# Ficha por Empleado (Modal 👤 con Métricas 30d) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portar `openUserModal()` del legacy vanilla (`tablero-contable/app.js:1231-1295`) a React v2: modal de ficha de empleado (editar nombre/rol/puesto/ficha + 7 métricas de 30 días), abierto desde un botón "Ficha" en el subnav (solo jefes) y desde las filas de la tabla de Admin.

**Architecture:** Una función pura `userMetrics30d()` en `lib/metrics.ts` (testeable con Vitest), un componente `UserModal.tsx` que la consume vía los hooks de TanStack Query existentes y guarda con mutación a `profiles`, y cableado en `App.tsx` (estado `openUser` + botón subnav) y `Admin.tsx` (click en fila).

**Tech Stack:** React 18 + TypeScript + Tailwind 3 (tokens Paris: `bg-surface`, `border-line`, `text-ink2`, `accent`), TanStack Query 5, Supabase JS, lucide-react, Vitest.

## Global Constraints

- Directorio de trabajo: `C:\Users\Vmagni\Desktop\GRUPO PARIS\tablero-contable-v2` (repo git propio; los commits van AHÍ, nunca en `tablero-contable/`).
- TODO comando node/npm/npx empieza con: `export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"` (Bash tool, no PowerShell).
- NO tocar `tablero-contable/` (legacy en producción, congelado). NO tocar políticas RLS ni Supabase — la tabla `profiles` ya tiene columnas `puesto` y `ficha`, y RLS ya permite a jefes actualizar perfiles (el vanilla lo hace hoy).
- Sin emojis en UI: íconos Lucide (`UserRound`). Feedback inline con texto ✔/✖ como hace `Admin.tsx` (patrón existente).
- Tests con fechas fijas del PASADO (nunca `Date.now()` en fixtures) — regla anti-flaky por timezone del proyecto.
- Antes de cada commit: `npx tsc --noEmit` limpio + `npx vitest run` verde.
- Estilo: seguir exactamente los patrones de `CardModal.tsx` (overlay, dialog, clases) y `Admin.tsx` (tabla). No refactorizar nada existente.

---

### Task 1: Función pura `userMetrics30d` + tests

**Files:**
- Modify: `src/lib/metrics.ts` (agregar al final)
- Test: `src/lib/metrics.test.ts` (agregar al final; ya tiene 9 tests que deben seguir pasando)

**Interfaces:**
- Consumes: `kpiPct` (ya existe en `metrics.ts`), tipos `Card`, `Objective`, `ActivityLog` de `./types`.
- Produces: `export interface UserMetrics { done30: number; effort30: number; onTimePct: number | null; openToday: number; objWeight: number; kpiPerf: number | null; activity30: number }` y `export function userMetrics30d(cards: Card[], objectives: Objective[], activity: ActivityLog[], userId: string, now: number): UserMetrics`. Task 2 la importa.

- [ ] **Step 1: Escribir los tests que fallan**

Agregar al final de `src/lib/metrics.test.ts` (ajustar el import existente para sumar `userMetrics30d`):

