// commands/cuotas.rs — Comandos CRUD para la entidad Cuota
//
// Expone los siguientes comandos Tauri:
//   - crear_cuota: Asigna un plan (mensual o paquete de clases) a un alumno
//   - obtener_cuotas_alumno: Lista las cuotas de un alumno (historial)
//
// Las cuotas soportan dos modalidades:
//   1. Mes calendario: clases_totales = 0 → ilimitadas dentro del período
//   2. Paquete de clases: clases_totales > 0 → se descuenta por asistencia
//
// Cuando se crea una nueva cuota, cualquier cuota activa previa del
// mismo alumno se desactiva automáticamente (solo una cuota activa por alumno).

use tauri::State;
use crate::database::DbState;
use crate::models::Cuota;

/// Comando Tauri: Crea una nueva cuota/plan para un alumno.
///
/// Validaciones:
///   - El alumno debe existir y estar activo
///   - Las fechas deben tener formato válido (YYYY-MM-DD)
///   - fecha_vencimiento debe ser posterior a fecha_inicio
///   - clases_totales >= 0 (0 = mensual ilimitado)
///
/// Lógica importante:
///   - Al crear una cuota nueva, se desactivan las cuotas activas previas
///     del mismo alumno. Esto garantiza que solo haya UNA cuota activa
///     por alumno en todo momento.
///   - clases_restantes se inicializa con el mismo valor que clases_totales
#[tauri::command]
pub fn crear_cuota(
    alumno_id: i64,
    fecha_inicio: String,
    fecha_vencimiento: String,
    clases_totales: i32,
    db: State<DbState>,
) -> Result<Cuota, String> {
    // --- Validaciones ---

    let fecha_inicio = fecha_inicio.trim().to_string();
    let fecha_vencimiento = fecha_vencimiento.trim().to_string();

    if fecha_inicio.is_empty() || fecha_vencimiento.is_empty() {
        return Err("Las fechas de inicio y vencimiento son obligatorias".into());
    }

    // Validar formato de fechas (YYYY-MM-DD)
    if chrono::NaiveDate::parse_from_str(&fecha_inicio, "%Y-%m-%d").is_err() {
        return Err(format!(
            "Fecha de inicio inválida: '{}'. Formato esperado: YYYY-MM-DD",
            fecha_inicio
        ));
    }

    if chrono::NaiveDate::parse_from_str(&fecha_vencimiento, "%Y-%m-%d").is_err() {
        return Err(format!(
            "Fecha de vencimiento inválida: '{}'. Formato esperado: YYYY-MM-DD",
            fecha_vencimiento
        ));
    }

    // Verificar que vencimiento sea posterior al inicio
    if fecha_vencimiento <= fecha_inicio {
        return Err("La fecha de vencimiento debe ser posterior a la fecha de inicio".into());
    }

    if clases_totales < 0 {
        return Err("La cantidad de clases no puede ser negativa".into());
    }

    let conn = db.conn.lock().map_err(|e| format!("Error de lock en BD: {}", e))?;

    // Verificar que el alumno existe y está activo
    let alumno_activo: bool = conn
        .query_row(
            "SELECT activo FROM alumnos WHERE id = ?1",
            rusqlite::params![alumno_id],
            |row| row.get(0),
        )
        .map_err(|e| {
            if matches!(e, rusqlite::Error::QueryReturnedNoRows) {
                format!("No existe un alumno con ID {}", alumno_id)
            } else {
                format!("Error al verificar alumno: {}", e)
            }
        })?;

    if !alumno_activo {
        return Err("No se puede asignar una cuota a un alumno dado de baja".into());
    }

    // Desactivar cuotas activas previas del mismo alumno.
    // ¿Por qué? Para evitar ambigüedad: si un alumno tiene 2 cuotas activas,
    // ¿cuál se descuenta al registrar asistencia? Mantenemos solo una.
    conn.execute(
        "UPDATE cuotas SET activa = 0 WHERE alumno_id = ?1 AND activa = 1",
        rusqlite::params![alumno_id],
    )
    .map_err(|e| format!("Error al desactivar cuotas previas: {}", e))?;

    // Insertar la nueva cuota con clases_restantes = clases_totales
    conn.execute(
        "INSERT INTO cuotas (alumno_id, fecha_inicio, fecha_vencimiento, clases_totales, clases_restantes, activa)
         VALUES (?1, ?2, ?3, ?4, ?5, 1)",
        rusqlite::params![alumno_id, fecha_inicio, fecha_vencimiento, clases_totales, clases_totales],
    )
    .map_err(|e| format!("Error al crear cuota: {}", e))?;

    let id = conn.last_insert_rowid();

    Ok(Cuota {
        id,
        alumno_id,
        fecha_inicio,
        fecha_vencimiento,
        clases_totales,
        clases_restantes: clases_totales,
        activa: true,
    })
}

/// Comando Tauri: Obtiene el historial de cuotas de un alumno.
///
/// Retorna TODAS las cuotas (activas e inactivas) ordenadas por fecha
/// más reciente primero. Útil para la vista de administración (Fase 5).
#[tauri::command]
pub fn obtener_cuotas_alumno(
    alumno_id: i64,
    db: State<DbState>,
) -> Result<Vec<Cuota>, String> {
    let conn = db.conn.lock().map_err(|e| format!("Error de lock en BD: {}", e))?;

    let mut stmt = conn
        .prepare(
            "SELECT id, alumno_id, fecha_inicio, fecha_vencimiento, clases_totales, clases_restantes, activa
             FROM cuotas
             WHERE alumno_id = ?1
             ORDER BY fecha_inicio DESC"
        )
        .map_err(|e| format!("Error al preparar query de cuotas: {}", e))?;

    let cuotas = stmt
        .query_map(rusqlite::params![alumno_id], |row| {
            Ok(Cuota {
                id: row.get(0)?,
                alumno_id: row.get(1)?,
                fecha_inicio: row.get(2)?,
                fecha_vencimiento: row.get(3)?,
                clases_totales: row.get(4)?,
                clases_restantes: row.get(5)?,
                activa: row.get(6)?,
            })
        })
        .map_err(|e| format!("Error al consultar cuotas: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Error al leer resultados de cuotas: {}", e))?;

    Ok(cuotas)
}
