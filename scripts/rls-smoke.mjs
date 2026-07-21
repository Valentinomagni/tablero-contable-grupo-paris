#!/usr/bin/env node
// ============================================================
// Smoke de RLS — verificación manual, solo lectura (+ 1 delete
// a un id inexistente que nunca puede borrar nada real).
//
// Uso (PowerShell), con cuentas de PRUEBA (nunca reales):
//   $env:SUPABASE_URL = "https://xxxx.supabase.co"
//   $env:SUPABASE_ANON_KEY = "sb_publishable_..."
//   $env:TEST_EMPLEADO_EMAIL = "empleado.prueba@..."
//   $env:TEST_EMPLEADO_PASS = "..."
//   $env:TEST_JEFE_EMAIL = "jefe.prueba@..."
//   $env:TEST_JEFE_PASS = "..."
//   node scripts/rls-smoke.mjs
//
// No agrega dependencias: usa fetch nativo de Node 18+.
// No hace nada destructivo: solo GET/SELECT y un DELETE contra un
// id que no existe (00000000-0000-0000-0000-000000000001).
// ============================================================

const REQUIRED_ENV = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "TEST_EMPLEADO_EMAIL",
  "TEST_EMPLEADO_PASS",
  "TEST_JEFE_EMAIL",
  "TEST_JEFE_PASS",
];

function printUsageAndExit() {
  console.error(`
Smoke de RLS — faltan variables de entorno.

Seteá estas 6 variables (PowerShell) con cuentas de PRUEBA, no reales:

  $env:SUPABASE_URL = "https://xxxx.supabase.co"
  $env:SUPABASE_ANON_KEY = "sb_publishable_..."
  $env:TEST_EMPLEADO_EMAIL = "empleado.prueba@ejemplo.com"
  $env:TEST_EMPLEADO_PASS = "contraseña-de-prueba"
  $env:TEST_JEFE_EMAIL = "jefe.prueba@ejemplo.com"
  $env:TEST_JEFE_PASS = "contraseña-de-prueba"
  node scripts/rls-smoke.mjs

No se tocó nada.
`);
  process.exit(1);
}

const env = process.env;
const missing = REQUIRED_ENV.filter((k) => !env[k]);
if (missing.length > 0) {
  console.error("Faltan: " + missing.join(", "));
  printUsageAndExit();
}

const SUPABASE_URL = env.SUPABASE_URL.replace(/\/+$/, "");
const ANON_KEY = env.SUPABASE_ANON_KEY;

const results = [];
function report(name, status, detail) {
  results.push({ name, status, detail: detail || "" });
}

async function login(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
    },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(
      `login falló para ${email}: ${res.status} ${JSON.stringify(data)}`
    );
  }
  return { token: data.access_token, userId: data.user?.id };
}

function authHeaders(token) {
  return {
    apikey: ANON_KEY,
    Authorization: `Bearer ${token}`,
  };
}