```ts
import { userMetrics30d } from "./metrics";
import type { Card, Objective, ActivityLog } from "./types";

const NOW = new Date("2020-03-01T12:00:00Z").getTime(); // fecha fija del pasado

function mkCard(p: Partial<Card>): Card {
  return {
    id: "c1", owner: "u1", title: "t", status: "pend", description: "",
    checklist: [], comments: [], history: [], done_at: null, due_date: null,
    recurring: false, priority: "media", effort: 1, card_type: "normal",
    deps: [], created_at: "2020-01-01T00:00:00Z", ...p,
  };
}
function mkObj(p: Partial<Objective>): Objective {
  return {
    id: "o1", owner: "u1", title: "obj", description: "", weight: 0,
    kpi_name: "", kpi_unit: "", kpi_target: null, kpi_current: 0, notes: "", ...p,
  };
}

describe("userMetrics30d", () => {
  it("cuenta cerradas 30d, esfuerzo y % a tiempo; excluye operativas y otros dueños", () => {
    const cards: Card[] = [
      mkCard({ id: "a", status: "term", done_at: "2020-02-20T10:00:00Z", due_date: "2020-02-21", effort: 3 }), // a tiempo
      mkCard({ id: "b", status: "term", done_at: "2020-02-25T10:00:00Z", due_date: "2020-02-20", effort: 2 }), // tarde
      mkCard({ id: "c", status: "term", done_at: "2019-12-01T10:00:00Z", effort: 5 }),                          // fuera de 30d
      mkCard({ id: "d", status: "term", done_at: "2020-02-22T10:00:00Z", card_type: "operativa" }),             // operativa: excluida
      mkCard({ id: "e", status: "term", done_at: "2020-02-22T10:00:00Z", owner: "u2" }),                        // otro dueño
      mkCard({ id: "f", status: "proc" }),                                                                       // abierta
    ];
    const m = userMetrics30d(cards, [], [], "u1", NOW);
    expect(m.done30).toBe(2);
    expect(m.effort30).toBe(5);
    expect(m.onTimePct).toBe(50);
    expect(m.openToday).toBe(1);
  });

  it("onTimePct es null sin cerradas con vencimiento", () => {
    const cards = [mkCard({ status: "term", done_at: "2020-02-20T10:00:00Z" })];
    expect(userMetrics30d(cards, [], [], "u1", NOW).onTimePct).toBeNull();
  });

  it("peso de objetivos y rendimiento ponderado con tope 120", () => {
    const objs: Objective[] = [
      mkObj({ id: "o1", weight: 60, kpi_target: 10, kpi_current: 15 }), // 150% → capea a 120
      mkObj({ id: "o2", weight: 40, kpi_target: 10, kpi_current: 5 }),  // 50%
      mkObj({ id: "o3", owner: "u2", weight: 100 }),                    // otro dueño
    ];
    const m = userMetrics30d([], objs, [], "u1", NOW);
    expect(m.objWeight).toBe(100);
    expect(m.kpiPerf).toBe(92); // (120*60 + 50*40) / 100
  });

  it("kpiPerf es null sin KPIs medibles", () => {
    expect(userMetrics30d([], [mkObj({ weight: 50 })], [], "u1", NOW).kpiPerf).toBeNull();
  });

  it("suma actividad operativa de 30d del dueño", () => {
    const act: ActivityLog[] = [
      { id: "1", card_id: "x", owner: "u1", who_name: "V", qty: 3, note: "", at: "2020-02-25T10:00:00Z" },
      { id: "2", card_id: "x", owner: "u1", who_name: "V", qty: 4, note: "", at: "2019-12-01T10:00:00Z" }, // vieja
      { id: "3", card_id: "x", owner: "u2", who_name: "O", qty: 9, note: "", at: "2020-02-25T10:00:00Z" }, // otro
    ];
    expect(userMetrics30d([], [], act, "u1", NOW).activity30).toBe(3);
  });
});
```

- [ ] **Step 2: Verificar que fallan**

Run: `export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"; cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/tablero-contable-v2"; npx vitest run`
Expected: FAIL — `userMetrics30d` no está exportada (error de import). Los 9 tests previos siguen verdes.

- [ ] **Step 3: Implementar**

Agregar al final de `src/lib/metrics.ts` (ampliar el import de tipos de la línea 1 a `import type { Card, Objective, ActivityLog } from "./types";`):

```ts
// ---- ficha por empleado (métricas 30 días) ----
export interface UserMetrics {
  done30: number; effort30: number; onTimePct: number | null;
  openToday: number; objWeight: number; kpiPerf: number | null; activity30: number;
}
export function userMetrics30d(
  cards: Card[], objectives: Objective[], activity: ActivityLog[],
  userId: string, now: number,
): UserMetrics {
  const mes = now - 30 * 86400000;
  const his = cards.filter((c) => c.owner === userId && c.card_type !== "operativa");
  const done30 = his.filter((c) => c.status === "term" && c.done_at && new Date(c.done_at).getTime() >= mes);
  const conVto = done30.filter((c) => c.due_date);
  const aTiempo = conVto.filter((c) => new Date(c.done_at!) <= new Date(c.due_date + "T23:59:59"));
  const objs = objectives.filter((o) => o.owner === userId);
  const conKpi = objs.filter((o) => kpiPct(o) !== null && o.weight > 0);
  const kpiPerf = conKpi.length
    ? Math.round(conKpi.reduce((s, o) => s + Math.min(kpiPct(o)!, 120) * o.weight, 0) /
                 conKpi.reduce((s, o) => s + o.weight, 0))
    : null;
  return {
    done30: done30.length,
    effort30: done30.reduce((s, c) => s + (c.effort ?? 1), 0),
    onTimePct: conVto.length ? Math.round((aTiempo.length / conVto.length) * 100) : null,
    openToday: his.filter((c) => c.status !== "term").length,
    objWeight: objs.reduce((s, o) => s + o.weight, 0),
    kpiPerf,
    activity30: activity
      .filter((a) => a.owner === userId && now - new Date(a.at).getTime() < 30 * 86400000)
      .reduce((s, a) => s + a.qty, 0),
  };
}
```

