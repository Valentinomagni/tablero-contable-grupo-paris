# Sistema visual

Qué usar y qué no, para que la app no se vaya separando con el tiempo. Hay **dos tests
guardianes** que hacen cumplir esto: `src/lib/tipografia.guard.test.ts` y
`src/components/Panel.guard.test.ts`. No son burocracia — un sistema de diseño no se rompe por
una decisión, se rompe por un `text-[13px]` puesto a las apuradas que nadie revisa.

## Tipografía

Nueve pasos, definidos en `tailwind.config.js`. **Nunca** un tamaño en píxeles a mano.

| Clase | Tamaño | Para qué |
|---|---|---|
| `text-2xs` | 11px | metadatos, chips, sellos |
| `text-xs` | 12px | texto de apoyo, notas al pie |
| `text-sm` | 13px | el caballito de batalla: listas, tablas, descripciones |
| `text-base` | 14px | cuerpo |
| `text-lg` | 16px | título de sección |
| `text-xl` | 19px | título de pantalla |
| `text-2xl` | 22px | encabezado grande |
| `text-3xl` | 26px | cifra destacada |
| `text-4xl` | 32px | la cifra principal de una pantalla |

De dónde salió: había **571** tamaños escritos a mano en **20 valores distintos**, decimales
incluidos (`11.5px`, `12.5px`, `13.5px`). Eso es lo que hace que una app se vea armada de a
pedazos aunque cada pantalla por separado esté bien.

Estos valores **pisan** los de Tailwind (su `text-sm` es 14px, el nuestro 13px). Es deliberado:
densidad de dashboard profesional. Los tamaños de 16px para arriba llevan `letter-spacing`
negativo porque Inter, a partir de ahí, se ve suelta con el tracking por defecto — apretarla es
lo que la hace ver editorial.

Si te falta un tamaño, **se agrega a la escala**, no se pone a mano. Ésa es exactamente la
conversación que el guardián fuerza a tener.

Los números que se comparan van con `tnum` (cifras de ancho fijo), así no bailan las columnas.

## Superficies

Una tarjeta es `<Panel>`. Con `densidad="compacta"` cuando va dentro de otra tarjeta. Nadie
repite `bg-surface … rounded-2xl p-[18px]` ni la sombra por su cuenta.

**Alcance real, medido:** de las 41 superficies con `rounded-2xl` del proyecto, **18 son la
tarjeta canónica** y `Panel` las cubre. Las otras 23 son 4 o 5 superficies genuinamente
distintas: fichas de estadística con `p-4`, bloques con `p-5`, `p-8` o `px-5 py-4`, y shells con
`overflow-hidden` sin padding propio porque el padding lo ponen los hijos. **Decidir si
merecen variantes de `Panel` requiere mirar la pantalla**, así que quedan pendientes a
propósito y el guardián no las persigue.

Por qué el guardián es angosto y no amplio: un chequeo amplio necesitaría unas quince
excepciones, y eso es peor que no tener guardián — aparenta una cobertura que no existe. Un
guardián que declara su alcance es honesto; uno que finge cubrir todo, no.

### El escape `panel-guard-ok`

Cuando un caso canónico genuinamente no puede usar `Panel`, se marca **en el fuente**, en la
línea o en las de arriba, **con el motivo escrito al lado**:

```tsx
{/* panel-guard-ok: la barra de color es `border-l-[3px]` con `border-done`, que es una
    utilidad de COLOR de borde y no de un lado: el `border border-line` de Panel pintaría
    los cuatro lados. Se resuelve cuando Panel tenga una variante sin borde. */}
```

Es por línea y no por archivo a propósito: exentar un archivo entero deja pasar cualquier copia
futura dentro de él y esconde la razón lejos del código. Hoy hay **un solo** marcador, en
`MiMes.tsx`.

**Si algún día hay varios marcadores, eso no significa agregar más marcadores: significa que a
`Panel` le falta una variante.**

