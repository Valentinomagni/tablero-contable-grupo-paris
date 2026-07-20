# Spec 26 — Refinamiento funcional, estructura organizacional y análisis ejecutivo

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Estructura organizacional dinámica (marcas + sucursales sin tocar código), agrupación como preferencia pura de vista, análisis ejecutivo real para el jefe, y corrección de 4 bugs funcionales (impresión, novedades, avisos, categorías de empleado).

**Architecture:** Se mantiene la arquitectura actual (React 19 + TanStack Query + Supabase con RLS). Las listas configurables (marcas/sucursales) viven en la tabla `settings` (JSON) con fallback hardcodeado defensivo — cero migración de datos para marcas; una migración aditiva (27) agrega `sucursal` a `profiles`/`cards` y la policy de DELETE en `announcements`. Todo cálculo analítico va en `src/lib/*.ts` puro con tests vitest; la UI solo consume.

**Tech Stack:** React 19, TypeScript, TanStack Query 5, Supabase (Postgres + RLS), Tailwind (tokens monocromo), vitest, Lucide.

## Global Constraints

- **Cero emojis en UI** — solo íconos Lucide o SVG propios monocromáticos (memoria del proyecto).
- Estética premium negro/blanco marca Paris; tokens CSS existentes (`--accent`, `bg-chip`, etc.).
- **Código defensivo ante migración no aplicada:** toda columna nueva es `?` opcional en types y la UI no debe crashear si la columna no existe todavía.
- Textos de UI en español rioplatense (vos), consistentes con los existentes.
- TDD: test que falla → implementación mínima → test verde → commit. Gates de pre-commit: `tsc -b` + vitest (los corre el hook).
- No romper: 296 tests existentes deben seguir verdes en cada commit.
- Las migraciones SQL van en archivos `migracion-27-*.sql` en la raíz, para que el usuario las corra a mano en Supabase SQL Editor (no puede correr CLI, PC sin admin). Actualizar `docs/PASOS-MANUALES.md` en la misma tarea que crea la migración.
- `Comment`/interfaces internas: no re-exportar nada que no se importe fuera del archivo.

---

### Task 1: Migración 27 — sucursales, marcas dinámicas y delete de avisos

**Files:**
- Create: `migracion-27-organizacion.sql`
- Modify: `docs/PASOS-MANUALES.md` (agregar sección "Migración 27")
- Modify: `src/lib/types.ts` (campos `sucursal`)

**Interfaces:**
- Produces: columnas `profiles.sucursal text null`, `cards.sucursal text null`; key `'organizacion'` en `settings` con `{ marcas: string[], sucursales: string[] }`; policy DELETE en `announcements`.
- Produces (TS): `Profile.sucursal?: string | null`, `Card.sucursal?: string | null`.

- [ ] **Step 1: Escribir la migración**

```sql
-- ============================================================
-- Migración 27 — Estructura organizacional (spec 26)
-- Correr COMPLETO en Supabase → SQL Editor. Idempotente.
-- 1) Sucursal en personas y tareas (texto libre, validado por la app
--    contra la lista configurable de settings).
-- 2) Listas configurables de marcas y sucursales en settings
--    (key 'organizacion') → agregar marcas/sucursales SIN tocar código.
-- 3) Poder ELIMINAR avisos (hoy solo se archivan): DELETE para autor o jefe.
-- ============================================================

alter table public.profiles add column if not exists sucursal text;
alter table public.cards    add column if not exists sucursal text;

insert into public.settings (key, value)
values ('organizacion', jsonb_build_object(
  'marcas',     jsonb_build_array('General','Peugeot','Citroën','Chevrolet','Honda','Postventa'),
  'sucursales', jsonb_build_array('San Luis Capital','Villa Mercedes','Merlo','San Juan')
))
on conflict (key) do nothing;  -- si ya existe, NO pisa lo configurado

-- DELETE de avisos: el autor o un jefe (misma regla que puedeEditarAnuncio en el front)
drop policy if exists "announcements_delete" on public.announcements;
create policy "announcements_delete" on public.announcements
  for delete using ( owner_id = auth.uid() or public.es_jefe() );
```

- [ ] **Step 2: Verificar sintaxis localmente** (no hay DB local: revisar a ojo que cada statement sea idempotente — `if not exists` / `on conflict` / `drop policy if exists`). Confirmar contra `migracion-23-*.sql` que `settings` tiene PK en `key` (si la PK fuese `id`, cambiar el `on conflict` a la columna correcta ANTES de commitear).

- [ ] **Step 3: Types defensivos**

En `src/lib/types.ts`, dentro de `Profile` agregar al final: `sucursal?: string | null;`
Dentro de `Card` (después de `requiere_resultado`): `sucursal?: string | null; // sucursal (migración 27)`

- [ ] **Step 4: `tsc -b` limpio y tests verdes** — Run: `npx tsc -b && npx vitest run` → 296 passed.

- [ ] **Step 5: Documentar en PASOS-MANUALES.md** — agregar sección con el texto: correr `migracion-27-organizacion.sql` en SQL Editor; verificación: `select value from settings where key='organizacion';` debe devolver el JSON con 6 marcas y 4 sucursales.

- [ ] **Step 6: Commit** — `git commit -m "feat(org): migración 27 — sucursales, listas configurables y delete de avisos"`

