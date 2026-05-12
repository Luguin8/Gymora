// KioscoScreen.tsx — Módulo Kiosco de Recepción (Core de GYMORA)
//
// Este es el componente más importante de la aplicación.
// Implementa el flujo completo de control de acceso del gimnasio:
//
// ESTADOS:
//   1. IDLE (Reposo): Pantalla oscura con logo y nombre del gimnasio.
//      Esperando que alguien ingrese un DNI con el teclado numérico.
//   2. TYPING: Los dígitos aparecen gigantes mientras se ingresa el DNI.
//      Timeout de 5s para limpiar si se abandona a medio camino.
//   3. PROCESSING: Breve estado mientras Rust verifica la asistencia.
//   4. SUCCESS: Fondo verde con nombre del alumno y clases restantes. 3.5s.
//   5. ERROR: Fondo rojo con motivo del rechazo. 3.5s.
//
// DISEÑO CLAVE:
//   - NO hay ningún <input> enfocado. Se usa un Global Event Listener.
//   - Solo captura teclas numéricas (0-9) y Enter.
//   - Backspace borra el último dígito.
//   - isProcessing previene doble-submit si presionan Enter rápido.
//   - Pantalla completa, pensada para una PC de recepción dedicada.
//
// REGLA ESTRICTA: Todo rounded-none.

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { Hexagon, Settings, CheckCircle, XCircle } from "lucide-react";

// ===================================================================
// TIPOS
// ===================================================================

/// Los 5 estados posibles de la pantalla del kiosco
type KioscoState = "idle" | "typing" | "processing" | "success" | "error";

/// Respuesta de Rust al registrar asistencia (espejo de RespuestaAsistencia)
interface RespuestaAsistencia {
  alumno_nombre: string;
  alumno_dni: string;
  clases_restantes: number;
  fecha_vencimiento: string;
  mensaje: string;
}

// ===================================================================
// CONSTANTES
// ===================================================================

/// Tiempo en ms antes de limpiar el buffer de DNI si no se completa
const TYPING_TIMEOUT_MS = 5000;

/// Tiempo en ms que se muestra la pantalla de resultado (éxito/error)
const RESULT_DISPLAY_MS = 3500;

/// Clave de localStorage para el nombre del gimnasio (seteada en setup)
const GYM_NAME_KEY = "gymora_gym_name";

/// Clave de localStorage para el logo del gimnasio (Base64)
const GYM_LOGO_KEY = "gymora_gym_logo";

// ===================================================================
// COMPONENTE PRINCIPAL
// ===================================================================

