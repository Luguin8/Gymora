// database.rs — Módulo de inicialización y gestión de la base de datos SQLite
//
// Responsabilidades:
//   - Crear/abrir la base de datos en el directorio de datos de la aplicación
//   - Ejecutar PRAGMA journal_mode=WAL (requerido por la guía para concurrencia)
//   - Crear las tablas iniciales (en esta fase, solo la tabla `licencia`)
//
// La BD se almacena en el directorio estándar de datos del usuario de Tauri,
// NO en el directorio de la aplicación, para sobrevivir actualizaciones.

use rusqlite::Connection;
use std::sync::Mutex;
use tauri::Manager;

/// Estado global de la base de datos envuelto en un Mutex.
///
/// ¿Por qué un Mutex? Tauri ejecuta los comandos en un thread pool,
/// y SQLite no es thread-safe por defecto. El Mutex garantiza acceso
/// exclusivo a la conexión, evitando race conditions.
pub struct DbState {
    pub conn: Mutex<Connection>,
}

/// Inicializa la base de datos: abre la conexión, configura WAL y crea tablas.
///
/// Usa `app.path().app_local_data_dir()` de Tauri v2 para obtener el directorio
/// de datos local (AppData/Local/com.gymora.app en Windows).
///
/// ¿Por qué WAL (Write-Ahead Logging)? Permite lecturas concurrentes mientras
/// se escribe, lo cual es crítico cuando múltiples comandos Tauri acceden
/// a la BD simultáneamente desde distintos threads.
pub fn initialize_database(app_handle: &tauri::AppHandle) -> Result<DbState, String> {
    // Tauri v2 API: app.path().app_local_data_dir()
    let app_data_dir = app_handle
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("No se pudo resolver el directorio de datos: {}", e))?;

    // Creamos el directorio si no existe
    std::fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("Error al crear directorio de datos: {}", e))?;

    let db_path = app_data_dir.join("gymora.db");

    // Abrimos (o creamos) la base de datos SQLite
    let conn = Connection::open(&db_path)
        .map_err(|e| format!("Error al abrir la base de datos en {:?}: {}", db_path, e))?;

    // PRAGMA journal_mode=WAL — Regla estricta del proyecto
    // Esto DEBE ejecutarse antes de cualquier otra operación
    conn.execute_batch("PRAGMA journal_mode=WAL;")
        .map_err(|e| format!("Error al configurar WAL mode: {}", e))?;

    // Creamos la tabla de licencia si no existe.
    // Esta tabla almacena la relación entre el hardware_id de la máquina
    // y la clave de activación proporcionada por el desarrollador.
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS licencia (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            hardware_id TEXT NOT NULL,
            clave_activacion TEXT NOT NULL,
            fecha_activacion TEXT NOT NULL
        );"
    )
    .map_err(|e| format!("Error al crear tabla licencia: {}", e))?;

    Ok(DbState {
        conn: Mutex::new(conn),
    })
}
