# Leer las consultas del equipo fuera de la app

Un comando baja todo lo que el equipo reportó (consultas, sugerencias y errores) a un
archivo de texto en esta carpeta, para poder leerlo y analizarlo sin abrir el navegador.

## Preparación (una sola vez)

1. Crear un archivo llamado **`.env.consultas.local`** en la carpeta del proyecto, con
   estas dos líneas:

   ```
   SUPABASE_EMAIL=tu.cuenta.de.administracion@ejemplo.com
   SUPABASE_PASSWORD=la-contrasena-de-esa-cuenta
   ```

   Es la misma cuenta con la que entrás a la app a ver las consultas.

2. Listo. No hay que instalar nada.

## Cada vez que quieras mirarlas

```bash
node scripts/consultas.mjs
```

Escribe **`consultas-bandeja.md`** en la carpeta del proyecto, agrupado así:

- **Errores** primero, porque son los que tienen a alguien trabado.
- Después **consultas**, y por último **sugerencias**.
- Dentro de cada grupo, lo que todavía nadie vio va arriba, y lo más reciente primero.
- Cada una indica quién la mandó, cuándo, y si ya tiene respuesta.

## Qué NO hace

- **No modifica nada.** Solo lee. Marcar una consulta como leída o responderla se sigue
  haciendo desde la app, que es donde le llega la respuesta a la persona.
- **No cuenta consultas por persona ni arma ningún ranking.** El nombre está para poder
  responderle, no para contabilizarlo. Alguien que reporta diez errores está haciendo el
  trabajo bien, no mal.

## Cosas a tener en cuenta

- **`consultas-bandeja.md` tiene texto escrito por tu equipo.** Está ignorado por git, así
  que no se sube a GitHub, pero queda en esta computadora en texto plano. Si la compartís,
  compartís lo que escribieron.
- **`.env.consultas.local` tiene una contraseña en texto plano.** También está ignorado por
  git. Es el precio de no tener que abrir el navegador cada vez; si preferís no tenerlo,
  la alternativa es mirar las consultas desde la app como hasta ahora.
- **Si el archivo sale vacío**, puede ser que todavía nadie haya mandado nada, o que la
  cuenta no tenga permiso: hace falta la **migración 33** aplicada y que esa cuenta esté
  marcada como administradora del sistema.

## Por qué no una segunda base de datos

Fue lo primero que se evaluó y se descartó. Poner las consultas en otra base no ayudaría:
seguiría haciendo falta bajarlas a un archivo igual, y encima habría dos copias de los
mismos datos que se pueden desincronizar sin avisar. Este script hace lo que hacía falta y
nada más.
