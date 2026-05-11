// commands/alumnos.rs — Comandos CRUD para la entidad Alumno
//
// Expone los siguientes comandos Tauri:
//   - crear_alumno: Registra un nuevo alumno con DNI único
//   - obtener_alumno_por_dni: Busca un alumno específico por su DNI
//   - buscar_alumnos: Búsqueda flexible por nombre, apellido o DNI
//
// El DNI es el identificador principal del alumno en todo el sistema.
// Es lo que se ingresa en el kiosco (Fase 4) para registrar asistencia.

use tauri::State;
use crate::database::DbState;
use crate::models::Alumno;

/// Comando Tauri: Registra un nuevo alumno en el sistema.
///
/// Validaciones:
///   - DNI no puede estar vacío ni repetido (UNIQUE en BD)
///   - Nombre y apellido obligatorios
///   - fecha_alta se genera automáticamente con la fecha actual
///
/// ¿Por qué el teléfono es opcional? No todos los alumnos proporcionan
/// un número de contacto al inscribirse. El campo tiene default vacío.
#[tauri::command]
pub fn crear_alumno(
    dni: String,
    nombre: String,
    apellido: String,
    telefono: Option<String>,
    db: State<DbState>,
) -> Result<Alumno, String> {
    // --- Validaciones de negocio ---

    let dni = dni.trim().to_string();
    if dni.is_empty() {
        return Err("El DNI no puede estar vacío".into());
    }

    let nombre = nombre.trim().to_string();
    if nombre.is_empty() {
        return Err("El nombre del alumno no puede estar vacío".into());
    }

    let apellido = apellido.trim().to_string();
    if apellido.is_empty() {
        return Err("El apellido del alumno no puede estar vacío".into());
    }

    let telefono = telefono
        .map(|t| t.trim().to_string())
        .unwrap_or_default();

    // Fecha de alta automática: hoy en formato ISO 8601
    let fecha_alta = chrono::Local::now().format("%Y-%m-%d").to_string();

    // --- Inserción en BD ---

    let conn = db.conn.lock().map_err(|e| format!("Error de lock en BD: {}", e))?;

    conn.execute(
        "INSERT INTO alumnos (dni, nombre, apellido, telefono, fecha_alta) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![dni, nombre, apellido, telefono, fecha_alta],
    )
    .map_err(|e| {
        // Detectamos el error de DNI duplicado para dar un mensaje claro
        if e.to_string().contains("UNIQUE") {
            format!("Ya existe un alumno registrado con el DNI {}", dni)
        } else {
            format!("Error al registrar alumno: {}", e)
        }
    })?;

    let id = conn.last_insert_rowid();

    Ok(Alumno {
        id,
        dni,
        nombre,
        apellido,
        telefono,
        fecha_alta,
        activo: true,
    })
}

/// Comando Tauri: Busca un alumno específico por su DNI.
///
/// Retorna el alumno completo o un error si no existe.
/// Usado internamente por `registrar_asistencia` y externamente
/// por la UI de administración (Fase 5).
#[tauri::command]
pub fn obtener_alumno_por_dni(
    dni: String,
    db: State<DbState>,
) -> Result<Alumno, String> {
    let dni = dni.trim().to_string();

    let conn = db.conn.lock().map_err(|e| format!("Error de lock en BD: {}", e))?;

    let result = conn.query_row(
        "SELECT id, dni, nombre, apellido, telefono, fecha_alta, activo FROM alumnos WHERE dni = ?1",
        rusqlite::params![dni],
        |row| {
            Ok(Alumno {
                id: row.get(0)?,
                dni: row.get(1)?,
                nombre: row.get(2)?,
                apellido: row.get(3)?,
                telefono: row.get(4)?,
                fecha_alta: row.get(5)?,
                activo: row.get(6)?,
            })
        },
    );

    match result {
        Ok(alumno) => Ok(alumno),
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            Err(format!("No se encontró ningún alumno con DNI {}", dni))
        }
        Err(e) => Err(format!("Error al buscar alumno: {}", e)),
    }
}

/// Comando Tauri: Búsqueda flexible de alumnos por nombre, apellido o DNI.
///
/// Usa LIKE con wildcards para búsqueda parcial (ej: "Gar" encuentra "García").
/// Retorna hasta 50 resultados ordenados por apellido.
///
/// ¿Por qué limitar a 50? En un gimnasio con cientos de alumnos, retornar
/// todos en cada tecla sería ineficiente. 50 es suficiente para refinar
/// la búsqueda sin impactar performance.
#[tauri::command]
pub fn buscar_alumnos(
    query: String,
    db: State<DbState>,
) -> Result<Vec<Alumno>, String> {
    let query = query.trim().to_string();

    let conn = db.conn.lock().map_err(|e| format!("Error de lock en BD: {}", e))?;

    // Si la query está vacía, retornamos todos los alumnos activos (con límite)
    let search_pattern = format!("%{}%", query);

    let mut stmt = conn
        .prepare(
            "SELECT id, dni, nombre, apellido, telefono, fecha_alta, activo
             FROM alumnos
             WHERE (nombre LIKE ?1 OR apellido LIKE ?1 OR dni LIKE ?1)
               AND activo = 1
             ORDER BY apellido, nombre
             LIMIT 50"
        )
        .map_err(|e| format!("Error al preparar búsqueda: {}", e))?;

    let alumnos = stmt
        .query_map(rusqlite::params![search_pattern], |row| {
            Ok(Alumno {
                id: row.get(0)?,
                dni: row.get(1)?,
                nombre: row.get(2)?,
                apellido: row.get(3)?,
                telefono: row.get(4)?,
                fecha_alta: row.get(5)?,
                activo: row.get(6)?,
            })
        })
        .map_err(|e| format!("Error al ejecutar búsqueda: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Error al leer resultados de búsqueda: {}", e))?;

    Ok(alumnos)
}
