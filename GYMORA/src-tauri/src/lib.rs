// lib.rs — Entry point del crate GYMORA (backend Tauri)
//
// Este archivo es el punto de entrada principal del backend Rust.
// Registra todos los módulos, plugins y comandos Tauri.
//
// Módulos de la Fase 1:
//   - hardware_id: Generación del fingerprint único de hardware
//   - database: Inicialización de SQLite con WAL mode
//   - license: Verificación y activación de licencia

// Declaración de módulos internos
mod hardware_id;
mod database;
mod license;

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
        // Setup: inicialización que requiere acceso al AppHandle
        .setup(|app| {
            // Inicializamos la base de datos SQLite.
            // Esto crea el archivo gymora.db en AppData/Local y configura WAL mode.
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
            license::check_license,
            license::activate_license,
            license::get_hardware_id,
        ])
        .run(tauri::generate_context!())
        .expect("Error fatal al ejecutar la aplicación GYMORA");
}