export default function KioscoScreen() {
  // --- Estado del kiosco ---
  const [state, setState] = useState<KioscoState>("idle");
  // Buffer del DNI que se va armando con las teclas numéricas
  const [dniBuffer, setDniBuffer] = useState("");
  // Datos de la respuesta exitosa de Rust
  const [successData, setSuccessData] = useState<RespuestaAsistencia | null>(null);
  // Mensaje de error de Rust
  const [errorMessage, setErrorMessage] = useState("");
  // Nombre del gimnasio recuperado de localStorage
  const [gymName, setGymName] = useState("");
  // Logo del gimnasio en Base64 (null si no se subió)
  const [gymLogo, setGymLogo] = useState<string | null>(null);
  // Guard contra doble-submit
  const isProcessingRef = useRef(false);
  // Timer de limpieza del buffer de typing
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Timer de auto-cierre de la pantalla de resultado
  const resultTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const navigate = useNavigate();

  // ================================================================
  // EFECTO: Cargar nombre del gimnasio al montar
  // ================================================================
  useEffect(() => {
    const name = localStorage.getItem(GYM_NAME_KEY);
    setGymName(name || "GIMNASIO");
    const logo = localStorage.getItem(GYM_LOGO_KEY);
    setGymLogo(logo);
  }, []);

  // ================================================================
  // FUNCIÓN: Resetear al estado de reposo
  // ================================================================
  const resetToIdle = useCallback(() => {
    setState("idle");
    setDniBuffer("");
    setSuccessData(null);
    setErrorMessage("");
    isProcessingRef.current = false;

    // Limpiar timers pendientes
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (resultTimeoutRef.current) {
      clearTimeout(resultTimeoutRef.current);
      resultTimeoutRef.current = null;
    }
  }, []);

  // ================================================================
  // FUNCIÓN: Procesar el DNI ingresado
  // ================================================================
  /// Invoca el comando Rust `registrar_asistencia` con el DNI acumulado.
  ///
  /// Flujo:
  ///   1. Marca isProcessing para bloquear doble-submit
  ///   2. Cambia a estado "processing" (breve loading)
  ///   3. Invoca Rust → OK → estado "success" / Error → estado "error"
  ///   4. Programa auto-cierre a 3.5 segundos → vuelve a idle
  const processDni = useCallback(async (dni: string) => {
    // Guard: no procesar si ya hay una operación en curso
    if (isProcessingRef.current) return;
    // Guard: DNI vacío o muy corto
    if (dni.length < 2) return;

    isProcessingRef.current = true;
    setState("processing");

    // Limpiar el timeout de typing si existe
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    try {
      const response = await invoke<RespuestaAsistencia>("registrar_asistencia", {
        dni,
      });

      // Éxito: mostrar pantalla verde
      setSuccessData(response);
      setState("success");
    } catch (err) {
      // Error: mostrar pantalla roja con el motivo de Rust
      setErrorMessage(`${err}`);
      setState("error");
    }

    // Programar auto-cierre después de 3.5 segundos
    resultTimeoutRef.current = setTimeout(() => {
      resetToIdle();
    }, RESULT_DISPLAY_MS);
  }, [resetToIdle]);

  // ================================================================
  // EFECTO: Global Key Listener
  // ================================================================
  /// Escucha TODAS las teclas en la ventana sin necesidad de un input enfocado.
  ///
  /// Diseño clave para el kiosco: el usuario (alumno) simplemente
  /// se acerca y teclea su DNI en el teclado numérico. No tiene que
  /// hacer click en ningún campo, ni siquiera tocar el mouse.
  ///
  /// Teclas capturadas:
  ///   - 0-9: Se agregan al buffer del DNI
  ///   - Enter: Dispara la verificación
  ///   - Backspace: Borra el último dígito
  ///   - Escape: Cancela y vuelve a idle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // No capturar si estamos mostrando resultado o procesando
      if (state === "success" || state === "error" || state === "processing") {
        return;
      }

      const key = e.key;

      // --- Teclas numéricas (0-9) ---
      if (/^[0-9]$/.test(key)) {
        e.preventDefault();

        setDniBuffer((prev) => {
          // Límite de 15 dígitos para evitar desborde visual extremo
          if (prev.length >= 15) return prev;
          const newBuffer = prev + key;
          return newBuffer;
        });

        // Cambiar a estado "typing" si estábamos en idle
        if (state === "idle") {
          setState("typing");
        }

        // Reiniciar el timeout de limpieza.
        // Si pasan 5 segundos sin actividad → limpiar buffer → volver a idle.
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        typingTimeoutRef.current = setTimeout(() => {
          resetToIdle();
        }, TYPING_TIMEOUT_MS);

        return;
      }

      // --- Enter: Enviar DNI ---
      if (key === "Enter") {
        e.preventDefault();
        // Usar una referencia indirecta al buffer actual
        // porque el state puede no estar actualizado en este closure
        setDniBuffer((currentBuffer) => {
          if (currentBuffer.length >= 2) {
            processDni(currentBuffer);
          }
          return currentBuffer;
        });
        return;
      }

      // --- Backspace: Borrar último dígito ---
      if (key === "Backspace") {
        e.preventDefault();
        setDniBuffer((prev) => {
          const newBuffer = prev.slice(0, -1);
          // Si el buffer queda vacío, volver a idle
          if (newBuffer.length === 0) {
            setState("idle");
            if (typingTimeoutRef.current) {
              clearTimeout(typingTimeoutRef.current);
              typingTimeoutRef.current = null;
            }
          }
          return newBuffer;
        });
        return;
      }

      // --- Escape: Cancelar y limpiar ---
      if (key === "Escape") {
        e.preventDefault();
        resetToIdle();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [state, processDni, resetToIdle]);

  // ================================================================
  // Cleanup de timers al desmontar
  // ================================================================
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (resultTimeoutRef.current) clearTimeout(resultTimeoutRef.current);
    };
  }, []);

  // ================================================================
  // RENDER: Estado SUCCESS (Acceso permitido)
  // ================================================================
  if (state === "success" && successData) {
    return (
      <div className="min-h-screen bg-emerald-950 flex items-center justify-center p-4 transition-colors duration-300">
        <div className="text-center animate-fade-in-up max-w-lg">
          {/* Icono de éxito */}
          <div className="flex justify-center mb-8">
            <div className="w-20 h-20 bg-emerald-900 border-2 border-emerald-500 rounded-none flex items-center justify-center">
              <CheckCircle size={44} className="text-emerald-400" />
            </div>
          </div>

          {/* Nombre del alumno */}
          <h1 className="text-5xl font-bold tracking-tight text-emerald-50 mb-4">
            {successData.alumno_nombre}
          </h1>

          {/* DNI */}
          <p className="text-lg text-emerald-300/70 font-mono mb-8">
            DNI: {successData.alumno_dni}
          </p>

          {/* Mensaje de Rust (clases restantes, etc.) */}
          <div className="bg-emerald-900/50 border border-emerald-700/50 rounded-none px-8 py-5">
            <p className="text-xl text-emerald-100 font-medium">
              {successData.mensaje}
            </p>

            {/* Indicador visual de clases restantes */}
            {successData.clases_restantes > 0 && (
              <div className="mt-4 flex items-center justify-center gap-3">
                <span className="text-4xl font-bold text-emerald-300">
                  {successData.clases_restantes}
                </span>
                <span className="text-sm text-emerald-400 uppercase tracking-wider">
                  clase{successData.clases_restantes !== 1 ? "s" : ""} restante{successData.clases_restantes !== 1 ? "s" : ""}
                </span>
              </div>
            )}

            {/* Plan ilimitado */}
            {successData.clases_restantes === -1 && (
              <p className="mt-3 text-sm text-emerald-400">
                Vigente hasta: {successData.fecha_vencimiento}
              </p>
            )}
          </div>

          {/* Barra de progreso del auto-cierre */}
          <div className="mt-8 w-full bg-emerald-900/30 h-1 rounded-none overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-none"
              style={{
                animation: `shrinkBar ${RESULT_DISPLAY_MS}ms linear forwards`,
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  // ================================================================
  // RENDER: Estado ERROR (Acceso denegado)
  // ================================================================
  if (state === "error") {
    return (
      <div className="min-h-screen bg-red-950 flex items-center justify-center p-4 transition-colors duration-300">
        <div className="text-center animate-fade-in-up max-w-lg">
          {/* Icono de error */}
          <div className="flex justify-center mb-8">
            <div className="w-20 h-20 bg-red-900 border-2 border-red-500 rounded-none flex items-center justify-center">
              <XCircle size={44} className="text-red-400" />
            </div>
          </div>

          {/* Título */}
          <h1 className="text-4xl font-bold tracking-tight text-red-50 mb-4">
            Acceso Denegado
          </h1>

          {/* Motivo del rechazo (viene de Rust) */}
          <div className="bg-red-900/50 border border-red-700/50 rounded-none px-8 py-5">
            <p className="text-lg text-red-100 font-medium">
              {errorMessage}
            </p>
          </div>

          {/* Barra de progreso del auto-cierre */}
          <div className="mt-8 w-full bg-red-900/30 h-1 rounded-none overflow-hidden">
            <div
              className="h-full bg-red-500 rounded-none"
              style={{
                animation: `shrinkBar ${RESULT_DISPLAY_MS}ms linear forwards`,
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  // ================================================================
  // RENDER: Estado PROCESSING (verificando)
  // ================================================================
  if (state === "processing") {
    return (
      <div className="min-h-screen bg-gymora-bg flex items-center justify-center">
        <div className="text-center animate-fade-in-up">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-2 h-2 bg-gymora-accent animate-pulse" />
            <div className="w-2 h-2 bg-gymora-accent animate-pulse" style={{ animationDelay: "150ms" }} />
            <div className="w-2 h-2 bg-gymora-accent animate-pulse" style={{ animationDelay: "300ms" }} />
          </div>
          <p className="text-lg text-gymora-text-muted uppercase tracking-widest">
            Verificando
          </p>
        </div>
      </div>
    );
  }

  // ================================================================
  // RENDER: Estado IDLE / TYPING (pantalla principal del kiosco)
  // ================================================================
  return (
    <div className="min-h-screen bg-gymora-bg flex flex-col items-center justify-center p-4 relative">
      {/* === CONTENIDO CENTRAL === */}
      <div className="text-center animate-fade-in-up">
        {/* Logo del gimnasio (real o placeholder) */}
        <div className="flex justify-center mb-6">
          {gymLogo ? (
            <img
              src={gymLogo}
              alt={gymName}
              className="h-48 object-contain rounded-none"
            />
          ) : (
            <div className="w-20 h-20 bg-gymora-surface border border-gymora-border rounded-none flex items-center justify-center">
              <Hexagon size={40} className="text-gymora-accent" strokeWidth={1.5} />
            </div>
          )}
        </div>

        {/* Nombre del gimnasio */}
        <h1 className="text-4xl font-bold tracking-tight text-gymora-text mb-2">
          {gymName}
        </h1>

        <p className="text-xs text-gymora-text-muted font-light tracking-widest uppercase mb-12">
          Sistema de Control de Acceso
        </p>

        {/* ============================== */}
        {/* ZONA DE DNI */}
        {/* ============================== */}
        {state === "idle" ? (
          // --- Estado IDLE: Hint de instrucción ---
          <div className="space-y-4">
            <div className="bg-gymora-surface border border-gymora-border rounded-none px-10 py-8">
              <p className="text-lg text-gymora-text-muted">
                Ingresá tu DNI con el teclado numérico
              </p>
            </div>
            <p className="text-xs text-gymora-text-muted/40 tracking-wider">
              Presioná ENTER para confirmar
            </p>
          </div>
        ) : (
          // --- Estado TYPING: Números gigantes ---
          <div className="space-y-4">
            <div className="bg-gymora-surface border border-gymora-accent/30 rounded-none px-10 py-8 min-w-[400px]">
              {/* DNI en tipografía MASIVA monoespaciada */}
              <div className="w-full overflow-hidden">
                <p className="text-[12rem] md:text-[15rem] font-bold tracking-[0.15em] text-gymora-accent font-mono-hwid leading-none truncate w-full text-center">
                  {dniBuffer}
                </p>
              </div>
            </div>

            {/* Hint de instrucciones */}
            <div className="flex items-center justify-center gap-6 text-xs text-gymora-text-muted/50">
              <span>ENTER = Confirmar</span>
              <span>·</span>
              <span>BACKSPACE = Borrar</span>
              <span>·</span>
              <span>ESC = Cancelar</span>
            </div>
          </div>
        )}
      </div>

      {/* === BOTÓN SUTIL: Ir a Gestión === */}
      {/* Solo visible en idle/typing. Esquina inferior derecha. */}
      <button
        id="kiosco-to-login-button"
        onClick={() => navigate("/login")}
        className="absolute bottom-4 right-4 p-3 text-gymora-text-muted/30 hover:text-gymora-text-muted hover:bg-gymora-surface-alt rounded-none transition-colors duration-200 cursor-pointer"
        title="Modo Gestión"
      >
        <Settings size={18} />
      </button>
    </div>
  );
}
