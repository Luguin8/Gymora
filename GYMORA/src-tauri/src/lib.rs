// lib.rs — Entry point del crate GYMORA (backend Tauri)
//
// Este archivo es el punto de entrada principal del backend Rust.
// Registra todos los módulos, plugins y comandos Tauri.
//
// Módulos de la Fase 1:
//   - hardware_id: Generación del fingerprint único de hardware
//   - database: Inicialización de SQLite con WAL mode
//   - license: Verificación y activación de licencia
//
// Módulos de la Fase 2:
//   - models: Structs serializables del dominio (Usuario, Alumno, Cuota, etc.)
//   - commands: Submódulo con los comandos CRUD agrupados por entidad
//     ├── usuarios: CRUD de dueños/profesores + validación de PIN
//     ├── alumnos: CRUD con búsqueda flexible por nombre/DNI
//     ├── cuotas: Gestión de planes (mensual/paquete de clases)
//     ├── pagos: Registro de cobros en caja
//     └── asistencias: Lógica core del kiosco de recepción

// Declaración de módulos internos — Fase 1
mod hardware_id;
mod database;
mod license;

// Declaración de módulos internos — Fase 2
mod models;
mod commands;

use database::initialize_database;
// Manager trait requerido para .manage() y otros métodos de Tauri v2
use tauri::Manager;

/// Punto de entrada principal de la aplicación Tauri.
///
/// Flujo de inicialización:
///   1. Se configura el Builder de Tauri con plugins (opener, updater)
///   2. Se usa `setup` para inicializar la BD y registrar el estado global
///   3. Se registran los comandos Tauri expuestos al frontend
///   4. Se lanza la ventana principal
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Plugin para abrir URLs/archivos con la app del sistema
        .plugin(tauri_plugin_opener::init())
        // Plugin de actualizaciones automáticas (configurado en tauri.conf.json)
        // Listo para conectarse a GitHub Releases u otro endpoint a futuro
        .plugin(tauri_plugin_updater::Builder::new().build())
        // Plugin de diálogo nativo (Save As, Open File, etc.)
        .plugin(tauri_plugin_dialog::init())
        // Setup: inicialización que requiere acceso al AppHandle
        .setup(|app| {
            // Inicializamos la base de datos SQLite.
            // Esto crea el archivo gymora.db en AppData/Local y configura WAL mode.
            // En Fase 2: ahora también crea las tablas de dominio (usuarios, alumnos, etc.)
            let db_state = initialize_database(app.handle())
                .expect("Error crítico: no se pudo inicializar la base de datos");

            // Registramos el estado de la BD como estado global de Tauri.
            // Esto permite que todos los comandos #[tauri::command] accedan
            // a la conexión vía State<DbState>.
            app.manage(db_state);

            Ok(())
        })
        // Registro de comandos Tauri expuestos al frontend React.
        // Cada función aquí es invocable desde JS con `invoke("nombre_comando")`.
        .invoke_handler(tauri::generate_handler![
            // --- Fase 1: Licencia y seguridad ---
            license::check_license,
            license::activate_license,
            license::get_hardware_id,

            // --- Fase 2: CRUD de dominio ---
            // Usuarios (dueño/profesor)
            commands::usuarios::crear_usuario,
            commands::usuarios::validar_pin,
            commands::usuarios::obtener_usuarios,

            // Alumnos
            commands::alumnos::crear_alumno,
            commands::alumnos::obtener_alumno_por_dni,
            commands::alumnos::buscar_alumnos,

            // Cuotas (planes)
            commands::cuotas::crear_cuota,
            commands::cuotas::obtener_cuotas_alumno,

            // Pagos (caja)
            commands::pagos::registrar_pago,
            commands::pagos::obtener_pagos_alumno,

            // Asistencias (kiosco — comando CORE)
            commands::asistencias::registrar_asistencia,

            // --- Fase 6: Dashboard y PDF ---
            commands::dashboard::obtener_metricas_dashboard,
            commands::dashboard::generar_pdf_caja,
        ])
        .run(tauri::generate_context!())
        .expect("Error fatal al ejecutar la aplicación GYMORA");
}
