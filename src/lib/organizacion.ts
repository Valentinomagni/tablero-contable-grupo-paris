// Estructura organizacional CONFIGURABLE (spec 26 item 1): las listas de marcas y
// sucursales viven en settings (key 'organizacion') para poder agregar nuevas sin
// tocar código. Este parser es la única puerta: siempre devuelve algo usable.
export interface Organizacion { marcas: string[]; sucursales: string[] }

export const DEFAULT_ORG: Organizacion = {
  marcas: ["General", "Peugeot", "Citroën", "Chevrolet", "Honda", "Postventa"],
  sucursales: ["San Luis Capital", "Villa Mercedes", "Merlo", "San Juan"],
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
  return { marcas, sucursales };
}
