// AlumnosPage.tsx — Gestión de Alumnos (ABM)
import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Users, Plus, Search, X, AlertCircle, CheckCircle } from "lucide-react";

interface Alumno {
  id: number;
  dni: string;
  nombre: string;
  apellido: string;
  telefono: string;
  fecha_alta: string;
  activo: boolean;
}

export default function AlumnosPage() {
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [listError, setListError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [formDni, setFormDni] = useState("");
  const [formNombre, setFormNombre] = useState("");
  const [formApellido, setFormApellido] = useState("");
  const [formTelefono, setFormTelefono] = useState("");
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const loadAlumnos = useCallback(async (query: string) => {
    setIsLoading(true);
    setListError("");
    try {
      const result = await invoke<Alumno[]>("buscar_alumnos", { query });
      setAlumnos(result);
    } catch (err) {
      setListError(`${err}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { loadAlumnos(searchQuery); }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, loadAlumnos]);

  const handleCrear = async () => {
    if (!formDni.trim()) { setFormError("El DNI es obligatorio"); return; }
    if (!formNombre.trim()) { setFormError("El nombre es obligatorio"); return; }
    if (!formApellido.trim()) { setFormError("El apellido es obligatorio"); return; }

    setIsCreating(true);
    setFormError("");
    setFormSuccess("");

    try {
      const nuevo = await invoke<Alumno>("crear_alumno", {
        dni: formDni.trim(),
        nombre: formNombre.trim(),
        apellido: formApellido.trim(),
        telefono: formTelefono.trim() || null,
      });
      setFormSuccess(`${nuevo.nombre} ${nuevo.apellido} creado correctamente`);
      setFormDni(""); setFormNombre(""); setFormApellido(""); setFormTelefono("");
      await loadAlumnos(searchQuery);
      setTimeout(() => { setShowModal(false); setFormSuccess(""); }, 1500);
    } catch (err) {
      setFormError(`${err}`);
    } finally {
      setIsCreating(false);
    }
  };

  const closeModal = () => {
    setShowModal(false); setFormError(""); setFormSuccess("");
    setFormDni(""); setFormNombre(""); setFormApellido(""); setFormTelefono("");
  };

  return (
    <div className="animate-fade-in-up space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gymora-surface-alt border border-gymora-border rounded-none flex items-center justify-center">
            <Users size={20} className="text-gymora-accent" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gymora-text">Gestión de Alumnos</h2>
            <p className="text-xs text-gymora-text-muted">
              {alumnos.length} alumno{alumnos.length !== 1 ? "s" : ""} registrado{alumnos.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <button id="btn-nuevo-alumno" onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-gymora-accent hover:bg-gymora-accent-hover rounded-none px-4 py-2.5 text-sm font-semibold text-gymora-bg uppercase tracking-wider transition-colors cursor-pointer">
          <Plus size={16} /> Nuevo Alumno
        </button>
      </div>

      {/* BÚSQUEDA */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gymora-text-muted" />
        <input id="search-alumnos" type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por nombre, apellido o DNI..."
          className="w-full bg-gymora-surface border border-gymora-border rounded-none pl-10 pr-4 py-3 text-sm text-gymora-text placeholder-gymora-text-muted/50 focus:outline-none focus:border-gymora-accent transition-colors" />
      </div>

      {listError && (
        <div className="flex items-center gap-2 bg-gymora-danger/10 border border-gymora-danger/30 rounded-none px-3 py-2">
          <AlertCircle size={14} className="text-gymora-danger shrink-0" />
          <p className="text-xs text-gymora-danger">{listError}</p>
        </div>
      )}

      {/* TABLA */}
      <div className="bg-gymora-surface border border-gymora-border rounded-none overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gymora-border bg-gymora-surface-alt">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gymora-text-muted uppercase tracking-wider">DNI</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gymora-text-muted uppercase tracking-wider">Apellido</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gymora-text-muted uppercase tracking-wider">Nombre</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gymora-text-muted uppercase tracking-wider">Teléfono</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gymora-text-muted uppercase tracking-wider">Alta</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gymora-text-muted">Cargando...</td></tr>
            ) : alumnos.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gymora-text-muted">
                {searchQuery ? `No se encontraron alumnos con "${searchQuery}"` : "No hay alumnos registrados."}
              </td></tr>
            ) : alumnos.map((a) => (
              <tr key={a.id} className="border-b border-gymora-border/50 hover:bg-gymora-surface-alt/50 transition-colors">
                <td className="px-4 py-3 font-mono text-gymora-accent text-xs">{a.dni}</td>
                <td className="px-4 py-3 text-gymora-text font-medium">{a.apellido}</td>
                <td className="px-4 py-3 text-gymora-text">{a.nombre}</td>
                <td className="px-4 py-3 text-gymora-text-muted">{a.telefono || "—"}</td>
                <td className="px-4 py-3 text-gymora-text-muted text-xs">{a.fecha_alta}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL: Nuevo Alumno */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-gymora-surface border border-gymora-border rounded-none animate-fade-in-up">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gymora-border">
              <h3 className="text-base font-bold text-gymora-text">Nuevo Alumno</h3>
              <button onClick={closeModal} className="text-gymora-text-muted hover:text-gymora-text transition-colors cursor-pointer"><X size={18} /></button>
            </div>
            <div className="px-5 py-5 space-y-4">
              {[
                { id: "modal-dni", label: "DNI *", value: formDni, set: setFormDni, ph: "Ej: 40123456" },
                { id: "modal-nombre", label: "Nombre *", value: formNombre, set: setFormNombre, ph: "Ej: Juan" },
                { id: "modal-apellido", label: "Apellido *", value: formApellido, set: setFormApellido, ph: "Ej: Pérez" },
                { id: "modal-telefono", label: "Teléfono (opcional)", value: formTelefono, set: setFormTelefono, ph: "Ej: 1155667788" },
              ].map((f) => (
                <div key={f.id} className="space-y-1.5">
                  <label className="block text-xs font-semibold text-gymora-text-muted uppercase tracking-wider">{f.label}</label>
                  <input id={f.id} type="text" value={f.value}
                    onChange={(e) => { f.set(e.target.value); setFormError(""); }}
                    onKeyDown={(e) => { if (e.key === "Enter") handleCrear(); }}
                    placeholder={f.ph}
                    className="w-full bg-gymora-bg border border-gymora-border rounded-none px-3 py-2.5 text-sm text-gymora-text placeholder-gymora-text-muted/50 focus:outline-none focus:border-gymora-accent transition-colors" />
                </div>
              ))}
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
            </div>
            <div className="flex gap-3 px-5 py-4 border-t border-gymora-border">
              <button onClick={closeModal}
                className="flex-1 bg-gymora-surface-alt border border-gymora-border rounded-none py-2.5 text-sm font-medium text-gymora-text-muted hover:text-gymora-text transition-colors cursor-pointer">
                Cancelar
              </button>
              <button id="btn-guardar-alumno" onClick={handleCrear} disabled={isCreating}
                className="flex-1 bg-gymora-accent hover:bg-gymora-accent-hover disabled:opacity-40 disabled:cursor-not-allowed rounded-none py-2.5 text-sm font-semibold text-gymora-bg uppercase tracking-wider transition-colors cursor-pointer">
                {isCreating ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
