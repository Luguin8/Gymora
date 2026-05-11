# GYMORA — Fase 4: Módulo "Kiosco" (Core de Recepción)

**Fecha:** 2026-05-11  
**Versión:** 0.1.2  
**Estado:** ✅ Completada

---

## 1. Resumen de la Fase

Se implementó el **módulo kiosco de recepción**, el componente más importante de la aplicación. El kiosco permite a los alumnos registrar su asistencia simplemente tecleando su DNI en el teclado numérico, sin necesidad de hacer click en ningún campo. Incluye pantallas de respuesta a pantalla completa (verde/rojo) con auto-cierre de 3.5 segundos.

También se ajustó el **Setup Inicial** para recoger el nombre del gimnasio, que se muestra en la pantalla de reposo del kiosco.

---

## 2. Archivos Modificados/Creados

```
src/
├── App.tsx                      [MOD] KioscoPlaceholder → KioscoScreen
├── App.css                      [MOD] +animación shrinkBar para barra de auto-cierre
└── components/
    ├── LoginScreen.tsx           [MOD] +campo "Nombre del Gimnasio" en Setup Inicial
    ├── KioscoScreen.tsx          [NEW] ⭐ Módulo kiosco completo
    └── KioscoPlaceholder.tsx     [DEPRECADO] Ya no se usa (reemplazado)
```

---

## 3. KioscoScreen — Máquina de Estados

### 3.1 Diagrama de Estados

```
                  ┌─────────────────────┐
                  │       IDLE          │
                  │ Logo + Nombre Gym   │
                  │ "Ingresá tu DNI"    │
                  └──────────┬──────────┘
                             │ tecla numérica
                             ▼
                  ┌─────────────────────┐
                  │      TYPING         │
                  │ Números gigantes    │◄─── Backspace (borra último)
                  │ (text-8xl mono)     │
                  └──────────┬──────────┘
                    │        │ Enter
           timeout 5s       ▼
                    │  ┌──────────────┐
                    │  │  PROCESSING  │
                    │  │ "Verificando"│
                    │  └──────┬───────┘
                    │    OK   │   Error
                    │  ┌──────┴───────┐
                    │  ▼              ▼
                    │ ┌──────┐  ┌──────────┐
                    │ │GREEN │  │   RED    │
                    │ │Acceso│  │ Denegado │
                    │ │3.5s  │  │  3.5s    │
                    │ └──┬───┘  └────┬─────┘
                    │    │           │
                    └────┴───────────┘
                         ▼ (auto-cierre)
                        IDLE
```

### 3.2 Teclas Capturadas (Global Event Listener)

| Tecla | Acción | Estado requerido |
|-------|--------|-----------------|
| `0-9` | Agregar dígito al buffer | idle, typing |
| `Enter` | Enviar DNI a Rust (`registrar_asistencia`) | typing |
| `Backspace` | Borrar último dígito | typing |
| `Escape` | Cancelar y volver a idle | typing |
| Cualquier otra | Ignorada | — |

### 3.3 Guardas de Seguridad

| Guardia | Propósito |
|---------|-----------|
| `isProcessingRef` | Previene doble-submit si se presiona Enter rápido |
| `typingTimeoutRef` (5s) | Limpia el buffer si alguien teclea medio DNI y se va |
| `resultTimeoutRef` (3.5s) | Auto-cierra la pantalla de resultado |
| Mínimo 2 dígitos | No procesa DNIs de 1 solo dígito |

---

## 4. Setup Inicial Actualizado

Se agregó el campo **"Nombre del Gimnasio"** al formulario de Setup Inicial:

```
Formulario de Setup:
  1. Nombre del Gimnasio  → localStorage("gymora_gym_name")
  2. Tu Nombre            → comando Rust crear_usuario
  3. PIN de 4 dígitos     → comando Rust crear_usuario
```

El nombre del gimnasio se guarda en `localStorage` con la clave `gymora_gym_name` y se recupera en el kiosco para mostrarlo en la pantalla de reposo.

---

## 5. Pantallas del Kiosco

### 5.1 Estado IDLE (Reposo)

- Fondo: `bg-gymora-bg` (#0a0a0a)
- Logo: Hexagon de lucide-react (placeholder)
- Nombre del gimnasio (de localStorage): `text-4xl font-bold`
- Hint: "Ingresá tu DNI con el teclado numérico"
- Botón sutil esquina inferior derecha: Settings → `/login`

### 5.2 Estado TYPING (Tecleando)

- Los números aparecen gigantes: `text-8xl font-bold tracking-[0.15em]`
- Tipografía monoespaciada (JetBrains Mono)
- Color ámbar: `text-gymora-accent`
- Borde de la card cambia a `border-gymora-accent/30`
- Hints: "ENTER = Confirmar · BACKSPACE = Borrar · ESC = Cancelar"

### 5.3 Estado SUCCESS (Acceso Permitido)

- Fondo: `bg-emerald-950` (verde oscuro)
- Icono: CheckCircle verde
- Nombre del alumno: `text-5xl font-bold`
- DNI en monospace
- Mensaje de Rust (clases restantes/vigencia)
- Indicador numérico de clases restantes (`text-4xl`)
- Barra de progreso que se encoge (3.5s) → auto-cierre

### 5.4 Estado ERROR (Acceso Denegado)

- Fondo: `bg-red-950` (rojo oscuro)
- Icono: XCircle rojo
- "Acceso Denegado" + motivo de Rust
- Barra de progreso que se encoge (3.5s) → auto-cierre

---

## 6. Verificación

- ✅ `npx tsc --noEmit` → 0 errores
- ✅ `npx vite build` → 0 warnings, 0 errors, build limpio
- ✅ Zero modificaciones al backend Rust
- ✅ Global keydown listener sin input enfocado
- ✅ `isProcessingRef` previene doble-submit
- ✅ Timeout 5s limpia buffer abandonado
- ✅ Resultado auto-cierra a 3.5s con barra de progreso
- ✅ `rounded-none` en todos los elementos

---

## 7. Próxima Fase

**Fase 5: Módulo de Administración de Alumnos** — ABM completo de alumnos, pantalla de cobro de cuotas con selección de plan y método de pago, conectado a los comandos Rust de la Fase 2.
