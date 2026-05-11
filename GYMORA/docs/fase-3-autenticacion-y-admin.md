# GYMORA — Fase 3: Autenticación Local y Pantalla Admin Base

**Fecha:** 2026-05-11  
**Versión:** 0.1.2
**Estado:** ✅ Completada

---

## 1. Resumen de la Fase

Se implementó el **sistema de autenticación local con PIN** y el **layout completo del panel de administración** en React. Se creó el flujo de login (incluyendo setup inicial del primer Dueño), un contexto de autenticación global, rutas protegidas con `react-router-dom`, y un sidebar de navegación industrial con iconos `lucide-react`.

---

## 2. Dependencias Frontend Añadidas

| Paquete | Versión | Propósito |
|---------|---------|-----------|
| `react-router-dom` | 7.x | Routing con HashRouter (compatible con Tauri file://) |
| `lucide-react` | latest | Iconos minimalistas (Shield, Users, Wallet, etc.) |

---

## 3. Estructura de Archivos (Fase 3)

```
src/
├── App.tsx                              [MOD] License gate + AuthProvider + HashRouter
├── App.css                              [MOD] Fix @import ordering
├── main.tsx                             [SIN CAMBIOS]
├── context/
│   └── AuthContext.tsx                   [NEW] Estado de autenticación global
└── components/
    ├── ActivationScreen.tsx              [SIN CAMBIOS] (Fase 1)
    ├── LoginScreen.tsx                   [NEW] Login con PIN / Setup inicial
    ├── AdminLayout.tsx                   [NEW] Layout con sidebar + Outlet
    ├── AdminPlaceholder.tsx              [NEW] Placeholders para sub-rutas admin
    ├── KioscoPlaceholder.tsx             [NEW] Placeholder del módulo kiosco
    └── ProtectedRoute.tsx               [NEW] Guardia de rutas protegidas
```

---

## 4. Arquitectura de Rutas

```
HashRouter
├── /           → KioscoPlaceholder (pública)
├── /login      → LoginScreen (pública)
└── /admin      → ProtectedRoute (requiere auth)
    └── AdminLayout (sidebar + Outlet)
        ├── /admin          → DashboardPage
        ├── /admin/alumnos  → AlumnosPage
        ├── /admin/caja     → CajaPage
        └── /admin/ajustes  → AjustesPage
```

### ¿Por qué HashRouter?

Tauri sirve los archivos como `file://` en producción. `BrowserRouter` depende de un servidor web que maneje las rutas (History API), lo cual no existe en una app de escritorio. `HashRouter` usa el fragmento `#` de la URL (`file://index.html#/admin`), que funciona correctamente en ambos entornos.

---

## 5. Flujo de Autenticación

### 5.1 Setup Inicial (primer uso)

```
App monta → LoginScreen
  ↓
invoke("obtener_usuarios") → []  (lista vacía)
  ↓
Mostrar formulario de Setup Inicial:
  - Campo: Nombre del Dueño
  - Campo: PIN de 4 dígitos
  ↓
invoke("crear_usuario", { nombre, rol: "dueño", pin_acceso })
  ↓
Recargar usuarios → Ahora hay 1 → Modo Login Normal
```

### 5.2 Login Normal

```
LoginScreen carga usuarios
  ↓
<select> con lista de usuarios (Nombre — Rol)
  ↓
<input type="password" maxLength={4}> para PIN
  ↓
Botón "Ingresar" → login(usuario_id, pin)
  ↓
AuthContext invoca: invoke("validar_pin", { usuario_id, pin })
  ├── OK → setUser(usuario) → navigate según rol
  │        ├── Dueño → /admin
  │        └── Profesor → / (kiosco)
  └── Error → Mostrar "PIN incorrecto" en UI
```

### 5.3 AuthContext

| Propiedad | Tipo | Descripción |
|-----------|------|-------------|
| `user` | `UsuarioAutenticado \| null` | Usuario actual (null = sin sesión) |
| `isLoggingIn` | `boolean` | True durante la verificación del PIN |
| `login(id, pin)` | `Promise<void>` | Autentica contra Rust |
| `logout()` | `void` | Limpia la sesión |

> La sesión es **solo en memoria** — se pierde al cerrar la app. Esto es intencional: cada turno de recepción requiere un nuevo login.

---

## 6. Componentes UI

### 6.1 LoginScreen

- **Modo Setup**: Formulario para crear el primer Dueño
- **Modo Login**: Dropdown de usuarios + PIN
- Inputs grandes (`py-3.5`, `text-base`) para uso rápido en recepción
- PIN centrado con tracking amplio (`tracking-[0.5em]`, `text-2xl`)
- Filtro de solo dígitos en inputs de PIN
- Enter para submit rápido
- Iconos `lucide-react`: Shield, UserPlus, LogIn, AlertCircle

### 6.2 AdminLayout

- Sidebar fijo de 224px (`w-56`) con:
  - Logo/brand GYMORA
  - 4 items de navegación con iconos (Dashboard, Alumnos, Caja, Ajustes)
  - Indicador de ruta activa (borde ámbar izquierdo + fondo)
  - Botón de acceso rápido al Kiosco
  - Footer con nombre/rol del usuario + botón Logout
- Área principal con `<Outlet />` para sub-rutas
- Scroll independiente en el área principal

### 6.3 ProtectedRoute

- Componente wrapper que verifica `useAuth().user`
- Si null → `<Navigate to="/login" replace />`
- Si existe → renderiza `<Outlet />`

---

## 7. Reglas de Diseño Aplicadas

- ✅ **`rounded-none`** en todos los elementos (global CSS `border-radius: 0 !important`)
- ✅ **Paleta oscura industrial**: `bg-gymora-bg` (#0a0a0a), `bg-gymora-surface` (#141414)
- ✅ **Acento ámbar**: `text-gymora-accent` (#f59e0b) para elementos activos
- ✅ **Tipografía Inter**: Fuente principal para toda la UI
- ✅ **Inputs grandes**: `py-3.5` + `text-base` para uso rápido en recepción
- ✅ **Animaciones sutiles**: `animate-fade-in-up` en todos los componentes

---

## 8. Verificación

- ✅ `npx tsc --noEmit` — TypeScript compila sin errores
- ✅ `npx vite build` — Build de producción limpio (0 warnings, 0 errors)
- ✅ Zero modificaciones al backend Rust
- ✅ HashRouter configurado para compatibilidad con Tauri

---

## 9. Próxima Fase

**Fase 4: Módulo "Kiosco" (El Core de Recepción)** — Implementar el Global Event Listener para captura de DNI sin input enfocado, invocar `registrar_asistencia`, y mostrar la pantalla de respuesta verde/rojo a pantalla completa por 3 segundos.
