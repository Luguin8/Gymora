// LoginScreen.tsx — Pantalla de login y setup inicial de GYMORA
//
// Esta pantalla tiene DOS modos:
//   A) Setup Inicial: Si no hay usuarios en el sistema, muestra un formulario
//      para crear el primer "Dueño" con nombre, PIN de 4 dígitos, y nombre del gimnasio.
//      El nombre del gimnasio se guarda en localStorage ('gymora_gym_name') para
//      que el kiosco lo muestre en la pantalla de reposo.
//   B) Login Normal: Si hay usuarios, muestra un dropdown para elegir el perfil
//      y un campo de PIN para autenticarse.
//
// Al loguearse exitosamente, redirige al usuario según su rol:
//   - Dueño → /admin (panel de administración)
//   - Profesor → / (kiosco de recepción)
//
// REGLA ESTRICTA: Todo rounded-none. Inputs grandes para uso rápido en recepción.

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { useAuth } from "../context/AuthContext";
import { Shield, UserPlus, LogIn, AlertCircle, ImagePlus } from "lucide-react";

// ===================================================================
// TIPOS
// ===================================================================

/// Usuario del sistema (espejo del struct Rust `Usuario`)
interface Usuario {
  id: number;
  nombre: string;
  rol: string;
  activo: boolean;
}

// ===================================================================
// COMPONENTE PRINCIPAL
// ===================================================================

