# GYMORA — Fase 5: Módulo de Administración (ABM) y Ajustes Visuales

**Fecha:** 2026-05-11  
**Versión:** 0.1.3  
**Estado:** ✅ Completada

---

## 1. Resumen

Se ejecutaron **correcciones visuales** al kiosco (DNI masivo, logo real Base64) y se implementó el **panel de administración completo** con 3 páginas funcionales conectadas a los comandos Rust de la Fase 2.

---

## 2. Parte 1: Correcciones Visuales

### 2.1 DNI Masivo en Kiosco
- Cambio: `text-8xl` → `text-[12rem] md:text-[15rem]`
- El DNI ahora ocupa prácticamente toda la pantalla durante el estado TYPING

### 2.2 Logo Real (Base64)
- **Setup Inicial** (`LoginScreen.tsx`): Nuevo campo `<input type="file" accept="image/*">` con preview y botón "Quitar"
- Conversión a Base64 vía `FileReader.readAsDataURL()`
- Se guarda en `localStorage` con clave `gymora_gym_logo`
- **Kiosco** (`KioscoScreen.tsx`): Si existe logo en localStorage, muestra `<img>` de `h-48`. Si no, fallback al Hexagon placeholder

---

## 3. Parte 2: Panel Admin

### 3.1 AlumnosPage (`src/pages/AlumnosPage.tsx`)

| Feature | Detalle |
|---------|---------|
| **Tabla** | Columnas: DNI, Apellido, Nombre, Teléfono, Fecha Alta |
| **Búsqueda** | Input con debounce 300ms → `buscar_alumnos(query)` |
| **Crear** | Modal: DNI*, Nombre*, Apellido*, Teléfono → `crear_alumno` |
| **Feedback** | Error (rojo) / Success (verde) con auto-cierre del modal 1.5s |

### 3.2 CajaPage (`src/pages/CajaPage.tsx`)

Flujo secuencial de cobro:

```
1. Buscar alumno por DNI → obtener_alumno_por_dni
2. Seleccionar tipo de cuota:
   ├── Mensual Libre (clases_totales = 0)
   └── Paquete de Clases (clases_totales = N)
3. Ingresar monto ($)
4. Seleccionar método de pago: Efectivo / Transferencia
5. "Registrar Cobro" → crear_cuota + registrar_pago (secuencial)
```

- El `usuario_id` del cobrador se obtiene del `AuthContext`
- Fecha de vencimiento = fecha actual + 1 mes (automático)

### 3.3 AjustesPage (`src/pages/AjustesPage.tsx`)

| Sección | Visibilidad | Funcionalidad |
|---------|-------------|---------------|
| **Personalización** | Todos | Editar nombre y logo del gimnasio (localStorage) |
| **Gestión Profesores** | Solo dueño | Lista de usuarios + formulario crear profesor |

---

## 4. Archivos

```
src/
├── App.tsx                       [MOD] Imports → pages/ reales
├── components/
│   ├── KioscoScreen.tsx          [MOD] DNI masivo + logo real
│   ├── LoginScreen.tsx           [MOD] Upload logo Base64 en setup
│   └── AdminPlaceholder.tsx      [DEPRECADO] Reemplazado por pages/
└── pages/                        [NEW] Directorio de páginas admin
    ├── DashboardPage.tsx         [NEW] Placeholder (Fase 6)
    ├── AlumnosPage.tsx           [NEW] ⭐ ABM completo
    ├── CajaPage.tsx              [NEW] ⭐ Cobro secuencial
    └── AjustesPage.tsx           [NEW] ⭐ Personalización + Profesores
```

---

## 5. Verificación

- ✅ `npx tsc --noEmit` → 0 errores
- ✅ `npx vite build` → 0 warnings, 0 errors
- ✅ Zero modificaciones al backend Rust
- ✅ `rounded-none` mantenido en todos los elementos nuevos
- ✅ Todos los comandos Rust invocados con manejo de errores

---

## 6. Próxima Fase

**Fase 6: Dashboard con Estadísticas y Reportes de Caja** — Métricas en tiempo real, cierre de caja diario, y exportación.
