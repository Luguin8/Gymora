# Blueprint Maestro: Sistema de Gestión de Gimnasio (Rust + Tauri + React)

## 1. Visión General del Proyecto
Desarrollo de una aplicación de escritorio nativa, offline y de alto rendimiento para el control de accesos y pagos de un gimnasio.
- **Backend/Core:** Rust + Tauri. Toda la lógica de negocio, acceso a BD y generación de archivos reside aquí.
- **Frontend:** React + Tailwind CSS. El frontend es "tonto"; solo renderiza estado y llama a comandos Tauri.
- **Base de Datos:** SQLite local gestionado puramente desde Rust (`rusqlite`).

## 2. Reglas Estrictas de Desarrollo (¡LEER ANTES DE CODIFICAR!)
1. **Paso a Paso:** El desarrollo se dividirá en Fases. NO escribas código de fases futuras. Al final de cada fase, debes generar un archivo `.md` resumiendo las funcionalidades implementadas, las dependencias añadidas y los comandos Tauri expuestos.
2. **Documentación:** Todo el código (especialmente Rust y hooks de React) debe estar exhaustivamente comentado explicando el *por qué* de las decisiones lógicas.
3. **Diseño UI:** Estilo ultra sobrio y minimalista usando Tailwind CSS. **Prohibido usar bordes redondeados.** Todos los componentes deben tener esquinas rectas (usar `rounded-none` en Tailwind).
4. **Manejo de Errores:** Rust debe retornar errores manejables (`Result<T, String>`) a React. La UI debe mostrar notificaciones (Toasts) claras.
5. **Concurrencia DB:** La conexión SQLite en Rust DEBE inicializarse con `PRAGMA journal_mode=WAL;` para evitar bloqueos de escritura concurrente.

---

## 3. Fases de Desarrollo

### Fase 1: Setup, Arquitectura Base y Seguridad
**Objetivo:** Inicializar el entorno, configurar dependencias y armar el sistema anti-copia.
- Setup de Tauri con React y Tailwind.
- **Hardware ID:** Crear una función en Rust que obtenga un hash único combinando Motherboard UUID, CPU ID y MAC Address. 
- Implementar la lógica de bloqueo: Al iniciar, la app verifica si la licencia en la BD local coincide con el hash generado. Si no, muestra la pantalla de activación.

### Fase 2: Capa de Datos (Rust + SQLite)
**Objetivo:** Crear el esquema relacional y exponer el CRUD mediante `#[tauri::command]`.
- Esquema requerido:
  - `usuarios` (Dueño y Profesores, con PIN de 4 dígitos).
  - `alumnos` (DNI, Nombre, Teléfono, etc.).
  - `cuotas` (Tipos de planes: mes calendario, clases, etc.).
  - `pagos` (Registro de caja: monto, método de pago, fecha, ID_profesor).
  - `asistencias` (Registro histórico de ingresos).
- Rust debe exponer todos los comandos necesarios para interactuar con estas tablas.

### Fase 3: Autenticación Local y Pantalla Admin Base
**Objetivo:** Sistema de login rápido para la recepción.
- Interfaz en React donde el usuario elige su perfil (Dueño o Profesor X) de un Select/Dropdown e ingresa un PIN numérico.
- Ruteo protegido en React para separar el "Kiosco" (ingreso de alumnos) del "Panel Admin".

### Fase 4: Módulo "Kiosco" (El Core de Recepción)
**Objetivo:** Pantalla principal de control de acceso.
- **UX Crítica:** El ingreso del DNI no debe depender de un `<input>` enfocado. Implementar un *Global Event Listener* en React que capture las pulsaciones de números para armar el DNI y accione con "Enter".
- Lógica de respuesta: Al ingresar el DNI, llamar a Rust para descontar una clase o verificar el vencimiento.
- UI de respuesta (Ocupando toda la pantalla por 3 segundos): Verde (Acceso Permitido, clases restantes) o Rojo (Denegado/Vencido).

### Fase 5: Módulo de Administración de Alumnos
**Objetivo:** Gestión diaria desde el rol Dueño o Profesor.
- ABM (Alta, Baja, Modificación) de alumnos.
- Pantalla de cobro de cuotas, seleccionando plan, método de pago (Efectivo/Transferencia) y registrando el ID del profesor logueado.

### Fase 6: Reportes y Cierre de Caja (Generación PDF)
**Objetivo:** Exportación de datos de forma offline.
- Comando en Rust que tome un rango de fechas y genere un archivo PDF nativo (usando crates como `genpdf`).
- El reporte debe detallar: Ingresos totales, división por método de pago, y cuotas cobradas por cada profesor.
- El PDF debe guardarse en el sistema de archivos del usuario abriendo un diálogo de guardado estándar de Windows.

---
**INSTRUCCIÓN PARA EL LLM:** Entendido este documento, responde únicamente confirmando la arquitectura, validando las mitigaciones de concurrencia/UX, y pide autorización para comenzar a escribir el código de la **Fase 1**.