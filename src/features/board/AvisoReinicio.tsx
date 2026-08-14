import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { mensajeUsuario, FallaDeUsuario } from "../../lib/fallas";
import { periodoLabel } from "../../lib/periodo-instancias";
import { yaEstabaCerrado, textoYaCerrado } from "../../lib/reinicio-mensual";

/**
 * AVISO: el mes pasado no se reinició.
 *
 * POR QUÉ EXISTE. El 04/08/2026 el equipo abrió el tablero y vio sus tareas de julio todavía
 * en "Terminado". El cron del reinicio mensual había fallado y no avisó a nadie; la persona
 * que lo notó no tenía forma de saber si el problema era del sistema o suyo. Media mañana de
 * gente confundida. Esto convierte esa falla invisible en una frase que se entiende.
 *
 * ENCUADRE. El texto describe una situación DEL SISTEMA. No hay nada que la persona que lo
 * lee haya hecho mal, así que no hay rojo, no hay signo de admiración y no se le pide que
 * arregle nada: se le dice qué está viendo y a quién avisarle. Un cartel de alarma por algo
 * que no depende de vos se aprende a ignorar, y el próximo sí importante también.
 */
export function AvisoReinicio({ mes, esJefe }: { mes: string; esJefe: boolean }) {
  const qc = useQueryClient();
  const [corriendo, setCorriendo] = useState(false);
  const etiqueta = periodoLabel(mes);

  async function reiniciar() {
    // Confirmación que dice QUÉ VA A PASAR, no "¿estás seguro?". La acción archiva un mes
    // entero y toca las tareas de todo el equipo: quien la aprieta tiene que poder anticipar
    // el resultado antes, no descubrirlo después.
    const ok = confirm(
      `Se va a archivar ${etiqueta} como cierre del mes y las tareas recurrentes mensuales ` +
      `van a volver a "Pendiente" para todo el equipo.\n\n¿Reiniciar el mes?`,
    );
    if (!ok) return;
    setCorriendo(true);
    try {
      const { data, error } = await supabase.rpc("reset_mes_manual", { mes_a_cerrar: mes });
      if (error) throw error;
      // EL MES YA ESTABA CERRADO Y LA BASE NO TOCÓ NADA (guarda de la migración 50).
      //
      // Este cartel aparece aunque el cron haya cerrado el mes bien, porque `reinicios_mensuales`
      // arranca vacía a propósito. Hasta la 50, apretar el botón en esa situación DESTRUÍA el
      // archivo del mes y lo dejaba en 0% para siempre. Ahora la base se planta, y acá hay que
      // contarlo: un botón que contesta "listo" sin haber hecho nada enseña a no creerle.
      //
      // Se recarga el registro igual —y sólo eso, porque las tarjetas no cambiaron— para que el
      // cartel desaparezca: si la base dice que el mes está cerrado, el aviso está de más.
      if (yaEstabaCerrado(data)) {
        qc.invalidateQueries({ queryKey: ["reinicios"] });
        // Se lanza en vez de mostrarse acá para que salga por el MISMO camino que cualquier otra
        // falla: `mensajeUsuario`. `FallaDeUsuario` es la marca de "este texto ya está escrito
        // para una persona", así que pasa entero y el texto crudo de la base no llega nunca.
        throw new FallaDeUsuario(textoYaCerrado(etiqueta));
      }
      // Se invalidan las tarjetas además del registro: el reinicio les cambió el estado a
      // todas, y dejar la lista vieja en pantalla haría parecer que el botón no hizo nada.
      qc.invalidateQueries({ queryKey: ["cards"] });
      qc.invalidateQueries({ queryKey: ["reinicios"] });
      // El texto que devuelve la función trae los números reales (cuántas archivó, cuántas
      // reinició). Es la única confirmación honesta: si reinició 0, hay que enterarse.
      toast.success(String(data ?? "Mes reiniciado."));
    } catch (e) {
      toast.error(mensajeUsuario(e, "reiniciar el mes"));
    } finally {
      setCorriendo(false);
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-line bg-surface p-3.5 sm:p-4" style={{ boxShadow: "var(--shadow)" }}>
      <div className="flex items-center gap-2 mb-1">
        <RotateCcw size={15} className="text-ink2 shrink-0" />
        <span className="text-xs uppercase tracking-wide text-ink2 font-semibold">Reinicio mensual pendiente</span>
      </div>
      <p className="text-sm text-ink2 m-0 mt-1">
        Las tareas de {etiqueta.toLowerCase()} todavía no se reiniciaron, por eso seguís viendo
        el estado del mes pasado.{" "}
        {esJefe
          ? "Se puede reiniciar desde acá."
          : "Avisale a la administración así lo reinician."}
      </p>
      {esJefe && (
        <div className="mt-3">
          <button
            onClick={reiniciar}
            disabled={corriendo}
            className="min-h-[40px] rounded-lg border border-line bg-surface2 px-3 text-sm font-semibold
              text-ink transition hover:border-accent/50 disabled:opacity-50">
            Reiniciar mes
          </button>
        </div>
      )}
    </div>
  );
}
