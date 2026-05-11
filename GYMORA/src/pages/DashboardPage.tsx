// DashboardPage.tsx — Vista principal del panel admin
// Placeholder hasta Fase 6 donde se implementarán estadísticas y métricas.
import { LayoutDashboard } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-gymora-surface-alt border border-gymora-border rounded-none flex items-center justify-center">
          <LayoutDashboard size={20} className="text-gymora-accent" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gymora-text">Dashboard</h2>
          <p className="text-xs text-gymora-text-muted uppercase tracking-wider">Disponible en Fase 6</p>
        </div>
      </div>
      <div className="bg-gymora-surface border border-gymora-border rounded-none p-5">
        <p className="text-sm text-gymora-text-muted">
          Vista general del gimnasio: alumnos activos, cuotas por vencer, ingresos del día y estadísticas rápidas.
        </p>
      </div>
    </div>
  );
}