---

### Task 2: Lib de organización dinámica (`organizacion.ts`)

**Files:**
- Create: `src/lib/organizacion.ts`
- Create: `src/lib/organizacion.test.ts`
- Modify: `src/hooks/useData.ts` (hook `useOrganizacion`)
- Modify: `src/lib/jerarquia.ts` (MARCAS pasa a ser fallback)

**Interfaces:**
- Produces: `interface Organizacion { marcas: string[]; sucursales: string[] }`; `DEFAULT_ORG: Organizacion`; `parseOrganizacion(raw: unknown): Organizacion` (defensiva: raw null/malformado → DEFAULT_ORG); hook `useOrganizacion(): Organizacion`.
- Consumes: `settings` key `'organizacion'` (Task 1).

- [ ] **Step 1: Test que falla** (`src/lib/organizacion.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { parseOrganizacion, DEFAULT_ORG } from "./organizacion";

describe("parseOrganizacion", () => {
  it("devuelve defaults si el valor es null o malformado", () => {
    expect(parseOrganizacion(null)).toEqual(DEFAULT_ORG);
    expect(parseOrganizacion({ marcas: "no-array" })).toEqual(DEFAULT_ORG);
  });
  it("acepta un JSON válido y filtra entradas vacías", () => {
    const o = parseOrganizacion({ marcas: ["General", " ", "Postventa"], sucursales: ["Merlo"] });
    expect(o.marcas).toEqual(["General", "Postventa"]);
    expect(o.sucursales).toEqual(["Merlo"]);
  });
  it("los defaults incluyen Postventa y las 4 sucursales", () => {
    expect(DEFAULT_ORG.marcas).toContain("Postventa");
    expect(DEFAULT_ORG.sucursales).toEqual(["San Luis Capital", "Villa Mercedes", "Merlo", "San Juan"]);
  });
});
```

- [ ] **Step 2: Correr y ver que falla** — `npx vitest run src/lib/organizacion.test.ts` → FAIL (módulo no existe).

- [ ] **Step 3: Implementación**

```ts
// src/lib/organizacion.ts
// Estructura organizacional CONFIGURABLE (spec 26 item 1): las listas de marcas y
// sucursales viven en settings (key 'organizacion') para poder agregar nuevas sin
// tocar código. Este parser es la única puerta: siempre devuelve algo usable.
export interface Organizacion { marcas: string[]; sucursales: string[] }

export const DEFAULT_ORG: Organizacion = {
  marcas: ["General", "Peugeot", "Citroën", "Chevrolet", "Honda", "Postventa"],
  sucursales: ["San Luis Capital", "Villa Mercedes", "Merlo", "San Juan"],
};

const lista = (v: unknown): string[] | null =>
  Array.isArray(v) && v.every((x) => typeof x === "string")
    ? (v as string[]).map((s) => s.trim()).filter(Boolean)
    : null;

export function parseOrganizacion(raw: unknown): Organizacion {
  if (typeof raw !== "object" || raw === null) return DEFAULT_ORG;
  const marcas = lista((raw as Record<string, unknown>).marcas);
  const sucursales = lista((raw as Record<string, unknown>).sucursales);
  if (!marcas || !sucursales) return DEFAULT_ORG;
  return { marcas, sucursales };
}
```

- [ ] **Step 4: Hook en `useData.ts`** (mismo patrón que `useSettings`):

```ts
// settings key='organizacion': { marcas: string[], sucursales: string[] } (spec 26)
export function useOrganizacion(): Organizacion {
  const { data } = useQuery({
    queryKey: ["organizacion"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("settings").select("value").eq("key", "organizacion").maybeSingle();
      return parseOrganizacion(data?.value);
    },
  });
  return data ?? DEFAULT_ORG;
}
```
(importar `parseOrganizacion, DEFAULT_ORG, type Organizacion` desde `../lib/organizacion`)

- [ ] **Step 5: `jerarquia.ts`** — reemplazar la línea `export const MARCAS = [...]` por:

```ts
// DEPRECATED como fuente de verdad: la lista viva sale de useOrganizacion() (settings).
// Queda como fallback de orden para el organigrama cuando settings aún no cargó.
export const MARCAS = ["General", "Peugeot", "Citroën", "Chevrolet", "Honda", "Postventa"];
```

- [ ] **Step 6: Tests verdes** — `npx vitest run` → todo verde (los tests de jerarquía no dependen del contenido exacto de MARCAS; si alguno sí, actualizarlo agregando Postventa).

- [ ] **Step 7: Commit** — `git commit -m "feat(org): lib organizacion configurable + hook useOrganizacion"`

---

### Task 3: Consumir marcas/sucursales dinámicas en UI (UserModal, Admin→Equipo, Organigrama)

**Files:**
- Modify: `src/features/admin/UserModal.tsx` (select de marca desde `useOrganizacion`; NUEVO select de sucursal idéntico debajo)
- Modify: `src/features/admin/Admin.tsx:138-139` (columnas **Marca** y **Sucursal** en la tabla de equipo)
- Modify: `src/features/organigrama/Organigrama.tsx` (orden de marcas desde `useOrganizacion().marcas` en vez de `MARCAS`; chip de sucursal junto a cada persona si tiene)

**Interfaces:**
- Consumes: `useOrganizacion()` (Task 2), `Profile.sucursal` (Task 1).
- Produces: UserModal guarda `sucursal` en el update/insert de `profiles` (mismo objeto donde hoy va `marca`).

- [ ] **Step 1: UserModal** — donde hoy hace `{MARCAS.map(...)}` (línea ~137) usar `org.marcas.map(...)` con `const org = useOrganizacion()`. Duplicar el bloque del select para `sucursal` (label "Sucursal", opción vacía "— Sin sucursal —"). Incluir `sucursal: draft.sucursal || null` en el payload de guardado.
- [ ] **Step 2: Admin tabla** — en `Admin.tsx:139` agregar `<th className="text-left px-4 py-2.5">Marca</th><th className="text-left px-4 py-2.5">Sucursal</th>` y en el `<tr>` del body las celdas `<td className="px-4 py-2.5 text-[13px]">{p.marca ?? "—"}</td><td className="px-4 py-2.5 text-[13px]">{p.sucursal ?? "—"}</td>` (respetar clases de las celdas vecinas).
- [ ] **Step 3: Organigrama** — reemplazar `MARCAS.indexOf` por `org.marcas.indexOf`; junto al nombre de cada persona, si `p.sucursal`, chip `<span className="text-[10.5px] text-ink2 bg-chip rounded px-1.5 py-0.5">{p.sucursal}</span>`.
- [ ] **Step 4: `tsc -b` + vitest verdes; smoke visual con preview** (Board → Admin → Organigrama sin crashear **con y sin** migración aplicada: la base de prueba puede no tener `sucursal` todavía → `p.sucursal` undefined es válido).
- [ ] **Step 5: Commit** — `git commit -m "feat(org): marcas/sucursales dinámicas en equipo, alta de usuario y organigrama"`

---

### Task 4: Segmentar tablero y reportes por marca/sucursal

**Files:**
- Create: `src/lib/segmento.ts` + `src/lib/segmento.test.ts`
- Modify: `src/features/board/Board.tsx` (filtro por marca/sucursal para jefe/encargado, junto al filtro de categoría existente)
- Modify: `src/features/reporte/Reporte.tsx` (selector de segmento arriba; filtra las cards de entrada)

**Interfaces:**
- Produces: `filtrarPorSegmento(cards: Card[], profiles: Profile[], seg: { marca?: string | null; sucursal?: string | null }): Card[]` — una card pertenece a una marca/sucursal por su propio campo, con fallback al del dueño (`profiles.find(p => p.id === c.owner)`).

- [ ] **Step 1: Test que falla** (`segmento.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { filtrarPorSegmento } from "./segmento";
import type { Card, Profile } from "./types";

const p = (id: string, marca: string | null, sucursal: string | null) =>
  ({ id, marca, sucursal, name: id, role: "empleado", email: "", username: null, puesto: "", ficha: "", manager_id: null }) as Profile;
const c = (id: string, owner: string, extra: Partial<Card> = {}) =>
  ({ id, owner, title: id, status: "pend", description: "", checklist: [], comments: [], history: [],
     done_at: null, due_date: null, recurring: false, priority: "media", effort: 1,
     card_type: "normal", deps: [], created_at: "2026-07-01", ...extra }) as Card;

describe("filtrarPorSegmento", () => {
  const profiles = [p("ana", "Peugeot", "Merlo"), p("bo", "Honda", null)];
  const cards = [c("t1", "ana"), c("t2", "bo"), c("t3", "ana", { marca: "Honda" } as Partial<Card>)];
  it("sin segmento devuelve todo", () => {
    expect(filtrarPorSegmento(cards, profiles, {})).toHaveLength(3);
  });
  it("filtra por marca usando la de la card y si no la del dueño", () => {
    const r = filtrarPorSegmento(cards, profiles, { marca: "Honda" });
    expect(r.map((x) => x.id).sort()).toEqual(["t2", "t3"]);
  });
  it("filtra por sucursal del dueño", () => {
    expect(filtrarPorSegmento(cards, profiles, { sucursal: "Merlo" }).map((x) => x.id)).toEqual(["t1", "t3"]);
  });
});
```
Nota: `Card` no tiene `marca` propia hoy — el test fija la decisión: **agregar `marca?: string | null` a `Card`** en types (columna ya usable vía `cards.sucursal` de Task 1; para marca de card agregar `alter table public.cards add column if not exists marca text;` a `migracion-27` ANTES de esta task si no se hizo — hacerlo en Task 1 directamente: sumar esa línea al SQL).

- [ ] **Step 2: FAIL confirmado** → **Step 3: Implementación**

```ts
// src/lib/segmento.ts
// Segmentación por marca/sucursal (spec 26 item 1): la card manda; si no tiene,
// hereda la del dueño. null/undefined en el filtro = no filtrar por ese eje.
import type { Card, Profile } from "./types";

export function filtrarPorSegmento(
  cards: Card[], profiles: Profile[],
  seg: { marca?: string | null; sucursal?: string | null },
): Card[] {
  if (!seg.marca && !seg.sucursal) return cards;
  const byId = new Map(profiles.map((p) => [p.id, p]));
  return cards.filter((c) => {
    const dueño = byId.get(c.owner);
    const marca = c.marca ?? dueño?.marca ?? null;
    const sucursal = c.sucursal ?? dueño?.sucursal ?? null;
    if (seg.marca && marca !== seg.marca) return false;
    if (seg.sucursal && sucursal !== seg.sucursal) return false;
    return true;
  });
}
```

- [ ] **Step 4: UI Board** — junto al filtro de categoría existente, dos selects (solo cuando `profiles.length > 1` y rol jefe/encargado): "Todas las marcas" / lista de `org.marcas`; ídem sucursales. Estado local `useState`, aplicar `filtrarPorSegmento` antes de repartir en columnas.
- [ ] **Step 5: UI Reporte** — mismo par de selects con clase `no-print`; filtrar cards de entrada antes de calcular métricas; el título impreso agrega el segmento activo (ej. "— Peugeot · Merlo").
- [ ] **Step 6: Gates + commit** — `git commit -m "feat(org): segmentación por marca y sucursal en tablero y reporte"`

---

### Task 5: Agrupación de tarjetas como preferencia pura de vista

**Files:**
- Modify: `src/lib/agrupar.ts` + `src/lib/agrupar.test.ts`
- Modify: `src/lib/prefs.ts` (nueva key `agruparModo`)
- Modify: `src/features/board/Board.tsx:70-73,188-191,222-223`

**Interfaces:**
- Produces: `type ModoAgrupar = "ninguno" | "categoria" | "prioridad" | "marca"`; `agruparCards(cards: Card[], modo: ModoAgrupar, ctx: { profiles: Profile[] }): { grupo: string; cards: Card[] }[]` — REEMPLAZA la firma actual `(cards, categorias)`.
- El modo se guarda por usuario en localStorage (`PREF.agruparModo`); NUNCA modifica `status` ni ningún dato de la card (es solo cómo se pintan dentro de cada columna).

- [ ] **Step 1: Reescribir tests de `agrupar.test.ts`** para la nueva firma: modo `"ninguno"` devuelve `[{ grupo: "", cards }]`; `"categoria"` agrupa como hoy (Sin categoría al final); `"prioridad"` agrupa Alta/Media/Baja SIEMPRE (ya no como fallback implícito); `"marca"` agrupa por marca heredada del dueño (reusar la resolución de `segmento.ts`). Correr → FAIL.
- [ ] **Step 2: Implementar** la nueva `agruparCards` (switch por modo; extraer helper `marcaDe(c, byId)` compartido con segmento si queda DRY).
- [ ] **Step 3: `prefs.ts`** — agregar `agruparModo: NS + "agrupar-modo"` a `PREF`; en `migrarPrefs`, si `PREF.agrupar === "1"` y no existe modo, setear `"categoria"` (respeta la elección previa del usuario).
- [ ] **Step 4: Board** — reemplazar el toggle "Agrupar" por un select compacto (mismo estilo del botón actual) con las 4 opciones: "Sin agrupar / Categoría / Prioridad / Marca". `renderCard` no cambia; solo el wrapping de grupos.
- [ ] **Step 5: Gates + smoke visual + commit** — `git commit -m "feat(board): agrupación como preferencia de vista con 4 modos"`

---

### Task 6: Fix impresión del Reporte Ejecutivo (desktop en blanco)

**Files:**
- Modify: `src/index.css` (bloque `@media print` global) y/o `src/features/reporte/Reporte.tsx:66-76`
- Modify: `src/components/Shell.tsx` (identificar el contenedor con scroll)

**Diagnóstico previo (obligatorio, systematic-debugging):** en desktop el contenido está dentro de un layout con `aside` + `main` que muy probablemente usa `height: 100vh; overflow: auto` (grid del Shell). Chrome/Edge de escritorio al imprimir SOLO pagina el flujo normal del documento: un ancestro con `overflow: hidden/auto` y altura fija imprime únicamente la primera "ventana" → si el reporte arranca más abajo, sale en blanco. En mobile el layout colapsa a una columna sin ese overflow → imprime bien. **Verificar** con preview: `window.print()` en viewport desktop, y confirmar en DevTools → Rendering → Emulate CSS media: print.

- [ ] **Step 1: Reproducir** en preview desktop (resize_window 1280×800, emular print) y confirmar el ancestro culpable (inspeccionar computed `overflow`/`height` de `main` y del wrapper del Shell).
- [ ] **Step 2: Fix CSS global** en `src/index.css`:

```css
/* Impresión (spec 26 item 3): en desktop el layout con alto fijo + overflow
   recorta el flujo y la página sale en blanco. Al imprimir, TODO el árbol
   vuelve a flujo normal y solo queda el contenido imprimible. */
@media print {
  html, body, #root { height: auto !important; overflow: visible !important; }
  #root > div, main { display: block !important; height: auto !important;
    overflow: visible !important; max-height: none !important; }
  aside, header.no-print, .no-print { display: none !important; }
}
```
(ajustar los selectores exactos a lo que confirme el Step 1 — no adivinar: el selector debe apuntar al contenedor que se vio con overflow)

- [ ] **Step 3: Verificar en preview** — emulación print desktop muestra el reporte completo, más de una página si corresponde; mobile sigue OK.
- [ ] **Step 4: Commit** — `git commit -m "fix(reporte): impresión en blanco en desktop — overflow del layout al imprimir"`

---

### Task 7: Eliminar avisos con confirmación

**Files:**
- Modify: `src/features/tablon/Tablon.tsx` (botón Eliminar + diálogo de confirmación)
- Modify: `src/lib/anuncios.ts` + `src/lib/anuncios.test.ts` (`puedeEliminarAnuncio` = misma regla que editar)

**Interfaces:**
- Consumes: policy DELETE de `announcements` (Task 1).
- Produces: `puedeEliminarAnuncio(a, meId, isJefe): boolean` (alias semántico de `puedeEditarAnuncio` — mantener función separada para que la regla pueda divergir a futuro).

- [ ] **Step 1: Test que falla** — en `anuncios.test.ts`: jefe puede eliminar ajeno; autor puede eliminar el suyo; empleado NO puede eliminar ajeno; legacy (`owner_id: null`) solo jefe. → FAIL.
- [ ] **Step 2: Implementar** `export const puedeEliminarAnuncio = puedeEditarAnuncio;` con comentario de por qué.
- [ ] **Step 3: UI** — en cada aviso (activo y archivado) donde `puedeEliminarAnuncio`, botón ícono `Trash2` (Lucide, 14px, `text-ink2 hover:text-danger`). Click abre confirmación inline (patrón existente del proyecto para confirmar: si hay `ArqueoResultDialog`-style o `window.confirm` en otros lados, seguir el patrón del código — buscar `confirm` en `src/features` y replicar; si no hay ninguno, mini-panel inline con "¿Eliminar definitivamente? Esta acción no se puede deshacer." + botones Cancelar / Eliminar en `bg-danger`). Mutación: `supabase.from("announcements").delete().eq("id", id)` + invalidate `["announcements"]` + toast "Aviso eliminado definitivamente".
- [ ] **Step 4: Gates + smoke + commit** — `git commit -m "feat(tablon): eliminar avisos definitivamente con confirmación"`

---

### Task 8: Corregir el sistema de novedades

**Causa raíz (ya diagnosticada):** `App.tsx:67` re-muestra el modal solo si `APP_VERSION` cambió, pero `version.ts` quedó en 2.1.0 desde el 16/07 mientras hubo N deploys → nunca volvió a aparecer. El changelog es manual y nadie lo alimenta.

**Files:**
- Modify: `src/lib/version.ts` + `src/lib/version.test.ts`
- Create: `docs/RELEASE.md` (proceso de release: 5 líneas)

**Interfaces:**
- Produces: `APP_VERSION` derivada del changelog: `export const APP_VERSION = CHANGELOG[0].version;` — imposible que diverjan. Entrada nueva 2.2.0 con todo lo shippeado desde el 16/07.

- [ ] **Step 1: Test que falla**

```ts
// version.test.ts (agregar)
it("APP_VERSION es siempre la primera entrada del changelog", () => {
  expect(APP_VERSION).toBe(CHANGELOG[0].version);
});
it("el changelog está ordenado descendente y sin versiones duplicadas", () => {
  const vs = CHANGELOG.map((e) => e.version);
  expect(new Set(vs).size).toBe(vs.length);
  const nums = vs.map((v) => v.split(".").map(Number));
  for (let i = 1; i < nums.length; i++) {
    const [a, b] = [nums[i - 1], nums[i]];
    expect(a[0] * 1e6 + a[1] * 1e3 + a[2]).toBeGreaterThan(b[0] * 1e6 + b[1] * 1e3 + b[2]);
  }
});
```

- [ ] **Step 2: Implementar** — reordenar `version.ts`: primero `CHANGELOG`, después `export const APP_VERSION = CHANGELOG[0].version;`. Agregar entrada `2.2.0` (fecha 2026-07-20) con los cambios en lenguaje de usuario: "Mi día: tu agenda del día con lo urgente primero", "Arqueo de caja con resultado (con/sin diferencias) desde tu día", "Avisos con prioridad y vencimiento en el tablón", "Registro de vacaciones y cobertura", "Buscador rápido con Ctrl+K", "Plantillas de tareas frecuentes", "Reporte imprimible mejorado", etc. (redactar desde los merges reales de git log desde el 16/07 — el implementador DEBE correr `git log --oneline --since=2026-07-16` y traducir a lenguaje de usuario, sin jerga).
- [ ] **Step 3: `docs/RELEASE.md`** — proceso: "Antes de cada push a main que agregue funcionalidad visible: 1) agregar entrada arriba de CHANGELOG en `src/lib/version.ts` (versión semver + fecha + cambios en lenguaje de usuario); 2) el test de version.test.ts valida el orden; 3) al deployar, cada usuario ve el modal de Novedades una única vez automáticamente." Además: **agregar recordatorio en CLAUDE.md del repo** si existe, o crearlo con esa regla, para que futuros agentes bumpeen versión al deployar features.
- [ ] **Step 4: Gates + commit** — `git commit -m "fix(novedades): versión derivada del changelog + entrada 2.2.0 + proceso de release"`

---

### Task 9: Íconos monocromáticos de marca en el Organigrama

**Files:**
- Create: `src/components/MarcaIcon.tsx`
- Modify: `src/features/organigrama/Organigrama.tsx` (ícono junto al título de cada sección)

**Interfaces:**
- Produces: `MarcaIcon({ marca, size = 18 }: { marca: string; size?: number })` — devuelve SVG monocromo `currentColor`. **NO usar logos oficiales de las automotrices** (marcas registradas; además el spec pide "ícono o logotipo monocromático" consistente con la estética — un glifo geométrico propio cumple sin riesgo legal).

- [ ] **Step 1: Implementar el componente** con Lucide para lo semántico y monogramas propios para las marcas:

```tsx
// src/components/MarcaIcon.tsx
// Glifos monocromos por marca (spec 26 item 7). Deliberadamente NO son los
// logos oficiales (marcas registradas): son monogramas geométricos propios,
// mismo trazo que Lucide (stroke 2, currentColor) para consistencia visual.
import { Building2, Wrench } from "lucide-react";

const MONOGRAMA: Record<string, string> = {
  // letra inicial en un rombo/círculo — dibujadas como <text> centrado
  Peugeot: "P", Citroën: "C", Chevrolet: "CH", Honda: "H",
};

export function MarcaIcon({ marca, size = 18 }: { marca: string; size?: number }) {
  if (marca === "General") return <Building2 size={size} className="text-ink2 shrink-0" />;
  if (marca === "Postventa") return <Wrench size={size} className="text-ink2 shrink-0" />;
  const m = MONOGRAMA[marca];
  if (!m) return <Building2 size={size} className="text-ink2 shrink-0" />; // marca futura: fallback
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="text-ink2 shrink-0" aria-hidden>
      <rect x="2.5" y="2.5" width="19" height="19" rx="5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <text x="12" y="16" textAnchor="middle" fontSize={m.length > 1 ? 8.5 : 11} fontWeight="700"
        fill="currentColor" fontFamily="inherit">{m}</text>
    </svg>
  );
}
```

- [ ] **Step 2: Organigrama** — en `Seccion`, junto al `titulo`: `<MarcaIcon marca={titulo} size={18} />` dentro del header flex existente.
- [ ] **Step 3: Smoke visual en preview** (light + dark) — los 6 glifos alineados, mismo gris `text-ink2`, sin emojis.
- [ ] **Step 4: Commit** — `git commit -m "feat(organigrama): glifos monocromos por marca"`

---

### Task 10: Redefinir "Entregado a tiempo" (item 10)

**Decisión (análisis pedido por el spec):** el cálculo actual (`Reporte.tsx:28-29`) es correcto pero ilegible: no dice n, ni período, ni qué pasa con las tareas sin vencimiento. **No se elimina; se redefine la presentación y el denominador:** pasa a llamarse **"Puntualidad"** = de las tareas CERRADAS en los últimos 30 días que tenían vencimiento, % cerradas en fecha, mostrando `n` y excluidas. Si n < 3, mostrar "muestra chica (n)" en vez del gauge para no inducir decisiones con 1 dato.

**Files:**
- Create: `src/lib/puntualidad.ts` + `src/lib/puntualidad.test.ts`
- Modify: `src/features/reporte/Reporte.tsx` (usa la lib; subtítulo "X de Y con vencimiento · Z sin fecha")

**Interfaces:**
- Produces: `puntualidad(cards: Card[], hoyISO: string): { pct: number | null; n: number; enFecha: number; sinFecha: number; muestraChica: boolean }` — considera solo `status === "term"` con `done_at` en los últimos 30 días.

- [ ] **Step 1: Test que falla** — casos: sin cerradas → pct null; 2 cerradas con vto (1 en fecha) → pct 50, muestraChica true (n=2 < 3); 4 cerradas 3 en fecha → 75, muestraChica false; cerradas sin due_date cuentan en `sinFecha` y no en n; cerrada hace 40 días NO cuenta.
- [ ] **Step 2: Implementar** (reusar comparación `done_at <= due_date + "T23:59:59"` idéntica a `metrics.ts:41`).
- [ ] **Step 3: Reporte** — tarjeta del gauge: label "Puntualidad", subtítulo `${enFecha} de ${n} con vencimiento · ${sinFecha} sin fecha`; si `muestraChica`, texto "Pocos datos (n=X) para medir" sin gauge.
- [ ] **Step 4: Gates + commit** — `git commit -m "feat(reporte): 'Entregado a tiempo' redefinido como Puntualidad con n visible"`

---

### Task 11: Categorías para el empleado (item 11)

**Relevamiento previo del implementador:** confirmar con grep dónde se restringe hoy la UI de categorías (`categoria` en `NuevaTareaModal.tsx`, `CardModal.tsx`, `Board.tsx`) y si el gating es por rol. El objetivo: TODO usuario ve, asigna y filtra categorías en SU tablero.

**Files:**
- Modify: `src/features/board/NuevaTareaModal.tsx` (input/datalist de categoría visible para todos: datalist con `categoriasEnUso(misCards)` + texto libre)
- Modify: `src/features/board/CardModal.tsx` (ídem edición, si estaba gated)
- Modify: `src/features/board/Board.tsx` (chips de filtro por categoría visibles para empleado; ya existe `pasaFiltroCategoria` — quitar el gating por rol si lo hay)

**Interfaces:**
- Consumes: `categoriasEnUso`, `pasaFiltroCategoria` (`src/lib/categorias.ts`, ya existen y testeadas).

- [ ] **Step 1: Grep del gating actual** (`grep -n "categoria" src/features/board/*.tsx` + leer el contexto de rol). Documentar en el commit qué estaba restringido.
- [ ] **Step 2: Quitar el gating** y agregar el datalist en NuevaTareaModal: `<input list="cats" ...>` + `<datalist id="cats">{cats.map(...)}</datalist>`, guardando `categoria: v.trim() || null`.
- [ ] **Step 3: Smoke con usuario empleado en preview** (login empleado de prueba): crear tarea con categoría nueva, filtrar, agrupar por categoría (Task 5).
- [ ] **Step 4: Gates + commit** — `git commit -m "feat(categorias): visibles, asignables y filtrables para todos los roles"`

---

### Task 12: Análisis ejecutivo de cierre mensual + Rendimiento Promedio (items 8 y 9)

**Indicadores elegidos (análisis pedido por el spec — implementar estos 9, dejar el resto documentado como fase 2):**
1. **Cumplimiento general** (% term / total del mes) — ya existe base en `cierreStats`.
2. **Cumplimiento por marca** y 3. **por sucursal** (usa `filtrarPorSegmento`, Task 4).
4. **Cumplimiento por persona** (tabla: term/total, vencidas — detecta sobrecarga y bloqueos).
5. **Carga de trabajo** (tareas abiertas por persona vs. mediana del equipo → "distribución del trabajo" con marca de desvío >1.5×).
6. **Diferencias de arqueo** (de `task_occurrences.resultado='dif'` del mes: cantidad + suma `dif_importe`).
7. **Vencidas al cierre** (abiertas con due < fin de mes).
8. **Evolución vs. mes anterior** (delta de cumplimiento general, flecha ↑↓ con `TrendingUp/Down` Lucide).
9. **Rendimiento Promedio (item 9):** promedio histórico de cumplimiento general sobre TODOS los meses en `cards_archive` + el actual; el mes en curso se compara: "Este mes: 82% · Tu promedio histórico: 76% (+6)". Responde "¿mejoramos?".

**Files:**
- Create: `src/lib/analisis.ts` + `src/lib/analisis.test.ts` (funciones puras)
- Create: `src/features/reporte/AnalisisMensual.tsx` (sección nueva del Reporte, imprimible)
- Modify: `src/features/reporte/Reporte.tsx` (renderiza `<AnalisisMensual />` debajo de lo existente)
- Modify: `src/hooks/useArchive.ts` — verificar que puede traer TODOS los archives del equipo para el jefe (si hoy es por owner, agregar `useArchiveEquipo()` con la misma query sin filtro de owner; RLS ya deja al jefe ver todo)

**Interfaces:**
- Produces:
```ts
export interface AnalisisMes {
  cumplimiento: number;                     // 0-100
  porMarca: { marca: string; pct: number; total: number }[];
  porSucursal: { sucursal: string; pct: number; total: number }[];
  porPersona: { id: string; nombre: string; pct: number; total: number; vencidas: number; abiertas: number }[];
  distribucion: { medianaAbiertas: number; sobrecargados: string[] };  // ids con >1.5× mediana
  arqueos: { difs: number; montoTotal: number };
  vencidas: number;
  deltaMesAnterior: number | null;          // puntos de % vs mes previo (null si no hay archivo)
  promedioHistorico: number | null;         // Rendimiento Promedio (item 9)
}
export function analizarMes(cards: Card[], profiles: Profile[], occs: TaskOccurrence[],
  archives: CardArchive[], year: number, month1a12: number): AnalisisMes
```

- [ ] **Step 1: Tests que fallan** — mínimo 8 casos (uno por indicador + bordes: sin archives → delta/promedio null; equipo de 1 → sin sobrecargados; sin difs → montoTotal 0). Datos sintéticos con los helpers de fábrica del test de segmento.
- [ ] **Step 2: Implementar `analizarMes`** — pura, sin fetch; toda la data entra por parámetros.
- [ ] **Step 3: UI `AnalisisMensual.tsx`** — grid de tarjetas estilo Reporte (reusar `cardSh`, `Gauge`, tokens): fila de KPIs (cumplimiento + delta + promedio histórico), tabla por persona (columnas Persona/Cerradas/Vencidas/Abiertas/% — `tnum`), dos mini-tablas por marca y sucursal, tarjeta de arqueos con `AlertTriangle` si `difs > 0`, bloque "Distribución" listando sobrecargados ("Revisar carga de: Ana (12 abiertas, mediana 5)"). Todo imprimible (sin `no-print`).
- [ ] **Step 4: Wiring en Reporte** con datos reales (`useData` cards+profiles, `useOccurrences` del mes, archives del equipo).
- [ ] **Step 5: Gates + smoke (preview como jefe) + commit** — `git commit -m "feat(reporte): análisis ejecutivo mensual + rendimiento promedio histórico"`

---

### Task 13: Propuesta de rediseño del cierre mensual (item 12 — SOLO documento, gate con el usuario)

**El spec pide proponer ANTES de modificar. Esta task NO toca código de producción.**

**Files:**
- Create: `docs/PROPUESTA-CIERRE-MENSUAL.md`

- [ ] **Step 1: Relevar el flujo actual** (leer `Cierre.tsx`, `PlantillaCierre.tsx`, `plantilla.ts`, `archivo.ts`, `HistorialMes.tsx`, función `archivar_mes` y `reset_recurrentes_seguro`) y describirlo en 1 diagrama de texto: qué se duplica y por qué se percibe redundante (checklist de cierre vs. archivo vs. reset de recurrentes = 3 conceptos que el usuario ve como "cerrar el mes" repetido).
- [ ] **Step 2: Redactar 2 alternativas** con ventajas/desventajas y esfuerzo:
  - **A (recomendada, evolutiva):** "Cierre unificado": una sola pantalla "Cerrar mes" que muestra el estado de los 3 pasos (checklist de cierre → archivo → reset) como wizard de un botón, todo automático vía el cron ya configurado; el usuario solo VE el resultado. Sin cambio de esquema; solo UI + copy. Bajo esfuerzo, mantiene todo el histórico.
  - **B (profunda):** el mes como entidad (`months` table con estado abierto/cerrado); cambia esquema, RLS y todos los flujos. Alto esfuerzo, más "correcto" conceptualmente, no aporta datos nuevos.
- [ ] **Step 3: Terminar el doc con la recomendación (A) y presentárselo al usuario. NO implementar hasta su ok explícito.**
- [ ] **Step 4: Commit** — `git commit -m "docs(cierre): propuesta de rediseño del cierre mensual (gate de decisión)"`

---

### Task 14: Revisión de propuestas anteriores (item 13) + mejoras arquitectónicas

**Files:**
- Create: `docs/AUDITORIA-MODULOS.md` (13.1: tabla módulo → uso actual → utilidad propuesta; NINGUNO se elimina)
- Modify: `src/App.tsx` (13.2: code-splitting con `React.lazy` de las vistas pesadas: Reporte, Organigrama, Calendario, Bitacora, HistorialMes — ataca el warning de bundle >500 kB ya detectado)
- Modify: `docs/PROPUESTAS-MEJORA.md` (marcar estado real de P1-P12 post-spec-26)

**Interfaces:**
- Produces: `const Reporte = lazy(() => import("./features/reporte/Reporte"))` etc. + `<Suspense fallback={<div className="px-6 py-8 text-ink2 text-sm">Cargando…</div>}>` alrededor del router de vistas. Requiere `export default` en cada vista lazy (agregar `export default X` al final de cada archivo SIN quitar el export nombrado, para no romper imports de tests).

- [ ] **Step 1: Auditoría 13.1** — recorrer `src/features/*` y documentar en la tabla: para módulos de poco uso aparente (Notas, Bitacora, Semana, MiMes, DepGraph) proponer integración (ej.: Notas linkeable desde CardModal; Semana como default de empleados los lunes). Sin tocar código.
- [ ] **Step 2: Code-splitting** — aplicar lazy a las 5 vistas; `npm run build` y comparar tamaño del chunk principal antes/después (anotar cifras en el commit). Verificar en preview que cada vista carga.
- [ ] **Step 3: Actualizar PROPUESTAS-MEJORA.md** con el estado (implementado en spec 25/26 / pendiente / bloqueado por usuario).
- [ ] **Step 4: Gates completos** (`tsc -b`, vitest, build, smoke) + commit — `git commit -m "perf(app): code-splitting de vistas + auditoría de módulos (13.1-13.3)"`

---

### Task 15: Cierre — versión 2.2.0, docs y push

- [ ] **Step 1:** Confirmar que la entrada 2.2.0 del changelog (Task 8) menciona lo NUEVO de este spec (sucursales, análisis mensual, agrupación por modos, eliminar avisos, íconos organigrama). Ajustar si falta.
- [ ] **Step 2:** `docs/PASOS-MANUALES.md` al día: migración 27 es el ÚNICO paso manual nuevo de este spec.
- [ ] **Step 3:** Gates finales completos: `npx tsc -b && npx vitest run && npm run build && npm run -s lint`.
- [ ] **Step 4:** Usar superpowers:finishing-a-development-branch — presentar al usuario el resumen y pushear a main (deploy Cloudflare) SOLO con su ok.

---

## Self-Review (hecho al escribir el plan)

- **Cobertura del spec:** item 1→Tasks 1-4; 2→Task 5; 3→Task 6; 4→Task 7; 5→Task 8; 6→Task 3; 7→Task 9; 8→Task 12; 9→Task 12; 10→Task 10; 11→Task 11; 12→Task 13 (gate); 13.1-13.3→Task 14. Requisitos generales (impacto DB, permisos, tests, docs) embebidos por task. ✔
- **Sin placeholders:** cada task tiene archivos exactos, código o especificación de firma completa; donde el implementador debe relevar antes (gating de categorías, selector del fix de print), el paso lo dice explícitamente como paso de diagnóstico, no como TODO. ✔
- **Consistencia de tipos:** `filtrarPorSegmento` (Task 4) la consumen Tasks 5 y 12; `useOrganizacion` (Task 2) la consumen Tasks 3-5; `Card.marca`/`Card.sucursal` se agregan en Task 1 (el SQL de marca de card queda anotado en Task 4 Step 1 para sumarlo a la migración 27 desde el inicio — el implementador de Task 1 DEBE incluir `alter table public.cards add column if not exists marca text;`). ✔
