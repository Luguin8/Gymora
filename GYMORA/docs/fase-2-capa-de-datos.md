# GYMORA — Fase 2: Capa de Datos (Rust + SQLite)

**Fecha:** 2026-05-11  
**Versión:** 0.1.0  
**Estado:** ✅ Completada

---

## 1. Resumen de la Fase

Se implementó la **capa de datos completa** del sistema GYMORA en Rust. Se crearon 5 tablas de dominio con relaciones, restricciones y índices de rendimiento. Se expusieron **11 comandos Tauri** organizados en módulos por entidad, incluyendo el **comando core `registrar_asistencia`** que implementa toda la lógica de negocio del kiosco de recepción.

---

## 2. Esquema de Base de Datos

### 2.1 Diagrama Relacional

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  usuarios   │     │   alumnos    │     │   licencia   │
├─────────────┤     ├──────────────┤     │  (Fase 1)    │
│ id (PK)     │     │ id (PK)      │     └──────────────┘
│ nombre      │     │ dni (UNIQUE) │
│ rol         │     │ nombre       │
│ pin_acceso  │     │ apellido     │
│ activo      │     │ telefono     │
└──────┬──────┘     │ fecha_alta   │
       │            │ activo       │
       │            └──────┬───────┘
       │                   │
       │        ┌──────────┼──────────┐
       │        │          │          │
       │   ┌────▼────┐ ┌──▼───┐ ┌───▼────────┐
       │   │ cuotas  │ │pagos │ │asistencias │
       │   ├─────────┤ ├──────┤ ├────────────┤
       │   │ id (PK) │ │id(PK)│ │ id (PK)    │
       │   │alumno_id│ │alum. │ │ alumno_id  │
       │   │fch_inic.│ │usua. │◄┘ fecha_hora │
       │   │fch_venc.│ │monto │ └────────────┘
       │   │cls_total│ │metodo│
       │   │cls_rest.│ │fecha │
       │   │ activa  │ └──┬───┘
       │   └─────────┘    │
       └──────────────────┘
```

### 2.2 Tablas Creadas

| Tabla | Columnas Clave | Restricciones |
|-------|---------------|---------------|
| `usuarios` | id, nombre, rol, pin_acceso, activo | `CHECK(rol IN ('dueño','profesor'))`, `CHECK(length(pin_acceso)=4)` |
| `alumnos` | id, dni, nombre, apellido, telefono, fecha_alta, activo | `UNIQUE(dni)` |
| `cuotas` | id, alumno_id, fecha_inicio, fecha_vencimiento, clases_totales, clases_restantes, activa | `FK(alumno_id → alumnos)` |
| `pagos` | id, alumno_id, usuario_id, monto, metodo_pago, fecha_pago | `FK(alumno_id)`, `FK(usuario_id)`, `CHECK(monto > 0)`, `CHECK(metodo_pago IN ...)` |
| `asistencias` | id, alumno_id, fecha_hora | `FK(alumno_id → alumnos)` |

### 2.3 Índices de Rendimiento

```sql
idx_alumnos_dni        → alumnos(dni)           -- Búsqueda por DNI en kiosco
idx_cuotas_alumno      → cuotas(alumno_id, activa) -- Cuota activa del alumno
idx_pagos_alumno       → pagos(alumno_id)       -- Historial de pagos
idx_pagos_fecha        → pagos(fecha_pago)       -- Reportes por rango de fechas
idx_asistencias_alumno → asistencias(alumno_id)  -- Historial por alumno
idx_asistencias_fecha  → asistencias(fecha_hora) -- Reportes por fecha
```

### 2.4 Configuración Crítica

- `PRAGMA journal_mode=WAL;` — Concurrencia de lecturas/escrituras (requerido por guía)
- `PRAGMA foreign_keys=ON;` — Integridad referencial activada

---

## 3. Comandos Tauri Expuestos (Fase 2)

### 3.1 Usuarios

| Comando | Firma | Descripción |
|---------|-------|-------------|
| `crear_usuario` | `(nombre, rol, pin_acceso) → Result<Usuario, String>` | Crea dueño/profesor con PIN de 4 dígitos |
| `validar_pin` | `(usuario_id, pin) → Result<UsuarioAutenticado, String>` | Login rápido por ID + PIN |
| `obtener_usuarios` | `() → Result<Vec<Usuario>, String>` | Lista usuarios activos (para dropdown) |

### 3.2 Alumnos

| Comando | Firma | Descripción |
|---------|-------|-------------|
| `crear_alumno` | `(dni, nombre, apellido, telefono?) → Result<Alumno, String>` | Alta con DNI único, fecha_alta auto |
| `obtener_alumno_por_dni` | `(dni) → Result<Alumno, String>` | Búsqueda exacta por DNI |
| `buscar_alumnos` | `(query) → Result<Vec<Alumno>, String>` | Búsqueda LIKE por nombre/apellido/dni (máx 50) |

### 3.3 Cuotas

| Comando | Firma | Descripción |
|---------|-------|-------------|
| `crear_cuota` | `(alumno_id, fecha_inicio, fecha_vencimiento, clases_totales) → Result<Cuota, String>` | Crea plan, desactiva cuotas previas |
| `obtener_cuotas_alumno` | `(alumno_id) → Result<Vec<Cuota>, String>` | Historial de cuotas |

### 3.4 Pagos

| Comando | Firma | Descripción |
|---------|-------|-------------|
| `registrar_pago` | `(alumno_id, usuario_id, monto, metodo_pago) → Result<Pago, String>` | Registro de cobro en caja |
| `obtener_pagos_alumno` | `(alumno_id) → Result<Vec<Pago>, String>` | Historial de pagos |

### 3.5 Asistencias (CORE)

| Comando | Firma | Descripción |
|---------|-------|-------------|
| `registrar_asistencia` | `(dni) → Result<RespuestaAsistencia, String>` | **Lógica core del kiosco** |

---

## 4. Lógica de `registrar_asistencia` (Detalle)

### Flujo de Decisión

```
DNI ingresado
  ↓