export default function LoginScreen() {
  // --- Estado del componente ---
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [error, setError] = useState("");

  // --- Estado del modo Setup Inicial ---
  const [setupNombre, setSetupNombre] = useState("");
  const [setupPin, setSetupPin] = useState("");
  const [setupGymName, setSetupGymName] = useState("");
  const [setupLogo, setSetupLogo] = useState<string | null>(null);
  const [setupLogoPreview, setSetupLogoPreview] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // --- Estado del modo Login Normal ---
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [loginPin, setLoginPin] = useState("");

  // --- Hooks ---
  const { login, isLoggingIn } = useAuth();
  const navigate = useNavigate();
  const pinInputRef = useRef<HTMLInputElement>(null);

  /// Al montar, consultamos la lista de usuarios desde Rust.
  /// Esto determina si mostramos el formulario de setup o el login.
  useEffect(() => {
    loadUsuarios();
  }, []);

  /// Carga la lista de usuarios desde el backend Rust.
  const loadUsuarios = async () => {
    setIsLoadingUsers(true);
    try {
      const users = await invoke<Usuario[]>("obtener_usuarios");
      setUsuarios(users);
      // Pre-seleccionar el primer usuario si existe
      if (users.length > 0) {
        setSelectedUserId(users[0].id);
      }
    } catch (err) {
      setError(`Error al cargar usuarios: ${err}`);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  /// Handler del Setup Inicial: Crea el primer usuario "Dueño".
  ///
  /// Después de crearlo, recargamos la lista de usuarios para
  /// pasar al modo de login normal automáticamente.
  const handleSetup = async () => {
    if (!setupGymName.trim()) {
      setError("Ingresá el nombre del gimnasio");
      return;
    }
    if (!setupNombre.trim()) {
      setError("Ingresá tu nombre");
      return;
    }
    if (setupPin.length !== 4 || !/^\d{4}$/.test(setupPin)) {
      setError("El PIN debe tener exactamente 4 dígitos numéricos");
      return;
    }

    setIsCreating(true);
    setError("");

    try {
      // Guardar el nombre del gimnasio en localStorage.
      // El kiosco lo leerá para mostrarlo en la pantalla de reposo.
      localStorage.setItem("gymora_gym_name", setupGymName.trim());

      // Guardar logo si se subió
      if (setupLogo) {
        localStorage.setItem("gymora_gym_logo", setupLogo);
      }

      await invoke("crear_usuario", {
        nombre: setupNombre.trim(),
        rol: "dueño",
        pinAcceso: setupPin,
      });
      // Recargar usuarios → ahora habrá al menos uno → modo login
      await loadUsuarios();
      // Limpiar campos de setup
      setSetupNombre("");
      setSetupPin("");
      setSetupGymName("");
      setSetupLogo(null);
      setSetupLogoPreview(null);
    } catch (err) {
      setError(`${err}`);
    } finally {
      setIsCreating(false);
    }
  };

  /// Handler del Login Normal: Valida PIN contra Rust y redirige.
  const handleLogin = async () => {
    if (!selectedUserId) {
      setError("Seleccioná un usuario");
      return;
    }
    if (loginPin.length !== 4) {
      setError("Ingresá tu PIN de 4 dígitos");
      return;
    }

    setError("");

    try {
      await login(selectedUserId, loginPin);

      // Buscar el usuario seleccionado para saber su rol
      const user = usuarios.find((u) => u.id === selectedUserId);

      // Redirigir según rol:
      //   - dueño → /admin (tiene acceso completo)
      //   - profesor → / (kiosco de recepción)
      if (user?.rol === "dueño") {
        navigate("/admin");
      } else {
        navigate("/");
      }
    } catch (err) {
      // El error viene de Rust como string (ej: "PIN incorrecto")
      setError(`${err}`);
      setLoginPin(""); // Limpiar PIN para re-intentar
      pinInputRef.current?.focus();
    }
  };

  // ===================================================================
  // RENDER: Estado de carga
  // ===================================================================
  if (isLoadingUsers) {
    return (
      <div className="min-h-screen bg-gymora-bg flex items-center justify-center">
        <div className="text-center animate-fade-in-up">
          <h1 className="text-2xl font-bold tracking-tight text-gymora-text mb-3">
            GYMORA
          </h1>
          <div className="flex items-center justify-center gap-2">
            <div className="w-1.5 h-1.5 bg-gymora-accent animate-pulse" />
            <p className="text-xs text-gymora-text-muted uppercase tracking-widest">
              Cargando sistema
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ===================================================================
  // RENDER: Setup Inicial (sin usuarios en el sistema)
  // ===================================================================
  if (usuarios.length === 0) {
    return (
      <div className="min-h-screen bg-gymora-bg flex items-center justify-center p-4">
        <div className="w-full max-w-md animate-fade-in-up">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="flex justify-center mb-6">
              <div className="w-10 h-10 bg-gymora-surface border border-gymora-border rounded-none flex items-center justify-center">
                <UserPlus size={20} className="text-gymora-accent" />
              </div>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-gymora-text mb-2">
              GYMORA
            </h1>
            <p className="text-sm text-gymora-text-muted font-light tracking-widest uppercase">
              Configuración Inicial
            </p>
          </div>

          {/* Card de Setup */}
          <div className="bg-gymora-surface border border-gymora-border rounded-none p-6 space-y-5">
            <p className="text-sm text-gymora-text-muted">
              No hay usuarios registrados. Configurá el sistema y creá la cuenta del <strong className="text-gymora-text">Dueño</strong> para comenzar.
            </p>

            {/* Campo: Nombre del Gimnasio */}
            <div className="space-y-2">
              <label
                htmlFor="setup-gym-name"
                className="block text-xs font-semibold text-gymora-text-muted uppercase tracking-wider"
              >
                Nombre del Gimnasio
              </label>
              <input
                id="setup-gym-name"
                type="text"
                value={setupGymName}
                onChange={(e) => {
                  setSetupGymName(e.target.value);
                  setError("");
                }}
                placeholder="Ej: Gimnasio Iron Fit"
                className="w-full bg-gymora-bg border border-gymora-border rounded-none px-4 py-3.5 text-base text-gymora-text placeholder-gymora-text-muted/50 focus:outline-none focus:border-gymora-accent transition-colors duration-150"
                autoFocus
              />
            </div>

            {/* Campo: Nombre del Dueño */}
            <div className="space-y-2">
              <label
                htmlFor="setup-nombre"
                className="block text-xs font-semibold text-gymora-text-muted uppercase tracking-wider"
              >
                Tu Nombre
              </label>
              <input
                id="setup-nombre"
                type="text"
                value={setupNombre}
                onChange={(e) => {
                  setSetupNombre(e.target.value);
                  setError("");
                }}
                placeholder="Ej: Juan Pérez"
                className="w-full bg-gymora-bg border border-gymora-border rounded-none px-4 py-3.5 text-base text-gymora-text placeholder-gymora-text-muted/50 focus:outline-none focus:border-gymora-accent transition-colors duration-150"
              />
            </div>

            {/* Campo: Logo del Gimnasio (opcional) */}
            <div className="space-y-2">
              <label
                htmlFor="setup-logo"
                className="block text-xs font-semibold text-gymora-text-muted uppercase tracking-wider"
              >
                Logo del Gimnasio (opcional)
              </label>
              {setupLogoPreview ? (
                <div className="relative">
                  <img
                    src={setupLogoPreview}
                    alt="Preview"
                    className="w-full h-32 object-contain bg-gymora-bg border border-gymora-border rounded-none p-2"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setSetupLogo(null);
                      setSetupLogoPreview(null);
                    }}
                    className="absolute top-1 right-1 bg-gymora-danger/80 text-white text-xs px-2 py-1 rounded-none cursor-pointer hover:bg-gymora-danger transition-colors"
                  >
                    Quitar
                  </button>
                </div>
              ) : (
                <label
                  htmlFor="setup-logo"
                  className="flex items-center justify-center gap-2 w-full bg-gymora-bg border border-dashed border-gymora-border rounded-none px-4 py-4 text-sm text-gymora-text-muted cursor-pointer hover:border-gymora-accent hover:text-gymora-accent transition-colors duration-150"
                >
                  <ImagePlus size={18} />
                  Seleccionar imagen
                </label>
              )}
              <input
                id="setup-logo"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  // Convertir a Base64 para guardar en localStorage
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    const base64 = ev.target?.result as string;
                    setSetupLogo(base64);
                    setSetupLogoPreview(base64);
                  };
                  reader.readAsDataURL(file);
                  // Reset el input para permitir subir el mismo archivo otra vez
                  e.target.value = "";
                }}
              />
            </div>

            {/* Campo: PIN */}
            <div className="space-y-2">
              <label
                htmlFor="setup-pin"
                className="block text-xs font-semibold text-gymora-text-muted uppercase tracking-wider"
              >
                PIN de Acceso (4 dígitos)
              </label>
              <input
                id="setup-pin"
                type="password"
                maxLength={4}
                inputMode="numeric"
                value={setupPin}
                onChange={(e) => {
                  // Solo aceptar dígitos
                  const val = e.target.value.replace(/\D/g, "");
                  setSetupPin(val);
                  setError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSetup();
                }}
                placeholder="• • • •"
                className="w-full bg-gymora-bg border border-gymora-border rounded-none px-4 py-3.5 text-center text-2xl tracking-[0.5em] text-gymora-text placeholder-gymora-text-muted/50 focus:outline-none focus:border-gymora-accent transition-colors duration-150"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 bg-gymora-danger/10 border border-gymora-danger/30 rounded-none px-3 py-2">
                <AlertCircle size={14} className="text-gymora-danger shrink-0" />
                <p className="text-xs text-gymora-danger">{error}</p>
              </div>
            )}

            {/* Botón crear */}
            <button
              id="setup-submit-button"
              onClick={handleSetup}
              disabled={isCreating}
              className="w-full bg-gymora-accent hover:bg-gymora-accent-hover disabled:opacity-40 disabled:cursor-not-allowed rounded-none py-3.5 text-sm font-semibold text-gymora-bg uppercase tracking-wider transition-colors duration-150 cursor-pointer"
            >
              {isCreating ? "Creando..." : "Crear Cuenta de Dueño"}
            </button>
          </div>

          <p className="text-center text-xs text-gymora-text-muted/50 mt-6">
            Este usuario tendrá acceso completo al sistema.
          </p>
        </div>
      </div>
    );
  }

  // ===================================================================
  // RENDER: Login Normal (hay usuarios registrados)
  // ===================================================================
  return (
    <div className="min-h-screen bg-gymora-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in-up">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="flex justify-center mb-6">
            <div className="w-10 h-10 bg-gymora-surface border border-gymora-border rounded-none flex items-center justify-center">
              <Shield size={20} className="text-gymora-accent" />
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gymora-text mb-2">
            GYMORA
          </h1>
          <p className="text-sm text-gymora-text-muted font-light tracking-widest uppercase">
            Iniciar Sesión
          </p>
        </div>

        {/* Card de Login */}
        <div className="bg-gymora-surface border border-gymora-border rounded-none p-6 space-y-5">
          {/* Selector de usuario */}
          <div className="space-y-2">
            <label
              htmlFor="login-user-select"
              className="block text-xs font-semibold text-gymora-text-muted uppercase tracking-wider"
            >
              Usuario
            </label>
            <select
              id="login-user-select"
              value={selectedUserId ?? ""}
              onChange={(e) => {
                setSelectedUserId(Number(e.target.value));
                setError("");
                setLoginPin("");
                // Enfocar el campo de PIN al cambiar de usuario
                setTimeout(() => pinInputRef.current?.focus(), 50);
              }}
              className="w-full bg-gymora-bg border border-gymora-border rounded-none px-4 py-3.5 text-base text-gymora-text focus:outline-none focus:border-gymora-accent transition-colors duration-150 cursor-pointer appearance-none"
            >
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre} — {u.rol === "dueño" ? "Dueño" : "Profesor"}
                </option>
              ))}
            </select>
          </div>

          {/* Campo: PIN */}
          <div className="space-y-2">
            <label
              htmlFor="login-pin-input"
              className="block text-xs font-semibold text-gymora-text-muted uppercase tracking-wider"
            >
              PIN de Acceso
            </label>
            <input
              id="login-pin-input"
              ref={pinInputRef}
              type="password"
              maxLength={4}
              inputMode="numeric"
              value={loginPin}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "");
                setLoginPin(val);
                setError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleLogin();
              }}
              placeholder="• • • •"
              className="w-full bg-gymora-bg border border-gymora-border rounded-none px-4 py-3.5 text-center text-2xl tracking-[0.5em] text-gymora-text placeholder-gymora-text-muted/50 focus:outline-none focus:border-gymora-accent transition-colors duration-150"
              autoFocus
            />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 bg-gymora-danger/10 border border-gymora-danger/30 rounded-none px-3 py-2">
              <AlertCircle size={14} className="text-gymora-danger shrink-0" />
              <p className="text-xs text-gymora-danger">{error}</p>
            </div>
          )}

          {/* Botón login */}
          <button
            id="login-submit-button"
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="w-full bg-gymora-accent hover:bg-gymora-accent-hover disabled:opacity-40 disabled:cursor-not-allowed rounded-none py-3.5 text-sm font-semibold text-gymora-bg uppercase tracking-wider transition-colors duration-150 cursor-pointer flex items-center justify-center gap-2"
          >
            <LogIn size={16} />
            {isLoggingIn ? "Verificando..." : "Ingresar"}
          </button>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gymora-text-muted/50 mt-6">
          GYMORA v0.1.0 — Sistema de Gestión de Gimnasio
        </p>
      </div>
    </div>
  );
}