## Color

Todo sale de las variables de `src/index.css`. La marca es monocroma —negro, blanco, grises— y
el color aparece **sólo** en estados: `--done` (verde), `--warn` (ámbar), `--danger` (rojo).
Nunca un color hexadecimal escrito en un componente.

**Cuidado con `--ring` y `--ring-sh`, que no son lo mismo:**

- `--ring-sh` es una sombra (`0 0 0 1px …`). Es la que va en un `box-shadow`.
- `--ring` es un **color** (`var(--accent)`), token semántico para bordes de foco.

Escribir `box-shadow: var(--ring), var(--shadow)` produce CSS inválido, y cuando un valor de la
lista es inválido **el navegador descarta la declaración entera**. Eso pasó de verdad: cinco
pantallas, entre ellas el tablero y el reporte, venían renderizando **sin ninguna sombra** y
nadie lo notó en meses. El segundo chequeo del guardián de `Panel` existe para que no vuelva a
pasar.

## Movimiento

Una sola curva (`ease-salida`) y dos duraciones (`duration-rapido` 120ms, `duration-medio`
200ms). Se animan **sólo** opacidad y `transform`, que el navegador compone en GPU; animar
`width`, `height` o `top` fuerza recálculo de layout y se ve a saltos.

`.aparecer` para algo que entra, `.latir` para algo que espera.

`prefers-reduced-motion` está respetado globalmente. No es cortesía: para algunas personas el
movimiento produce mareo real.

## Foco

Global, con `:focus-visible` — aparece al tabular y **no** al hacer clic con el mouse, que es lo
que molesta y lleva a que alguien lo desactive con `outline: none`. Dentro de la barra lateral
oscura usa `--side-ink`, porque el negro del acento sobre negro es invisible; la regla anterior
usaba el selector universal y justo ahí no se veía.

**Nunca** `outline: none` sin poner otro indicador en su lugar.

## Estados de carga

`<Skeleton>` con la forma de lo que va a aparecer, o `<SkeletonVista>` para una pantalla
completa. Nunca la palabra "Cargando": el hueco con forma reserva el espacio (no hay salto
cuando llegan los datos) y hace que la espera se sienta más corta. Es la señal más barata que
existe de software terminado.

Accesibilidad: `aria-busy` en el contenedor y `aria-hidden` en las barras grises, que son
decoración y no contenido.

## Errores

Nunca un mensaje crudo de la base en pantalla. Todo pasa por `clasificarFalla` de
`src/lib/fallas.ts`, que devuelve título, explicación en lenguaje de usuario y **la acción que
de verdad desatasca**:

| Situación | Acción que se ofrece |
|---|---|
| Se publicó una versión nueva | **Actualizar** (recarga limpiando caché y service worker) |
| Sin conexión | Reintentar |
| Sin permiso (RLS) | Ninguna — reintentar no va a cambiar nada |
| Falta una migración | Ninguna |
| Cualquier otra | Reintentar |

El orden de esas ramas importa: **sin conexión se evalúa antes que versión vieja**, porque sin
red un módulo también falla al bajar y ahí actualizar es lo peor que se puede hacer — una
recarga sin red deja la pantalla en blanco.

Ofrecer "Reintentar" cuando reintentar no puede funcionar es peor que no ofrecer nada.

## Datos que llegan de la base

Dos pasos, en `src/lib/schemas.ts`, con roles distintos y por eso conviven:

- `validateRows` **avisa** del drift de la base sin tocar los datos.
- `saneaCards` **arregla** lo arreglable y **descarta** lo inservible antes de que un
  componente lo toque.

Que falte una tarjeta es un problema chico y visible; que se caiga la pantalla es grande. El
saneado usa `looseObject` para que las columnas que el esquema no nombra sobrevivan: si las
borrara, arreglar un dato roto costaría perder features enteras.
