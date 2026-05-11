// commands/pagos.rs — Comandos CRUD para la entidad Pago
//
// Expone los siguientes comandos Tauri:
//   - registrar_pago: Registra un cobro en la caja
//   - obtener_pagos_alumno: Historial de pagos de un alumno
//
// Cada pago queda vinculado al alumno que pagó Y al usuario (profesor/dueño)
// que realizó el cobro. Esto es crítico para los reportes de cierre de caja
// (Fase 6) donde se necesita saber cuánto cobró cada profesor.

use tauri::State;
use crate::database::DbState;
use crate::models::Pago;

/// Comando Tauri: Registra un nuevo pago/cobro en la caja.
///
/// Validaciones:
///   - El alumno debe existir
///   - El usuario (cobrador) debe existir
///   - El monto debe ser positivo (la BD también lo valida con CHECK)
///   - El método de pago debe ser "efectivo" o "transferencia"
///   - La fecha se genera automáticamente con timestamp actual
///
/// ¿Por qué registrar quién cobró? Para los reportes de la Fase 6:
/// el dueño necesita saber cuánto cobró cada profesor en un rango de fechas.
#[tauri::command]
pub fn registrar_pago(
    alumno_id: i64,
    usuario_id: i64,
    monto: f64,
    metodo_pago: String,
    db: State<DbState>,
) -> Result<Pago, String> {
    // --- Validaciones ---

    if monto <= 0.0 {
        return Err("El monto del pago debe ser mayor a cero".into());
    }

    let metodo_pago = metodo_pago.trim().to_lowercase();
    if metodo_pago != "efectivo" && metodo_pago != "transferencia" {
        return Err(format!(
            "Método de pago inválido: '{}'. Opciones: 'efectivo' o 'transferencia'",
            metodo_pago
        ));
    }

    let conn = db.conn.lock().map_err(|e| format!("Error de lock en BD: {}", e))?;

    // Verificar que el alumno existe
    conn.query_row(
        "SELECT id FROM alumnos WHERE id = ?1",
        rusqlite::params![alumno_id],
        |_| Ok(()),
    )
    .map_err(|e| {
        if matches!(e, rusqlite::Error::QueryReturnedNoRows) {
            format!("No existe un alumno con ID {}", alumno_id)
        } else {
            format!("Error al verificar alumno: {}", e)
        }
    })?;

    // Verificar que el usuario (cobrador) existe
    conn.query_row(
        "SELECT id FROM usuarios WHERE id = ?1",
        rusqlite::params![usuario_id],
        |_| Ok(()),
    )
    .map_err(|e| {
        if matches!(e, rusqlite::Error::QueryReturnedNoRows) {
            format!("No existe un usuario con ID {}", usuario_id)
        } else {
            format!("Error al verificar usuario: {}", e)
        }
    })?;

    // Timestamp del pago: fecha y hora actual
    let fecha_pago = chrono::Local::now()
        .format("%Y-%m-%d %H:%M:%S")
        .to_string();

    // --- Inserción ---

    conn.execute(
        "INSERT INTO pagos (alumno_id, usuario_id, monto, metodo_pago, fecha_pago)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![alumno_id, usuario_id, monto, metodo_pago, fecha_pago],
    )
    .map_err(|e| format!("Error al registrar pago: {}", e))?;

    let id = conn.last_insert_rowid();

    Ok(Pago {
        id,
        alumno_id,
        usuario_id,
        monto,
        metodo_pago,
        fecha_pago,
    })
}

/// Comando Tauri: Obtiene el historial de pagos de un alumno.
///
/// Retorna todos los pagos ordenados por fecha más reciente primero.
/// Usado en la vista de administración de alumnos (Fase 5).
#[tauri::command]
pub fn obtener_pagos_alumno(
    alumno_id: i64,
    db: State<DbState>,
) -> Result<Vec<Pago>, String> {
    let conn = db.conn.lock().map_err(|e| format!("Error de lock en BD: {}", e))?;

    let mut stmt = conn
        .prepare(
            "SELECT id, alumno_id, usuario_id, monto, metodo_pago, fecha_pago
             FROM pagos
             WHERE alumno_id = ?1
             ORDER BY fecha_pago DESC"
        )
        .map_err(|e| format!("Error al preparar query de pagos: {}", e))?;

    let pagos = stmt
        .query_map(rusqlite::params![alumno_id], |row| {
            Ok(Pago {
                id: row.get(0)?,
                alumno_id: row.get(1)?,
                usuario_id: row.get(2)?,
                monto: row.get(3)?,
                metodo_pago: row.get(4)?,
                fecha_pago: row.get(5)?,
            })
        })
        .map_err(|e| format!("Error al consultar pagos: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Error al leer resultados de pagos: {}", e))?;

    Ok(pagos)
}
