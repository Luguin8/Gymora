// AdminLayout.tsx — Layout principal del panel de administración
//
// Estructura:
//   - Sidebar lateral izquierdo con navegación (Dashboard, Alumnos, Caja, Ajustes)
//   - Área principal derecha con <Outlet /> para sub-rutas
//   - Header con nombre del usuario logueado y botón de logout
//
// REGLA ESTRICTA: Todo rounded-none. Estilo sobrio e industrial.
// El sidebar usa iconos de lucide-react para una navegación visual limpia.

import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard,
  Users,
  Wallet,
  Settings,
  LogOut,
  Monitor,
} from "lucide-react";

// ===================================================================
// TIPOS
// ===================================================================

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  path: string;
}

// ===================================================================
// CONSTANTES
// ===================================================================

/// Items de navegación del sidebar.
/// Cada uno corresponde a una sub-ruta de /admin.
/// Las pantallas se implementarán en las Fases 4-5.
const NAV_ITEMS: NavItem[] = [
  {
    id: "nav-dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    path: "/admin",
  },
  {
    id: "nav-alumnos",
    label: "Alumnos",
    icon: Users,
    path: "/admin/alumnos",
  },
  {
    id: "nav-caja",
    label: "Caja",
    icon: Wallet,
    path: "/admin/caja",
  },
  {
    id: "nav-ajustes",
    label: "Ajustes",
    icon: Settings,
    path: "/admin/ajustes",
  },
];

// ===================================================================
// COMPONENTE PRINCIPAL
// ===================================================================

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  /// Determina si un item de navegación está activo.
  ///
  /// Para "/admin" (Dashboard) solo es activo si la ruta es exacta.
  /// Para sub-rutas como "/admin/alumnos", verificamos con startsWith.
  const isActive = (path: string) => {
    if (path === "/admin") {
      return location.pathname === "/admin";
    }
    return location.pathname.startsWith(path);
  };

  /// Handler de logout: limpia el auth context y redirige al login.
  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  /// Handler para ir al kiosco (acceso rápido desde admin).
  const handleGoToKiosco = () => {
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gymora-bg flex">
      {/* =============================================== */}
      {/* SIDEBAR */}
      {/* =============================================== */}
      <aside className="w-56 bg-gymora-surface border-r border-gymora-border flex flex-col shrink-0">
        {/* --- Logo / Brand --- */}
        <div className="px-5 py-5 border-b border-gymora-border">
          <h1 className="text-lg font-bold tracking-tight text-gymora-text">
            GYMORA
          </h1>
          <p className="text-[10px] text-gymora-text-muted uppercase tracking-widest mt-0.5">
            Panel Admin
          </p>
        </div>

        {/* --- Navegación principal --- */}
        <nav className="flex-1 py-3 px-2 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);

            return (
              <button
                key={item.id}
                id={item.id}
                onClick={() => navigate(item.path)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-none text-sm font-medium
                  transition-colors duration-150 cursor-pointer text-left
                  ${
                    active
                      ? "bg-gymora-accent/10 text-gymora-accent border-l-2 border-gymora-accent"
                      : "text-gymora-text-muted hover:text-gymora-text hover:bg-gymora-surface-alt border-l-2 border-transparent"
                  }
                `}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* --- Separador --- */}
        <div className="px-2">
          <div className="border-t border-gymora-border" />
        </div>

        {/* --- Acceso rápido al Kiosco --- */}
        <div className="px-2 py-2">
          <button
            id="nav-kiosco"
            onClick={handleGoToKiosco}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-none text-sm font-medium text-gymora-text-muted hover:text-gymora-accent hover:bg-gymora-surface-alt transition-colors duration-150 cursor-pointer text-left border-l-2 border-transparent"
          >
            <Monitor size={18} />
            Ir al Kiosco
          </button>
        </div>

        {/* --- Footer: Usuario logueado + Logout --- */}
        <div className="px-3 py-4 border-t border-gymora-border">
          {/* Info del usuario */}
          <div className="mb-3">
            <p className="text-sm font-medium text-gymora-text truncate">
              {user?.nombre}
            </p>
            <p className="text-[10px] text-gymora-text-muted uppercase tracking-wider">
              {user?.rol === "dueño" ? "Dueño" : "Profesor"}
            </p>
          </div>

          {/* Botón de logout */}
          <button
            id="logout-button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-none text-xs font-medium text-gymora-text-muted hover:text-gymora-danger hover:bg-gymora-danger/10 border border-gymora-border transition-colors duration-150 cursor-pointer"
          >
            <LogOut size={14} />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* =============================================== */}
      {/* ÁREA PRINCIPAL */}
      {/* =============================================== */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Contenido: renderiza las sub-rutas */}
        <div className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
