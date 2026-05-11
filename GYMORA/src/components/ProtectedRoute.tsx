// ProtectedRoute.tsx — Componente de guardia de rutas protegidas
//
// Verifica que el usuario esté autenticado antes de renderizar
// las rutas del panel de administración.
//
// Si no hay usuario logueado → redirige a /login.
// Si hay usuario → renderiza el <Outlet /> (contenido de la ruta).
//
// ¿Por qué separar esto en un componente? Para no duplicar la lógica
// de verificación en cada ruta protegida. Se usa como wrapper en el router.

import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute() {
  const { user } = useAuth();

  // Si no hay usuario autenticado, redirigir al login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Si hay usuario, renderizar las sub-rutas
  return <Outlet />;
}
