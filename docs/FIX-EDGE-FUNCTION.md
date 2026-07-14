# Fix: Edge Function crear-usuario (diagnóstico 14/07/2026)

**Diagnóstico hecho por API**: `POST https://yyyrlopgwmuvfbzwxiwp.supabase.co/functions/v1/crear-usuario` responde
`404 {"code":"NOT_FOUND","message":"Requested function was not found"}`.

**Conclusión**: la función NO está desplegada con ese nombre. No es un bug del código (el código de
`tablero-contable/edge-function-crear-usuario.ts` es correcto y autocontenido — usa las env vars que
Supabase inyecta solo: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY, no hay secrets que configurar).

**Lo más probable**: al crearla en el dashboard quedó con otro nombre (el default que sugiere Supabase,
o con guion bajo `crear_usuario`), o el deploy quedó en borrador sin apretar "Deploy".

## Cómo arreglarlo (5 min, cuando tengas un hueco)
1. Dashboard Supabase → proyecto `yyyrlopgwmuvfbzwxiwp` → **Edge Functions**.
2. Mirá la lista: si hay una función con otro nombre, borrala (o ignorala).
3. **Deploy new function** → nombre EXACTO: `crear-usuario` (con guion medio).
4. Pegá el contenido completo de `tablero-contable/edge-function-crear-usuario.ts`.
5. **Deploy** y esperá el tilde verde.
6. Probá desde la app: Administración → Crear usuario nuevo. Si algo falla ahora vas a ver el motivo
   real en el mensaje (la UI ya distingue errores), y en el dashboard → Edge Functions → Logs.

Verificación externa rápida (sin crear nada): `curl -X OPTIONS https://yyyrlopgwmuvfbzwxiwp.supabase.co/functions/v1/crear-usuario`
debe dar **200** (hoy da 404).
