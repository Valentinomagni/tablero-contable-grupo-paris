// Estructura organizacional CONFIGURABLE (spec 26 item 1): las listas de marcas y
// sucursales viven en settings (key 'organizacion') para poder agregar nuevas sin
// tocar código. Este parser es la única puerta: siempre devuelve algo usable.
export interface Organizacion {
  marcas: string[];
  sucursales: string[];
  /**
   * Áreas externas que pueden tener trabada una tarea contable (migración 54).
   *
   * Viven acá y no en una tabla propia porque son lo mismo que marcas y sucursales: estructura
   * organizacional configurable. Una tabla nueva obligaría a una pantalla nueva para
   * administrarla, y la de organización ya existe.
   *
   * NO son usuarios ni equipos del tablero: Ventas no entra a la app. Es sólo el nombre de quien
   * tiene la pelota cuando algo está frenado afuera.
   */
  areas: string[];
}

export const DEFAULT_ORG: Organizacion = {
  marcas: ["General", "Peugeot", "Citroën", "Chevrolet", "Honda", "Postventa"],
  sucursales: ["San Luis Capital", "Villa Mercedes", "Merlo", "San Juan"],
  areas: ["Ventas", "Administración", "Recursos Humanos", "Sistemas", "Fábrica"],
};

const lista = (v: unknown): string[] | null =>
  Array.isArray(v) && v.every((x) => typeof x === "string")
    ? (v as string[]).map((s) => s.trim()).filter(Boolean)
    : null;

export function parseOrganizacion(raw: unknown): Organizacion {
  if (typeof raw !== "object" || raw === null) return DEFAULT_ORG;
  const marcas = lista((raw as Record<string, unknown>).marcas);
  const sucursales = lista((raw as Record<string, unknown>).sucursales);
  if (!marcas || !sucursales) return DEFAULT_ORG;
  // `areas` se trata APARTE y nunca hace caer al resto (migración 54). La fila que ya existe en
  // `settings` se guardó antes de que este campo existiera: si su ausencia devolviera
  // DEFAULT_ORG entero, las marcas y sucursales que el jefe cargó a mano desaparecerían de la
  // pantalla, en silencio, la primera vez que alguien abriera la app.
  //
  // Es el mismo criterio del gateado defensivo de `esquema.ts`: un campo que falta degrada esa
  // parte, nunca la consulta completa.
  const areas = lista((raw as Record<string, unknown>).areas);
  return { marcas, sucursales, areas: areas ?? DEFAULT_ORG.areas };
}
