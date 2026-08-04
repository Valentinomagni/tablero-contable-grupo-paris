import type { Card, Profile } from "../../lib/types";
import { enQueAnda, type AndarDePersona, type TareaAbierta } from "../../lib/en-que-anda";
import { equipoDe } from "../../lib/jerarquia";
import { personasVisibles } from "../../lib/visibilidad";
import { Panel } from "../../components/Panel";

// "En qué anda el equipo" — la vista.
//
// PARA QUÉ. Un jefe o un encargado necesita saber de un vistazo quién tiene qué abierto, para
// repartir la carga y dar una mano. Todo el cálculo vive en `src/lib/en-que-anda.ts`, que es
// puro y está testeado; acá sólo se dibuja.
//
// LO QUE ESTA PANTALLA NO HACE, Y ES DELIBERADO: no hay cronómetro, no hay orden por cantidad
// (el orden es alfabético) y no se destaca a quien no tiene nada abierto. Los motivos están
// escritos en el encabezado de la lib.
//
// EL ENCUADRE VA A LA VISTA, NO A UN TOOLTIP. Un texto escondido no encuadra nada: la línea de
// arriba es lo que evita que estas listas se lean como una nota de desempeño. Mismo criterio
// que usa el ICR en el Director.
//
// ALCANCE. Idéntico al del resto del sistema: el jefe ve a todos, el encargado ve a quienes le
// reportan. Se resuelve con `equipoDe`, que ya se usa en Admin para exactamente esto — no hay
// un criterio nuevo de visibilidad acá.

function Punto({ activo }: { activo: boolean }) {
  // El color marca ESTADO (en proceso / todavía no arrancó), nunca a la persona.
  return (
    <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
      style={{ background: activo ? "var(--done)" : "var(--ink2)" }} />
  );
}

function Fila({ t }: { t: TareaAbierta }) {
  return (
    <li className="flex items-center gap-2 py-1">
      <Punto activo={t.enProceso} />
      <span className="text-sm truncate">{t.title}</span>
      {/* Sin fecha de inicio no se escribe nada: que una tarea no la tenga no dice nada sobre
          quien la tiene, así que inventar "sin iniciar" sería afirmar lo que no se sabe. */}
      {t.dias !== null && (
        <span className="text-xs text-ink2 shrink-0">
          desde hace {t.dias} {t.dias === 1 ? "día" : "días"}
        </span>
      )}
    </li>
  );
}

function TarjetaPersona({ andar }: { andar: AndarDePersona }) {
  const n = andar.abiertas.length;
  return (
    <Panel>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <h3 className="text-base font-semibold truncate">{andar.persona.name}</h3>
        {n > 0 && (
          <span className="text-sm text-ink2 shrink-0">
            {n} {n === 1 ? "abierta" : "abiertas"} · {andar.enProceso} en proceso
          </span>
        )}
      </div>

      {n === 0 ? (
        // Sin destaque ni color: un tablero vacío puede ser una licencia, alguien que cerró
        // todo, o alguien que no está cargando su trabajo. El dato es ambiguo y se muestra
        // como lo que es.
        <p className="text-sm text-ink2">Sin tareas abiertas.</p>
      ) : (
        <ul className="list-none p-0 m-0">
          {andar.abiertas.map((t) => <Fila key={t.id} t={t} />)}
        </ul>
      )}

      {/* El aviso es SOBRE LA TAREA, nunca sobre la persona: "lleva 8 días sin moverse" le
          sirve igual a quien conduce y no dice que alguien haya fallado. */}
      {andar.sinMover && (
        <p className="text-xs text-ink2 mt-2.5 mb-0">
          {andar.sinMover.title} lleva {andar.sinMover.dias} días sin moverse.
        </p>
      )}
    </Panel>
  );
}

export function EnQueAnda({ cards, team, me }: { cards: Card[]; team: Profile[]; me: Profile }) {
  const equipo = me.role === "encargado" ? equipoDe(me.id, team) : team;
  const equipoVisible = personasVisibles(equipo);
  // `hoyISO` se calcula acá y entra por parámetro: la lib es pura y no mira el reloj.
  const filas = enQueAnda(cards, equipoVisible, new Date().toISOString());

  return (
    <div className="flex flex-col gap-3.5">
      <p className="text-xs text-ink2 mt-0 mb-0">
        Muestra en qué está trabajando cada persona para poder repartir la carga y dar una mano.
        No mide desempeño: una tarea puede llevar días por su naturaleza y no por quien la hace.
      </p>

      {filas.length === 0 ? (
        <Panel><p className="text-sm text-ink2 m-0">Todavía no hay personas en tu equipo.</p></Panel>
      ) : (
        <div className="grid gap-3.5 md:grid-cols-2">
          {filas.map((f) => <TarjetaPersona key={f.persona.id} andar={f} />)}
        </div>
      )}
    </div>
  );
}
