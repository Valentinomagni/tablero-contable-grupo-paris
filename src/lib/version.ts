// Versión de la app y changelog en lenguaje de usuario (se muestra en "Novedades").
// APP_VERSION se deriva SIEMPRE de la primera entrada del changelog: agregá la entrada
// nueva arriba de todo y la versión se actualiza sola (ver docs/RELEASE.md).
export const CHANGELOG: { version: string; fecha: string; cambios: string[] }[] = [
  {
    version: "2.5.0",
    fecha: "2026-07-22",
    cambios: [
      "Mis arqueos: mirá tu historial de diferencias de caja del mes, con el detalle de qué faltó y qué sobró.",
      "Al registrar una diferencia ahora elegís si falta o sobra plata, así el número queda bien cargado.",
      "Cierre del día: un repaso al final de tu jornada para no dejarte nada abierto.",
      "Si un vencimiento tuyo es hoy o mañana, te llega un aviso.",
      "Reporte: nuevo indicador de retrabajo, para detectar tareas que se reabren seguido.",
      "Reporte: cómo evolucionan las diferencias de caja mes a mes.",
      "Resumen: radar de vencimientos, que avisa cuáles podrían no llegar a tiempo.",
      "La campana de notificaciones ahora se actualiza al instante.",
      "La app carga más rápido: pesa un 20% menos al abrirla.",
    ],
  },
  {
    version: "2.4.0",
    fecha: "2026-07-21",
    cambios: [
      "Consultas: desde el menú de tu perfil podés mandar consultas, sugerencias o avisar errores, y ver la respuesta.",
      "Cerrá tu mes cuando vos terminaste: podés tener junio y julio abiertos a la vez, sin que uno trabe al otro.",
      "Tiempo máximo por tarea: se puede configurar cuántas horas debería llevar cada tipo de tarea, y queda registrado si se pasa.",
      "Ahora se ve quién está en línea y cuándo fue su última conexión.",
      "Nuevo campo Dato de control a adjuntar para anotar una referencia, código o comprobante en la tarea.",
      "El tablero agrupado ahora usa carriles: la tarea cambia de columna sin salirse de su grupo.",
    ],
  },
  {
    version: "2.3.0",
    fecha: "2026-07-20",
    cambios: [
      "Cierre del mes unificado: una sola pantalla te muestra con un semáforo si el mes quedó cerrado (checklist, historial guardado y tareas recurrentes en cero).",
      "El análisis mensual del reporte ahora se exporta a Excel con un click.",
      "Adjuntos en las tareas: subí comprobantes y archivos directamente en cada tarea (PDF, imágenes, Excel).",
      "Aviso de sin conexión: si se corta internet, la app te lo dice antes de que pierdas cambios.",
      "Administración muestra si la base de datos está al día o falta aplicar alguna actualización.",
      "Resumen semanal automático en el tablón con lo importante de la semana (se activa con una configuración).",
    ],
  },
  {
    version: "2.2.0",
    fecha: "2026-07-20",
    cambios: [
      "Categorías: ahora cualquier persona puede asignarlas y filtrar por ellas en su tablero, no solo jefes y encargados.",
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
      "Reporte: análisis ejecutivo del mes con cumplimiento por persona, marca y sucursal, más tu rendimiento promedio histórico para ver si mejoramos.",
      "Se arregló la impresión del reporte: ahora sale completa y prolija.",
      "El resumen y el reporte ahora se adaptan al rol y la jerarquía de cada persona.",
      "Reporte: el indicador de puntualidad ahora muestra cuántas tareas se midieron y avisa cuando la muestra es chica.",
      "Reporte: el análisis mensual ahora se puede exportar a Excel.",
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
