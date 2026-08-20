import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { Card, Profile, Objective, ActivityLog, Empresa, DiaNoLaborable, TareaEstandar } from "../lib/types";
import type { DepInfo, RevDep } from "../lib/deps";
import { CardSchema, validateRows, saneaCards } from "../lib/schemas";
import { COLUMNAS_CARDS } from "../lib/esquema";
import type { Organizacion } from "../lib/organizacion";
import { parseOrganizacion, DEFAULT_ORG } from "../lib/organizacion";

// título/estado/responsable de deps que apuntan a tarjetas ajenas (security definer)
export function useDepsInfo(missing: string[]) {
  return useQuery({
    queryKey: ["deps-info", [...missing].sort()],
    queryFn: async (): Promise<DepInfo[]> => {
      const { data } = await supabase.rpc("deps_info", { ids: missing });
      return (data as DepInfo[]) ?? [];
    },
    enabled: missing.length > 0,
  });
}

// tareas ajenas que dependen de las mías (solo tiene sentido para no-jefes)
export function useReverseDeps(cardIds: string[], enabled: boolean) {
  return useQuery({
    queryKey: ["reverse-deps", [...cardIds].sort()],
    queryFn: async (): Promise<RevDep[]> => {
      const { data } = await supabase.rpc("reverse_deps", { ids: cardIds });
      return (data as RevDep[]) ?? [];
    },
    enabled: enabled && cardIds.length > 0,
  });
}

export function useObjectives() {
  return useQuery({
    queryKey: ["objectives"],
    queryFn: async (): Promise<Objective[]> => {
      const { data } = await supabase.from("objectives").select("*").order("created_at");
      return (data as Objective[]) ?? [];
    },
  });
}

export function useAnnouncements() {
  return useQuery({
    queryKey: ["announcements"],
    queryFn: async () => {
      const { data } = await supabase.from("announcements").select("*").order("created_at");
      return (data as import("../lib/types").Announcement[]) ?? [];
    },
  });
}

export function useActivity() {
  return useQuery({
    queryKey: ["activity"],
    queryFn: async (): Promise<ActivityLog[]> => {
      const since = new Date(Date.now() - 60 * 86400000).toISOString();
      const { data } = await supabase.from("activity_log").select("*").gte("at", since).order("at", { ascending: false });
      return (data as ActivityLog[]) ?? [];
    },
  });
}

// fotos diarias por persona (cron snapshot-diario) para la evolución de carga
export function useSnapshots(enabled: boolean) {
  return useQuery({
    queryKey: ["snapshots"],
    queryFn: async (): Promise<import("../lib/types").Snapshot[]> => {
      const since = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
      const { data } = await supabase.from("daily_snapshots").select("*").gte("day", since).order("day");
      return (data as import("../lib/types").Snapshot[]) ?? [];
    },
    enabled,
  });
}

// settings key='permissions': { edit_closed, board_name, due_warn_days, stuck_days }
export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async (): Promise<import("../lib/types").AppSettings> => {
      // maybeSingle (no single): sin sesión aún, RLS devuelve 0 filas — evita el 406 en el primer render.
      const { data } = await supabase.from("settings").select("value").eq("key", "permissions").maybeSingle();
      return (data?.value as import("../lib/types").AppSettings) ?? { edit_closed: false };
    },
  });
}

// settings key='organizacion': { marcas: string[], sucursales: string[] } (spec 26)
export function useOrganizacion(): Organizacion {
  const { data } = useQuery({
    queryKey: ["organizacion"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("settings").select("value").eq("key", "organizacion").maybeSingle();
      return parseOrganizacion(data?.value);
    },
  });
  return data ?? DEFAULT_ORG;
}

