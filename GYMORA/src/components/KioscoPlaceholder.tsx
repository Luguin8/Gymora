// KioscoPlaceholder.tsx — Placeholder del módulo Kiosco
//
// Este componente es un placeholder temporal para la ruta "/" (kiosco).
// La implementación completa del kiosco se hará en la Fase 4,
// donde se implementará el Global Event Listener para captura de DNI
// y la pantalla de respuesta verde/rojo a pantalla completa.
//
// Por ahora, muestra un mensaje indicando que el kiosco estará
// disponible en la siguiente fase, con un botón para ir al login.

import { useNavigate } from "react-router-dom";
import { Monitor, ArrowRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function KioscoPlaceholder() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gymora-bg flex items-center justify-center p-4">
      <div className="text-center animate-fade-in-up max-w-md">
        {/* Icono */}
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 bg-gymora-surface border border-gymora-border rounded-none flex items-center justify-center">
            <Monitor size={28} className="text-gymora-accent" />
          </div>
        </div>

        {/* Título */}
        <h1 className="text-3xl font-bold tracking-tight text-gymora-text mb-2">
          GYMORA
        </h1>
        <p className="text-sm text-gymora-text-muted font-light tracking-widest uppercase mb-8">
          Kiosco de Recepción
        </p>

        {/* Card informativa */}
        <div className="bg-gymora-surface border border-gymora-border rounded-none px-6 py-5 mb-6 text-left space-y-3">
          <p className="text-sm text-gymora-text">
            Este módulo estará disponible en la <strong className="text-gymora-accent">Fase 4</strong>.
          </p>
          <p className="text-xs text-gymora-text-muted">
            Aquí se implementará la captura de DNI por teclado/lector, la verificación de cuotas y la pantalla de respuesta a pantalla completa.
          </p>
        </div>

        {/* Botón de navegación */}
        {!user ? (
          <button
            id="goto-login-button"
            onClick={() => navigate("/login")}
            className="inline-flex items-center gap-2 bg-gymora-accent hover:bg-gymora-accent-hover rounded-none px-6 py-3 text-sm font-semibold text-gymora-bg uppercase tracking-wider transition-colors duration-150 cursor-pointer"
          >
            Ir al Login
            <ArrowRight size={16} />
          </button>
        ) : (
          <button
            id="goto-admin-button"
            onClick={() => navigate("/admin")}
            className="inline-flex items-center gap-2 bg-gymora-accent hover:bg-gymora-accent-hover rounded-none px-6 py-3 text-sm font-semibold text-gymora-bg uppercase tracking-wider transition-colors duration-150 cursor-pointer"
          >
            Ir al Panel Admin
            <ArrowRight size={16} />
          </button>
        )}

        {/* Footer */}
        <p className="text-xs text-gymora-text-muted/50 mt-8">
          Presioná F11 para pantalla completa (recomendado para recepción).
        </p>
      </div>
    </div>
  );
}