- [ ] **Step 4: Verificar que pasan**

Run: `export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"; cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/tablero-contable-v2"; npx vitest run && npx tsc --noEmit`
Expected: 14 tests PASS (9 previos + 5 nuevos), tsc sin errores.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/tablero-contable-v2"
git add src/lib/metrics.ts src/lib/metrics.test.ts
git commit -m "feat: userMetrics30d — métricas 30d para ficha de empleado"
```

---

### Task 2: Componente `UserModal.tsx`

**Files:**
- Create: `src/features/admin/UserModal.tsx`

**Interfaces:**
- Consumes: `userMetrics30d`/`UserMetrics` (Task 1), hooks `useCards`, `useObjectives`, `useActivity` de `../../hooks/useData`, `supabase` de `../../lib/supabase`, tipos `Profile`/`Role` de `../../lib/types`.
- Produces: `export function UserModal({ user, meId, onClose }: { user: Profile; meId: string; onClose: () => void })`. Tasks 3 y 4 lo importan.

- [ ] **Step 1: Crear el componente**

Contenido completo de `src/features/admin/UserModal.tsx`:

```tsx
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import type { Profile, Role } from "../../lib/types";
import { useCards, useObjectives, useActivity } from "../../hooks/useData";
import { userMetrics30d } from "../../lib/metrics";

export function UserModal({ user: u, meId, onClose }: { user: Profile; meId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: cards = [] } = useCards();
  const { data: objectives = [] } = useObjectives();
  const { data: activity = [] } = useActivity();
  const [name, setName] = useState(u.name);
  const [role, setRole] = useState<Role>(u.role);
  const [puesto, setPuesto] = useState(u.puesto ?? "");
  const [ficha, setFicha] = useState(u.ficha ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; txt: string } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const m = userMetrics30d(cards, objectives, activity, u.id, Date.now());

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profiles")
        .update({ name: name.trim(), role, puesto: puesto.trim(), ficha: ficha.trim() })
        .eq("id", u.id);
      if (error) throw error;
    },
    onSuccess: () => { setMsg({ ok: true, txt: "✔ Guardado." }); qc.invalidateQueries({ queryKey: ["team"] }); },
    onError: (e: Error) => setMsg({ ok: false, txt: "✖ " + e.message }),
  });

  const onSave = () => {
    if (u.id === meId && role !== "jefe") {
      setMsg({ ok: false, txt: "✖ No podés quitarte el rol de jefe a vos mismo (pedíselo al otro jefe)." });
      return;
    }
    save.mutate();
  };

  const inputCls = "w-full bg-surface2 border border-line rounded-lg px-2.5 py-1.5 text-ink text-[13px]";
  const Stat = ({ v, label }: { v: string | number; label: string }) => (
    <div className="bg-surface2 border border-line rounded-xl px-3 py-2.5 text-center">
      <b className="block text-lg">{v}</b><span className="text-xs text-ink2">{label}</span>
    </div>
  );

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 bg-black/55 flex items-start justify-center p-[6vh_16px] z-40" style={{ backdropFilter: "blur(3px)" }}>
      <div role="dialog" aria-modal className="bg-surface border border-line rounded-[18px] w-full max-w-[560px] max-h-[85vh] overflow-y-auto p-[20px_22px]"
        style={{ boxShadow: "var(--shadow-lg)" }}>
        <h3 className="text-lg font-semibold m-0">{u.name}</h3>
        <div className="text-xs text-ink2 mb-3.5">{u.email || ""} · rol: {u.role}</div>

        <div className="grid gap-2.5 mb-1">
          <label className="text-[13px] text-ink2">Nombre
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </label>
          <label className="text-[13px] text-ink2">Rol
            <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={inputCls}>
              <option value="empleado">empleado</option>
              <option value="encargado">encargado</option>
              <option value="jefe">jefe</option>
            </select>
          </label>
          <label className="text-[13px] text-ink2">Puesto
            <input value={puesto} onChange={(e) => setPuesto(e.target.value)} placeholder="Ej: Analista impositivo" className={inputCls} />
          </label>
          <label className="text-[13px] text-ink2">Ficha de puesto — qué se espera de este perfil
            <textarea value={ficha} onChange={(e) => setFicha(e.target.value)} rows={5}
              placeholder="Responsabilidades, entregables, estándares…" className={inputCls + " resize-y"} />
          </label>
        </div>

        <h4 className="text-xs uppercase tracking-wide text-ink2 mt-4 mb-2">Métricas (últimos 30 días)</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <Stat v={m.done30} label="Tareas cerradas" />
          <Stat v={m.effort30} label="Esfuerzo cerrado" />
          <Stat v={m.onTimePct !== null ? m.onTimePct + "%" : "—"} label="Cerradas a tiempo" />
          <Stat v={m.openToday} label="Abiertas hoy" />
          <Stat v={m.objWeight + "%"} label="Peso de objetivos" />
          <Stat v={m.kpiPerf !== null ? m.kpiPerf + "%" : "—"} label="Cumplimiento KPIs" />
          <Stat v={m.activity30} label="Actividad operativa (30 d)" />
        </div>

        {msg && <p className={"text-sm mt-3 " + (msg.ok ? "text-done" : "text-danger")}>{msg.txt}</p>}
        <div className="flex gap-2 mt-4">
          <button onClick={onSave} disabled={save.isPending}
            className="bg-accent text-white rounded-lg px-3.5 py-2 text-[13px] font-semibold disabled:opacity-60">
            {save.isPending ? "Guardando…" : "Guardar cambios"}
          </button>
          <button onClick={onClose} className="ml-auto border border-line bg-surface2 rounded-lg px-3.5 py-2 text-[13px]">Cerrar</button>
        </div>
      </div>
    </div>
  );
}
```

Nota: si `text-danger`/`text-done`/`bg-accent` no existen como clases en `tailwind.config.js`, revisar los nombres exactos de los tokens ahí y usar los equivalentes (en `Admin.tsx` ya se usa `text-done`; `CardModal.tsx` usa los mismos patrones).

- [ ] **Step 2: Verificar compilación**

Run: `export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"; cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/tablero-contable-v2"; npx tsc --noEmit && npx vitest run`
Expected: sin errores, 14 tests PASS. (El componente aún no se usa; TS no marca módulos sin usar como error.)

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/tablero-contable-v2"
git add src/features/admin/UserModal.tsx
git commit -m "feat: componente UserModal (ficha de empleado con métricas 30d)"
```