// settings key='tiempos_max': Record<categoría, horas> — SLA por categoría (spec 28, Task 4).
// Defensivo: sin fila o sin migración aplicada -> {} (sin límites configurados).
export function useTiemposMax(): Record<string, number> {
  const { data } = useQuery({
    queryKey: ["tiempos_max"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Record<string, number>> => {
      const { data } = await supabase.from("settings").select("value").eq("key", "tiempos_max").maybeSingle();
      const v = data?.value;
      return v && typeof v === "object" ? (v as Record<string, number>) : {};
    },
  });
  return data ?? {};
}

// Feriados y días no laborables cargados a mano por el jefe (tabla `dias_no_laborables`,
// migración 48), con el motivo al lado. Lo consume la pantalla de Administración, que es donde
// se cargan y se borran: sin el motivo, un feriado suelto en la lista no se distingue de un
// error de carga y nadie se anima a borrarlo.
//
// Defensivo, igual que useTiemposMax: si la migración 48 todavía no corrió (42P01/PGRST205) o
// la consulta falla por cualquier motivo, devuelve []. Sin feriados los sábados y domingos se
// siguen descontando, que es la mayor parte del problema — quedarse sin pantalla por esto sería
// peor que mostrar la lista vacía.
//
// Orden ascendente por fecha: la lista se lee como un calendario, del día más próximo al más
// lejano, que es como se piensa un feriado.
export function useDiasNoLaborablesLista() {
  return useQuery({
    queryKey: ["dias_no_laborables"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<DiaNoLaborable[]> => {
      const { data, error } = await supabase.from("dias_no_laborables").select("fecha,motivo").order("fecha");
      if (error) return [];
      return (data as DiaNoLaborable[]) ?? [];
    },
  });
}

// Los mismos días, en la forma que esperan las funciones de `src/lib/dias-habiles.ts`.
//
// POR QUÉ UN Set Y NO EL ARREGLO. Ahí la pregunta es siempre "¿esta fecha está en la lista?", y
// se hace una vez por día dentro de un bucle que recorre semanas: con un arreglo cada pregunta
// vuelve a recorrer la lista entera. `esHabil` ya está escrita contra un Set y no se toca.
//
// POR QUÉ COMPARTE LA CLAVE DE QUERY con el hook de arriba y no consulta aparte: si fueran dos
// consultas distintas, el cálculo de tiempos y la pantalla donde se cargan los feriados podrían
// mostrar listas distintas del mismo día, y ahí nadie sabría cuál creer.
//
// El `useMemo` no es micro-optimización: sin él cada render devuelve un Set nuevo, y esa
// identidad nueva invalida cualquier useMemo aguas abajo que dependa de los feriados.
export function useDiasNoLaborables(): Set<string> {
  const { data } = useDiasNoLaborablesLista();
  return useMemo(() => new Set((data ?? []).map((d) => d.fecha)), [data]);
}

// Catálogo de tareas estándar (tabla `tareas_estandar`, migración 55): la definición canónica
// del trabajo que se repite en varias marcas y personas. La pantalla de Administración las
// administra; la de crear tareas las instancia.
//
// LO LEE CUALQUIERA CON SESIÓN, y a propósito: todos crean tareas, así que todos necesitan el
// catálogo. Lo que sólo puede el jefe es ESCRIBIRLO, y eso lo aplica la RLS de la tabla.
//
// Defensivo, igual que useDiasNoLaborablesLista: si la migración 55 todavía no corrió
// (42P01/PGRST205) o la consulta falla, devuelve [] en vez de romper la pantalla. Sin catálogo
// la app funciona exactamente como antes de que existiera, que es el criterio de todo el
// proyecto ante una base sin migrar.
//
// El orden final (activas primero) lo pone `ordenarEstandares` en `src/lib/catalogo.ts`: acá se
// pide por nombre nada más, porque `activa` es una decisión de presentación y no de la consulta.
export function useTareasEstandar() {
  return useQuery({
    queryKey: ["tareas_estandar"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<TareaEstandar[]> => {
      const { data, error } = await supabase.from("tareas_estandar").select("*").order("nombre");
      if (error) return [];
      return (data as TareaEstandar[]) ?? [];
    },
  });
}

// enabled: jefe y encargado traen los profiles (RLS del Plan 02 limita lo que ve el encargado).
// El empleado no consulta — App le arma team = [me].
// refrescá cada 90s pa' que la presencia no quede congelada
export function useTeam(enabled: boolean) {
  return useQuery({
    queryKey: ["team", enabled],
    queryFn: async (): Promise<Profile[]> => {
      const { data } = await supabase.from("profiles").select("*").order("role").order("name");
      return (data as Profile[]) ?? [];
    },
    staleTime: 60_000,
    refetchInterval: 90_000,
    enabled,
  });
}

// estado de migraciones (spec 27, T2): null si la tabla no existe todavía (p.ej. sin migración 28 aplicada)
export function useMigraciones() {
  return useQuery({
    queryKey: ["migraciones"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<number[] | null> => {
      const { data, error } = await supabase.from("schema_migrations").select("id");
      if (error || !data) return null;
      return (data as { id: number }[]).map((r) => r.id);
    },
  });
}

// ¿El trigger `cards_notificar_finalizacion` está ACTIVO en la base? (spec 28 fase C, Task 11)
//
// No se puede deducir de useMigraciones(): la migración 30 crea el trigger DESACTIVADO a
// propósito y activarlo es un paso manual aparte, así que "migración 30 aplicada" no
// implica "trigger activo". El RPC lee pg_trigger.tgenabled, o sea el estado real.
//
// Devuelve null cuando no se pudo saber (RPC inexistente porque la 30 no corrió, error de
// red, RLS). null → debeNotificarDesdeCliente() decide que el cliente notifique igual:
// preferimos un duplicado ocasional antes que un silencio permanente.
export function useTriggerNotificaciones() {
  return useQuery({
    queryKey: ["trigger-notificaciones"],
    staleTime: 5 * 60_000,
    // El QueryClient global tiene refetchOnWindowFocus:false y no hay otro disparador de
    // refetch automático: sin este intervalo, alguien parado en el tablero (pestaña nunca
    // desmontada) se quedaría con el valor viejo indefinidamente tras un rollback del trigger.
    refetchInterval: 5 * 60_000,
    retry: false,
    queryFn: async (): Promise<boolean | null> => {
      const { data, error } = await supabase.rpc("trigger_notificaciones_activo");
      if (error) return null;
      return typeof data === "boolean" ? data : null;
    },
  });
}

// Búsqueda full-text sobre `cards` (spec 28 fase C, Task 13) vía RPC público.buscar_cards.
// SECURITY INVOKER en el servidor: la RLS de `cards` sigue aplicando, cada quien ve lo suyo.
//
// Sólo se pega a la base con q.trim().length >= 3 (por debajo no vale la pena). El propio
// hook debounce-a el disparo del RPC (300ms) para no mandar un request por cada tecla.
//
// Defensivo: si la RPC no está expuesta (migración 30 no corrida, PGRST202/42883) o falla
// por cualquier otro motivo (red, RLS), se resuelve con data: [] y NO se propaga como error —
// el CommandPalette debe seguir funcionando con el filtro en memoria de siempre (fallback
// obligatorio, ver src/components/CommandPalette.tsx).
export function useBuscarCards(q: string) {
  const trimmed = q.trim();
  const habilitada = trimmed.length >= 3;
  const [debounced, setDebounced] = useState(trimmed);

  useEffect(() => {
    if (!habilitada) { setDebounced(""); return; }
    const t = setTimeout(() => setDebounced(trimmed), 300);
    return () => clearTimeout(t);
  }, [trimmed, habilitada]);

  return useQuery({
    queryKey: ["buscar-cards", debounced],
    enabled: debounced.length >= 3,
    staleTime: 30_000,
    retry: false,
    queryFn: async (): Promise<Card[]> => {
      const { data, error } = await supabase.rpc("buscar_cards", { q: debounced });
      if (error) return [];
      return (data as Card[]) ?? [];
    },
  });
}

// Consultas (Task 3, spec 28): defensivo — si la tabla no existe todavía (migración 29 sin correr),
// la queryFn tira el error (react-query lo expone via isError) y quien no lo mira usa `data ?? []`.
// RLS ya filtra: autor ve las suyas, jefe ve todas.
export function useConsultas() {
  return useQuery({
    queryKey: ["consultas"],
    queryFn: async (): Promise<import("../lib/types").Consulta[]> => {
      const { data, error } = await supabase.from("consultas").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data as import("../lib/types").Consulta[]) ?? [];
    },
    retry: false,
  });
}

// Empresas (spec 28, Task 8): datos estratégicos para priorizar trabajo, tabla
// `empresas` (migración 31). Mismo patrón defensivo que useConsultas: si la
// migración todavía no corrió, la queryFn tira el error (react-query lo expone
// via isError, Empresas.tsx lo chequea con esTablaInexistente) y quien no lo
// mira usa `data ?? []`. RLS: SELECT para cualquier autenticado, escritura
// solo `es_jefe()` — la UI igual gatea el CRUD para no mostrar controles que
// el servidor va a rechazar.
export function useEmpresas() {
  return useQuery({
    queryKey: ["empresas"],
    queryFn: async (): Promise<Empresa[]> => {
      const { data, error } = await supabase.from("empresas").select("*").order("nombre");
      if (error) throw error;
      return (data as Empresa[]) ?? [];
    },
    retry: false,
  });
}

export function useCrearEmpresa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (e: { nombre: string; cuit: string | null; cierre_balance: string | null; reporta_fabrica: boolean; prioridad: number }) => {
      const { error } = await supabase.from("empresas").insert(e);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["empresas"] }),
  });
}

