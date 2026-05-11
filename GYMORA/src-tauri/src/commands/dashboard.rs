// commands/dashboard.rs — Comandos del Dashboard y exportación PDF
//
// obtener_metricas_dashboard: Métricas del día (ingresos, asistencias, alumnos)
// generar_pdf_caja: Exporta el cierre de caja a PDF con genpdf

use tauri::State;
use crate::database::DbState;
use crate::models::MetricasDashboard;
// Element trait requerido para usar .styled() en Paragraph
use genpdf::Element as _;

/// Comando Tauri: Obtiene las métricas del día para el dashboard.
///
/// Recibe una fecha en formato "YYYY-MM-DD" y retorna:
///   - Ingresos totales, por efectivo y por transferencia
///   - Cantidad de asistencias registradas ese día
///   - Cantidad total de alumnos activos en el sistema
#[tauri::command]
pub fn obtener_metricas_dashboard(
    fecha: String,
    db: State<DbState>,
) -> Result<MetricasDashboard, String> {
    let fecha = fecha.trim().to_string();
    let conn = db.conn.lock().map_err(|e| format!("Error de lock: {}", e))?;

    // Ingresos totales del día
    let ingresos_totales: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(monto), 0) FROM pagos WHERE fecha_pago LIKE ?1",
            rusqlite::params![format!("{}%", fecha)],
            |row| row.get(0),
        )
        .map_err(|e| format!("Error al calcular ingresos: {}", e))?;

    // Ingresos por efectivo
    let ingresos_efectivo: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(monto), 0) FROM pagos WHERE fecha_pago LIKE ?1 AND metodo_pago = 'efectivo'",
            rusqlite::params![format!("{}%", fecha)],
            |row| row.get(0),
        )
        .map_err(|e| format!("Error al calcular efectivo: {}", e))?;

    // Ingresos por transferencia
    let ingresos_transferencia: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(monto), 0) FROM pagos WHERE fecha_pago LIKE ?1 AND metodo_pago = 'transferencia'",
            rusqlite::params![format!("{}%", fecha)],
            |row| row.get(0),
        )
        .map_err(|e| format!("Error al calcular transferencias: {}", e))?;

    // Asistencias del día
    let cantidad_asistencias_hoy: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM asistencias WHERE fecha_hora LIKE ?1",
            rusqlite::params![format!("{}%", fecha)],
            |row| row.get(0),
        )
        .map_err(|e| format!("Error al contar asistencias: {}", e))?;

    // Alumnos activos totales
    let cantidad_alumnos_activos: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM alumnos WHERE activo = 1",
            [],
            |row| row.get(0),
        )
        .map_err(|e| format!("Error al contar alumnos: {}", e))?;

    Ok(MetricasDashboard {
        ingresos_totales,
        ingresos_efectivo,
        ingresos_transferencia,
        cantidad_asistencias_hoy,
        cantidad_alumnos_activos,
    })
}

