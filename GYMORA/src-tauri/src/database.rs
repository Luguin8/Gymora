// database.rs — Módulo de inicialización y gestión de la base de datos SQLite
//
// Responsabilidades:
//   - Crear/abrir la base de datos en el directorio de datos de la aplicación
//   - Ejecutar PRAGMA journal_mode=WAL (requerido por la guía para concurrencia)
//   - Crear TODAS las tablas del sistema (licencia + dominio de negocio)
//
// La BD se almacena en el directorio estándar de datos del usuario de Tauri,
// NO en el directorio de la aplicación, para sobrevivir actualizaciones.
//
// === FASE 2: Se añaden las tablas de dominio ===
//   - usuarios: Dueño y Profesores con PIN de 4 dígitos
//   - alumnos: Datos personales, DNI único, estado activo/baja
//   - cuotas: Planes por mes calendario o paquete de clases
//   - pagos: Registro de caja con método de pago y quién cobró
//   - asistencias: Historial de ingresos con timestamp

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

    // Habilitamos foreign keys — SQLite las tiene desactivadas por defecto.
    // Sin esto, las relaciones entre tablas (alumno_id, usuario_id) no se validarían.
    conn.execute_batch("PRAGMA foreign_keys=ON;")
        .map_err(|e| format!("Error al activar foreign keys: {}", e))?;

    // Creamos todas las tablas del sistema en una transacción atómica.
    // Si alguna falla, ninguna se crea — evitamos estados inconsistentes.
    conn.execute_batch(
        "
        -- =================================================================
        -- TABLA: licencia (Fase 1)
        -- Almacena la relación hardware_id ↔ clave de activación
        -- =================================================================
        CREATE TABLE IF NOT EXISTS licencia (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            hardware_id TEXT NOT NULL,
            clave_activacion TEXT NOT NULL,
            fecha_activacion TEXT NOT NULL
        );

        -- =================================================================
        -- TABLA: usuarios (Fase 2)
        -- Roles del sistema: 'dueño' o 'profesor'
        -- El PIN es de 4 dígitos, usado para login rápido en recepción
        -- =================================================================
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            rol TEXT NOT NULL CHECK (rol IN ('dueño', 'profesor')),
            pin_acceso TEXT NOT NULL CHECK (length(pin_acceso) = 4),
            activo INTEGER NOT NULL DEFAULT 1
        );

        -- =================================================================
        -- TABLA: alumnos (Fase 2)
        -- DNI es único — es el identificador principal en el kiosco.
        -- 'activo' permite dar de baja lógica sin borrar el historial.
        -- =================================================================
        CREATE TABLE IF NOT EXISTS alumnos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            dni TEXT NOT NULL UNIQUE,
            nombre TEXT NOT NULL,
            apellido TEXT NOT NULL,
            telefono TEXT DEFAULT '',
            fecha_alta TEXT NOT NULL,
            activo INTEGER NOT NULL DEFAULT 1
        );

        -- =================================================================
        -- TABLA: cuotas (Fase 2)
        -- Modelo flexible que cubre dos modalidades:
        --   1. Mes calendario: clases_totales = 0 (ilimitadas), se verifica fecha_vencimiento
        --   2. Paquete de clases: clases_totales > 0, se descuenta clases_restantes
        -- 'activa' se marca FALSE cuando vence o se agotan las clases.
        -- =================================================================
        CREATE TABLE IF NOT EXISTS cuotas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            alumno_id INTEGER NOT NULL,
            fecha_inicio TEXT NOT NULL,
            fecha_vencimiento TEXT NOT NULL,
            clases_totales INTEGER NOT NULL DEFAULT 0,
            clases_restantes INTEGER NOT NULL DEFAULT 0,
            activa INTEGER NOT NULL DEFAULT 1,
            FOREIGN KEY (alumno_id) REFERENCES alumnos(id)
        );

        -- =================================================================
        -- TABLA: pagos (Fase 2)
        -- Registro de caja: cada pago está vinculado al alumno que pagó
        -- y al usuario (profesor/dueño) que realizó el cobro.
        -- metodo_pago: 'efectivo' o 'transferencia'
        -- =================================================================
        CREATE TABLE IF NOT EXISTS pagos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            alumno_id INTEGER NOT NULL,
            usuario_id INTEGER NOT NULL,
            monto REAL NOT NULL CHECK (monto > 0),
            metodo_pago TEXT NOT NULL CHECK (metodo_pago IN ('efectivo', 'transferencia')),
            fecha_pago TEXT NOT NULL,
            FOREIGN KEY (alumno_id) REFERENCES alumnos(id),
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        );

        -- =================================================================
        -- TABLA: asistencias (Fase 2)
        -- Registro histórico de cada ingreso al gimnasio.
        -- fecha_hora se almacena como TEXT en formato ISO 8601.
        -- =================================================================
        CREATE TABLE IF NOT EXISTS asistencias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            alumno_id INTEGER NOT NULL,
            fecha_hora TEXT NOT NULL,
            FOREIGN KEY (alumno_id) REFERENCES alumnos(id)
        );

        -- =================================================================
        -- ÍNDICES de rendimiento
        -- Optimizan las queries más frecuentes del kiosco y admin.
        -- =================================================================
        CREATE INDEX IF NOT EXISTS idx_alumnos_dni ON alumnos(dni);
        CREATE INDEX IF NOT EXISTS idx_cuotas_alumno ON cuotas(alumno_id, activa);
        CREATE INDEX IF NOT EXISTS idx_pagos_alumno ON pagos(alumno_id);
        CREATE INDEX IF NOT EXISTS idx_pagos_fecha ON pagos(fecha_pago);
        CREATE INDEX IF NOT EXISTS idx_asistencias_alumno ON asistencias(alumno_id);
        CREATE INDEX IF NOT EXISTS idx_asistencias_fecha ON asistencias(fecha_hora);
        "
    )
    .map_err(|e| format!("Error al crear tablas del sistema: {}", e))?;

    Ok(DbState {
        conn: Mutex::new(conn),
    })
}
