# Rediseño Visual Premium (v2) — Plan

Feedback del usuario: "sigue sin sorprenderme… desde lo visual le falta muchísimo". Los pases anteriores fueron de tokens (invisibles a simple vista). Este pase cambia la ANATOMÍA de las pantallas — lo que sí se ve.

## Método
1. VER la app (screenshot real) antes y después de cada cambio — no diseñar a ciegas.
2. Referencia: dashboards premium (Linear/Vercel/Stripe): jerarquía tipográfica fuerte, hairline borders, superficies planas limpias, un solo acento, mucho aire.

## Cambios de alto impacto visual
1. **Topbar**: título más grande (20px/650) + subtítulo contextual; fecha como chip discreto; separador hairline. Buscador global visible (no solo Ctrl+K).
2. **Sidebar**: secciones con más aire; ítem activo con fondo pill + barra de acento; contadores como chips redondos; hover con transición; footer de usuario más rico (nombre+rol en dos líneas ya está).
3. **Stat tiles** (Resumen/MiMes): números 32px/700 tnum, label 11px uppercase, ícono Lucide arriba a la derecha en soft-accent, borde hairline, radius 16, padding 20; grid uniforme de 4.
4. **Section headers**: título 13px/600 sentence-case (no uppercase gris chiquito en TODO — reservar uppercase para labels), con acción a la derecha cuando aplique.
5. **Kanban**: columnas SIN glass (plano limpio bg-surface2/40), header de columna con contador alineado; cards con radius 12, padding 14, título 13.5/600, meta-row de chips uniformes altura 22.
6. **Tabla equipo**: filas 44px, hover con bg suave, primera columna con avatar 28 + nombre 600.
7. **Login**: ya es fuerte (negro + logo). Ajustar: form con radius 20 y sombra más profunda.
8. **Charts**: barras con radius superior, color accent sólido 85%, gridline sutil.

## Verificación
Screenshot desktop light + dark de: Login, Resumen, Tablero persona, Reporte. Comparar contra checklist ui-ux-pro-max (§4 estilo, §6 tipografía).
