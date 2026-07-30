import { useState } from "react";
import { KeyRound, Copy, Check } from "lucide-react";
import { supabase, SUPABASE_URL } from "../../lib/supabase";
import { generarClaveTemporal } from "../../lib/clave-temporal";
import { mensajeUsuario } from "../../lib/fallas";

// Blanqueo de contraseña, para que nadie quede afuera esperando a que alguien abra Supabase.
//
// DECISIONES QUE IMPORTAN:
//
// · La clave se muestra UNA VEZ y no se guarda en ningún lado. No va a la base, no va a
//   localStorage, no queda en el historial. Si se pierde, se genera otra — que es barato.
//   Guardarla "por las dudas" convertiría a la app en el lugar donde están las contraseñas
//   de todos en texto plano.
//
// · Hay confirmación antes de hacerlo. Es una acción sobre la cuenta de otra persona y la
//   deja sin poder entrar hasta que reciba la clave nueva: no puede pasar por un clic al pasar.
//
// · El texto dice explícitamente que hay que avisarle a la persona. El blanqueo sin aviso deja
//   a alguien sin poder trabajar y sin entender por qué.

export function BlanquearClave({ userId, nombre }: { userId: string; nombre: string }) {
  const [confirmando, setConfirmando] = useState(false);
  const [clave, setClave] = useState<string | null>(null);
  const [copiada, setCopiada] = useState(false);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function blanquear() {
    setEnviando(true);
    setError("");
    const nueva = generarClaveTemporal();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch(SUPABASE_URL + "/functions/v1/blanquear-clave", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + (session?.access_token ?? ""),
        },
        body: JSON.stringify({ userId, nuevaClave: nueva }),
      });
      const out = await r.json();
      if (!r.ok) { setError(out.error ?? "No se pudo blanquear la contraseña."); return; }
      setClave(nueva);
      setConfirmando(false);
    } catch (e) {
      setError(mensajeUsuario(e, "blanquear la contraseña"));
    } finally {
      setEnviando(false);
    }
  }

  function copiar() {
    if (!clave) return;
    navigator.clipboard?.writeText(clave)
      .then(() => { setCopiada(true); setTimeout(() => setCopiada(false), 2000); })
      .catch(() => { /* sin permiso de portapapeles: la clave igual está a la vista */ });
  }

  // Después del blanqueo: la clave, una sola vez.
  if (clave) {
    return (
      <div className="border-t border-line mt-4 pt-4">
        <p className="text-sm text-ink m-0 mb-2">
          Contraseña nueva de <b>{nombre}</b>. <b>Anotala ahora</b>: no se guarda en ningún lado
          y no se puede volver a ver.
        </p>
        <div className="flex items-center gap-2">
          <code className="bg-surface2 border border-line rounded-lg px-3 py-2 text-base tracking-wider select-all">{clave}</code>
          <button onClick={copiar}
            className="inline-flex items-center gap-1.5 border border-line bg-surface2 rounded-lg px-3 py-2 text-sm font-semibold">
            {copiada ? <Check size={14} /> : <Copy size={14} />} {copiada ? "Copiada" : "Copiar"}
          </button>
        </div>
        <p className="text-xs text-ink2 m-0 mt-2">
          Pasásela por donde se hablen habitualmente y pedile que la cambie cuando entre.
        </p>
      </div>
    );
  }

  return (
    <div className="border-t border-line mt-4 pt-4">
      {!confirmando ? (
        <>
          <button onClick={() => setConfirmando(true)}
            className="inline-flex items-center gap-1.5 border border-line bg-surface2 rounded-lg px-3 py-2 text-sm font-semibold text-ink">
            <KeyRound size={14} /> Blanquear contraseña
          </button>
          <p className="text-xs text-ink2 m-0 mt-1.5">
            Genera una contraseña nueva para que {nombre} pueda volver a entrar.
          </p>
        </>
      ) : (
        <>
          <p className="text-sm text-ink m-0 mb-2">
            La contraseña actual de <b>{nombre}</b> deja de servir en el momento. Hasta que le
            pases la nueva, no va a poder entrar.
          </p>
          <div className="flex gap-2">
            <button onClick={blanquear} disabled={enviando}
              className="rounded-lg px-3.5 py-2 text-sm font-semibold bg-accent text-[color:var(--accent-ink)] disabled:opacity-50">
              {enviando ? "Generando…" : "Sí, blanquear"}
            </button>
            <button onClick={() => setConfirmando(false)} disabled={enviando}
              className="border border-line bg-surface2 rounded-lg px-3.5 py-2 text-sm font-semibold text-ink">
              Cancelar
            </button>
          </div>
        </>
      )}
      {error && <p className="text-sm text-danger m-0 mt-2">{error}</p>}
    </div>
  );
}
