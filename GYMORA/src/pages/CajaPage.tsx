// CajaPage.tsx — Módulo de Cobro de Cuotas
// Flujo: Buscar alumno → Seleccionar tipo de cuota → Ingresar monto → Registrar pago
// Ejecuta secuencialmente: crear_cuota + registrar_pago
import { useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAuth } from "../context/AuthContext";
import { Wallet, Search, AlertCircle, CheckCircle } from "lucide-react";

interface Alumno {
  id: number; dni: string; nombre: string; apellido: string;
  telefono: string; fecha_alta: string; activo: boolean;
}
interface Cuota {
  id: number; alumno_id: number; fecha_inicio: string; fecha_vencimiento: string;
  clases_totales: number; clases_restantes: number; activa: boolean;
}

export default function CajaPage() {
  const { user } = useAuth();

  // Búsqueda de alumno
  const [dniSearch, setDniSearch] = useState("");
  const [selectedAlumno, setSelectedAlumno] = useState<Alumno | null>(null);
  const [searchError, setSearchError] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // Formulario de cobro
  const [tipoCuota, setTipoCuota] = useState<"mensual" | "paquete">("mensual");
  const [clasesTotales, setClasesTotales] = useState("12");
  const [monto, setMonto] = useState("");
  const [metodoPago, setMetodoPago] = useState<"efectivo" | "transferencia">("efectivo");
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const isProcessingRef = useRef(false);

  const buscarAlumno = async () => {
    if (!dniSearch.trim()) { setSearchError("Ingresá un DNI"); return; }
    setIsSearching(true); setSearchError(""); setSelectedAlumno(null);
    try {
      const alumno = await invoke<Alumno>("obtener_alumno_por_dni", { dni: dniSearch.trim() });
      setSelectedAlumno(alumno);
    } catch (err) {
      setSearchError(`${err}`);
    } finally {
      setIsSearching(false);
    }
  };

  const handleCobrar = async () => {
    if (isProcessingRef.current) return;
    if (!selectedAlumno) return;
    if (!monto.trim() || isNaN(Number(monto)) || Number(monto) <= 0) {
      setFormError("Ingresá un monto válido mayor a 0"); return;
    }
    if (tipoCuota === "paquete" && (!clasesTotales || Number(clasesTotales) <= 0)) {
      setFormError("Ingresá una cantidad de clases válida"); return;
    }

    isProcessingRef.current = true;
    setIsProcessing(true); setFormError(""); setFormSuccess("");

    try {
      // Helper para obtener YYYY-MM-DD en hora local
      const toLocalDateString = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
      };

      // Calcular fechas de la cuota localmente
      const hoy = new Date();
      const fechaInicio = toLocalDateString(hoy);
      const vencimiento = new Date(hoy);
      vencimiento.setMonth(vencimiento.getMonth() + 1);
      const fechaVencimiento = toLocalDateString(vencimiento);

      // 1. Crear la cuota
      const clases = tipoCuota === "mensual" ? 0 : Number(clasesTotales);
      await invoke<Cuota>("crear_cuota", {
        alumnoId: selectedAlumno.id,
        fechaInicio,
        fechaVencimiento,
        clasesTotales: clases,
      });

      // 2. Registrar el pago
      await invoke("registrar_pago", {
        alumnoId: selectedAlumno.id,
        usuarioId: user!.id,
        monto: Number(monto),
        metodoPago,
      });

      setFormSuccess(
        `Cuota ${tipoCuota === "mensual" ? "mensual" : `de ${clasesTotales} clases`} ` +
        `registrada para ${selectedAlumno.nombre} ${selectedAlumno.apellido}. ` +
        `Pago: $${monto} (${metodoPago}).`
      );

      // Reset para nuevo cobro
      setMonto("");
      setClasesTotales("12");

    } catch (err) {
      setFormError(`${err}`);
    } finally {
      setIsProcessing(false);
      isProcessingRef.current = false;
    }
  };

  return (
    <div className="animate-fade-in-up space-y-6">
      {/* HEADER */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gymora-surface-alt border border-gymora-border rounded-none flex items-center justify-center">
          <Wallet size={20} className="text-gymora-accent" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gymora-text">Caja — Cobro de Cuotas</h2>
          <p className="text-xs text-gymora-text-muted">Cobrador: {user?.nombre} ({user?.rol})</p>
        </div>
      </div>

      {/* PASO 1: Buscar alumno */}
      <div className="bg-gymora-surface border border-gymora-border rounded-none p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gymora-text uppercase tracking-wider">1. Buscar Alumno por DNI</h3>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gymora-text-muted" />
            <input id="caja-dni-search" type="text" value={dniSearch}
              onChange={(e) => { setDniSearch(e.target.value); setSearchError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") buscarAlumno(); }}
              placeholder="Ingresá el DNI del alumno"
              className="w-full bg-gymora-bg border border-gymora-border rounded-none pl-10 pr-4 py-3 text-sm text-gymora-text placeholder-gymora-text-muted/50 focus:outline-none focus:border-gymora-accent transition-colors" />
          </div>
          <button onClick={buscarAlumno} disabled={isSearching}
            className="bg-gymora-accent hover:bg-gymora-accent-hover disabled:opacity-40 rounded-none px-5 py-3 text-sm font-semibold text-gymora-bg uppercase tracking-wider transition-colors cursor-pointer">
            {isSearching ? "..." : "Buscar"}
          </button>
        </div>

        {searchError && (
          <div className="flex items-center gap-2 bg-gymora-danger/10 border border-gymora-danger/30 rounded-none px-3 py-2">
            <AlertCircle size={14} className="text-gymora-danger shrink-0" />
            <p className="text-xs text-gymora-danger">{searchError}</p>
          </div>
        )}

        {selectedAlumno && (
          <div className="bg-gymora-surface-alt border border-gymora-border rounded-none p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-gymora-accent/10 border border-gymora-accent/30 rounded-none flex items-center justify-center text-gymora-accent font-bold text-sm">
              {selectedAlumno.nombre[0]}{selectedAlumno.apellido[0]}
            </div>
            <div>
              <p className="text-sm font-medium text-gymora-text">{selectedAlumno.apellido}, {selectedAlumno.nombre}</p>
              <p className="text-xs text-gymora-text-muted font-mono">DNI: {selectedAlumno.dni}</p>
            </div>
          </div>
        )}
      </div>

      {/* PASO 2: Formulario de cobro (solo si hay alumno seleccionado) */}
      {selectedAlumno && (
        <div className="bg-gymora-surface border border-gymora-border rounded-none p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gymora-text uppercase tracking-wider">2. Datos del Cobro</h3>

          {/* Tipo de cuota */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gymora-text-muted uppercase tracking-wider">Tipo de Cuota</label>
            <div className="flex gap-2">
              {(["mensual", "paquete"] as const).map((tipo) => (
                <button key={tipo} onClick={() => { setTipoCuota(tipo); setFormError(""); }}
                  className={`flex-1 py-2.5 text-sm font-medium rounded-none border transition-colors cursor-pointer ${
                    tipoCuota === tipo
                      ? "bg-gymora-accent/10 border-gymora-accent text-gymora-accent"
                      : "bg-gymora-bg border-gymora-border text-gymora-text-muted hover:border-gymora-text-muted"
                  }`}>
                  {tipo === "mensual" ? "Mensual Libre" : "Paquete de Clases"}
                </button>
              ))}
            </div>
          </div>

          {/* Clases (solo paquete) */}
          {tipoCuota === "paquete" && (
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gymora-text-muted uppercase tracking-wider">Cantidad de Clases</label>
              <input type="number" value={clasesTotales} min="1"
                onChange={(e) => { setClasesTotales(e.target.value); setFormError(""); }}
                className="w-full bg-gymora-bg border border-gymora-border rounded-none px-3 py-2.5 text-sm text-gymora-text focus:outline-none focus:border-gymora-accent transition-colors" />
            </div>
          )}

          {/* Monto */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gymora-text-muted uppercase tracking-wider">Monto ($)</label>
            <input id="caja-monto" type="number" value={monto} min="1" step="0.01"
              onChange={(e) => { setMonto(e.target.value); setFormError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleCobrar(); }}
              placeholder="Ej: 15000"
              className="w-full bg-gymora-bg border border-gymora-border rounded-none px-3 py-2.5 text-sm text-gymora-text placeholder-gymora-text-muted/50 focus:outline-none focus:border-gymora-accent transition-colors" />
          </div>

          {/* Método de pago */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gymora-text-muted uppercase tracking-wider">Método de Pago</label>
            <div className="flex gap-2">
              {(["efectivo", "transferencia"] as const).map((m) => (
                <button key={m} onClick={() => setMetodoPago(m)}
                  className={`flex-1 py-2.5 text-sm font-medium rounded-none border transition-colors cursor-pointer ${
                    metodoPago === m
                      ? "bg-gymora-accent/10 border-gymora-accent text-gymora-accent"
                      : "bg-gymora-bg border-gymora-border text-gymora-text-muted hover:border-gymora-text-muted"
                  }`}>
                  {m === "efectivo" ? "Efectivo" : "Transferencia"}
                </button>
              ))}
            </div>
          </div>

          {formError && (
            <div className="flex items-center gap-2 bg-gymora-danger/10 border border-gymora-danger/30 rounded-none px-3 py-2">
              <AlertCircle size={14} className="text-gymora-danger shrink-0" />
              <p className="text-xs text-gymora-danger">{formError}</p>
            </div>
          )}
          {formSuccess && (
            <div className="flex items-center gap-2 bg-gymora-success/10 border border-gymora-success/30 rounded-none px-3 py-2">
              <CheckCircle size={14} className="text-gymora-success shrink-0" />
              <p className="text-xs text-gymora-success">{formSuccess}</p>
            </div>
          )}

          <button id="btn-cobrar" onClick={handleCobrar} disabled={isProcessing}
            className="w-full bg-gymora-accent hover:bg-gymora-accent-hover disabled:opacity-40 disabled:cursor-not-allowed rounded-none py-3 text-sm font-semibold text-gymora-bg uppercase tracking-wider transition-colors cursor-pointer">
            {isProcessing ? "Procesando..." : "Registrar Cobro"}
          </button>
        </div>
      )}
    </div>
  );
}
