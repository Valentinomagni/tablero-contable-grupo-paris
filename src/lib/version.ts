// Versión de la app y changelog en lenguaje de usuario (se muestra en "Novedades").
export const APP_VERSION = "2.1.0";

export const CHANGELOG: { version: string; fecha: string; cambios: string[] }[] = [
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
