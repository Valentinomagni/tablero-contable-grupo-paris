# Plan 09 — Autenticación Corporativa (login con usuario) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development o executing-plans. Checkbox steps.

**Goal:** Login con **nombre de usuario** (ej. `Vmagni`), no con email. El email corporativo queda solo para autenticar/recuperar contraseña y NO se muestra en la UI. El nombre real es independiente.

**Architecture (decisión confirmada por el usuario):** enfoque **usuario→email interno**. El usuario escribe `username` + contraseña; el front resuelve el email real vía una RPC `security definer` (`email_por_usuario`) y llama a `supabase.auth.signInWithPassword(email, password)`. Supabase Auth sigue siendo la fuente de verdad (seguridad intacta); el email nunca se muestra.

**Tech Stack:** Supabase Auth + RPC, React.

## Global Constraints
- ES EL PLAN MÁS RIESGOSO: toca el login de todo el equipo en producción. Ejecutar último, con backup previo (Admin → backup JSON) y probando en un usuario de test antes del rollout.
- Migración de datos: cada perfil necesita un `username` único. Definir uno por persona antes de forzar el nuevo login.

---

### Task 1: Migración — username

**Files:**
- Create: `migracion-19-username.sql`

- [ ] **Step 1: Migración**
```sql
-- Migración 19 — Username para login corporativo
alter table public.profiles add column if not exists username text unique;

-- RPC que mapea username -> email (para login). SECURITY DEFINER: solo devuelve el email
-- correspondiente a un username exacto; no lista ni expone otros datos.
create or replace function public.email_por_usuario(u text) returns text
language sql security definer set search_path = public as $$
  select email from public.profiles where lower(username) = lower(u) limit 1;
$$;
grant execute on function public.email_por_usuario(text) to anon, authenticated;
```
- [ ] **Step 2:** Aplicar. Cargar `username` para cada perfil existente (desde Admin o un `update` puntual; ej. Vmagni). Tipo `Profile.username: string | null` en `types.ts`.
- [ ] **Step 3:** Commit — `git commit -m "feat(auth): migración username + RPC email_por_usuario (spec #16)"`

---

### Task 2: Login por usuario

**Files:**
- Modify: `src/components/Login.tsx` (campo "Usuario" en vez de "Email")
- Modify: `src/hooks/useAuth.ts` (nuevo `signIn(username, password)`)

**Interfaces:**
- `signIn` resuelve email vía RPC y luego autentica.

- [ ] **Step 1:** `useAuth.signIn` pasa a:
```typescript
async function signIn(username: string, password: string) {
  const { data: email } = await supabase.rpc("email_por_usuario", { u: username.trim() });
  if (!email) return { error: "Usuario no encontrado" };
  return supabase.auth.signInWithPassword({ email, password });
}
```
- [ ] **Step 2:** `Login.tsx`: label "Usuario", input text (no email), placeholder "Ej: Vmagni". Mensaje de error claro. La recuperación de contraseña sigue por email (Supabase) — texto "¿Olvidaste la contraseña? Pedile al jefe el reseteo" o link a reset por email.
- [ ] **Step 3:** Test de que `signIn` con usuario inexistente devuelve error sin llamar a auth. Build + smoke + **e2e** (actualizar `e2e/app.spec.ts` y `scripts/smoke.mjs`/`shots.mjs` para loguear por usuario `jefe1`→ su username). Commit — `git commit -m "feat(auth): login por nombre de usuario (spec #16)"`

---

### Task 3: Ocultar email en toda la UI

**Files:**
- Modify: `src/features/admin/Admin.tsx` (tabla muestra email → cambiar a username)
- Modify: `src/features/admin/UserModal.tsx`, `src/components/AccountModal.tsx` (email solo como "correo de recuperación", no identificador)

- [ ] **Step 1:** Reemplazar toda muestra de `email` como identificador por `username` (o `name`). El email queda solo en la ficha como "correo de recuperación".
- [ ] **Step 2:** Crear usuario (Admin + edge function): agregar campo `username` obligatorio y único; el email sigue requerido para auth pero se etiqueta "correo corporativo (acceso/recuperación)".
- [ ] **Step 3:** Validación: username único y no vacío (`usuarioValido` + chequeo de unicidad). Build + smoke. Commit — `git commit -m "feat(auth): username como identificador visible, email solo para recuperación (spec #16)"`

---

### Task 4: Rollout seguro

- [ ] **Step 1:** Backup JSON (Admin) antes de nada.
- [ ] **Step 2:** Probar login por usuario con UN perfil de test end-to-end en producción.
- [ ] **Step 3:** Cargar `username` a todo el equipo. Comunicar el cambio. Recién entonces quitar el login por email.
- [ ] **Step 4:** Commit/tag de release — `git commit -m "chore(auth): rollout login por usuario verificado (spec #16)"`

## Self-review
- #16 completo: login por usuario (T2), email oculto (T3), nombre independiente (ya lo es: `name` ≠ `username` ≠ `email`). Enfoque usuario→email confirmado. Riesgo mitigado con rollout (T4).