/// Comando Tauri: Genera un PDF de cierre de caja para una fecha dada.
///
/// Usa genpdf con fuentes Liberation Sans embebidas.
/// Contenido: título, ingresos totales, desglose por método, desglose por usuario.
#[tauri::command]
pub fn generar_pdf_caja(
    fecha: String,
    ruta_destino: String,
    db: State<DbState>,
) -> Result<String, String> {
    let fecha = fecha.trim().to_string();
    let conn = db.conn.lock().map_err(|e| format!("Error de lock: {}", e))?;

    // --- Recopilar datos ---

    let ingresos_totales: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(monto), 0) FROM pagos WHERE fecha_pago LIKE ?1",
            rusqlite::params![format!("{}%", fecha)],
            |row| row.get(0),
        )
        .map_err(|e| format!("Error SQL: {}", e))?;

    let ingresos_efectivo: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(monto), 0) FROM pagos WHERE fecha_pago LIKE ?1 AND metodo_pago = 'efectivo'",
            rusqlite::params![format!("{}%", fecha)],
            |row| row.get(0),
        )
        .map_err(|e| format!("Error SQL: {}", e))?;

    let ingresos_transferencia: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(monto), 0) FROM pagos WHERE fecha_pago LIKE ?1 AND metodo_pago = 'transferencia'",
            rusqlite::params![format!("{}%", fecha)],
            |row| row.get(0),
        )
        .map_err(|e| format!("Error SQL: {}", e))?;

    // Desglose por usuario (quién cobró cuánto)
    let mut stmt = conn
        .prepare(
            "SELECT u.nombre, u.rol, COALESCE(SUM(p.monto), 0)
             FROM pagos p
             JOIN usuarios u ON p.usuario_id = u.id
             WHERE p.fecha_pago LIKE ?1
             GROUP BY p.usuario_id
             ORDER BY u.nombre"
        )
        .map_err(|e| format!("Error SQL: {}", e))?;

    let cobros_por_usuario: Vec<(String, String, f64)> = stmt
        .query_map(rusqlite::params![format!("{}%", fecha)], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, f64>(2)?,
            ))
        })
        .map_err(|e| format!("Error SQL: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Error al leer cobros: {}", e))?;

    // Cantidad de pagos del día
    let cantidad_pagos: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM pagos WHERE fecha_pago LIKE ?1",
            rusqlite::params![format!("{}%", fecha)],
            |row| row.get(0),
        )
        .map_err(|e| format!("Error SQL: {}", e))?;

    // --- Generar PDF con genpdf ---

    // Cargar fuentes embebidas (Liberation Sans)
    let font_regular = genpdf::fonts::FontData::new(
        include_bytes!("../../fonts/LiberationSans-Regular.ttf").to_vec(),
        None,
    )
    .map_err(|e| format!("Error al cargar fuente regular: {}", e))?;

    let font_bold = genpdf::fonts::FontData::new(
        include_bytes!("../../fonts/LiberationSans-Bold.ttf").to_vec(),
        None,
    )
    .map_err(|e| format!("Error al cargar fuente bold: {}", e))?;

    let font_family = genpdf::fonts::FontFamily {
        regular: font_regular,
        bold: font_bold.clone(),
        italic: font_bold.clone(),
        bold_italic: font_bold,
    };

    let mut doc = genpdf::Document::new(font_family);
    doc.set_title(format!("Cierre de Caja - {}", fecha));

    // Configurar márgenes
    let mut decorator = genpdf::SimplePageDecorator::new();
    decorator.set_margins(15);
    doc.set_page_decorator(decorator);

    // --- Contenido del PDF ---

    // Título
    doc.push(genpdf::elements::Paragraph::new(
        format!("CIERRE DE CAJA — {}", fecha),
    ).styled(genpdf::style::Style::new().bold().with_font_size(16)));

    doc.push(genpdf::elements::Paragraph::new("GYMORA — Sistema de Gestión de Gimnasio")
        .styled(genpdf::style::Style::new().with_font_size(8)));

    doc.push(genpdf::elements::Break::new(1.5));

    // Sección: Resumen
    doc.push(genpdf::elements::Paragraph::new("RESUMEN DE INGRESOS")
        .styled(genpdf::style::Style::new().bold().with_font_size(12)));
    doc.push(genpdf::elements::Break::new(0.5));

    doc.push(genpdf::elements::Paragraph::new(
        format!("Ingresos Totales:          $ {:.2}", ingresos_totales)
    ));
    doc.push(genpdf::elements::Paragraph::new(
        format!("  - Efectivo:              $ {:.2}", ingresos_efectivo)
    ));
    doc.push(genpdf::elements::Paragraph::new(
        format!("  - Transferencia:         $ {:.2}", ingresos_transferencia)
    ));
    doc.push(genpdf::elements::Paragraph::new(
        format!("Cantidad de cobros:        {}", cantidad_pagos)
    ));

    doc.push(genpdf::elements::Break::new(1.5));

    // Sección: Desglose por cobrador
    doc.push(genpdf::elements::Paragraph::new("DESGLOSE POR COBRADOR")
        .styled(genpdf::style::Style::new().bold().with_font_size(12)));
    doc.push(genpdf::elements::Break::new(0.5));

    if cobros_por_usuario.is_empty() {
        doc.push(genpdf::elements::Paragraph::new(
            "No se registraron cobros en esta fecha."
        ));
    } else {
        for (nombre, rol, total) in &cobros_por_usuario {
            let rol_display = if rol == "dueño" { "Dueño" } else { "Profesor" };
            doc.push(genpdf::elements::Paragraph::new(
                format!("{} ({}):  $ {:.2}", nombre, rol_display, total)
            ));
        }
    }

    doc.push(genpdf::elements::Break::new(2.0));

    // Footer
    let ahora = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    doc.push(genpdf::elements::Paragraph::new(
        format!("Documento generado: {}", ahora)
    ).styled(genpdf::style::Style::new().with_font_size(7)));

    // Guardar el PDF
    doc.render_to_file(&ruta_destino)
        .map_err(|e| format!("Error al guardar PDF en {}: {}", ruta_destino, e))?;

    Ok(format!("PDF guardado exitosamente en: {}", ruta_destino))
}
