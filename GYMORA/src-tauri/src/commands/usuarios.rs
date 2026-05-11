// commands/usuarios.rs — Comandos CRUD para la entidad Usuario
//
// Expone los siguientes comandos Tauri:
//   - crear_usuario: Registra un nuevo dueño o profesor
//   - validar_pin: Autentica un usuario por ID + PIN (login rápido)
//   - obtener_usuarios: Lista todos los usuarios activos del sistema
//
// SEGURIDAD: El PIN nunca se retorna al frontend. Solo se usa
// internamente para la validación en `validar_pin`.

use tauri::State;
use crate::database::DbState;
use crate::models::{Usuario, UsuarioAutenticado};

/// Comando Tauri: Crea un nuevo usuario en el sistema.
///
/// Validaciones:
///   - El rol debe ser "dueño" o "profesor" (la BD también lo valida con CHECK)
///   - El PIN debe tener exactamente 4 dígitos numéricos
///   - El nombre no puede estar vacío
///
/// ¿Por qué validar en Rust además del CHECK de SQLite? Para retornar
/// mensajes de error legibles al usuario en español, en lugar del
/// error crudo de SQLite que sería incomprensible.
#[tauri::command]
pub fn crear_usuario(
    nombre: String,
    rol: String,
    pin_acceso: String,
    db: State<DbState>,
) -> Result<Usuario, String> {
    // --- Validaciones de negocio ---

    let nombre = nombre.trim().to_string();
    if nombre.is_empty() {
        return Err("El nombre del usuario no puede estar vacío".into());
    }

    // Validar que el rol sea uno de los permitidos
    let rol = rol.trim().to_lowercase();
    if rol != "dueño" && rol != "profesor" {
        return Err(format!(
            "Rol inválido: '{}'. Los roles permitidos son 'dueño' o 'profesor'",
            rol
        ));
    }

    // Validar que el PIN tenga exactamente 4 dígitos numéricos
    let pin = pin_acceso.trim().to_string();
    if pin.len() != 4 || !pin.chars().all(|c| c.is_ascii_digit()) {
        return Err("El PIN debe tener exactamente 4 dígitos numéricos".into());
    }

    // --- Inserción en BD ---

    let conn = db.conn.lock().map_err(|e| format!("Error de lock en BD: {}", e))?;

    conn.execute(
        "INSERT INTO usuarios (nombre, rol, pin_acceso) VALUES (?1, ?2, ?3)",
        rusqlite::params![nombre, rol, pin],
    )
    .map_err(|e| format!("Error al crear usuario: {}", e))?;

    // Obtenemos el ID del usuario recién creado
    let id = conn.last_insert_rowid();

    Ok(Usuario {
        id,
        nombre,
        rol,
        activo: true,
    })
}

/// Comando Tauri: Valida el PIN de un usuario para autenticación.
///
/// Flujo:
///   1. Busca el usuario por ID en la BD
///   2. Verifica que esté activo
///   3. Compara el PIN ingresado con el almacenado
///   4. Retorna los datos del usuario autenticado (sin el PIN)
///
/// ¿Por qué por ID y no por nombre? En la UI (Fase 3), el usuario
/// seleccionará su perfil de un dropdown (que tiene el ID interno),
/// luego ingresará el PIN. Esto evita colisiones de nombres.
#[tauri::command]
pub fn validar_pin(
    usuario_id: i64,
    pin: String,
    db: State<DbState>,
) -> Result<UsuarioAutenticado, String> {
    let pin = pin.trim().to_string();

    let conn = db.conn.lock().map_err(|e| format!("Error de lock en BD: {}", e))?;

    // Buscamos el usuario y su PIN en una sola query
    let result = conn.query_row(
        "SELECT id, nombre, rol, pin_acceso, activo FROM usuarios WHERE id = ?1",
        rusqlite::params![usuario_id],
        |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, bool>(4)?,
            ))
        },
    );

    match result {
        Ok((id, nombre, rol, pin_almacenado, activo)) => {
            // Verificar que el usuario esté activo
            if !activo {
                return Err("Este usuario ha sido deshabilitado del sistema".into());
            }

            // Comparar PINs
            if pin != pin_almacenado {
                return Err("PIN incorrecto".into());
            }

            Ok(UsuarioAutenticado { id, nombre, rol })
        }
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            Err("Usuario no encontrado".into())
        }
        Err(e) => {
            Err(format!("Error al buscar usuario: {}", e))
        }
    }
}

/// Comando Tauri: Obtiene la lista de todos los usuarios activos.
///
/// Retorna los usuarios sin el PIN por seguridad.
/// Se usa en la pantalla de login (Fase 3) para poblar el dropdown
/// de selección de perfil.
#[tauri::command]
pub fn obtener_usuarios(db: State<DbState>) -> Result<Vec<Usuario>, String> {
    let conn = db.conn.lock().map_err(|e| format!("Error de lock en BD: {}", e))?;

    let mut stmt = conn
        .prepare("SELECT id, nombre, rol, activo FROM usuarios WHERE activo = 1 ORDER BY nombre")
        .map_err(|e| format!("Error al preparar query de usuarios: {}", e))?;

    let usuarios = stmt
        .query_map([], |row| {
            Ok(Usuario {
                id: row.get(0)?,
                nombre: row.get(1)?,
                rol: row.get(2)?,
                activo: row.get(3)?,
            })
        })
        .map_err(|e| format!("Error al consultar usuarios: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Error al leer resultados de usuarios: {}", e))?;

    Ok(usuarios)
}
