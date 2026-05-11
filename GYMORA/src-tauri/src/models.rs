// models.rs — Estructuras de datos serializables del dominio GYMORA
//
// Todas las entidades del sistema se definen aquí como structs con
// derive(Serialize) para que Tauri pueda enviarlas al frontend como JSON.
//
// ¿Por qué centralizar los modelos? Evita duplicación y garantiza que
// el contrato de datos entre Rust y React sea consistente. Cualquier
// cambio en la estructura de una entidad se hace en un solo lugar.

use serde::Serialize;

// =================================================================
// MODELO: Usuario
// =================================================================

/// Representa un usuario del sistema (Dueño o Profesor).
///
/// El PIN de 4 dígitos se usa para login rápido en la recepción.
/// NOTA: El pin_acceso NO se envía al frontend en las respuestas
/// por seguridad. Se usa un struct separado (UsuarioSeguro) para eso.
#[derive(Debug, Serialize, Clone)]
pub struct Usuario {
    pub id: i64,
    pub nombre: String,
    pub rol: String,
    /// Indica si el usuario está habilitado en el sistema
    pub activo: bool,
}

/// Respuesta de validación de PIN exitosa.
/// Contiene los datos del usuario autenticado sin exponer el PIN.
#[derive(Debug, Serialize)]
pub struct UsuarioAutenticado {
    pub id: i64,
    pub nombre: String,
    pub rol: String,
}

// =================================================================
// MODELO: Alumno
// =================================================================

/// Representa un alumno registrado en el gimnasio.
///
/// El DNI es el identificador principal usado en el kiosco de recepción.
/// 'activo' permite dar de baja lógica sin perder el historial de pagos
/// y asistencias del alumno.
#[derive(Debug, Serialize, Clone)]
pub struct Alumno {
    pub id: i64,
    pub dni: String,
    pub nombre: String,
    pub apellido: String,
    pub telefono: String,
    /// Fecha en formato ISO 8601 (YYYY-MM-DD)
    pub fecha_alta: String,
    pub activo: bool,
}

// =================================================================
// MODELO: Cuota
// =================================================================

/// Representa una cuota/plan asignado a un alumno.
///
/// Soporta dos modalidades:
///   - Mes calendario: clases_totales = 0 (ilimitadas dentro del período)
///   - Paquete de clases: clases_totales > 0, clases_restantes se decrementa
///
/// Una cuota se desactiva (activa = false) cuando:
///   - La fecha de vencimiento pasa (mes calendario)
///   - Las clases_restantes llegan a 0 (paquete de clases)
#[derive(Debug, Serialize, Clone)]
pub struct Cuota {
    pub id: i64,
    pub alumno_id: i64,
    /// Fecha de inicio en formato ISO 8601 (YYYY-MM-DD)
    pub fecha_inicio: String,
    /// Fecha de vencimiento en formato ISO 8601 (YYYY-MM-DD)
    pub fecha_vencimiento: String,
    /// 0 = ilimitadas (mes calendario), >0 = paquete de N clases
    pub clases_totales: i32,
    /// Clases que le quedan al alumno (solo relevante si clases_totales > 0)
    pub clases_restantes: i32,
    pub activa: bool,
}

// =================================================================
// MODELO: Pago
// =================================================================

/// Representa un registro de pago/cobro en la caja.
///
/// Cada pago está vinculado al alumno que pagó y al usuario
/// (profesor o dueño) que realizó el cobro. Esto permite rastrear
/// quién cobró qué para los reportes de cierre de caja.
#[derive(Debug, Serialize, Clone)]
pub struct Pago {
    pub id: i64,
    pub alumno_id: i64,
    /// ID del usuario (profesor/dueño) que registró el cobro
    pub usuario_id: i64,
    pub monto: f64,
    /// "efectivo" o "transferencia"
    pub metodo_pago: String,
    /// Fecha del pago en formato ISO 8601 (YYYY-MM-DD HH:MM:SS)
    pub fecha_pago: String,
}

// =================================================================
// MODELO: Asistencia
// =================================================================

/// Representa un registro de ingreso al gimnasio.
///
/// Cada vez que un alumno pasa su DNI por el kiosco y es aprobado,
/// se crea un registro de asistencia con el timestamp exacto.
#[derive(Debug, Serialize, Clone)]
pub struct Asistencia {
    pub id: i64,
    pub alumno_id: i64,
    /// Timestamp del ingreso en formato ISO 8601 (YYYY-MM-DD HH:MM:SS)
    pub fecha_hora: String,
}

// =================================================================
// MODELO: RespuestaAsistencia (respuesta del comando registrar_asistencia)
// =================================================================

/// Respuesta enriquecida del comando `registrar_asistencia`.
///
/// Contiene toda la información necesaria para que el frontend
/// muestre la pantalla de confirmación del kiosco (Fase 4):
///   - Datos del alumno (nombre para el saludo)
///   - Estado de la cuota (clases restantes, vencimiento)
///   - Mensaje descriptivo
#[derive(Debug, Serialize)]
pub struct RespuestaAsistencia {
    /// Nombre completo del alumno (nombre + apellido)
    pub alumno_nombre: String,
    /// DNI del alumno
    pub alumno_dni: String,
    /// Clases restantes después de registrar (-1 si es plan mensual ilimitado)
    pub clases_restantes: i32,
    /// Fecha de vencimiento de la cuota activa
    pub fecha_vencimiento: String,
    /// Mensaje descriptivo del resultado, ej: "Acceso permitido. Te quedan 7 clases."
    pub mensaje: String,
}
