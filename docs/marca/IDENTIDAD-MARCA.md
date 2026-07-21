# Identidad de marca — Tablero Contable (Grupo Paris)

Este manual no inventa una marca nueva: formaliza la que ya vive en el código.
Cada valor citado acá está tomado verbatim de `src/index.css`, `src/components/Logo.tsx`
y `public/brand/`. Si algo cambia en el código, este documento queda desactualizado y
hay que corregirlo a él, no al revés.

## 1. Qué es y qué promete

El Tablero Contable es el sistema interno de gestión de tareas, cierre mensual, calendario
y comunicación de Grupo Paris (concesionarias Peugeot, Citroën, Chevrolet, Honda y
Postventa, en San Luis Capital, Villa Mercedes, Merlo y San Juan).

**Posicionamiento:** una herramienta de trabajo tan seria como los balances que ordena —
sin ruido visual, sin nada que compita con los números.

## 2. El isotipo

El isotipo es el logo real de Grupo Paris, vectorizado con potrace a partir del logo
original (`scripts/logo-vector.py`), reconstruido en curvas Bézier. No es un ícono genérico
ni una interpretación libre: es la marca de la empresa, trazada para que se vea nítida a
cualquier tamaño.

**Variantes disponibles** (`public/brand/`):
- `isotipo-negro.svg` / `isotipo-blanco.svg` — solo símbolo, viewBox 133×123.
- `lockup-negro.svg` / `lockup-blanco.svg` — símbolo + wordmark, viewBox 244×239.

**Cuándo usar cada una:**
- **Blanca**, sobre fondos oscuros: sidebar (`--side-bg:#0a0a0b`), pantalla de login, cualquier
  superficie oscura. Así la usa `LogoMark` en `src/components/Logo.tsx`.
- **Negra**, sobre fondos claros: encabezados de reportes impresos, documentos, superficies
  blancas (`--surface:#ffffff`) o el fondo general claro (`--bg:#f6f6f7`).
- **Isotipo solo** en espacios chicos (favicon, avatar, sidebar colapsado).
- **Lockup** cuando hay espacio horizontal y conviene reforzar el nombre (portadas de reporte,
  pantalla de login, materiales institucionales).

**Área de protección:** dejar alrededor del símbolo un margen libre mínimo equivalente a la
altura de la "P" central del isotipo (aprox. 1/8 de su altura total). Ningún texto, borde o
elemento gráfico debe invadir ese margen.

**Tamaño mínimo:** 24 px de alto para el isotipo solo (por debajo pierde el detalle de las
curvas internas); 32 px de alto para el lockup completo. En `Logo.tsx` el tamaño por defecto
en la interfaz es 34 px.

**Usos prohibidos:**
- Deformar, rotar o estirar el isotipo (nunca ajustar ancho y alto por separado).
- Colorearlo: el isotipo es monocromo por definición — solo negro (`#0B0B0D`, el fill del SVG)
  o blanco. Nunca en el color de acento de otra marca, gradientes ni degradés.
- Ponerlo sobre fondos de bajo contraste (ej. isotipo negro sobre gris medio, o blanco sobre
  superficie clara): siempre negro-sobre-claro o blanco-sobre-oscuro, sin excepciones.
- Agregarle sombra, contorno, efectos 3D o cualquier tratamiento que no sea el trazo plano.

## 3. Paleta

La decisión de marca es que **el color no decora — el negro/blanco/gris es la marca, y el
color queda reservado por completo a comunicar estado**. No hay azul, no hay paleta de marca
secundaria: `--accent` literalmente ES el negro (modo claro) o el gris claro (modo oscuro).
Esto es intencional: en un tablero contable, un color "de marca" en botones o barras compite
por atención con lo que importa (si algo está atrasado, si algo cerró bien). Sacando el color
decorativo, el único color que aparece en pantalla siempre significa algo.

**Modo claro:**

| Token | Hex | Uso |
|---|---|---|
| `--bg` | `#f6f6f7` | Fondo general de la app |
| `--surface` | `#ffffff` | Tarjetas, paneles, superficies elevadas |
| `--surface2` | `#f1f1f3` | Superficies secundarias, inputs |
| `--ink` | `#18181b` | Texto principal |
| `--ink2` | `#71717a` | Texto secundario, metadatos |
| `--line` | `#e4e4e7` | Bordes y separadores |
| `--accent` | `#18181b` | Acento de marca — negro puro, botones primarios, foco |
| `--accent-ink` | `#ffffff` | Texto/ícono sobre el acento |
| `--chip` | `#f1f1f3` | Fondo de chips/badges neutros |
| `--done` | `#0f9d6b` | Estado: terminado |
| `--warn` | `#c2790a` | Estado: atención |
| `--danger` | `#dc2626` | Estado: peligro |

**Modo oscuro:**

