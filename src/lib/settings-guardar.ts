import { supabase } from "./supabase";
import type { AppSettings } from "./types";

// ÚNICO lugar donde se escribe la fila `settings.key = 'permissions'`.
//
// POR QUÉ EXISTE. Esa fila es un blob JSON compartido: adentro viven `edit_closed`,
// `board_name`, `due_warn_days`, `stuck_days`, `categorias`, `plantillas` y
// `closing_template`. Dos pantallas distintas (Administración y Plantilla de cierre) hacían
// read-modify-write del blob completo a partir de la copia que tenían en memoria.
//
// El QueryClient usa `staleTime: 30_000` y `refetchOnWindowFocus: false`, así que una pestaña
// de Administración abierta desde la mañana sirve un `settings` de hace horas. El caso real:
// se deja Administración abierta, en otra pestaña se edita la Plantilla de cierre y se guarda,
// se vuelve a la primera y se toca un checkbox. Ese toque escribe el blob viejo completo y
// BORRA la plantilla recién guardada, sin ningún aviso.
//
// La solución no es atómica —para eso habría que mover el merge a la base— pero reduce la
// ventana de horas a milisegundos: se relee la fila justo antes de escribir y el cambio se
// aplica encima de lo que hay AHORA, no de lo que había cuando se cargó la pantalla.

/**
 * Aplica `patch` sobre el valor actual de `settings.permissions` y lo guarda.
 *
 * Recibe SÓLO los campos que cambian, nunca el objeto completo: mandar el objeto completo es
 * justamente lo que causaba el problema.
 */
export async function guardarPermissions(patch: Partial<AppSettings>): Promise<void> {
  // 1) Releer lo que hay ahora. Si esta lectura falla, se corta acá: escribir a ciegas sobre
  //    un blob compartido es la forma de perder el trabajo de otra pantalla.
  const { data, error: errLeer } = await supabase
    .from("settings").select("value").eq("key", "permissions").maybeSingle();
  if (errLeer) throw new Error("No se pudo leer la configuración actual: " + errLeer.message);

  const actual = (data?.value ?? {}) as AppSettings;
  const proximo: AppSettings = { ...actual, ...patch };

  // 2) `upsert` y no `update`: si la fila no existiera, un `update ... .eq()` matchea cero
  //    filas, PostgREST devuelve error null, y la pantalla diría "Guardado" sin guardar nada.
  const { error } = await supabase
    .from("settings").upsert({ key: "permissions", value: proximo }, { onConflict: "key" });
  if (error) throw new Error("No se pudo guardar la configuración: " + error.message);
}
