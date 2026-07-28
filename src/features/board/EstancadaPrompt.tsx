import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";
import type { Card } from "../../lib/types";
import { HelpCircle } from "lucide-react";

/**
 * P1 — el aviso de tarea estancada. Tarjeta discreta dentro de "Mi día":
 * NUNCA un modal que bloquee (una pregunta que tapa la pantalla se contesta con el primer
 * botón que aparezca, que es justo el dato falso que queremos evitar).
 *
 * Cuatro SALIDAS REALES. Sin salidas, la alerta se aprende a ignorar: si la única respuesta
 * posible es "sigo con esto", eso es lo que se aprieta siempre y el estado nunca se corrige.
 *
 * El texto pregunta, no reprocha: nada de "abandonaste" ni "hace mucho que no hacés nada".
 */
export function EstancadaPrompt({ card, diasSinMover, quien, onAbrir, onPosponer }: {
  card: Card;
  diasSinMover: number;
  quien: string;        // nombre de quien responde, para firmar la entrada de historial.
  onAbrir: (c: Card) => void;
  onPosponer: (id: string) => void;
}) {
  const qc = useQueryClient();

  // "Sigo con esto" → deja una entrada en `history`. Eso ACTUALIZA la señal de movimiento,
  // que es todo el objetivo: la tarea deja de figurar como quieta sin mentir sobre su estado.
  const seguir = useMutation({
    mutationFn: async () => {
      const hist = [...(card.history ?? []), {
        who: quien, at: new Date().toISOString(), txt: "Confirmó que sigue trabajando en esta tarea",
      }];
      const { error } = await supabase.from("cards").update({ history: hist }).eq("id", card.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cards"] }); toast.success("Anotado, gracias."); },
    onError: (e: Error) => toast.error("No se pudo registrar: " + e.message),
  });

  // "Ya está terminada" → la cierra acá mismo. Es la salida que corrige el dato viejo,
  // la razón de ser de toda la propuesta.
  const terminar = useMutation({
    mutationFn: async () => {
      const ahora = new Date().toISOString();
      const hist = [...(card.history ?? []), { who: quien, at: ahora, txt: "Marcó la tarea como terminada" }];
      const { error } = await supabase.from("cards")
        .update({ status: "term", done_at: ahora, history: hist }).eq("id", card.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cards"] }); toast.success("Tarea cerrada."); },
    onError: (e: Error) => toast.error("No se pudo cerrar: " + e.message),
  });

  const ocupado = seguir.isPending || terminar.isPending;
  const btn = "min-h-[40px] rounded-lg border border-line bg-surface2 px-3 text-[13px] font-semibold " +
    "text-ink transition hover:border-accent/50 disabled:opacity-50";

  return (
    <div className="mb-4 rounded-xl border border-line bg-surface p-3.5 sm:p-4" style={{ boxShadow: "var(--shadow)" }}>
      <div className="flex items-center gap-2 mb-1">
        <HelpCircle size={15} className="text-ink2 shrink-0" />
        <span className="text-xs uppercase tracking-wide text-ink2 font-semibold">Una consulta</span>
      </div>
      <p className="font-semibold text-[14px] tracking-tight leading-snug m-0 break-words">{card.title}</p>
      <p className="text-[13px] text-ink2 m-0 mt-1">
        No tiene novedades desde hace {diasSinMover} días. ¿Seguís con esto o ya está terminada?
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className={btn} disabled={ocupado} onClick={() => seguir.mutate()}>Sigo con esto</button>
        <button className={btn} disabled={ocupado} onClick={() => terminar.mutate()}>Ya está terminada</button>
        <button className={btn} disabled={ocupado} onClick={() => onPosponer(card.id)}>Ahora no</button>
        <button className={btn} disabled={ocupado} onClick={() => onAbrir(card)}>Abrir la tarea</button>
      </div>
    </div>
  );
}
