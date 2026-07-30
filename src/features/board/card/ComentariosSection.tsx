import { useState } from "react";
import { type UseMutationResult } from "@tanstack/react-query";
import { supabase } from "../../../lib/supabase";
import { type Card, type Profile } from "../../../lib/types";
import { fmtDateTime } from "../../../lib/metrics";
import { detectarMenciones } from "../../../lib/menciones";
import { Avatar } from "../../../lib/ui";

type PatchMut = UseMutationResult<void, Error, Partial<Card>, unknown>;

// Anotaciones (comentarios) de la tarea, con autocompletado de menciones @ y aviso a los mencionados.
export function ComentariosSection({ c, team, meId, meName, patch }:
  { c: Card; team: Profile[]; meId?: string; meName: string; patch: PatchMut }) {
  const [newCm, setNewCm] = useState("");

  // Guarda una anotación y, si menciona a compañeros con @, les avisa (best-effort).
  const anotar = () => {
    const txt = newCm.trim();
    if (!txt) return;
    patch.mutate({ comments: [...c.comments, { who: meName, when: new Date().toISOString(), txt }] });
    // Menciones @ → notificación tipo "sistema" (spec #8). Si la tabla notifications
    // no existe aún, la anotación se guarda igual y esto se descarta en silencio.
    try {
      const ids = detectarMenciones(txt, team).filter((id) => id !== meId);
      if (ids.length) {
        void supabase.from("notifications").insert(ids.map((id) => ({
          owner: id, tipo: "sistema" as const, titulo: `Te mencionaron en «${c.title}»`,
          detalle: txt.slice(0, 120), card_id: c.id, leida: false,
        }))).then(undefined, () => { /* secundario: se ignora */ });
      }
    } catch { /* secundario: se ignora */ }
    setNewCm("");
  };

  // Autocompletar @: si el texto termina en "@" + letras, sugerir miembros que matcheen.
  const mencionFrag = (() => {
    const m = newCm.match(/@(\p{L}*)$/u);
    return m ? m[1].normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase() : null;
  })();
  const mencionSug = mencionFrag === null ? [] : team.filter((u) => {
    if (u.id === meId) return false;
    const full = u.name.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
    return full.startsWith(mencionFrag) || full.split(/\s+/).some((p) => p.startsWith(mencionFrag));
  }).slice(0, 5);
  const completarMencion = (name: string) => setNewCm((t) => t.replace(/@\p{L}*$/u, "@" + name + " "));

  return (
    <>
        <h4 className="text-xs uppercase tracking-wide text-ink2 mt-4 mb-2">Anotaciones</h4>
        {c.comments.map((m, n) => (
            <div key={n} className="bg-surface2 rounded-lg px-2.5 py-2 mb-1.5">
              <div className="text-xs font-semibold">{m.who} <span className="font-normal text-ink2 tnum">· {fmtDateTime(m.when)}</span></div>
              <p className="text-sm m-0 mt-0.5">{m.txt}</p>
            </div>
          ))}
        <div className="flex gap-1.5 mt-1 relative">
          <input value={newCm} onChange={(e) => setNewCm(e.target.value)} placeholder="Ej: no avanza porque falta… (mencioná con @)"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); anotar(); } }}
            className="flex-1 bg-surface2 border border-line rounded-lg px-2.5 py-1.5 text-sm" />
          {mencionSug.length > 0 && (
            <div className="absolute left-0 bottom-full mb-1 z-10 min-w-[180px] bg-surface2 border border-line rounded-lg shadow-lg overflow-hidden">
              {mencionSug.map((u) => (
                <button key={u.id} type="button" onMouseDown={(e) => { e.preventDefault(); completarMencion(u.name); }}
                  className="flex items-center gap-2 w-full text-left px-2.5 py-1.5 text-sm hover:bg-accent-soft hover:text-accent">
                  <Avatar name={u.name} size={18} /><span className="truncate">{u.name}</span>
                </button>
              ))}
            </div>
          )}
          <button onClick={anotar}
            className="border border-line bg-surface2 rounded-lg px-3 text-sm">Anotar</button>
        </div>
    </>
  );
}
