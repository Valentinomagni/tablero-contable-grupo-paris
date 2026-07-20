// Versión de la app y changelog en lenguaje de usuario (se muestra en "Novedades").
// APP_VERSION se deriva SIEMPRE de la primera entrada del changelog: agregá la entrada
// nueva arriba de todo y la versión se actualiza sola (ver docs/RELEASE.md).
export const CHANGELOG: { version: string; fecha: string; cambios: string[] }[] = [
  {
    version: "2.2.0",
    fecha: "2026-07-20",
    cambios: [
      "Mi día: tu agenda del día con lo urgente primero.",
      "Arqueo de caja con resultado (ok o con diferencias) directamente desde tu día.",
      "Avisos en el tablón con prioridad, vencimiento y ahora se pueden eliminar definitivamente.",
      "Sucursales: organizá y filtrá el tablero y el reporte por marca y sucursal.",
      "Nuevo modo de agrupación del tablero: elegí cómo querés ver tus tareas, con varias opciones a elección.",
      "Registro de vacaciones y cobertura de tareas mientras alguien está de licencia.",
      "Buscador rápido de avisos con Ctrl+K.",
      "Plantillas para crear tareas frecuentes en un solo paso.",
      "Alertas para gestores cuando algo necesita atención antes de que sea un problema.",
      "Menciones con @ en los comentarios de las tareas, con notificación para la persona mencionada.",
      "Reporte con métricas de uso del tiempo del equipo.",
      "Se arregló la impresión del reporte: ahora sale completa y prolija.",
      "El resumen y el reporte ahora se adaptan al rol y la jerarquía de cada persona.",
      "Reporte: el indicador de puntualidad ahora muestra cuántas tareas se midieron y avisa cuando la muestra es chica.",
    ],
  },
  {
    version: "2.1.0",
    fecha: "2026-07-16",
    cambios: [
      "Ahora podés editar los ítems del checklist y las tareas operativas.",
      "Delegá tareas a otra persona directamente desde el tablero.",
      "El calendario está disponible para todo el equipo, no solo para jefes.",
      "Nuevo organigrama para ver la estructura del equipo.",
      "Anotaciones privadas: notas que solo ves vos.",
      "Cierre mensual con checklist de fin de mes.",
      "Tareas recurrentes con seguimiento de cumplimiento diario.",
      "Los avisos de vencimiento ahora se ven de forma más clara.",
      "Modo oscuro más limpio, con mejor separación entre tarjetas.",
      "La barra lateral queda fija: ya no se cierra sola al navegar.",
      "Podés iniciar sesión con tu nombre de usuario.",
    ],
  },
  {
    version: "2.0.0",
    fecha: "2026-07-13",
    cambios: ["Migración completa a la nueva plataforma."],
  },
];

export const APP_VERSION = CHANGELOG[0].version;
