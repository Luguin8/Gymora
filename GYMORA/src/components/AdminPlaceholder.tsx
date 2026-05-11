// AdminPlaceholder.tsx — Placeholder para las sub-rutas del Admin
//
// Componentes temporales para las secciones del panel de administración
// que se implementarán en las Fases 5-6.
//
// Cada uno muestra un mensaje indicando qué se implementará ahí.

import { LayoutDashboard, Users, Wallet, Settings } from "lucide-react";

// ===================================================================
// TIPOS
// ===================================================================

interface PlaceholderProps {
  title: string;
  description: string;
  phase: string;
  icon: React.ElementType;
}

// ===================================================================
// COMPONENTE GENÉRICO
// ===================================================================

function AdminPlaceholderCard({ title, description, phase, icon: Icon }: PlaceholderProps) {
  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-gymora-surface-alt border border-gymora-border rounded-none flex items-center justify-center">
          <Icon size={20} className="text-gymora-accent" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gymora-text">{title}</h2>
          <p className="text-xs text-gymora-text-muted uppercase tracking-wider">{phase}</p>
        </div>
      </div>

      <div className="bg-gymora-surface border border-gymora-border rounded-none p-5">
        <p className="text-sm text-gymora-text-muted">{description}</p>
      </div>
    </div>
  );
}

// ===================================================================
// PLACEHOLDERS EXPORTADOS
// ===================================================================

export function DashboardPage() {
  return (
    <AdminPlaceholderCard
      title="Dashboard"
      description="Vista general del gimnasio: alumnos activos, cuotas por vencer, ingresos del día y estadísticas rápidas. Se implementará junto con los módulos de datos."
      phase="Disponible en Fase 5"
      icon={LayoutDashboard}
    />
  );
}

export function AlumnosPage() {
  return (
    <AdminPlaceholderCard
      title="Gestión de Alumnos"
      description="ABM completo de alumnos: alta con DNI, búsqueda, edición de datos, asignación de cuotas y cobro de pagos. Incluye vista de historial de asistencias y pagos."
      phase="Disponible en Fase 5"
      icon={Users}
    />
  );
}

export function CajaPage() {
  return (
    <AdminPlaceholderCard
      title="Caja y Reportes"
      description="Registro de cobros, cierre de caja diario, reportes por rango de fechas con desglose por método de pago y profesor. Exportación a PDF."
      phase="Disponible en Fase 6"
      icon={Wallet}
    />
  );
}

export function AjustesPage() {
  return (
    <AdminPlaceholderCard
      title="Ajustes del Sistema"
      description="Gestión de usuarios (agregar profesores, cambiar PINs), configuración de planes/cuotas, y opciones del sistema."
      phase="Disponible en Fase 5"
      icon={Settings}
    />
  );
}
