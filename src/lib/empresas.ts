import type { Empresa } from "./types";

// Datos estratégicos de empresas (spec 28, Task 8): SOLO estos 4 campos
// (nombre, CUIT, cierre de balance, reporta a fábrica, prioridad manual).
// A propósito NO hay domicilio, contactos, condición de IVA, actividad ni
// cuentas: esto es parametrización para priorizar trabajo interno, no un
// maestro de clientes tipo ERP — eso es Quiter. No agregar campos acá.

// Peso fijo que suma reportar a fábrica: alcanza para superar cualquier
// diferencia de 1 punto en la prioridad manual (0..4), de forma que "reporta
// a fábrica" empuja a la empresa por encima de cualquiera que no reporte con
// prioridad manual apenas mayor, pero una prioridad manual mucho más alta
// (+5 o más) todavía puede ganarle. Es una combinación simple y determinística:
// no hay aleatoriedad ni dependencia de reloj.
//
// INVARIANTE CRÍTICO: `prioridad` DEBE estar en el rango 0..4 (impuesto por
// la migración 31 en la DB y validado en el UI). Si este rango no se cumple,
// el bonus de fábrica puede no ser decisivo. El clamp defensivo de abajo lo
// refuerza por si llegara un dato fuera de rango de una base vieja.
const PESO_REPORTA_FABRICA = 5;
const PRIORIDAD_MIN = 0;
const PRIORIDAD_MAX = 4;

// Prioridad efectiva = prioridad manual (elegida por el jefe) + bonus fijo si
// reporta a fábrica. Mayor número = mayor prioridad.
//
// Clampea defensivamente `prioridad` a 0..4 aunque la DB debería garantizarlo:
// así la función es robusta ante datos de migraciones viejas o errores.
export function prioridadEmpresa(e: Empresa): number {
  const prioridadClamped = Math.max(PRIORIDAD_MIN, Math.min(PRIORIDAD_MAX, e.prioridad));
  return prioridadClamped + (e.reporta_fabrica ? PESO_REPORTA_FABRICA : 0);
}

// Orden para mostrar en la UI: mayor prioridad efectiva primero; empate se
// desempata alfabéticamente por nombre (localeCompare, sensible a acentos/ñ).
// No muta el array recibido.
export function ordenarEmpresas(es: Empresa[]): Empresa[] {
  return [...es].sort((a, b) => {
    const diff = prioridadEmpresa(b) - prioridadEmpresa(a);
    if (diff !== 0) return diff;
    return a.nombre.localeCompare(b.nombre, "es");
  });
}
