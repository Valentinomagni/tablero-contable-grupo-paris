// Panel de seguimiento de delegaciones (spec 28 Fase C, J7): el jefe delega una tarea y
// pierde el rastro. Detecta las tarjetas espejo creadas por DelegarModal (vía filasCompartida
// en shared.ts) y muestra cuánto hace que no se mueven. Es seguimiento de TAREAS, no
// vigilancia de personas: el copy debe hablar de "esta tarea", nunca de la persona.
import type { Card, Profile } from "./types";
import { isShared } from "./shared";
import { esVisible } from "./visibilidad";
import { toARTDate } from "./metrics";

// Texto exacto que escribe filasCompartida() en el history al delegar. Debe coincidir
// literalmente con shared.ts — si cambia ahí, hay que actualizar este regex también.
const RE_DELEGADA = /^Tarea compartida — delegada por (.+?) · con /;

function delegadorDe(c: Pick<Card, "history">): string | null {
  const h = (c.history ?? []).find((e) => RE_DELEGADA.test(e.txt));
  if (!h) return null;
  const m = h.txt.match(RE_DELEGADA);
  return m ? m[1] : null;
}

function diasEntre(desdeISO: string, hastaISO: string): number {
  const a = new Date(desdeISO + "T00:00:00Z").getTime();
  const b = new Date(hastaISO + "T00:00:00Z").getTime();
  return Math.round((b - a) / 86400000);
}

export interface DelegacionViva {
  card: Card;
  de: Profile | null;
  a: Profile | null;
  diasSinMover: number;
  trabada: boolean;
}

export function delegacionesVivas(cards: Card[], profiles: Profile[], hoyISO: string): DelegacionViva[] {
  const visibles = new Set(profiles.filter(esVisible).map((p) => p.id));

  return cards
    .filter((c) => c.status !== "term")
    .filter((c) => isShared(c))
    .filter((c) => visibles.has(c.owner))
    .map((c) => {
      const history = c.history ?? [];
      const delegadorName = delegadorDe(c);
      const de = delegadorName ? profiles.find((p) => p.name === delegadorName) ?? null : null;
      const a = profiles.find((p) => p.id === c.owner) ?? null;

      const ultima = history.length ? history[history.length - 1] : null;
      const diasSinMover = ultima ? Math.max(0, diasEntre(toARTDate(ultima.at), hoyISO)) : 0;
      const trabada = diasSinMover >= 5;

      return { card: c, de, a, diasSinMover, trabada };
    })
    .filter((d) => d.de ? visibles.has(d.de.id) : true);
}
