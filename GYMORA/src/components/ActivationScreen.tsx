// ActivationScreen.tsx — Pantalla de activación de licencia GYMORA
//
// Esta pantalla se muestra cuando la app NO tiene una licencia válida.
// Muestra el Hardware ID para que el usuario lo copie y envíe al desarrollador,
// y un campo para ingresar la clave de activación.
//
// REGLA ESTRICTA: Absolutamente CERO bordes redondeados. Todo usa rounded-none.
// La clase global CSS ya fuerza border-radius: 0, pero usamos rounded-none
// en Tailwind por claridad y redundancia.

import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

/// Props del componente ActivationScreen
interface ActivationScreenProps {
  /// Callback que se ejecuta cuando la activación es exitosa.
  /// El componente padre (App.tsx) lo usa para cambiar el estado a "activado".
  onActivated: () => void;
  /// Hardware ID actual de la máquina, obtenido desde Rust al montar App.tsx
  hardwareId: string;
}

export default function ActivationScreen({ onActivated, hardwareId }: ActivationScreenProps) {
  // Estado del campo de clave de activación
  const [activationKey, setActivationKey] = useState("");
  // Estado de carga durante la verificación
  const [isLoading, setIsLoading] = useState(false);
  // Mensaje de error si la clave es inválida
  const [error, setError] = useState("");
  // Estado de "copiado" para el botón de copiar Hardware ID
  const [copied, setCopied] = useState(false);

  /// Copia el Hardware ID al portapapeles del sistema.
  /// Muestra un indicador visual de "Copiado" por 2 segundos.
  const handleCopyHwId = async () => {
    try {
      await navigator.clipboard.writeText(hardwareId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback si clipboard API falla
      setError("No se pudo copiar al portapapeles");
    }
  };

  /// Envía la clave de activación al backend Rust para verificación.
  ///
  /// Flujo:
  ///   1. Valida que el campo no esté vacío
  ///   2. Invoca el comando Tauri `activate_license` con la clave
  ///   3. Si retorna true → licencia activada → callback onActivated()
  ///   4. Si retorna false → clave inválida → muestra error
  const handleActivate = async () => {
    // Validación básica del campo
    if (!activationKey.trim()) {
      setError("Ingresá una clave de activación");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      // Invocamos el comando Rust que compara la clave con SHA256(HWID + SALT)
      const success = await invoke<boolean>("activate_license", {
        key: activationKey.trim(),
      });

      if (success) {
        // Activación exitosa — notificamos al componente padre
        onActivated();
      } else {
        // Clave inválida — no coincide con la derivación esperada
        setError("Clave de activación inválida. Contactá al desarrollador.");
      }
    } catch (err) {
      // Error de sistema (BD, permisos, etc.)
      setError(`Error del sistema: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gymora-bg flex items-center justify-center p-4">
      <div className="w-full max-w-lg animate-fade-in-up">
        {/* === HEADER === */}
        <div className="text-center mb-10">
          {/* Indicador de estado — punto ámbar con pulso */}
          <div className="flex justify-center mb-6">
            <div className="w-3 h-3 bg-gymora-accent rounded-none animate-pulse-glow" />
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-gymora-text mb-2">
            GYMORA
          </h1>
          <p className="text-sm text-gymora-text-muted font-light tracking-widest uppercase">
            Activación de Licencia
          </p>
        </div>

        {/* === CARD PRINCIPAL === */}
        <div className="bg-gymora-surface border border-gymora-border rounded-none p-6 space-y-6">

          {/* --- Sección: Hardware ID --- */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-gymora-text-muted uppercase tracking-wider">
              Identificador de Hardware
            </label>
            <p className="text-xs text-gymora-text-muted">
              Enviá este código al desarrollador para obtener tu clave de activación.
            </p>
            <div className="flex items-stretch gap-0">
              {/* Campo con el Hardware ID (solo lectura) */}
              <div
                id="hardware-id-display"
                className="flex-1 bg-gymora-bg border border-gymora-border rounded-none px-3 py-3 font-mono-hwid text-gymora-accent select-text overflow-x-auto"
              >
                {hardwareId || "Obteniendo..."}
              </div>
              {/* Botón copiar */}
              <button
                id="copy-hwid-button"
                onClick={handleCopyHwId}
                className="bg-gymora-surface-alt border border-l-0 border-gymora-border rounded-none px-4 text-xs font-medium text-gymora-text-muted hover:text-gymora-text hover:bg-gymora-border transition-colors duration-150 cursor-pointer"
                title="Copiar Hardware ID"
              >
                {copied ? "✓ Copiado" : "Copiar"}
              </button>
            </div>
          </div>

          {/* --- Separador --- */}
          <div className="border-t border-gymora-border" />

          {/* --- Sección: Clave de Activación --- */}
          <div className="space-y-3">
            <label
              htmlFor="activation-key-input"
              className="block text-xs font-semibold text-gymora-text-muted uppercase tracking-wider"
            >
              Clave de Activación
            </label>
            <input
              id="activation-key-input"
              type="text"
              value={activationKey}
              onChange={(e) => {
                setActivationKey(e.target.value);
                setError(""); // Limpiamos errores al tipear
              }}
              onKeyDown={(e) => {
                // Permitir activar con Enter
                if (e.key === "Enter") handleActivate();
              }}
              placeholder="Ingresá la clave proporcionada"
              className="w-full bg-gymora-bg border border-gymora-border rounded-none px-3 py-3 text-sm text-gymora-text placeholder-gymora-text-muted/50 focus:outline-none focus:border-gymora-accent transition-colors duration-150"
              disabled={isLoading}
              autoFocus
            />
          </div>

          {/* --- Mensaje de error --- */}
          {error && (
            <div
              id="activation-error"
              className="bg-gymora-danger/10 border border-gymora-danger/30 rounded-none px-3 py-2 text-xs text-gymora-danger"
            >
              {error}
            </div>
          )}

          {/* --- Botón de activación --- */}
          <button
            id="activate-button"
            onClick={handleActivate}
            disabled={isLoading || !activationKey.trim()}
            className="w-full bg-gymora-accent hover:bg-gymora-accent-hover disabled:opacity-40 disabled:cursor-not-allowed rounded-none py-3 text-sm font-semibold text-gymora-bg uppercase tracking-wider transition-colors duration-150 cursor-pointer"
          >
            {isLoading ? "Verificando..." : "Activar Licencia"}
          </button>
        </div>

        {/* === FOOTER === */}
        <p className="text-center text-xs text-gymora-text-muted/50 mt-6">
          GYMORA v0.1.0 — Sistema de Gestión de Gimnasio
        </p>
      </div>
    </div>
  );
}
