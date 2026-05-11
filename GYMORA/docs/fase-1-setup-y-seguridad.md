# GYMORA — Fase 1: Setup, Arquitectura Base y Seguridad

**Fecha:** 2026-05-11  
**Versión:** 0.1.0  
**Estado:** ✅ Completada

---

## 1. Resumen de la Fase

Se inicializó el proyecto GYMORA como aplicación de escritorio nativa usando **Tauri v2 + React + TypeScript + Tailwind CSS v4**. Se implementó el sistema anti-copia basado en un **Hardware ID único** (SHA-256 de Motherboard UUID + CPU ID + MAC Address) con verificación de licencia al arranque mediante **clave derivada con salt secreto**.

---

## 2. Stack Tecnológico Configurado

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Runtime Nativo | Tauri | 2.x |
| Backend | Rust | 2021 edition |
| Frontend | React + TypeScript | 18.x |
| Bundler | Vite | 6.x |
| Estilos | Tailwind CSS | 4.x |
| Base de Datos | SQLite (rusqlite) | 0.35 |
| Actualizaciones | tauri-plugin-updater | 2.x |

---

## 3. Dependencias Rust Añadidas

| Crate | Versión | Propósito |
|-------|---------|-----------|
| `sysinfo` | 0.34 | Información del CPU (brand/model) |
| `mac_address` | 1.1 | MAC Address del adaptador de red primario |
| `sha2` | 0.10 | Hash SHA-256 para hardware fingerprint y clave derivada |
| `hex` | 0.4 | Conversión de bytes hash a string hexadecimal |
| `rusqlite` | 0.35 (bundled) | Base de datos SQLite local |
| `uuid` | 1.x | Generación de UUIDs (disponible para fases futuras) |
| `chrono` | 0.4 | Timestamps para registro de activación |
| `tauri-plugin-updater` | 2.x | Sistema de actualizaciones automáticas |

---

## 4. Dependencias npm Añadidas

| Paquete | Propósito |
|---------|-----------|
| `tailwindcss` | Framework CSS v4 |
| `@tailwindcss/vite` | Plugin Vite para Tailwind v4 |
| `@tauri-apps/plugin-updater` | API JS del plugin de actualizaciones |

---

## 5. Estructura de Archivos Creados/Modificados

```
GYMORA/
├── index.html                          [MOD] Título GYMORA, lang="es", meta SEO
├── vite.config.ts                      [MOD] Agregado plugin Tailwind CSS v4
├── src/
│   ├── App.css                         [MOD] Tema GYMORA, fuentes, animaciones, rounded-none global
│   ├── App.tsx                         [MOD] Gate de licencia: loading → activación → app
│   ├── main.tsx                        [SIN CAMBIOS]
│   └── components/
│       └── ActivationScreen.tsx        [NEW] Pantalla de activación con HWID y clave
├── src-tauri/
│   ├── Cargo.toml                      [MOD] Todas las dependencias de Fase 1
│   ├── tauri.conf.json                 [MOD] Nombre GYMORA, updater config
│   ├── capabilities/
│   │   └── default.json                [SIN CAMBIOS]
│   └── src/
│       ├── main.rs                     [SIN CAMBIOS] Entry point binario
│       ├── lib.rs                      [MOD] Registro de módulos, plugins y comandos
│       ├── hardware_id.rs              [NEW] Generación de fingerprint de hardware
│       ├── database.rs                 [NEW] Inicialización SQLite + WAL + tabla licencia
│       └── license.rs                  [NEW] Verificación y activación de licencia
```

---

## 6. Comandos Tauri Expuestos al Frontend

| Comando | Firma Rust | Descripción |
|---------|-----------|-------------|
| `check_license` | `() -> Result<bool, String>` | Verifica si existe una licencia válida en la BD |
| `activate_license` | `(key: String) -> Result<bool, String>` | Valida la clave contra el hash derivado y la almacena |
| `get_hardware_id` | `() -> Result<String, String>` | Retorna el Hardware ID para mostrarlo en la UI |

---

## 7. Arquitectura del Sistema Anti-Copia

### 7.1 Generación del Hardware ID

```
Motherboard UUID (PowerShell → wmic fallback)
        +
CPU Brand/Model (sysinfo crate)
        +
MAC Address (mac_address crate)
        ↓
Concatenación: "UUID||CPU||MAC"
        ↓
SHA-256 Hash → 64 caracteres hex = Hardware ID
```

### 7.2 Derivación de la Clave de Activación

```
Hardware ID (64 chars hex)
        +
Salt Secreto: "GYMORA_SECRET_SALT_2026"
        ↓
Concatenación: HardwareID + Salt
        ↓
SHA-256 Hash → 64 caracteres hex = Clave de Activación
```

> **SEGURIDAD:** La clave de activación NO es el Hardware ID crudo. Es un hash derivado con un salt secreto. El usuario nunca puede auto-generar su propia clave.

### 7.3 Flujo de Verificación al Arranque

```
App inicia
    ↓
React monta App.tsx
    ↓
invoke("get_hardware_id") → Obtiene HWID actual
invoke("check_license")   → Verifica BD
    ↓
¿Existe licencia en BD con HWID coincidente?
    ├── SÍ → ¿La clave almacenada == SHA256(HWID + SALT)?
    │        ├── SÍ → Licencia válida → Mostrar app
    │        └── NO → Licencia inválida → Pantalla activación
    └── NO → Sin licencia → Pantalla activación
```

---

## 8. Esquema de Base de Datos (Fase 1)

```sql
PRAGMA journal_mode=WAL;

CREATE TABLE IF NOT EXISTS licencia (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hardware_id TEXT NOT NULL,
    clave_activacion TEXT NOT NULL,
    fecha_activacion TEXT NOT NULL
);
```

---

## 9. Diseño UI — Reglas Aplicadas

- **`rounded-none` global:** Se aplica `border-radius: 0 !important` a todos los elementos vía CSS.
- **Paleta oscura industrial:** Fondo `#0a0a0a`, superficies `#141414`, acento ámbar `#f59e0b`.
- **Tipografía:** Inter (UI) + JetBrains Mono (Hardware ID).
- **Animaciones:** `fadeInUp` para entrada de componentes, `pulse-glow` para indicador de estado.
- **Sin selección de texto** excepto en inputs (comportamiento de app nativa).

---

## 10. Configuración del Updater

El `tauri.conf.json` incluye la configuración del plugin de actualizaciones apuntando a un endpoint genérico de GitHub Releases:

```json
"plugins": {
    "updater": {
        "pubkey": "",
        "endpoints": [
            "https://github.com/TU_USUARIO/gymora-releases/releases/latest/download/latest.json"
        ],
        "dialog": true
    }
}
```

> **NOTA:** El `pubkey` debe generarse al configurar el pipeline de releases. El endpoint debe actualizarse con el repo real.

---

## 11. Verificación

- ✅ `cargo check` — Compila sin errores ni warnings
- ✅ Dependencias Rust descargadas y resueltas (534 packages)
- ✅ Dependencias npm instaladas (88 packages)
- ⏳ `npm run tauri dev` — Pendiente de ejecución por el usuario

---

## 12. Próxima Fase

**Fase 2: Capa de Datos (Rust + SQLite)** — Crear el esquema relacional completo (usuarios, alumnos, cuotas, pagos, asistencias) y exponer el CRUD mediante `#[tauri::command]`.
