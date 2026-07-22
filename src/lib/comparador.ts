// Comparador de marcas y sucursales en el tiempo (spec 28, Fase C, Task 5). Función PURA:
// toda la data entra por parámetros, sin fetch — consumida por Comparador.tsx.
// La ventana de `meses` se ancla en el mes más reciente CON DATOS (no en `new Date()`),
// igual criterio que tendenciaDiferencias en arqueo.ts: la función queda pura y los tests
// estables sin importar cuándo se corran.
import type { CardArchive, Profile } from "./types";
import { marcaDe } from "./segmento";
import { archivesParaMetricas } from "./visibilidad";

export interface ComparativaMes {
  mes: string;
  porMarca: Record<string, number>;
  porSucursal: Record<string, number>;
}

// % de cumplimiento (term / total) sobre un set de cards ya filtrado (excluye operativas).
// Un grupo sin cards (mes sin actividad de esa marca/sucursal) simplemente no aparece en el
// Record del mes — evita división por cero y evita mostrar un 0% engañoso que sugeriría
// "no cumplió" cuando en realidad no hubo tareas de esa dimensión ese mes.
function cumplPct(cards: { status: string }[]): number | null {
  if (!cards.length) return null;
  const term = cards.filter((c) => c.status === "term").length;
  return Math.round((term / cards.length) * 100);
}

export function comparativaMensual(
  archives: CardArchive[], profiles: Profile[], meses: number,
): ComparativaMes[] {
  const byId = new Map(profiles.map((p) => [p.id, p]));

  // Criterio único de métricas históricas (visibilidad.ts): fuera los ocultos, el centinela
  // "Sin asignar" cuenta. Antes acá se usaba esVisible(), que además sacaba al centinela, y
  // esta comparativa no coincidía con el cumplimiento histórico de analizarMes().
  const vivos = archivesParaMetricas(archives, profiles)
    .filter((a) => a.card.card_type !== "operativa");
  if (!vivos.length) return [];

  // Ventana de `meses`, anclada en el mes más reciente con datos (no en "hoy").
  const anchor = vivos.reduce((max, a) => (a.mes > max ? a.mes : max), vivos[0].mes);
  const mesesUnicos = [...new Set(vivos.map((a) => a.mes))].sort();
  const anchorPos = mesesUnicos.indexOf(anchor);
  const ventana = mesesUnicos.slice(Math.max(0, anchorPos - meses + 1), anchorPos + 1);
  const ventanaSet = new Set(ventana);

  const porMes = new Map<string, CardArchive[]>();
  for (const a of vivos) {
    if (!ventanaSet.has(a.mes)) continue;
    (porMes.get(a.mes) ?? porMes.set(a.mes, []).get(a.mes)!).push(a);
  }

  return ventana.map((mes) => {
    const items = porMes.get(mes) ?? [];
    const porMarcaGrupos = new Map<string, { status: string }[]>();
    const porSucursalGrupos = new Map<string, { status: string }[]>();
    for (const a of items) {
      const marca = marcaDe(a.card, byId);
      if (marca) (porMarcaGrupos.get(marca) ?? porMarcaGrupos.set(marca, []).get(marca)!).push(a.card);
      const dueño = byId.get(a.owner);
      const sucursal = a.card.sucursal ?? dueño?.sucursal ?? null;
      if (sucursal) (porSucursalGrupos.get(sucursal) ?? porSucursalGrupos.set(sucursal, []).get(sucursal)!).push(a.card);
    }
    const porMarca: Record<string, number> = {};
    for (const [k, cs] of porMarcaGrupos) {
      const pct = cumplPct(cs);
      if (pct !== null) porMarca[k] = pct;
    }
    const porSucursal: Record<string, number> = {};
    for (const [k, cs] of porSucursalGrupos) {
      const pct = cumplPct(cs);
      if (pct !== null) porSucursal[k] = pct;
    }
    return { mes, porMarca, porSucursal };
  });
}
