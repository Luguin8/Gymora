// commands/mod.rs — Módulo raíz de comandos Tauri
//
// Centraliza la re-exportación de todos los submódulos de comandos.
// Cada submódulo agrupa los comandos por entidad de dominio.
//
// Al agregar una nueva entidad, basta con:
//   1. Crear el archivo commands/nueva_entidad.rs
//   2. Agregar `pub mod nueva_entidad;` aquí
//   3. Registrar los comandos en lib.rs

pub mod usuarios;
pub mod alumnos;
pub mod cuotas;
pub mod pagos;
pub mod asistencias;
pub mod dashboard;