¿Alumno existe?
  ├─ NO → "No se encontró ningún alumno con DNI X"
  ↓ SÍ
¿Alumno activo?
  ├─ NO → "El alumno X está dado de baja en el sistema"
  ↓ SÍ
¿Tiene cuota activa?
  ├─ NO → "X no tiene ninguna cuota activa. Debe abonar."
  ↓ SÍ
¿Cuota vencida por fecha?
  ├─ SÍ → Desactivar cuota → "La cuota venció el YYYY-MM-DD"
  ↓ NO
¿Es paquete de clases? (clases_totales > 0)
  ├─ SÍ → ¿clases_restantes > 0?
  │       ├─ NO → Desactivar → "Agotó todas las clases"
  │       └─ SÍ → Descontar 1 clase
  │              → Si llega a 0: desactivar cuota
  ↓ NO (mensual ilimitado)
Registrar asistencia (INSERT)
  ↓
Retornar RespuestaAsistencia
  - alumno_nombre, alumno_dni
  - clases_restantes (-1 si ilimitado)
  - fecha_vencimiento
  - mensaje descriptivo
```

### Modalidades de Cuota

| Tipo | clases_totales | Comportamiento |
|------|---------------|----------------|
| Mes calendario | 0 | Solo verifica fecha_vencimiento. No descuenta. |
| Paquete de clases | N > 0 | Descuenta 1 clase por asistencia. Desactiva al llegar a 0. |

---

## 5. Estructura de Archivos (Fase 2)

```
src-tauri/src/
├── main.rs              [SIN CAMBIOS]
├── lib.rs               [MOD] Registra módulos models, commands y 11 comandos nuevos
├── hardware_id.rs       [SIN CAMBIOS]
├── database.rs          [MOD] 5 tablas nuevas, FK, CHECK, índices, PRAGMA foreign_keys
├── license.rs           [SIN CAMBIOS]
├── models.rs            [NEW] Structs: Usuario, Alumno, Cuota, Pago, Asistencia, RespuestaAsistencia
└── commands/
    ├── mod.rs           [NEW] Re-exporta todos los submódulos
    ├── usuarios.rs      [NEW] crear_usuario, validar_pin, obtener_usuarios
    ├── alumnos.rs       [NEW] crear_alumno, obtener_alumno_por_dni, buscar_alumnos
    ├── cuotas.rs        [NEW] crear_cuota, obtener_cuotas_alumno
    ├── pagos.rs         [NEW] registrar_pago, obtener_pagos_alumno
    └── asistencias.rs   [NEW] registrar_asistencia (CORE)
```

---

## 6. Verificación

- ✅ `cargo check` — Compila sin errores
- ✅ 1 warning esperado: struct `Asistencia` definida pero no usada aún (se usará en Fase 4+)
- ✅ Foreign keys activadas (`PRAGMA foreign_keys=ON`)
- ✅ WAL mode activado
- ✅ Todos los comandos retornan `Result<T, String>`
- ✅ Zero cambios en el frontend

---

## 7. Próxima Fase

**Fase 3: Autenticación Local y Pantalla Admin Base** — Sistema de login con PIN por perfil (dropdown + PIN numérico), ruteo protegido en React para separar el kiosco del panel de administración.
