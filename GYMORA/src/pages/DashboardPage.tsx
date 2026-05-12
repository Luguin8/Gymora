// DashboardPage.tsx — Panel principal con métricas del día y exportación PDF
// Conecta con: obtener_metricas_dashboard, generar_pdf_caja (Rust)
// Usa: @tauri-apps/plugin-dialog para diálogo nativo de guardado
import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import {
  LayoutDashboard, DollarSign, Banknote, ArrowLeftRight,
  Users, ClipboardCheck, FileDown, AlertCircle, CheckCircle,
} from "lucide-react";

interface MetricasDashboard {
  ingresos_totales: number;
  ingresos_efectivo: number;
  ingresos_transferencia: number;
  cantidad_asistencias_hoy: number;
  cantidad_alumnos_activos: number;
}

export default function DashboardPage() {
  const [metricas, setMetricas] = useState<MetricasDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [pdfStatus, setPdfStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Helper para obtener YYYY-MM-DD en hora local
  const toLocalDateString = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const fechaHoy = toLocalDateString(new Date());

  const loadMetricas = useCallback(async () => {
    setIsLoading(true); setError("");
    try {
      const data = await invoke<MetricasDashboard>("obtener_metricas_dashboard", { fecha: fechaHoy });
      setMetricas(data);
    } catch (err) {
      setError(`${err}`);
    } finally {
      setIsLoading(false);
    }
  }, [fechaHoy]);

  useEffect(() => { loadMetricas(); }, [loadMetricas]);

  const handleExportPdf = async () => {
    setIsExporting(true); setPdfStatus(null);
    try {
      const ruta = await save({
        defaultPath: `cierre_caja_${fechaHoy}.pdf`,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (!ruta) { setIsExporting(false); return; } // Usuario canceló

      const msg = await invoke<string>("generar_pdf_caja", {
        fecha: fechaHoy, rutaDestino: ruta,
      });
      setPdfStatus({ type: "success", msg });
      setTimeout(() => setPdfStatus(null), 5000);
    } catch (err) {
      setPdfStatus({ type: "error", msg: `${err}` });
    } finally {
      setIsExporting(false);
    }
  };

  const formatMoney = (n: number) => `$ ${n.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`;

  if (isLoading) {
    return (
      <div className="animate-fade-in-up flex items-center justify-center py-20">
        <p className="text-gymora-text-muted uppercase tracking-widest text-sm">Cargando métricas...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gymora-surface-alt border border-gymora-border rounded-none flex items-center justify-center">
            <LayoutDashboard size={20} className="text-gymora-accent" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gymora-text">Dashboard</h2>
            <p className="text-xs text-gymora-text-muted font-mono">{fechaHoy}</p>
          </div>
        </div>
        <button id="btn-export-pdf" onClick={handleExportPdf} disabled={isExporting}
          className="flex items-center gap-2 bg-gymora-accent hover:bg-gymora-accent-hover disabled:opacity-40 rounded-none px-4 py-2.5 text-sm font-semibold text-gymora-bg uppercase tracking-wider transition-colors cursor-pointer">
          <FileDown size={16} /> {isExporting ? "Exportando..." : "Exportar Cierre PDF"}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-gymora-danger/10 border border-gymora-danger/30 rounded-none px-3 py-2">
          <AlertCircle size={14} className="text-gymora-danger shrink-0" />
          <p className="text-xs text-gymora-danger">{error}</p>
        </div>
      )}

      {/* PDF STATUS TOAST */}
      {pdfStatus && (
        <div className={`flex items-center gap-2 rounded-none px-3 py-2 border ${
          pdfStatus.type === "success"
            ? "bg-gymora-success/10 border-gymora-success/30"
            : "bg-gymora-danger/10 border-gymora-danger/30"
        }`}>
          {pdfStatus.type === "success"
            ? <CheckCircle size={14} className="text-gymora-success shrink-0" />
            : <AlertCircle size={14} className="text-gymora-danger shrink-0" />
          }
          <p className={`text-xs ${pdfStatus.type === "success" ? "text-gymora-success" : "text-gymora-danger"}`}>
            {pdfStatus.msg}
          </p>
        </div>
      )}

      {/* TARJETAS DE MÉTRICAS */}
      {metricas && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {[
            { label: "Ingresos Totales", value: formatMoney(metricas.ingresos_totales), icon: DollarSign, color: "text-gymora-accent" },
            { label: "Efectivo", value: formatMoney(metricas.ingresos_efectivo), icon: Banknote, color: "text-emerald-400" },
            { label: "Transferencia", value: formatMoney(metricas.ingresos_transferencia), icon: ArrowLeftRight, color: "text-blue-400" },
            { label: "Asistencias Hoy", value: `${metricas.cantidad_asistencias_hoy}`, icon: ClipboardCheck, color: "text-purple-400" },
            { label: "Alumnos Activos", value: `${metricas.cantidad_alumnos_activos}`, icon: Users, color: "text-cyan-400" },
          ].map((card) => (
            <div key={card.label}
              className="bg-gymora-surface border border-gymora-border rounded-none p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gymora-text-muted uppercase tracking-wider font-semibold">
                  {card.label}
                </p>
                <card.icon size={16} className={card.color} />
              </div>
              <p className={`text-2xl font-bold ${card.color}`}>
                {card.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* NOTA */}
      <div className="bg-gymora-surface border border-gymora-border rounded-none p-4">
        <p className="text-xs text-gymora-text-muted">
          Las métricas se actualizan al cargar la página. El cierre de caja PDF incluye desglose por método de pago y por cobrador.
        </p>
      </div>
    </div>
  );
}
