# Acceso y permisos

Quién puede hacer qué, y qué hacer cuando alguien no puede entrar.

## Cuando alguien no puede entrar

Preguntale **qué dice exactamente el cartel**. El login ahora distingue los casos, y cada uno
lleva a una acción distinta:

| Lo que dice | Qué pasó | Qué hacer |
|---|---|---|
| "No encontré ninguna cuenta con X" | El usuario que escribió no existe | Que pruebe con su correo. Si tampoco, revisá el usuario en Administración |
| "El usuario o la contraseña no coinciden" | Existe, pero algo no coincide | Blanqueale la contraseña (abajo) |
| "Hubo demasiados intentos seguidos" | Supabase lo frenó un rato | Esperar unos minutos. **No** cambiar la contraseña: no es eso |
| "No hay conexión con el servidor" | Internet | Revisar la conexión |
| "Tu cuenta todavía no está confirmada" | Falta confirmarla | Confirmarla en Supabase → Authentication → Users |

A propósito, cuando la contraseña no coincide **no se aclara cuál de los dos falló**. Decir
"el usuario existe pero la contraseña está mal" le confirma a un desconocido que esa cuenta
existe.

## Blanquear una contraseña

**Sólo el jefe.** Administración → clic en la persona → "Blanquear contraseña".

Genera una contraseña temporal, la muestra **una sola vez** y no la guarda en ningún lado. Hay
que anotarla en el momento; si se pierde, se genera otra. Pasásela a la persona por donde se
hablen habitualmente y pedile que la cambie cuando entre.

La persona recibe además un aviso dentro de la app diciendo que su contraseña fue restablecida
y quién lo hizo. Eso no es un detalle: es lo que separa una herramienta de soporte de una
puerta trasera.

**Por qué no hay "recuperar contraseña por email":** los usuarios se crean con un correo que se
escribe a mano y que puede no ser una casilla real que la persona revise. Un blanqueo que
depende de un mail que quizá no llega es peor que no tener blanqueo.

## Qué puede hacer cada rol

| | Empleado | Encargado | Jefe | Admin del sistema |
|---|---|---|---|---|
| Ver y editar sus tareas | Sí | Sí | Sí | Sí |
| Ver y editar las de su equipo | No | Sí | Sí | Sí |
| Ver todo el equipo | No | Su equipo | Sí | Sí |
| Crear y eliminar usuarios | No | No | Sí | No |
| Blanquear contraseñas | No | No | **Sí** | No |
| Cambiar rol, marca o sucursal | No | No | Sí | No |
| Ver las consultas del equipo | Las suyas | Las suyas | **No** | **Sí** |

Dos cosas de esa tabla que suelen sorprender y son a propósito:

- **El jefe no ve las consultas.** Es el canal donde el equipo reporta problemas; si lo leyera
  el jefe, nadie reportaría nada incómodo. Van a la cuenta de administración del sistema.
- **El admin del sistema no administra usuarios.** Sólo ve las consultas. Son dos permisos
  separados a propósito: quien lee los reclamos no es quien decide sobre las cuentas.

## Cómo se hace cumplir

En la base, no en la pantalla. Esconder un botón no es un permiso: quien sepa hacerlo llama a
la base igual. Las reglas reales son las policies de RLS, y la app sólo evita mostrar cosas que
el servidor va a rechazar de todos modos.

Tres piezas:

- **Policies de RLS** por tabla, con el mismo modelo en todas: propio, o `es_jefe()`, o
  `es_encargado_de(owner)`. **Lectura y escritura tienen que coincidir** — la migración 36
  existe porque no coincidían y un encargado podía ver el trabajo de su equipo pero no
  guardarlo.
- **Un trigger sobre `profiles`** que bloquea las columnas sensibles (`role`, `manager_id`,
  `oculto`, `username`, `email`, `marca`, `sucursal`, `admin_sistema`). **Toda columna nueva
  que otorgue permisos tiene que agregarse ahí en la misma migración que la crea**: es una
  lista explícita, así que lo que no está queda desprotegido en silencio. La migración 35
  existe porque `admin_sistema` se agregó y nadie tocó el trigger.
- **Edge Functions** para lo que necesita `service_role` (crear, eliminar y blanquear). Cada
  una valida el rol leyéndolo de la base, nunca del cuerpo del pedido.

## Desplegar una Edge Function

Los archivos `edge-function-*.ts` de la raíz son **referencia local**: no se compilan ni se
suben con la app. Para cada uno:

1. Supabase Dashboard → Edge Functions
2. Si no existe, "Create function" con el nombre exacto (`blanquear-clave`)
3. Edit → reemplazar **todo** el contenido por el del archivo → Deploy

No hace falta configurar variables: `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` ya están
disponibles dentro de las funciones.
