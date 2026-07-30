import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Modal } from "../../components/Modal";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, SUPABASE_URL } from "../../lib/supabase";
import type { ActivityLog, Card, Profile, Role } from "../../lib/types";
import { useObjectives, useOrganizacion, useMigraciones } from "../../hooks/useData";
import { payloadProfiles } from "../../lib/esquema";
import { useArqueoStats } from "../../hooks/useArqueo";
import { userMetrics30d } from "../../lib/metrics";
import { nombreValido } from "../../lib/validacion";
import { puedeSerManager, esSinAsignar } from "../../lib/jerarquia";
import { esVisible } from "../../lib/visibilidad";
import { confirmacionValida } from "../../lib/borrado";
import { BlanquearClave } from "./BlanquearClave";
import { toast } from "sonner";

export function UserModal({ user: u, meId, team, cards, activity, onClose }:
  { user: Profile; meId: string; team: Profile[]; cards: Card[]; activity: ActivityLog[]; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: objectives = [] } = useObjectives();
  const org = useOrganizacion();
  // Esquema de la base (ALTA 1): sin la migración 29 la columna `oculto` no existe y el
  // update entero falla con PGRST204 — no se podría guardar NINGÚN perfil.
  const { data: migracionesAplicadas } = useMigraciones();
  const [name, setName] = useState(u.name);
  const [username, setUsername] = useState(u.username ?? "");
  const [role, setRole] = useState<Role>(u.role);
  const [puesto, setPuesto] = useState(u.puesto ?? "");
  const [ficha, setFicha] = useState(u.ficha ?? "");
  const [managerId, setManagerId] = useState<string | null>(u.manager_id ?? null);
  const [marca, setMarca] = useState<string | null>(u.marca ?? null);
  const [sucursal, setSucursal] = useState<string | null>(u.sucursal ?? null);
  const [oculto, setOculto] = useState(u.oculto === true);
  const [msg, setMsg] = useState<{ ok: boolean; txt: string } | null>(null);
  const [borrando, setBorrando] = useState(false);
  const [tipeado, setTipeado] = useState("");

  const esJefe = team.find((t) => t.id === meId)?.role === "jefe";
  const puedeEliminar = esJefe && u.id !== meId && !esSinAsignar(u);

  const m = userMetrics30d(cards, objectives, activity, u.id, Date.now());

  // Arqueo (mes): cumplimiento de las cards de control de las que esta persona es dueña (P1).
  const mesPrefix = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; })();
  const arqueoRows = useArqueoStats(cards, mesPrefix).filter((r) => r.card.owner === u.id);
  const arqueoTot = arqueoRows.reduce((s, r) => s + r.stats.total, 0);
  const arqueoOk = arqueoRows.reduce((s, r) => s + r.stats.ok, 0);
  const arqueoPctOk = arqueoTot === 0 ? 0 : Math.round((arqueoOk / arqueoTot) * 10000) / 100;

  // Managers posibles: encargados/jefes que no generen ciclo (ni sí mismo ni un subordinado).
  const managerOpts = team.filter(
    (t) => (t.role === "encargado" || t.role === "jefe") && puedeSerManager(t.id, u.id, team) && esVisible(t),
  );

  const save = useMutation({
    mutationFn: async () => {
      // Quien NO es jefe manda un payload SIN marca/sucursal/oculto, en vez de mandarlos en
      // null. Antes iban `marca: null, sucursal: null` explícitos, y eso tenía dos finales
      // malos, los dos silenciosos:
      //   · Un encargado editando a alguien de su equipo: la policy sólo permite
      //     `id = auth.uid() or es_jefe()`, así que el update no matcheaba NINGUNA fila.
      //     PostgREST devuelve error null, y la pantalla decía "Guardado." sin guardar nada.
      //   · Un encargado editando su propio perfil: la fila sí matchea, pero si tenía una
      //     marca asignada el trigger cortaba con excepción y no podía guardar ni su nombre.
      // Y aparecía o no según el dato (si marca ya era null, el `is distinct from` no salta),
      // que es lo peor posible para diagnosticarlo.
      const fila = {
        name: name.trim(), username: username.trim() || null, role,
        puesto: puesto.trim(), ficha: ficha.trim(), manager_id: managerId,
        ...(esJefe ? { marca, sucursal: sucursal || null, oculto } : {}),
      };
      const { error, data } = await supabase.from("profiles")
        .update(payloadProfiles(fila, migracionesAplicadas))
        .eq("id", u.id)
        .select("id");
      if (error) throw error;
      // `select` + conteo: sin esto, un update que no matchea ninguna fila (porque RLS no lo
      // permite) es indistinguible de uno exitoso. Decir "Guardado." cuando no se guardó nada
      // es peor que mostrar un error.
      if (!data || data.length === 0) {
        throw new Error("No se pudo guardar: tu cuenta no tiene permiso para editar este perfil.");
      }
    },
    onSuccess: () => { setMsg({ ok: true, txt: "Guardado." }); qc.invalidateQueries({ queryKey: ["team"] }); },
    // El mensaje de la base puede ser el texto crudo de un trigger. Se muestra tal cual sólo
    // si ya viene en lenguaje entendible; los de Postgres arrancan con mayúscula y jerga.
    onError: (e: Error) => setMsg({ ok: false, txt: e.message || "No se pudo guardar." }),
  });

  const eliminar = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      let out: { ok?: boolean; error?: string; reasignadas?: number };
      try {
        const r = await fetch(SUPABASE_URL + "/functions/v1/eliminar-usuario", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + session?.access_token },
          body: JSON.stringify({ userId: u.id }),
        });
        out = await r.json();
      } catch {
        out = { error: "No se pudo contactar la función eliminar-usuario. ¿Está desplegada en Supabase?" };
      }
      if (!out.ok) throw new Error(out.error ?? "Error al eliminar");
      return out.reasignadas ?? 0;
    },
    onSuccess: (reasignadas) => {
      qc.invalidateQueries({ queryKey: ["team"] });
      qc.invalidateQueries({ queryKey: ["cards"] });
      toast.success(`Empleado eliminado. ${reasignadas} tarea(s) quedaron "Sin asignar".`);
      onClose();
    },
    onError: (e: Error) => toast.error("" + e.message),
  });

  const onSave = () => {
    if (!nombreValido(name)) {
      toast.error("El nombre es obligatorio");
      return;
    }
    if (u.id === meId && role !== "jefe") {
      setMsg({ ok: false, txt: "No podés quitarte el rol de jefe a vos mismo (pedíselo al otro jefe)." });
      return;
    }
    save.mutate();
  };

  const inputCls = "w-full bg-surface2 border border-line rounded-lg px-2.5 py-1.5 text-ink text-sm";
  const Stat = ({ v, label }: { v: string | number; label: string }) => (
    <div className="bg-surface2 border border-line rounded-xl px-3 py-2.5 text-center">
      <b className="block text-lg">{v}</b><span className="text-xs text-ink2">{label}</span>
    </div>
  );

  return (
    <Modal onClose={onClose}>
        <h3 className="text-lg font-semibold m-0">{u.name}</h3>
        <div className="text-xs text-ink2 mb-3.5">{u.username ? "@" + u.username : "sin usuario"} · rol: {u.role}</div>

        <div className="grid gap-2.5 mb-1">
          <label className="text-sm text-ink2">Nombre
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </label>
          <label className="text-sm text-ink2">Usuario (para ingresar)
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Ej: Vmagni" className={inputCls} />
          </label>
          <label className="text-sm text-ink2">Correo de recuperación
            <input value={u.email || ""} disabled className={inputCls + " opacity-70"} />
          </label>
          <label className="text-sm text-ink2">Rol
            <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={inputCls}>
              <option value="empleado">empleado</option>
              <option value="encargado">encargado</option>
              <option value="jefe">jefe</option>
            </select>
          </label>
          <label className="text-sm text-ink2">Puesto
            <input value={puesto} onChange={(e) => setPuesto(e.target.value)} placeholder="Ej: Analista impositivo" className={inputCls} />
          </label>
          <label className="text-sm text-ink2">Responde a
            <select value={managerId ?? ""} onChange={(e) => setManagerId(e.target.value || null)} className={inputCls}>
              <option value="">— Sin responsable</option>
              {managerOpts.map((mo) => <option key={mo.id} value={mo.id}>{mo.name}</option>)}
            </select>
          </label>
          <label className="text-sm text-ink2">Marca
            <select value={marca ?? ""} onChange={(e) => setMarca(e.target.value || null)} disabled={!esJefe} className={inputCls}>
              <option value="">—</option>
              {org.marcas.map((mk) => <option key={mk} value={mk}>{mk}</option>)}
            </select>
          </label>
          <label className="text-sm text-ink2">Sucursal
            <select value={sucursal ?? ""} onChange={(e) => setSucursal(e.target.value || null)} disabled={!esJefe} className={inputCls}>
              <option value="">— Sin sucursal —</option>
              {org.sucursales.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="text-sm text-ink2">Ficha de puesto — qué se espera de este perfil
            <textarea value={ficha} onChange={(e) => setFicha(e.target.value)} rows={5}
              placeholder="Responsabilidades, entregables, estándares…" className={inputCls + " resize-y"} />
          </label>
          {esJefe && (
            <label className="flex items-center gap-2.5 text-sm text-ink2 cursor-pointer">
              <input type="checkbox" checked={oculto} onChange={(e) => setOculto(e.target.checked)} className="accent-accent w-4 h-4" />
              Usuario oculto (no aparece en listados ni métricas)
            </label>
          )}
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
          {arqueoRows.length > 0 && <Stat v={arqueoPctOk + "%"} label="Arqueo (mes)" />}
        </div>

        {/* Blanquear va ANTES de eliminar y separado: es reversible y frecuente, mientras que
            eliminar es definitivo y raro. Lo peligroso va último para que nadie apriete lo
            que no quería. */}
        {esJefe && <BlanquearClave userId={u.id} nombre={u.name} />}

        {puedeEliminar && (
          <div className="mt-5 pt-4 border-t border-line">
            {!borrando ? (
              <button onClick={() => { setBorrando(true); setTipeado(""); }}
                className="flex items-center gap-1.5 text-danger border border-line rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-surface2">
                <Trash2 size={14} /> Eliminar empleado
              </button>
            ) : (
              <div className="grid gap-2">
                <p className="text-sm text-ink2 m-0">
                  Esto elimina a <b className="text-ink">{u.name}</b> definitivamente. Sus tareas no se pierden: quedan
                  como "Sin asignar" para reasignar. Para confirmar, escribí el nombre exacto:
                </p>
                <input value={tipeado} onChange={(e) => setTipeado(e.target.value)} placeholder={u.name}
                  className={inputCls} autoFocus />
                <div className="flex gap-2">
                  <button onClick={() => eliminar.mutate()}
                    disabled={!confirmacionValida(tipeado, u.name) || eliminar.isPending}
                    className="flex items-center gap-1.5 bg-danger text-white rounded-lg px-3.5 py-2 text-sm font-semibold disabled:opacity-50">
                    <Trash2 size={14} /> {eliminar.isPending ? "Eliminando…" : "Eliminar definitivamente"}
                  </button>
                  <button onClick={() => { setBorrando(false); setTipeado(""); }}
                    className="border border-line bg-surface2 rounded-lg px-3.5 py-2 text-sm">Cancelar</button>
                </div>
              </div>
            )}
          </div>
        )}

        {msg && <p className={"text-sm mt-3 " + (msg.ok ? "text-done" : "text-danger")}>{msg.txt}</p>}
        <div className="flex gap-2 mt-4">
          <button onClick={onSave} disabled={save.isPending}
            className="bg-accent text-white rounded-lg px-3.5 py-2 text-sm font-semibold disabled:opacity-60">
            {save.isPending ? "Guardando…" : "Guardar cambios"}
          </button>
          <button onClick={onClose} className="ml-auto border border-line bg-surface2 rounded-lg px-3.5 py-2 text-sm">Cerrar</button>
        </div>
    </Modal>
  );
}
