// Menciones con @ en comentarios (spec #8 / propuesta P8): detecta a qué miembros
// del equipo se está mencionando con `@` para notificarlos. Lógica pura y testeada.

const norm = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

// Devuelve los IDs de los miembros mencionados con `@` en el texto (sin duplicar,
// en orden de aparición). Matchea contra el nombre completo o el primer nombre,
// case-insensitive y sin tildes. Un `@` que no matchea a nadie se ignora.
export function detectarMenciones(
  txt: string,
  team: { id: string; name: string }[],
): string[] {
  if (!txt) return [];
  // Candidatos por miembro: nombre completo y primer nombre, normalizados.
  const candidatos = team.map((m) => {
    const full = norm(m.name);
    const first = full.split(/\s+/)[0] ?? "";
    return { id: m.id, full, first };
  });
  const out: string[] = [];
  // Captura @ seguido de una o más "palabras" (letras, con espacios entre ellas).
  const re = /@([\p{L}]+(?:\s+[\p{L}]+)*)/gu;
  for (const m of txt.matchAll(re)) {
    const tokens = norm(m[1]).split(/\s+/).filter(Boolean);
    // Preferí el match más largo: primero probar nombre completo (todos los tokens),
    // luego ir recortando hasta el primer token.
    let hitId: string | null = null;
    for (let take = tokens.length; take >= 1 && !hitId; take--) {
      const frag = tokens.slice(0, take).join(" ");
      const c = candidatos.find((x) => x.full === frag || x.first === frag);
      if (c) hitId = c.id;
    }
    if (hitId && !out.includes(hitId)) out.push(hitId);
  }
  return out;
}
