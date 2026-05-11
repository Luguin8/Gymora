// App.tsx — Componente raíz de GYMORA
//
// Responsabilidades:
//   1. Verificación de licencia al montar (gate de seguridad — Fase 1)
//   2. Proveer el contexto de autenticación (AuthProvider — Fase 3)
//   3. Configurar el router con todas las rutas del sistema
//
// Arquitectura de rutas:
//   /         → KioscoPlaceholder (Fase 4: captura de DNI)
//   /login    → LoginScreen (setup inicial o login con PIN)
//   /admin    → ProtectedRoute → AdminLayout → sub-rutas
//     /admin          → DashboardPage
//     /admin/alumnos  → AlumnosPage
//     /admin/caja     → CajaPage
//     /admin/ajustes  → AjustesPage
//
// ¿Por qué HashRouter y no BrowserRouter?
// Tauri sirve los archivos como file:// en producción. BrowserRouter
// depende de un servidor web que maneje las rutas, lo cual no existe
// en una app de escritorio. HashRouter usa el fragmento (#) de la URL,
// que funciona correctamente tanto en dev como en producción.

import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { HashRouter, Routes, Route } from "react-router-dom";

// --- Fase 1: Activación ---
import ActivationScreen from "./components/ActivationScreen";

// --- Fase 3: Auth y Layout ---
import { AuthProvider } from "./context/AuthContext";
import LoginScreen from "./components/LoginScreen";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminLayout from "./components/AdminLayout";
import KioscoScreen from "./components/KioscoScreen";
import {
  DashboardPage,
  AlumnosPage,
  CajaPage,
  AjustesPage,
} from "./components/AdminPlaceholder";

import "./App.css";

// ===================================================================
// TIPOS
// ===================================================================

/// Posibles estados de la verificación de licencia
type LicenseStatus = "loading" | "valid" | "invalid";

// ===================================================================
// COMPONENTE PRINCIPAL
// ===================================================================

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

  // ===================================================================
  // RENDER: Estado de carga (verificando licencia)
  // ===================================================================
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

  // ===================================================================
  // RENDER: Licencia inválida → Pantalla de activación bloqueante
  // ===================================================================
  if (licenseStatus === "invalid") {
    return (
      <ActivationScreen
        onActivated={handleActivated}
        hardwareId={hardwareId}
      />
    );
  }

  // ===================================================================
  // RENDER: Licencia válida → App completa con routing
  // ===================================================================
  // Envolvemos todo en AuthProvider para que el estado de autenticación
  // esté disponible en todas las rutas vía useAuth().
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          {/* ============================== */}
          {/* Ruta pública: Kiosco */}
          {/* ============================== */}
          <Route path="/" element={<KioscoScreen />} />

          {/* ============================== */}
          {/* Ruta pública: Login */}
          {/* ============================== */}
          <Route path="/login" element={<LoginScreen />} />

          {/* ============================== */}
          {/* Rutas protegidas: Admin */}
          {/* ProtectedRoute verifica que haya un usuario autenticado */}
          {/* Si no → redirige a /login */}
          {/* ============================== */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<DashboardPage />} />
              <Route path="/admin/alumnos" element={<AlumnosPage />} />
              <Route path="/admin/caja" element={<CajaPage />} />
              <Route path="/admin/ajustes" element={<AjustesPage />} />
            </Route>
          </Route>
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}

export default App;
