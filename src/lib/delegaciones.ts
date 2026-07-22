// Panel de seguimiento de delegaciones (spec 28 Fase C, J7): el jefe delega una tarea y
// pierde el rastro. Detecta las tarjetas espejo creadas por DelegarModal (vía filasCompartida
// en shared.ts) y muestra cuánto hace que no se mueven. Es seguimiento de TAREAS, no
// vigilancia de personas: el copy debe hablar de "esta tarea", nunca de la persona.
import type { Card, Profile } from "./types";
import { isShared, sharedLinkId, delegadorDe } from "./shared";
import { esVisible } from "./visibilidad";
import { toARTDate } from "./metrics";

function diasEntre(desdeISO: string, hastaISO: string): number {
  const a = new Date(desdeISO + "T00:00:00Z").getTime();
  const b = new Date(hastaISO + "T00:00:00Z").getTime();
  return Math.round((b - a) / 86400000);
}

export interface DelegacionViva {
  card: Card; // tarjeta representativa (la primera hermana visible) para abrir el detalle
  de: Profile | null;
  a: Profile[]; // destinatarios: todos los dueños de las tarjetas espejo de esta delegación
  diasSinMover: number;
  trabada: boolean;
}

export function delegacionesVivas(cards: Card[], profiles: Profile[], hoyISO: string): DelegacionViva[] {
  const visibles = new Set(profiles.filter(esVisible).map((p) => p.id));

  // Cada delegación (linkId) crea una tarjeta espejo por participante (filasCompartida en
  // shared.ts). Agrupamos por linkId para mostrar UNA fila por delegación, no una por espejo.
  const grupos = new Map<string, Card[]>();
  for (const c of cards) {
    if (!isShared(c)) continue;
    if (!visibles.has(c.owner)) continue; // el destinatario oculto no cuenta como espejo visible
    const id = sharedLinkId(c)!;
    const arr = grupos.get(id);
    if (arr) arr.push(c);
    else grupos.set(id, [c]);
  }

  const out: DelegacionViva[] = [];
  for (const espejos of grupos.values()) {
    // Si TODOS los espejos ya terminaron, la delegación está resuelta: no aparece.
    // Si alguno sigue vivo, la delegación sigue viva aunque otros participantes ya terminaron.
    const vivos = espejos.filter((c) => c.status !== "term");
    if (vivos.length === 0) continue;

    const primero = vivos[0];
    const delegadorName = delegadorDe(primero);
    // LIMITACIÓN CONOCIDA: el history guarda el NOMBRE del delegador, no su id, así que si
    // dos personas comparten nombre esto matchea la primera que encuentre en profiles. No
    // hay forma exacta de resolverlo sin cambiar el esquema (guardar delegador_id en el
    // history). No se corrige ahora — documentado a propósito (ver review commit d4b7169).
    const de = delegadorName ? profiles.find((p) => p.name === delegadorName) ?? null : null;
    if (de && !visibles.has(de.id)) continue;

    const a = [...new Set(espejos.map((c) => c.owner))]
      .map((ownerId) => profiles.find((p) => p.id === ownerId) ?? null)
      .filter((p): p is Profile => p !== null);

    // diasSinMover = MÁXIMO entre los espejos vivos: la delegación sigue trabada mientras
    // exista al menos un participante que no movió su copia.
    const diasSinMover = Math.max(
      0,
      ...vivos.map((c) => {
        const history = c.history ?? [];
        const ultima = history.length ? history[history.length - 1] : null;
        return ultima ? diasEntre(toARTDate(ultima.at), hoyISO) : 0;
      }),
    );
    const trabada = diasSinMover >= 5;

    out.push({ card: primero, de, a, diasSinMover, trabada });
  }

  return out;
}
