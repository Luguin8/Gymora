# GYMORA — Fase 6: Dashboard, Cierre de Caja y Exportación PDF

**Fecha:** 2026-05-11  
**Versión:** 0.1.4  
**Estado:** ✅ Completada

---

## 1. Resumen

Se implementó el **dashboard con métricas del día** y la **exportación PDF nativa** del cierre de caja. Esta es la fase final de funcionalidades del sistema.

**Parte 1 (Backend Rust):** Nuevos comandos `obtener_metricas_dashboard` y `generar_pdf_caja` + integración de `genpdf` con fuentes embebidas y `tauri-plugin-dialog`.

**Parte 2 (Frontend React):** DashboardPage con tarjetas de métricas y botón de exportación con diálogo nativo de Windows "Guardar Como".

---

## 2. Dependencias Añadidas

### Rust (`Cargo.toml`)
| Crate | Versión | Propósito |
|-------|---------|-----------|
| `genpdf` | 0.2 | Generación de PDF con layout automático |
| `tauri-plugin-dialog` | 2 | Diálogo nativo de guardado de archivos |

### Fuentes embebidas (`src-tauri/fonts/`)
| Archivo | Propósito |
|---------|-----------|
| `LiberationSans-Regular.ttf` | Fuente regular para el cuerpo del PDF |
| `LiberationSans-Bold.ttf` | Fuente bold para títulos del PDF |

> Las fuentes se embeben en el binario via `include_bytes!()`, no dependen de archivos externos en runtime.

### Frontend (npm)
| Paquete | Propósito |
|---------|-----------|
| `@tauri-apps/plugin-dialog` | API JS para abrir diálogos nativos |

### Capabilities (`default.json`)
- Se añadió `"dialog:default"` para habilitar el permiso del plugin.

---

## 3. Archivos

```
src-tauri/
├── Cargo.toml                             [MOD] +genpdf, +tauri-plugin-dialog
├── capabilities/default.json              [MOD] +dialog:default
├── fonts/
│   ├── LiberationSans-Regular.ttf         [NEW] Fuente embebida
│   └── LiberationSans-Bold.ttf            [NEW] Fuente embebida
└── src/
    ├── lib.rs                             [MOD] +dialog plugin + 2 comandos
    ├── models.rs                          [MOD] +MetricasDashboard, +CobroPorUsuario
    └── commands/
        ├── mod.rs                         [MOD] +pub mod dashboard
        └── dashboard.rs                   [NEW] ⭐ 2 comandos nuevos

src/
└── pages/
    └── DashboardPage.tsx                  [MOD] ⭐ Reescrito completo
```

---

## 4. Comando `obtener_metricas_dashboard`

```
Entrada: fecha ("2026-05-11")
Salida:  MetricasDashboard {
    ingresos_totales: f64,
    ingresos_efectivo: f64,
    ingresos_transferencia: f64,
    cantidad_asistencias_hoy: i64,
    cantidad_alumnos_activos: i64,
}
```

Queries SQL:
- `SUM(monto)` filtrado por `fecha_pago LIKE 'YYYY-MM-DD%'`
- Desglosado por `metodo_pago = 'efectivo'` / `'transferencia'`
- `COUNT(*)` en `asistencias` filtrado por `fecha_hora LIKE ...`
- `COUNT(*)` en `alumnos WHERE activo = 1`

---

## 5. Comando `generar_pdf_caja`

```
Entrada: fecha, ruta_destino (absoluta, viene del diálogo nativo)
Salida:  Result<String, String> (mensaje de éxito o error)
```

### Contenido del PDF

```
┌─────────────────────────────────────────┐
│  CIERRE DE CAJA — 2026-05-11           │  (bold, 16pt)
│  GYMORA — Sistema de Gestión            │  (8pt)
│                                         │
│  RESUMEN DE INGRESOS                    │  (bold, 12pt)
│  Ingresos Totales:      $ 45000.00      │
│    - Efectivo:           $ 30000.00     │
│    - Transferencia:      $ 15000.00     │
│  Cantidad de cobros:     4              │
│                                         │
│  DESGLOSE POR COBRADOR                  │  (bold, 12pt)
│  Juan Pérez (Dueño):    $ 30000.00      │
│  María López (Profesor): $ 15000.00     │
│                                         │
│  Documento generado: 2026-05-11 17:30   │  (7pt)
└─────────────────────────────────────────┘
```

### Pipeline técnico

```
1. Rust recopila datos con 5 queries SQL
2. genpdf carga fuentes via include_bytes!() (compile-time)
3. Se construye el documento con Paragraphs styled
4. doc.render_to_file(&ruta_destino)
5. Retorna mensaje de éxito o error
```

---

## 6. Frontend: DashboardPage

### Tarjetas de métricas (5 cards)

| Card | Icono | Color |
|------|-------|-------|
| Ingresos Totales | DollarSign | Ámbar |
| Efectivo | Banknote | Emerald |
| Transferencia | ArrowLeftRight | Blue |
| Asistencias Hoy | ClipboardCheck | Purple |
| Alumnos Activos | Users | Cyan |

### Flujo de exportación PDF

```
1. Click "Exportar Cierre PDF"
2. save() de @tauri-apps/plugin-dialog → ventana nativa "Guardar como"
   - Nombre sugerido: cierre_caja_YYYY-MM-DD.pdf
   - Filtro: *.pdf
3. Si el usuario selecciona ruta → invoke("generar_pdf_caja", { fecha, rutaDestino })
4. Toast de éxito (verde) o error (rojo) con auto-cierre 5s
```

---

## 7. Verificación

- ✅ `cargo check` → Compila OK (2 warnings menores de dead_code)
- ✅ `npx tsc --noEmit` → 0 errores
- ✅ `npx vite build` → 0 warnings, 0 errors
- ✅ Fuentes embebidas en binario (no dependencias externas)
- ✅ `rounded-none` en todas las tarjetas y botones nuevos
- ✅ Limpieza de archivos temporales (tar.gz eliminado)

---

## 8. Resumen Final del Proyecto

| Fase | Estado | Descripción |
|------|--------|-------------|
| 1 | ✅ | Setup, HWID, sistema de licencias |
| 2 | ✅ | Capa de datos SQLite (WAL, CRUD) |
| 3 | ✅ | Autenticación PIN, routing, layout admin |
| 4 | ✅ | Kiosco de recepción (core) |
| 5 | ✅ | ABM Alumnos, Caja, Ajustes |
| 6 | ✅ | Dashboard, métricas, exportación PDF |