---

### Task 3: Botón "Ficha" en subnav (App.tsx, solo jefes)

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `UserModal` (Task 2), ícono `UserRound` de lucide-react, `Profile` de `./lib/types`.
- Produces: estado `openUser: Profile | null` que Task 4 reutiliza vía prop `onOpenUser` de Admin.

- [ ] **Step 1: Cablear estado y botón**

En `src/App.tsx`:

1. Imports — ampliar la línea 2 y agregar dos imports:
```tsx
import { ClipboardList, Target, TrendingUp, UserRound } from "lucide-react";
import { UserModal } from "./features/admin/UserModal";
import type { Card, Profile } from "./lib/types";  // reemplaza el import type existente de Card
```

2. Junto a los otros useState (después de `const [openCard, setOpenCard] = useState<Card | null>(null);`):
```tsx
const [openUser, setOpenUser] = useState<Profile | null>(null);
```

3. En el `subnav` (dentro del fragmento `<>...</>` de `isPersonView`, después del tercer `<SubTab>`):
```tsx
{isJefe && person && (
  <button onClick={() => setOpenUser(person)}
    className="flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[13px] border bg-surface2 border-line text-ink2 transition">
    <UserRound size={14} /> Ficha
  </button>
)}
```

4. Al final del JSX, junto a `{openCard && <CardModal .../>}`:
```tsx
{openUser && <UserModal user={fullTeam.find((t) => t.id === openUser.id) ?? openUser} meId={me.id} onClose={() => setOpenUser(null)} />}
```
(El lookup en `fullTeam` hace que el modal muestre datos frescos tras guardar e invalidar la query `team`.)

- [ ] **Step 2: Verificar**