export function useEditarEmpresa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...cambios }: { id: string; nombre: string; cuit: string | null; cierre_balance: string | null; reporta_fabrica: boolean; prioridad: number }) => {
      const { error } = await supabase.from("empresas").update(cambios).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["empresas"] }),
  });
}

export function useBorrarEmpresa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("empresas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["empresas"] }),
  });
}

// Solo para el badge del jefe en Administración: cuenta de estado 'nueva'.
// Sólo el jefe ve el badge de la bandeja: sin `enabled` esta query corría para los ~30
// usuarios del equipo en cada carga, pidiendo filas que RLS les devuelve vacías igual.
export function useConsultasNuevas(isJefe: boolean) {
  return useQuery({
    queryKey: ["consultas-nuevas"],
    enabled: isJefe,
    queryFn: async (): Promise<import("../lib/types").Consulta[]> => {
      const { data, error } = await supabase.from("consultas").select("*").eq("estado", "nueva");
      if (error) return [];
      return (data as import("../lib/types").Consulta[]) ?? [];
    },
  });
}

// Instancias de estado por período mensual (migración 32, propuesta de períodos Fase 0).
// Mismo patrón defensivo que useConsultas/useEmpresas: si la tabla todavía no existe
// (migración 32 sin correr, 42P01/PGRST205) o falla por cualquier motivo, devuelve []
// SIN romper nada — la Fase 1 cae al fallback (leer `cards`) y la app funciona como hoy.
// RLS ya filtra: propio, encargado del dueño o jefe.
export function useCardPeriodos() {
  return useQuery({
    queryKey: ["card_periodos"],
    queryFn: async (): Promise<import("../lib/types").CardPeriodo[]> => {
      const { data, error } = await supabase.from("card_periodos").select("*");
      if (error) return [];
      return (data as import("../lib/types").CardPeriodo[]) ?? [];
    },
    retry: false,
  });
}

