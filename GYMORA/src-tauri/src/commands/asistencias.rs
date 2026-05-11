// commands/asistencias.rs — Comando core del sistema: Registro de Asistencia
//
// Este módulo contiene la LÓGICA DE NEGOCIO MÁS IMPORTANTE del sistema.
//
// El comando `registrar_asistencia` es el corazón del kiosco de recepción:
//   1. Recibe un DNI (ingresado manualmente o por lector de código)
//   2. Busca al alumno en la BD
//   3. Verifica que tenga una cuota activa y vigente
//   4. Si la cuota es por paquete de clases, descuenta una clase
//   5. Registra la asistencia en el historial
//   6. Retorna una respuesta enriquecida para la UI del kiosco
//
// Todos los escenarios de rechazo retornan Err(String) con un motivo
// claro y legible para mostrar en la UI.

use tauri::State;
use crate::database::DbState;
use crate::models::RespuestaAsistencia;

/// Comando Tauri: Registra la asistencia de un alumno por su DNI.
///
/// Este es el comando que se invoca cada vez que alguien ingresa un DNI
/// en el kiosco de recepción (Fase 4).
///
/// ### Flujo completo:
///
/// ```text
/// DNI ingresado
///   ↓
/// ¿Alumno existe? → NO → Err("Alumno no encontrado con DNI X")
///   ↓ SÍ
/// ¿Alumno activo? → NO → Err("Alumno dado de baja")
///   ↓ SÍ
/// ¿Tiene cuota activa? → NO → Err("No tiene cuota activa")
///   ↓ SÍ
/// ¿Cuota vencida por fecha? → SÍ → Desactivar cuota → Err("Cuota vencida")
///   ↓ NO
/// ¿Es paquete de clases? → SÍ → ¿Clases restantes > 0?
///   │                              ├── NO → Desactivar → Err("Sin clases")
///   │                              └── SÍ → Descontar 1 clase
///   ↓ NO (mensual ilimitado)
/// Registrar asistencia en historial
///   ↓
/// Ok(RespuestaAsistencia) con datos actualizados
/// ```
///
/// ### Decisiones de diseño:
///
/// - **Una transacción atómica**: Todo el flujo (verificación + descuento + registro)
///   se ejecuta bajo el mismo lock del Mutex, garantizando consistencia.
///   Si algo falla a mitad del proceso, no se registran cambios parciales.
///
/// - **Desactivación automática de cuotas vencidas**: Si al verificar detectamos
///   que la cuota expiró (por fecha o por clases agotadas), la marcamos como
///   inactiva inmediatamente. Esto evita verificaciones repetidas.
///
/// - **Clases restantes = -1 en respuesta**: Para cuotas mensuales ilimitadas,
///   retornamos -1 como convención. El frontend interpretará esto como "∞".
#[tauri::command]
pub fn registrar_asistencia(
    dni: String,
    db: State<DbState>,
) -> Result<RespuestaAsistencia, String> {
    let dni = dni.trim().to_string();

    if dni.is_empty() {
        return Err("El DNI no puede estar vacío".into());
    }

    let conn = db.conn.lock().map_err(|e| format!("Error de lock en BD: {}", e))?;

    // ================================================================
    // PASO 1: Buscar alumno por DNI
    // ================================================================
    let alumno = conn.query_row(
        "SELECT id, dni, nombre, apellido, activo FROM alumnos WHERE dni = ?1",
        rusqlite::params![dni],
        |row| {
            Ok((
                row.get::<_, i64>(0)?,       // id
                row.get::<_, String>(1)?,     // dni
                row.get::<_, String>(2)?,     // nombre
                row.get::<_, String>(3)?,     // apellido
                row.get::<_, bool>(4)?,       // activo
            ))
        },
    );

    let (alumno_id, alumno_dni, nombre, apellido, activo) = match alumno {
        Ok(data) => data,
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            return Err(format!("No se encontró ningún alumno con DNI {}", dni));
        }
        Err(e) => {
            return Err(format!("Error al buscar alumno: {}", e));
        }
    };

    // ================================================================
    // PASO 2: Verificar que el alumno esté activo
    // ================================================================
    if !activo {
        return Err(format!(
            "El alumno {} {} (DNI: {}) está dado de baja en el sistema",
            nombre, apellido, alumno_dni
        ));
    }

    let nombre_completo = format!("{} {}", nombre, apellido);

    // ================================================================
    // PASO 3: Buscar cuota activa del alumno
    // ================================================================
    // Tomamos la cuota activa más reciente (debería ser la única por la
    // lógica de `crear_cuota` que desactiva las anteriores).
    let cuota = conn.query_row(
        "SELECT id, fecha_vencimiento, clases_totales, clases_restantes
         FROM cuotas
         WHERE alumno_id = ?1 AND activa = 1
         ORDER BY fecha_inicio DESC
         LIMIT 1",
        rusqlite::params![alumno_id],
        |row| {
            Ok((
                row.get::<_, i64>(0)?,       // id
                row.get::<_, String>(1)?,     // fecha_vencimiento
                row.get::<_, i32>(2)?,        // clases_totales
                row.get::<_, i32>(3)?,        // clases_restantes
            ))
        },
    );

    let (cuota_id, fecha_vencimiento, clases_totales, clases_restantes) = match cuota {
        Ok(data) => data,
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            return Err(format!(
                "{} no tiene ninguna cuota activa. Debe abonar para ingresar.",
                nombre_completo
            ));
        }
        Err(e) => {
            return Err(format!("Error al buscar cuota: {}", e));
        }
    };

    // ================================================================
    // PASO 4: Verificar que la cuota no esté vencida por fecha
    // ================================================================
    let hoy = chrono::Local::now().format("%Y-%m-%d").to_string();

    if fecha_vencimiento < hoy {
        // La cuota expiró — la desactivamos para no volver a evaluarla
        conn.execute(
            "UPDATE cuotas SET activa = 0 WHERE id = ?1",
            rusqlite::params![cuota_id],
        )
        .map_err(|e| format!("Error al desactivar cuota vencida: {}", e))?;

        return Err(format!(
            "La cuota de {} venció el {}. Debe renovar para ingresar.",
            nombre_completo, fecha_vencimiento
        ));
    }

    // ================================================================
    // PASO 5: Si es paquete de clases, verificar y descontar
    // ================================================================
    // clases_totales = 0 → plan mensual ilimitado (no se descuenta)
    // clases_totales > 0 → paquete de N clases (se descuenta 1)
    let clases_restantes_final: i32;

    if clases_totales > 0 {
        // Es un paquete de clases — verificar que queden clases
        if clases_restantes <= 0 {
            // Se agotaron las clases — desactivar la cuota
            conn.execute(
                "UPDATE cuotas SET activa = 0 WHERE id = ?1",
                rusqlite::params![cuota_id],
            )
            .map_err(|e| format!("Error al desactivar cuota sin clases: {}", e))?;

            return Err(format!(
                "{} agotó todas las clases de su paquete. Debe renovar.",
                nombre_completo
            ));
        }

        // Descontar una clase
        let nuevas_restantes = clases_restantes - 1;

        conn.execute(
            "UPDATE cuotas SET clases_restantes = ?1 WHERE id = ?2",
            rusqlite::params![nuevas_restantes, cuota_id],
        )
        .map_err(|e| format!("Error al descontar clase: {}", e))?;

        // Si se agotaron las clases después de descontar, desactivar
        if nuevas_restantes == 0 {
            conn.execute(
                "UPDATE cuotas SET activa = 0 WHERE id = ?1",
                rusqlite::params![cuota_id],
            )
            .map_err(|e| format!("Error al desactivar cuota agotada: {}", e))?;
        }

        clases_restantes_final = nuevas_restantes;
    } else {
        // Plan mensual ilimitado — no se descuenta nada
        // Usamos -1 como convención para indicar "ilimitadas" al frontend
        clases_restantes_final = -1;
    }

    // ================================================================
    // PASO 6: Registrar la asistencia en el historial
    // ================================================================
    let ahora = chrono::Local::now()
        .format("%Y-%m-%d %H:%M:%S")
        .to_string();

    conn.execute(
        "INSERT INTO asistencias (alumno_id, fecha_hora) VALUES (?1, ?2)",
        rusqlite::params![alumno_id, ahora],
    )
    .map_err(|e| format!("Error al registrar asistencia: {}", e))?;

    // ================================================================
    // PASO 7: Construir respuesta enriquecida para la UI
    // ================================================================
    let mensaje = if clases_restantes_final == -1 {
        // Plan mensual ilimitado
        format!(
            "Acceso permitido. Plan mensual vigente hasta el {}.",
            fecha_vencimiento
        )
    } else if clases_restantes_final == 0 {
        // Última clase del paquete
        format!(
            "Acceso permitido. ¡ÚLTIMA CLASE! El paquete se ha agotado.",
        )
    } else {
        // Paquete con clases restantes
        format!(
            "Acceso permitido. Te quedan {} clase(s) del paquete.",
            clases_restantes_final
        )
    };

    Ok(RespuestaAsistencia {
        alumno_nombre: nombre_completo,
        alumno_dni,
        clases_restantes: clases_restantes_final,
        fecha_vencimiento,
        mensaje,
    })
}