Run: `export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"; cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/tablero-contable-v2"; npx tsc --noEmit && npx vitest run`
Expected: limpio, 14 PASS.

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/tablero-contable-v2"
git add src/App.tsx
git commit -m "feat: botón Ficha en subnav de jefe abre UserModal"
```

---

### Task 4: Click en fila de Admin abre la ficha

**Files:**
- Modify: `src/features/admin/Admin.tsx`
- Modify: `src/App.tsx` (una línea)

**Interfaces:**
- Consumes: estado `openUser`/`setOpenUser` de Task 3.
- Produces: prop `onOpenUser: (u: Profile) => void` en `Admin`.

- [ ] **Step 1: Modificar Admin.tsx**

Firma (línea 7):
```tsx
export function Admin({ team, meName, onOpenUser }: { team: Profile[]; meName: string; onOpenUser: (u: Profile) => void }) {
```

Fila de la tabla (línea 36) — agregar click y cursor:
```tsx
<tr key={u.id} onClick={() => onOpenUser(u)} className="border-t border-line cursor-pointer hover:bg-surface2">
```

Título de la sección (línea 28) — paridad con vanilla:
```tsx
<h2 className="text-xs uppercase tracking-wide text-ink2 font-semibold mb-2.5">Equipo — clic en una persona para editar su ficha</h2>
```

- [ ] **Step 2: Pasar la prop en App.tsx**

Línea del render de Admin:
```tsx
: view === "__admin" ? <Admin team={fullTeam} meName={me.name} onOpenUser={setOpenUser} />
```

- [ ] **Step 3: Verificar**

Run: `export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"; cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/tablero-contable-v2"; npx tsc --noEmit && npx vitest run`
Expected: limpio, 14 PASS.

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/tablero-contable-v2"
git add src/features/admin/Admin.tsx src/App.tsx
git commit -m "feat: filas de Admin abren la ficha del empleado"
```

---

### Task 5: Verificación e2e + build

**Files:** ninguno (solo verificación).

- [ ] **Step 1: Build**

Run: `export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"; cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/tablero-contable-v2"; npm run build`
Expected: build OK, bundle ~138-142KB gzip.

- [ ] **Step 2: Levantar dev y abrir preview**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/tablero-contable-v2"
(npm run dev > /tmp/vite.log 2>&1 &); sleep 8; grep localhost /tmp/vite.log
```
Luego `mcp__Claude_Browser__preview_start` con `{url:"http://localhost:PUERTO/"}`.

- [ ] **Step 3: Login e2e como jefe**

Con `javascript_tool`, usar el setter de prototipo del elemento (NUNCA `.value=` directo ni `window.HTMLInputElement.prototype`):
```js
function fill(el,v){const d=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el),"value");d.set.call(el,v);el.dispatchEvent(new Event("input",{bubbles:true}));}
```
Credenciales: `jefe1@grupoparis.com` / `Paris2026!`.

- [ ] **Step 4: Verificar la feature por DOM (el screenshot tool timeoutea, no usarlo)**

1. Navegar al tablero de una persona (click en sidebar) → confirmar por `read_page`/`javascript_tool` que el subnav muestra el botón "Ficha".
2. Click en "Ficha" → verificar que el dialog contiene "Métricas (últimos 30 días)" y 7 stats con números.
3. Cambiar "Puesto" a un valor de prueba, Guardar → verificar texto "✔ Guardado."; reabrir el modal y confirmar que persiste. Restaurar el valor original y guardar de nuevo.
4. Ir a Administración → click en una fila → se abre el mismo modal.
5. Con la sesión de jefe1 sobre su propio perfil: cambiar rol a "empleado" y Guardar → debe aparecer "✖ No podés quitarte el rol de jefe a vos mismo…" y NO guardar.
6. Escape y click en overlay cierran el modal.

- [ ] **Step 5: Cerrar dev server y reportar**

Matar el proceso de vite (`preview_stop` / kill del background). Reportar resultados con evidencia (texto del DOM leído), no afirmaciones.

---

## Self-Review (hecho al escribir el plan)

- **Cobertura vs vanilla `openUserModal()`:** formulario (nombre/rol/puesto/ficha) ✔, 7 métricas idénticas ✔, guard anti auto-democión ✔, refetch de team tras guardar (vía invalidateQueries, mejor que el refetch manual del vanilla) ✔, apertura desde subnav (app.js:443-447) ✔ y desde tabla admin (app.js:1170) ✔.
- **Placeholders:** ninguno — todo el código está inline.
- **Consistencia de tipos:** `UserMetrics`/`userMetrics30d` (Task 1) coinciden con el consumo en Task 2; `onOpenUser: (u: Profile) => void` (Task 4) coincide con `setOpenUser` (`Dispatch<SetStateAction<Profile | null>>` acepta `Profile`) ✔.
- **Riesgo conocido:** nombres exactos de clases de token (`text-danger`, `bg-accent`) — verificar contra `tailwind.config.js` en Task 2 Step 2; el resto de clases ya se usan en `CardModal.tsx`/`Admin.tsx`.