export function useCards() {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase
      .channel("cards-live-v2")
      .on("postgres_changes", { event: "*", schema: "public", table: "cards" },
        () => qc.invalidateQueries({ queryKey: ["cards"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  return useQuery({
    queryKey: ["cards"],
    queryFn: async (): Promise<Card[]> => {
      // Columnas explícitas (no `*`): evita arrastrar el tsvector `tsv` de la migración 30
      // en cada refetch — y hay uno por cada evento realtime. Ver COLUMNAS_CARDS.
      const { data, error } = await supabase.from("cards").select(COLUMNAS_CARDS).order("created_at");
      // Fallback a `*` si la base todavía no tiene alguna de esas columnas (42703 /
      // PGRST204 en una base sin migrar): pedir columnas explícitas hace fallar el select
      // ENTERO, y quedarse sin tablero es peor que traer un tsvector de más.
      // Dos pasos con roles distintos (ver el comentario largo en lib/schemas.ts):
      // `validateRows` AVISA del drift sin tocar nada, y `saneaCards` ARREGLA lo arreglable
      // y descarta lo inservible antes de que un componente lo toque. Una fila con
      // `checklist` en null tumbaba la pantalla entera desde el `.map()` de un componente.
      if (error) {
        const { data: todo } = await supabase.from("cards").select("*").order("created_at");
        return saneaCards(validateRows((todo as Card[]) ?? [], CardSchema, "cards"));
      }
      return saneaCards(validateRows((data as unknown as Card[]) ?? [], CardSchema, "cards"));
    },
  });
}