| Token | Hex | Uso |
|---|---|---|
| `--bg` | `#0b0b0c` | Fondo general |
| `--surface` | `#1b1b1e` | Tarjetas, paneles |
| `--surface2` | `#232327` | Superficies secundarias |
| `--ink` | `#f4f4f5` | Texto principal |
| `--ink2` | `#a1a1aa` | Texto secundario |
| `--line` | `#33333a` | Bordes |
| `--accent` | `#e4e4e7` | Acento — gris claro (inversión del negro en claro) |
| `--side-bg` | `#050506` | Barra lateral, la superficie más oscura de toda la app |
| `--done` | `#34d399` | Estado: terminado |
| `--warn` | `#fbbf24` | Estado: atención |
| `--danger` | `#f87171` | Estado: peligro |

Notar que `--s1`/`--s2`/`--naranja` (usados en gráficos) reutilizan la misma lógica: una
escala de grises neutros más los mismos semánticos de estado — nunca una paleta categórica
de colores vivos.

## 4. Tipografía

**Familia:** Inter Variable, cargada localmente desde `src/assets/InterVariable.woff2`
(sin dependencia de Google Fonts ni CDN externo). Fallback: `"Segoe UI", system-ui, sans-serif`.

**Jerarquía:**
- **Títulos** (`h1`, `h2`, `h3`): `letter-spacing: -.02em` — tracking negativo que cierra
  las formas y da densidad tipográfica premium.
- **Cuerpo:** tamaño base 14.5px, `line-height: 1.5`, `letter-spacing: -.006em` (tracking
  levemente negativo también en el texto corrido, definido a nivel `body`).
- **Números:** clase `.tnum` aplica `font-variant-numeric: tabular-nums` — todo número
  contable, monto o fecha en columna debe llevar esta clase para que las cifras alineen
  verticalmente dígito a dígito.

**Reglas:** nunca usar otra familia tipográfica en la interfaz. El tracking negativo en
títulos y el tabular-nums en números no son estéticos solamente: en un tablero contable,
que las columnas de cifras no "bailen" es funcional, no decorativo.

## 5. Iconografía

**Librería:** Lucide (íconos de línea) — es la única fuente de íconos de la interfaz.

**Trazo y tamaño:** líneas finas y consistentes, monocromáticas (heredan `currentColor`,
nunca un color propio fijo), en los tamaños estándar de Lucide (16/20/24 px según contexto).

**Regla de cero emojis:** ningún emoji en ningún lugar de la interfaz — ni en textos, ni en
notificaciones, ni en botones, ni en placeholders. Solo íconos de línea Lucide o SVG propios
monocromáticos (como el isotipo).

**Por qué:**
- **Seriedad:** es una herramienta de trabajo contable, no una app de consumo — el emoji
  introduce un registro informal que no corresponde al contexto (cierres, balances, tareas
  con responsables).
- **Consistencia visual:** un emoji rompe la paleta monocroma de un plumazo (trae color,
  trae una fuente distinta, renderiza distinto según el sistema operativo). Un ícono Lucide
  respeta el mismo trazo y el mismo color que el resto de la UI en cualquier dispositivo.
- **Contexto contable:** en cierres y reportes, cualquier elemento no funcional es ruido.
  El único lugar donde el color aparece es en el estado (terminado/atención/peligro); el
  emoji competiría con esa única señal.

## 6. Voz y tono

Español rioplatense, voseo, directo, sin jerga técnica de cara al usuario final. El sistema
le habla al usuario como un compañero de trabajo prolijo: corto, concreto, sin relleno, y
cuando algo sale mal explica qué pasó sin excusas ni tecnicismos.

Ejemplos reales tomados del código (`src/features/...`):

- `"Elegí un responsable por defecto para los ítems sin responsable."` — `Admin.tsx:83`
- `"Ponele un nombre a la plantilla."` — `Admin.tsx:105`
- `"Vacaciones registradas"` — `VacacionesModal.tsx:43`
- `"No se pudo reasignar: " + e.message` — `Huerfanas.tsx:27` (error concreto, sin jerga,
  agrega el motivo real en vez de un genérico "ocurrió un error")
- `"Elegí persona y un rango de fechas válido"` — `VacacionesModal.tsx:102`
- `"Ponele un título al aviso"` — `Tablon.tsx:267`

El patrón es siempre el mismo: verbo en modo imperativo voseante ("elegí", "ponele",
"agregá"), frase corta, y en los mensajes de éxito una confirmación seca de lo que pasó
("Vacaciones registradas", "Aviso publicado", "Tarea reasignada") sin adornos ni signos de
exclamación de más.

## 7. Aplicaciones

- **Interfaz:** paleta y tokens de `src/index.css` aplicados de punta a punta (claro/oscuro
  vía `data-theme` o preferencia de sistema), Inter Variable en toda la app, íconos Lucide,
  isotipo blanco en la sidebar.
- **Reportes impresos:** el `@media print` de `src/index.css` colapsa el layout a flujo de
  bloque y oculta el `aside` — en un reporte impreso el encabezado debe llevar el isotipo o
  lockup **negro** (fondo blanco de la hoja), nunca el blanco de pantalla.
- **Esta presentación:** este mismo documento sigue las reglas que describe — sin emojis,
  con la voz directa de la sección 6, y sin introducir ningún color fuera de la paleta
  documentada.

---

*Documento vivo: si `src/index.css`, `Logo.tsx` o `public/brand/` cambian, actualizar este
manual en el mismo commit.*
