// hardware_id.rs — Módulo de generación de Hardware ID único
//
// Genera un fingerprint SHA-256 combinando tres fuentes de hardware:
//   1. Motherboard UUID (vía PowerShell/Get-CimInstance, con fallback a wmic)
//   2. CPU ID (nombre del procesador vía sysinfo)
//   3. MAC Address (adaptador de red primario vía crate mac_address)
//
// Este hash actúa como identidad única de la máquina para el sistema anti-copia.
// IMPORTANTE: El hash NO es la clave de activación. La clave se deriva con un salt.

use sha2::{Sha256, Digest};
use std::process::Command;

/// Obtiene el UUID de la placa madre ejecutando PowerShell.
/// Si PowerShell falla, cae a wmic como fallback (deprecated en Win11 pero funcional en Win10).
///
/// ¿Por qué PowerShell primero? Microsoft está deprecando wmic en Windows 11.
/// El comando Get-CimInstance es el reemplazo oficial y estable.
fn get_motherboard_uuid() -> Result<String, String> {
    // Intento primario: PowerShell con Get-CimInstance
    let ps_result = Command::new("powershell")
        .args(["-Command", "(Get-CimInstance -Class Win32_ComputerSystemProduct).UUID"])
        .output();

    if let Ok(output) = ps_result {
        if output.status.success() {
            let uuid = String::from_utf8_lossy(&output.stdout).trim().to_string();
            // Validamos que el resultado no esté vacío y tenga formato de UUID
            if !uuid.is_empty() && uuid.len() >= 8 {
                return Ok(uuid);
            }
        }
    }

    // Fallback: wmic (funciona en Windows 10, puede no existir en Win11)
    let wmic_result = Command::new("wmic")
        .args(["csproduct", "get", "UUID"])
        .output();

    match wmic_result {
        Ok(output) if output.status.success() => {
            let raw = String::from_utf8_lossy(&output.stdout);
            // wmic retorna un header "UUID" seguido del valor; tomamos la segunda línea
            let uuid = raw
                .lines()
                .filter(|line| !line.trim().is_empty() && !line.contains("UUID"))
                .map(|line| line.trim().to_string())
                .next()
                .unwrap_or_default();

            if uuid.is_empty() {
                Err("No se pudo obtener el UUID de la placa madre con ningún método".into())
            } else {
                Ok(uuid)
            }
        }
        _ => Err("No se pudo obtener el UUID de la placa madre: ni PowerShell ni wmic están disponibles".into()),
    }
}

/// Obtiene el nombre/modelo del procesador como identificador de CPU.
///
/// ¿Por qué el nombre del CPU y no un ID de serie? La mayoría de CPUs de consumo
/// no exponen un serial único vía software. El nombre del modelo (ej: "Intel Core i7-12700K")
/// combinado con los otros factores genera suficiente unicidad.
fn get_cpu_id() -> Result<String, String> {
    use sysinfo::System;

    let sys = System::new_all();
    let cpus = sys.cpus();

    if cpus.is_empty() {
        return Err("No se detectaron procesadores en el sistema".into());
    }

    // Tomamos el nombre de la primera CPU (en sistemas multi-CPU, todas son iguales)
    Ok(cpus[0].brand().to_string())
}

/// Obtiene la MAC Address del adaptador de red primario.
///
/// ¿Por qué la MAC? Es un identificador de hardware que rara vez cambia y es
/// fácil de obtener de forma cross-platform. Si el usuario no tiene adaptador de red
/// (improbable en un PC de recepción), usamos un valor por defecto.
fn get_mac_address() -> Result<String, String> {
    match mac_address::get_mac_address() {
        Ok(Some(mac)) => Ok(mac.to_string()),
        Ok(None) => Err("No se encontró ningún adaptador de red con MAC address".into()),
        Err(e) => Err(format!("Error al obtener MAC address: {}", e)),
    }
}

/// Genera el Hardware ID único de esta máquina.
///
/// Combina Motherboard UUID + CPU ID + MAC Address en un solo string,
/// luego genera un hash SHA-256 que se representa como string hexadecimal.
///
/// El resultado es un hash de 64 caracteres hexadecimales, ejemplo:
/// "a3f2b7c9d4e1f8a0b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8"
pub fn generate_hardware_id() -> Result<String, String> {
    // Recolectamos las tres fuentes de hardware
    let mb_uuid = get_motherboard_uuid()?;
    let cpu_id = get_cpu_id()?;
    let mac = get_mac_address()?;

    // Concatenamos con un separador para evitar colisiones de strings
    // Ejemplo: "UUID-1234||Intel Core i7||AA:BB:CC:DD:EE:FF"
    let raw_fingerprint = format!("{}||{}||{}", mb_uuid, cpu_id, mac);

    // Generamos el hash SHA-256
    let mut hasher = Sha256::new();
    hasher.update(raw_fingerprint.as_bytes());
    let result = hasher.finalize();

    // Convertimos a hexadecimal legible
    Ok(hex::encode(result))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hardware_id_generation() {
        // Este test solo verifica que la función no falla en la máquina actual
        let id = generate_hardware_id();
        assert!(id.is_ok(), "generate_hardware_id() falló: {:?}", id.err());

        let id_str = id.unwrap();
        // SHA-256 produce exactamente 64 caracteres hexadecimales
        assert_eq!(id_str.len(), 64, "El Hardware ID debe tener 64 caracteres hex");
    }

    #[test]
    fn test_hardware_id_consistency() {
        // Dos llamadas consecutivas deben producir el mismo resultado
        let id1 = generate_hardware_id().unwrap();
        let id2 = generate_hardware_id().unwrap();
        assert_eq!(id1, id2, "El Hardware ID debe ser determinista");
    }
}
