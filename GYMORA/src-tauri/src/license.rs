// license.rs — Módulo de verificación y activación de licencia
//
// Implementa el sistema anti-copia de GYMORA:
//   1. Al iniciar la app, se verifica si existe una licencia válida en la BD
//   2. Si no existe o el hardware cambió, se muestra la pantalla de activación
//   3. La clave de activación NO es el Hardware ID crudo — es un hash derivado
//      con un salt secreto: SHA256(HardwareID + "GYMORA_SECRET_SALT_2026")
//
// SEGURIDAD: El desarrollador genera la clave externamente usando el mismo
// algoritmo de derivación. El usuario nunca ve ni manipula el Hardware ID crudo
// como clave.

use sha2::{Sha256, Digest};
use tauri::State;

use crate::database::DbState;
use crate::hardware_id;

/// Salt secreto para la derivación de claves de activación.
///
/// Este salt se concatena con el Hardware ID antes de hashear, de modo que
/// conocer el Hardware ID no permite generar la clave sin conocer el salt.
/// En un escenario real, este salt debería ofuscarse o almacenarse de forma segura.
const ACTIVATION_SALT: &str = "GYMORA_SECRET_SALT_2026";

/// Genera la clave de activación esperada a partir del Hardware ID actual.
///
/// Fórmula: SHA256(hardware_id + ACTIVATION_SALT)
/// Esto produce un hash de 64 caracteres hexadecimales.
fn derive_activation_key(hardware_id: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(format!("{}{}", hardware_id, ACTIVATION_SALT).as_bytes());
    hex::encode(hasher.finalize())
}

/// Comando Tauri: Verifica si la app tiene una licencia válida.
///
/// Flujo:
///   1. Genera el Hardware ID actual de la máquina
///   2. Busca en la tabla `licencia` un registro con ese hardware_id
///   3. Si existe, recalcula la clave derivada y la compara con la almacenada
///   4. Retorna true si todo coincide, false si no hay licencia o cambió el hardware
///
/// ¿Por qué recalcular la clave derivada en cada verificación?
/// Para detectar si el usuario copió la BD a otra máquina: el hardware_id
/// almacenado no coincidirá con el generado en el nuevo hardware.
#[tauri::command]
pub fn check_license(db: State<DbState>) -> Result<bool, String> {
    // Paso 1: Obtener el Hardware ID actual
    let current_hw_id = hardware_id::generate_hardware_id()?;

    // Paso 2: Buscar licencia en la BD
    let conn = db.conn.lock().map_err(|e| format!("Error de lock en BD: {}", e))?;

    let result: Result<(String, String), _> = conn.query_row(
        "SELECT hardware_id, clave_activacion FROM licencia ORDER BY id DESC LIMIT 1",
        [],
        |row| Ok((row.get(0)?, row.get(1)?)),
    );

    match result {
        Ok((stored_hw_id, stored_key)) => {
            // Paso 3: Verificar que el hardware_id almacenado coincide con el actual
            if stored_hw_id != current_hw_id {
                // La BD fue copiada a otra máquina — licencia inválida
                return Ok(false);
            }

            // Paso 4: Verificar que la clave almacenada es correcta
            let expected_key = derive_activation_key(&current_hw_id);
            Ok(stored_key == expected_key)
        }
        Err(_) => {
            // No hay registro de licencia — app no activada
            Ok(false)
        }
    }
}

/// Comando Tauri: Activa la licencia con una clave proporcionada por el usuario.
///
/// Flujo:
///   1. Genera el Hardware ID actual
///   2. Deriva la clave esperada: SHA256(HardwareID + SALT)
///   3. Compara la clave ingresada con la esperada
///   4. Si coincide, guarda en la BD y retorna true
///   5. Si no coincide, retorna false (clave inválida)
///
/// La clave que ingresa el usuario la genera el desarrollador externamente
/// usando el mismo algoritmo de derivación con el Hardware ID que le envió el usuario.
#[tauri::command]
pub fn activate_license(key: String, db: State<DbState>) -> Result<bool, String> {
    // Paso 1: Obtener Hardware ID actual
    let current_hw_id = hardware_id::generate_hardware_id()?;

    // Paso 2: Derivar la clave esperada
    let expected_key = derive_activation_key(&current_hw_id);

    // Paso 3: Comparar (case-insensitive para evitar errores de tipeo)
    if key.trim().to_lowercase() != expected_key.to_lowercase() {
        return Ok(false); // Clave inválida
    }

    // Paso 4: Guardar en la BD
    let conn = db.conn.lock().map_err(|e| format!("Error de lock en BD: {}", e))?;

    // Limpiamos registros anteriores (solo debe existir una licencia activa)
    conn.execute("DELETE FROM licencia", [])
        .map_err(|e| format!("Error al limpiar licencias previas: {}", e))?;

    // Registramos la nueva licencia con timestamp
    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

    conn.execute(
        "INSERT INTO licencia (hardware_id, clave_activacion, fecha_activacion) VALUES (?1, ?2, ?3)",
        rusqlite::params![current_hw_id, expected_key, now],
    )
    .map_err(|e| format!("Error al guardar licencia: {}", e))?;

    Ok(true)
}

/// Comando Tauri: Retorna el Hardware ID actual para mostrarlo en la UI.
///
/// El usuario copia este ID y se lo envía al desarrollador, quien genera
/// la clave de activación con el algoritmo de derivación.
#[tauri::command]
pub fn get_hardware_id() -> Result<String, String> {
    hardware_id::generate_hardware_id()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_key_derivation_deterministic() {
        // La derivación debe ser determinista: mismo input → mismo output
        let key1 = derive_activation_key("test_hardware_id_123");
        let key2 = derive_activation_key("test_hardware_id_123");
        assert_eq!(key1, key2);
    }

    #[test]
    fn test_key_derivation_different_inputs() {
        // Diferentes Hardware IDs deben producir diferentes claves
        let key1 = derive_activation_key("hardware_a");
        let key2 = derive_activation_key("hardware_b");
        assert_ne!(key1, key2);
    }

    #[test]
    fn test_derived_key_is_sha256() {
        // La clave derivada debe tener 64 caracteres hex (SHA-256)
        let key = derive_activation_key("test_id");
        assert_eq!(key.len(), 64);
    }
}
