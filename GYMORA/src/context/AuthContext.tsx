// AuthContext.tsx — Contexto de autenticación de GYMORA
//
// Provee el estado del usuario autenticado a toda la app.
// Funciones expuestas:
//   - login(usuario_id, pin): Llama a Rust `validar_pin`, guarda el usuario en estado
//   - logout(): Limpia el estado del usuario
//   - user: El usuario autenticado actual (null si no hay sesión)
//
// ¿Por qué un Context y no un state local?
// Porque el usuario autenticado se necesita en múltiples componentes:
//   - AdminLayout (mostrar nombre y rol en el sidebar)
//   - Rutas protegidas (verificar si hay sesión)
//   - Comandos de cobro (necesitan el usuario_id del cobrador)

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { invoke } from "@tauri-apps/api/core";

// ===================================================================
// TIPOS
// ===================================================================

/// Datos del usuario autenticado (espejo del struct Rust `UsuarioAutenticado`)
interface UsuarioAutenticado {
  id: number;
  nombre: string;
  rol: string;
}

/// Shape del contexto de autenticación
interface AuthContextType {
  /// El usuario actualmente logueado (null = sin sesión)
  user: UsuarioAutenticado | null;
  /// True mientras se está procesando el login contra Rust
  isLoggingIn: boolean;
  /// Autentica un usuario por ID + PIN invocando el backend Rust
  login: (usuarioId: number, pin: string) => Promise<void>;
  /// Cierra la sesión actual
  logout: () => void;
}

// ===================================================================
// CONTEXTO
// ===================================================================

const AuthContext = createContext<AuthContextType | null>(null);

// ===================================================================
// PROVIDER
// ===================================================================

interface AuthProviderProps {
  children: ReactNode;
}

/// Provee el estado de autenticación a todo el árbol de componentes.
///
/// Se monta en App.tsx envolviendo el router y las rutas.
/// Persiste el usuario en memoria (se pierde al cerrar la app,
/// lo cual es intencional: cada turno de recepción requiere login).
export function AuthProvider({ children }: AuthProviderProps) {
  // Estado del usuario autenticado — null = sin sesión
  const [user, setUser] = useState<UsuarioAutenticado | null>(null);
  // Estado de carga durante el login (para deshabilitar el botón)
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  /// Autentica al usuario invocando el comando Rust `validar_pin`.
  ///
  /// Si el PIN es correcto, Rust retorna los datos del usuario
  /// y los guardamos en el estado. Si falla, lanzamos el error
  /// para que el componente de login lo capture y lo muestre.
  ///
  /// ¿Por qué useCallback? Para mantener la referencia estable
  /// y evitar re-renders innecesarios en componentes que consumen el contexto.
  const login = useCallback(async (usuarioId: number, pin: string) => {
    setIsLoggingIn(true);
    try {
      // Invocamos el comando Rust que valida el PIN contra la BD
      const usuario = await invoke<UsuarioAutenticado>("validar_pin", {
        usuarioId,
        pin,
      });
      setUser(usuario);
    } catch (error) {
      // Re-lanzamos el error para que LoginScreen lo capture
      // El error viene como string desde Rust (Result<T, String>)
      throw error;
    } finally {
      setIsLoggingIn(false);
    }
  }, []);

  /// Cierra la sesión actual.
  /// Simplemente limpia el estado — no hay nada que invalidar en el backend
  /// porque no hay tokens ni sesiones persistentes.
  const logout = useCallback(() => {
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoggingIn, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ===================================================================
// HOOK
// ===================================================================

/// Hook custom para consumir el contexto de autenticación.
///
/// Lanza un error si se usa fuera de un AuthProvider (bug de desarrollo).
/// Uso: `const { user, login, logout } = useAuth();`
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error(
      "useAuth() debe usarse dentro de un <AuthProvider>. " +
        "Verificá que App.tsx envuelva el router con <AuthProvider>."
    );
  }
  return context;
}
