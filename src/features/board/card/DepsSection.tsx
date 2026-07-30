import { useState } from "react";
import { type UseMutationResult } from "@tanstack/react-query";
import { type Card, type Profile, type HistoryEntry } from "../../../lib/types";
import { depInfoOf, dependentsOf, isBlocked, type DepMap, type RevDep } from "../../../lib/deps";
import { Check, Link2, Lock, Hourglass, X } from "lucide-react";

type PatchMut = UseMutationResult<void, Error, Partial<Card>, unknown>;

// Dependencias de la tarea: "Depende de" (bloqueo + alta/baja de vínculos, solo jefe)
// y "Habilita a" (tareas que dependen de esta).
export function DepsSection({ c, cards, team, depMap, revDeps, nameOf, isJefe, patch, hist }:
  { c: Card; cards: Card[]; team: Profile[]; depMap: DepMap; revDeps: RevDep[]; nameOf: (id: string) => string; isJefe: boolean; patch: PatchMut; hist: (txt: string) => HistoryEntry[] }) {
  const [depPerson, setDepPerson] = useState("");
  const [depTask, setDepTask] = useState("");

  const depIds = c.deps ?? [];

  return (
    <>
        {(depIds.length > 0 || isJefe) && (
          <>
            <h4 className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-ink2 mt-4 mb-2"><Link2 size={12} /> Depende de</h4>
            {isBlocked(c, cards, depMap) && (
              <div className="bg-warn-soft text-warn rounded-lg px-3 py-2 text-sm mb-2">
                Esta tarea está bloqueada: primero deben terminarse las tareas de las que depende.
              </div>
            )}
            {depIds.map((id) => {
              const d = depInfoOf(id, cards, nameOf, depMap);
              if (!d) return null;
              const okDep = d.status === "term";
              return (
                <div key={id} className="flex items-center gap-2 py-1 text-sm">
                  <span className={okDep ? "text-done" : "text-warn"}>{okDep ? <Check size={14} /> : <Lock size={13} />}</span>
                  <span className={okDep ? "text-ink2" : ""}>{d.title} <span className="text-ink2 text-xs">· {d.owner_name} · {okDep ? "terminada" : "sin terminar"}</span></span>
                  {isJefe && (
                    <button title="Quitar dependencia"
                      onClick={() => patch.mutate({ deps: depIds.filter((x) => x !== id), history: hist(`Quitó dependencia: "${d.title}"`) })}
                      className="ml-auto border border-line bg-surface2 rounded-lg px-1.5 py-1"><X size={12} /></button>
                  )}
                </div>
              );
            })}
            {depIds.length === 0 && <p className="text-ink2 text-sm m-0">Sin dependencias.</p>}
            {isJefe && (
              <div className="flex gap-1.5 mt-2">
                <select value={depPerson} onChange={(e) => { setDepPerson(e.target.value); setDepTask(""); }}
                  className="bg-surface2 border border-line rounded-lg px-2 py-1.5 text-sm">
                  <option value="">Persona…</option>
                  {team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
                <select value={depTask} onChange={(e) => setDepTask(e.target.value)} disabled={!depPerson}
                  className="flex-1 bg-surface2 border border-line rounded-lg px-2 py-1.5 text-sm disabled:opacity-60">
                  <option value="">Tarea…</option>
                  {cards.filter((x) => x.owner === depPerson && x.id !== c.id && !depIds.includes(x.id))
                    .map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
                </select>
                <button disabled={!depTask}
                  onClick={() => {
                    const d = depInfoOf(depTask, cards, nameOf, depMap);
                    patch.mutate({ deps: [...depIds, depTask], history: hist(`Vinculó dependencia: "${d?.title ?? "?"}"`) });
                    setDepTask("");
                  }}
                  className="border border-line bg-surface2 rounded-lg px-3 text-sm disabled:opacity-60">Vincular</button>
              </div>
            )}
          </>
        )}
        {(() => {
          const dependents = dependentsOf(c.id, cards, nameOf, revDeps, isJefe);
          return dependents.length > 0 && (
            <>
              <h4 className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-ink2 mt-4 mb-2"><Link2 size={12} /> Habilita a (dependen de esta tarea)</h4>
              {dependents.map((d) => (
                <div key={d.id} className="flex items-center gap-2 py-1 text-sm">
                  <span className={d.status === "term" ? "text-done" : "text-accent"}>{d.status === "term" ? <Check size={14} /> : <Hourglass size={13} />}</span>
                  <span className={d.status === "term" ? "text-ink2" : ""}>{d.title} <span className="text-ink2 text-xs">· {d.owner_name} · {d.status === "term" ? "terminada" : "esperándote"}</span></span>
                </div>
              ))}
            </>
          );
        })()}
    </>
  );
}
