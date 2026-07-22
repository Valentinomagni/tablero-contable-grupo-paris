import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Users, UserRound, AlarmClock, Link2, TrendingUp, UserX, Info, CheckCheck } from "lucide-react";
import { useNotifications, noLeidas } from "../hooks/useNotifications";
import { tiempoRelativo } from "../lib/notificaciones";
import { supabase } from "../lib/supabase";
import type { Notification, NotifTipo } from "../lib/types";
import { cn } from "../lib/ui";

const ICONO: Record<NotifTipo, React.ReactNode> = {
  asignacion: <UserRound size={15} />,
  delegacion: <Users size={15} />,
  vencida: <AlarmClock size={15} />,
  dep_liberada: <Link2 size={15} />,
  avance: <TrendingUp size={15} />,
  sin_asignar: <UserX size={15} />,
  sistema: <Info size={15} />,
  vencimiento_propio: <AlarmClock size={15} />,
};

// Campana del topbar (spec #8): badge con no leídas + panel dropdown.
// Defensivo: sin migración 21 el hook devuelve [] → campana sin badge, panel vacío.
export function NotificacionesBell({ onOpenCard }: { onOpenCard: (cardId: string) => void }) {
  const qc = useQueryClient();
  const { data: notifs = [] } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unread = noLeidas(notifs);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // best-effort: si falla (tabla inexistente) no rompe nada
  const marcar = useMutation({
    mutationFn: async (id: string) => { await supabase.from("notifications").update({ leida: true }).eq("id", id); },
    onSettled: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const marcarTodas = useMutation({
    mutationFn: async () => { await supabase.from("notifications").update({ leida: true }).eq("leida", false); },
    onSettled: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const clic = (n: Notification) => {
    if (!n.leida) marcar.mutate(n.id);
    // En vencimiento_propio, card_id es el id del aviso (tablón), no de tarea — no abrir.
    if (n.card_id && n.tipo !== "vencimiento_propio") { setOpen(false); onOpenCard(n.card_id); }
  };

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} title="Notificaciones" aria-label="Notificaciones"
        className="relative border border-line bg-surface2 rounded-lg px-2.5 py-1.5 hover:bg-surface transition-colors">
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-naranja text-white rounded-full text-[10px] px-1.5 py-px font-bold tnum min-w-[17px] text-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] w-[340px] max-w-[86vw] bg-surface border border-line rounded-[14px] overflow-hidden z-50"
          style={{ boxShadow: "var(--shadow-lg)" }}>
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-line">
            <b className="text-[13px]">Notificaciones</b>
            {unread > 0 && (
              <button onClick={() => marcarTodas.mutate()}
                className="flex items-center gap-1 text-[11.5px] text-ink2 hover:text-ink transition-colors">
                <CheckCheck size={13} /> Marcar todas como leídas
              </button>
            )}
          </div>
          <div className="max-h-[46vh] overflow-y-auto">
            {notifs.length === 0 && (
              <div className="px-3.5 py-6 text-center text-ink2 text-[13px]">Sin notificaciones por ahora.</div>
            )}
            {notifs.map((n) => (
              <button key={n.id} onClick={() => clic(n)}
                className={cn("flex items-start gap-2.5 w-full text-left px-3.5 py-2.5 border-b border-line/60 last:border-b-0 transition-colors hover:bg-surface2",
                  !n.leida && "bg-accent-soft/50")}>
                <span className={cn("mt-0.5 shrink-0", n.leida ? "text-ink2" : "text-accent")}>{ICONO[n.tipo] ?? ICONO.sistema}</span>
                <span className="flex-1 min-w-0 leading-snug">
                  <span className={cn("block text-[13px] truncate", !n.leida && "font-semibold")}>{n.titulo}</span>
                  {n.detalle && <span className="block text-[12px] text-ink2 truncate">{n.detalle}</span>}
                  <span className="block text-[11px] text-ink2 mt-0.5">{tiempoRelativo(n.created_at)}</span>
                </span>
                {!n.leida && <span className="mt-1.5 w-2 h-2 rounded-full bg-naranja shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
