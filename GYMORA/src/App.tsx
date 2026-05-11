// App.tsx — Componente raíz de GYMORA
//
// Responsabilidades:
//   1. Al montar, verifica el estado de la licencia invocando el backend Rust
//   2. Si la licencia es válida → muestra la app principal (placeholder para Fase 2+)
//   3. Si la licencia NO es válida → muestra la pantalla de activación bloqueante
//   4. Mientras verifica, muestra un loading state minimalista
//
// IMPORTANTE: Este componente es el "gate" de seguridad. Nada de la app
// se renderiza hasta que la licencia esté verificada.

import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import ActivationScreen from "./components/ActivationScreen";
import "./App.css";

/// Posibles estados de la verificación de licencia
type LicenseStatus = "loading" | "valid" | "invalid";

function App() {
  // Estado de la licencia — arranca en "loading" hasta que Rust responda
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus>("loading");
  // Hardware ID obtenido desde Rust — necesario para la pantalla de activación
  const [hardwareId, setHardwareId] = useState<string>("");

  /// Efecto que se ejecuta al montar el componente.
  ///
  /// Flujo:
  ///   1. Invoca `get_hardware_id` para obtener el fingerprint de la máquina
  ///   2. Invoca `check_license` para verificar si hay una licencia válida
  ///   3. Actualiza el estado según la respuesta del backend
  ///
  /// ¿Por qué obtener el Hardware ID aunque la licencia sea válida?
  /// Porque si la licencia falla, necesitamos mostrarlo en ActivationScreen
  /// inmediatamente sin otra llamada async.
  useEffect(() => {
    const verifyLicense = async () => {
      try {
        // Paso 1: Obtener el Hardware ID de esta máquina
        const hwId = await invoke<string>("get_hardware_id");
        setHardwareId(hwId);

        // Paso 2: Verificar estado de la licencia
        const isValid = await invoke<boolean>("check_license");
        setLicenseStatus(isValid ? "valid" : "invalid");
      } catch (err) {
        // Si hay un error de sistema, tratamos como no licenciado
        // para no bloquear al usuario sin feedback
        console.error("Error al verificar licencia:", err);
        setLicenseStatus("invalid");
      }
    };

    verifyLicense();
  }, []);

  /// Callback que se ejecuta cuando ActivationScreen logra activar la licencia.
  /// Simplemente cambia el estado a "valid" para desmontar la pantalla de activación.
  const handleActivated = () => {
    setLicenseStatus("valid");
  };

  // === RENDER: Estado de carga ===
  // Pantalla minimalista mientras verificamos la licencia con el backend
  if (licenseStatus === "loading") {
    return (
      <div className="min-h-screen bg-gymora-bg flex items-center justify-center">
        <div className="text-center animate-fade-in-up">
          <h1 className="text-2xl font-bold tracking-tight text-gymora-text mb-3">
            GYMORA
          </h1>
          <div className="flex items-center justify-center gap-2">
            <div className="w-1.5 h-1.5 bg-gymora-accent animate-pulse" />
            <p className="text-xs text-gymora-text-muted uppercase tracking-widest">
              Verificando licencia
            </p>
          </div>
        </div>
      </div>
    );
  }

  // === RENDER: Licencia inválida → Pantalla de activación ===
  if (licenseStatus === "invalid") {
    return (
      <ActivationScreen
        onActivated={handleActivated}
        hardwareId={hardwareId}
      />
    );
  }

  // === RENDER: Licencia válida → App principal ===
  // Placeholder para las fases futuras (Fase 2: CRUD, Fase 3: Login, etc.)
  return (
    <div className="min-h-screen bg-gymora-bg flex items-center justify-center">
      <div className="text-center animate-fade-in-up">
        {/* Indicador de estado activo */}
        <div className="flex justify-center mb-6">
          <div className="w-3 h-3 bg-gymora-success rounded-none" />
        </div>

        <h1 className="text-3xl font-bold tracking-tight text-gymora-text mb-2">
          GYMORA
        </h1>
        <p className="text-sm text-gymora-text-muted font-light tracking-widest uppercase mb-8">
          Sistema de Gestión de Gimnasio
        </p>

        <div className="bg-gymora-surface border border-gymora-border rounded-none px-8 py-6">
          <p className="text-sm text-gymora-text-muted">
            Licencia activa — Sistema listo.
          </p>
          <p className="text-xs text-gymora-text-muted/50 mt-2">
            Los módulos del sistema se habilitarán en las próximas fases.
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