async function main() {
  console.log("Smoke de RLS — iniciando (solo lectura + 1 delete a id inexistente)\n");

  let empleado, jefe;
  try {
    empleado = await login(env.TEST_EMPLEADO_EMAIL, env.TEST_EMPLEADO_PASS);
    report("login empleado", "PASS", `user id ${empleado.userId}`);
  } catch (e) {
    report("login empleado", "FAIL", e.message);
  }

  try {
    jefe = await login(env.TEST_JEFE_EMAIL, env.TEST_JEFE_PASS);
    report("login jefe", "PASS", `user id ${jefe.userId}`);
  } catch (e) {
    report("login jefe", "FAIL", e.message);
  }

  // (a) empleado: GET cards → solo propias (owner === su user id)
  if (empleado) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/cards?select=id,owner`, {
        headers: authHeaders(empleado.token),
      });
      const cards = await res.json().catch(() => null);
      if (!res.ok || !Array.isArray(cards)) {
        report("empleado: cards visibles", "FAIL", `respuesta inesperada: ${res.status} ${JSON.stringify(cards)}`);
      } else {
        const ajenas = cards.filter((c) => c.owner !== empleado.userId);
        if (ajenas.length > 0) {
          report(
            "empleado: cards visibles",
            "FAIL",
            `vio ${ajenas.length} card(s) ajenas de owners: ${[...new Set(ajenas.map((c) => c.owner))].join(", ")}`
          );
        } else {
          report("empleado: cards visibles", "PASS", `${cards.length} card(s), todas propias`);
        }
      }
    } catch (e) {
      report("empleado: cards visibles", "FAIL", e.message);
    }
  } else {
    report("empleado: cards visibles", "SKIP", "sin sesión de empleado");
  }

  // (b) empleado: DELETE a announcement inexistente → nunca debe borrar nada real
  if (empleado) {
    try {
      const fakeId = "00000000-0000-0000-0000-000000000001";
      const res = await fetch(`${SUPABASE_URL}/rest/v1/announcements?id=eq.${fakeId}`, {
        method: "DELETE",
        headers: {
          ...authHeaders(empleado.token),
          Prefer: "return=representation",
        },
      });
      const body = await res.json().catch(() => null);
      if (res.status >= 200 && res.status < 300) {
        if (Array.isArray(body) && body.length === 0) {
          report("empleado: delete id inexistente", "PASS", "200/204 con 0 filas afectadas");
        } else {
          report(
            "empleado: delete id inexistente",
            "FAIL",
            `¡devolvió filas! esto no debería pasar con un id inexistente: ${JSON.stringify(body)}`
          );
        }
      } else if (res.status >= 400) {
        report("empleado: delete id inexistente", "PASS", `rechazado con ${res.status} (esperado o aceptable)`);
      } else {
        report("empleado: delete id inexistente", "FAIL", `status inesperado ${res.status}`);
      }
    } catch (e) {
      report("empleado: delete id inexistente", "FAIL", e.message);
    }
  } else {
    report("empleado: delete id inexistente", "SKIP", "sin sesión de empleado");
  }

  // (c) empleado: SELECT schema_migrations → debe funcionar (policy migración 28) o 404 si aún no corrió
  if (empleado) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/schema_migrations?select=id&limit=1`, {
        headers: authHeaders(empleado.token),
      });
      if (res.status === 404) {
        report("empleado: select schema_migrations", "SKIP", "tabla no existe — migración 28 no corrida aún");
      } else if (res.ok) {
        report("empleado: select schema_migrations", "PASS", `status ${res.status}`);
      } else {
        report("empleado: select schema_migrations", "FAIL", `status ${res.status}`);
      }
    } catch (e) {
      report("empleado: select schema_migrations", "FAIL", e.message);
    }
  } else {
    report("empleado: select schema_migrations", "SKIP", "sin sesión de empleado");
  }

  // (d) jefe: GET cards → puede ver más (o igual, si solo hay las suyas)
  if (jefe) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/cards?select=id,owner`, {
        headers: authHeaders(jefe.token),
      });
      const cards = await res.json().catch(() => null);
      if (!res.ok || !Array.isArray(cards)) {
        report("jefe: cards visibles", "FAIL", `respuesta inesperada: ${res.status} ${JSON.stringify(cards)}`);
      } else {
        const owners = new Set(cards.map((c) => c.owner));
        report(
          "jefe: cards visibles",
          "PASS",
          `${cards.length} card(s) de ${owners.size} owner(s) distinto(s) — reportá si esperabas ver más`
        );
      }
    } catch (e) {
      report("jefe: cards visibles", "FAIL", e.message);
    }
  } else {
    report("jefe: cards visibles", "SKIP", "sin sesión de jefe");
  }

  // Tabla de resultados
  console.log("\nResultado:\n");
  const width = Math.max(...results.map((r) => r.name.length), 10);
  for (const r of results) {
    console.log(`${r.status.padEnd(6)} ${r.name.padEnd(width)}  ${r.detail}`);
  }

  const anyFail = results.some((r) => r.status === "FAIL");
  console.log(anyFail ? "\nHay FAIL(s) — revisar arriba." : "\nTodo OK (o SKIP donde correspondía).");
  process.exit(anyFail ? 1 : 0);
}

main().catch((e) => {
  console.error("Error inesperado:", e);
  process.exit(1);
});
