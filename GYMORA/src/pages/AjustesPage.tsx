// AjustesPage.tsx — Ajustes del Sistema
// Sección 1: Personalización (nombre/logo del gimnasio → localStorage)
// Sección 2: Gestión de Profesores (solo visible para "dueño")
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAuth } from "../context/AuthContext";
import { Settings, ImagePlus, Plus, AlertCircle, CheckCircle } from "lucide-react";

interface Usuario {
  id: number; nombre: string; rol: string; activo: boolean;
}

export default function AjustesPage() {
  const { user } = useAuth();

  // Personalización
  const [gymName, setGymName] = useState("");
  const [gymLogo, setGymLogo] = useState<string | null>(null);
  const [persSaved, setPersSaved] = useState("");

  // Gestión de Profesores
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [profNombre, setProfNombre] = useState("");
  const [profPin, setProfPin] = useState("");
  const [profError, setProfError] = useState("");
  const [profSuccess, setProfSuccess] = useState("");
  const [isCreatingProf, setIsCreatingProf] = useState(false);

  useEffect(() => {
    setGymName(localStorage.getItem("gymora_gym_name") || "");
    setGymLogo(localStorage.getItem("gymora_gym_logo"));
    loadUsuarios();
  }, []);

  const loadUsuarios = async () => {
    try {
      const users = await invoke<Usuario[]>("obtener_usuarios");
      setUsuarios(users);
    } catch (_) { /* silently fail */ }
  };

  const savePersonalizacion = () => {
    if (gymName.trim()) localStorage.setItem("gymora_gym_name", gymName.trim());
    if (gymLogo) localStorage.setItem("gymora_gym_logo", gymLogo);
    setPersSaved("Cambios guardados. Se verán reflejados en el Kiosco.");
    setTimeout(() => setPersSaved(""), 3000);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setGymLogo(ev.target?.result as string); };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleCrearProfesor = async () => {
    if (!profNombre.trim()) { setProfError("El nombre es obligatorio"); return; }
    if (profPin.length !== 4 || !/^\d{4}$/.test(profPin)) {
      setProfError("El PIN debe tener 4 dígitos numéricos"); return;
    }
    setIsCreatingProf(true); setProfError(""); setProfSuccess("");
    try {
      await invoke("crear_usuario", {
        nombre: profNombre.trim(), rol: "profesor", pinAcceso: profPin,
      });
      setProfSuccess(`Profesor "${profNombre.trim()}" creado correctamente`);
      setProfNombre(""); setProfPin("");
      await loadUsuarios();
      setTimeout(() => setProfSuccess(""), 3000);
    } catch (err) {
      setProfError(`${err}`);
    } finally {
      setIsCreatingProf(false);
    }
  };

  return (
    <div className="animate-fade-in-up space-y-8">
      {/* HEADER */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gymora-surface-alt border border-gymora-border rounded-none flex items-center justify-center">
          <Settings size={20} className="text-gymora-accent" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gymora-text">Ajustes del Sistema</h2>
          <p className="text-xs text-gymora-text-muted">Configuración general de GYMORA</p>
        </div>
      </div>

      {/* SECCIÓN 1: Personalización */}
      <div className="bg-gymora-surface border border-gymora-border rounded-none p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gymora-text uppercase tracking-wider border-b border-gymora-border pb-3">
          Personalización del Gimnasio
        </h3>

        {/* Nombre */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-gymora-text-muted uppercase tracking-wider">Nombre del Gimnasio</label>
          <input type="text" value={gymName}
            onChange={(e) => setGymName(e.target.value)}
            className="w-full bg-gymora-bg border border-gymora-border rounded-none px-3 py-2.5 text-sm text-gymora-text focus:outline-none focus:border-gymora-accent transition-colors" />
        </div>

        {/* Logo */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-gymora-text-muted uppercase tracking-wider">Logo del Gimnasio</label>
          {gymLogo ? (
            <div className="relative">
              <img src={gymLogo} alt="Logo" className="w-full h-32 object-contain bg-gymora-bg border border-gymora-border rounded-none p-2" />
              <button type="button" onClick={() => { setGymLogo(null); localStorage.removeItem("gymora_gym_logo"); }}
                className="absolute top-1 right-1 bg-gymora-danger/80 text-white text-xs px-2 py-1 rounded-none cursor-pointer hover:bg-gymora-danger transition-colors">
                Quitar
              </button>
            </div>
          ) : (
            <label htmlFor="ajustes-logo"
              className="flex items-center justify-center gap-2 w-full bg-gymora-bg border border-dashed border-gymora-border rounded-none px-4 py-4 text-sm text-gymora-text-muted cursor-pointer hover:border-gymora-accent hover:text-gymora-accent transition-colors">
              <ImagePlus size={18} /> Seleccionar imagen
            </label>
          )}
          <input id="ajustes-logo" type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
        </div>

        {persSaved && (
          <div className="flex items-center gap-2 bg-gymora-success/10 border border-gymora-success/30 rounded-none px-3 py-2">
            <CheckCircle size={14} className="text-gymora-success shrink-0" />
            <p className="text-xs text-gymora-success">{persSaved}</p>
          </div>
        )}

        <button onClick={savePersonalizacion}
          className="bg-gymora-accent hover:bg-gymora-accent-hover rounded-none px-5 py-2.5 text-sm font-semibold text-gymora-bg uppercase tracking-wider transition-colors cursor-pointer">
          Guardar Cambios
        </button>
      </div>

      {/* SECCIÓN 2: Gestión de Profesores (solo dueño) */}
      {user?.rol === "dueño" && (
        <div className="bg-gymora-surface border border-gymora-border rounded-none p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gymora-text uppercase tracking-wider border-b border-gymora-border pb-3">
            Gestión de Profesores
          </h3>

          {/* Lista de usuarios actuales */}
          <div className="space-y-2">
            <p className="text-xs text-gymora-text-muted uppercase tracking-wider font-semibold">Usuarios del Sistema</p>
            <div className="space-y-1">
              {usuarios.map((u) => (
                <div key={u.id} className="flex items-center justify-between bg-gymora-bg border border-gymora-border/50 rounded-none px-3 py-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 ${u.activo ? "bg-gymora-success" : "bg-gymora-danger"} rounded-none`} />
                    <span className="text-sm text-gymora-text">{u.nombre}</span>
                  </div>
                  <span className="text-xs text-gymora-text-muted uppercase tracking-wider">
                    {u.rol === "dueño" ? "Dueño" : "Profesor"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Formulario nuevo profesor */}
          <div className="border-t border-gymora-border pt-4 space-y-3">
            <p className="text-xs text-gymora-text-muted uppercase tracking-wider font-semibold">Agregar Nuevo Profesor</p>
            <div className="grid grid-cols-2 gap-3">
              <input type="text" value={profNombre} onChange={(e) => { setProfNombre(e.target.value); setProfError(""); }}
                placeholder="Nombre del profesor"
                className="bg-gymora-bg border border-gymora-border rounded-none px-3 py-2.5 text-sm text-gymora-text placeholder-gymora-text-muted/50 focus:outline-none focus:border-gymora-accent transition-colors" />
              <input type="password" value={profPin} maxLength={4} inputMode="numeric"
                onChange={(e) => { setProfPin(e.target.value.replace(/\D/g, "")); setProfError(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") handleCrearProfesor(); }}
                placeholder="PIN (4 dígitos)"
                className="bg-gymora-bg border border-gymora-border rounded-none px-3 py-2.5 text-sm text-center text-gymora-text placeholder-gymora-text-muted/50 focus:outline-none focus:border-gymora-accent transition-colors" />
            </div>

            {profError && (
              <div className="flex items-center gap-2 bg-gymora-danger/10 border border-gymora-danger/30 rounded-none px-3 py-2">
                <AlertCircle size={14} className="text-gymora-danger shrink-0" />
                <p className="text-xs text-gymora-danger">{profError}</p>
              </div>
            )}
            {profSuccess && (
              <div className="flex items-center gap-2 bg-gymora-success/10 border border-gymora-success/30 rounded-none px-3 py-2">
                <CheckCircle size={14} className="text-gymora-success shrink-0" />
                <p className="text-xs text-gymora-success">{profSuccess}</p>
              </div>
            )}

            <button id="btn-crear-profesor" onClick={handleCrearProfesor} disabled={isCreatingProf}
              className="flex items-center gap-2 bg-gymora-accent hover:bg-gymora-accent-hover disabled:opacity-40 disabled:cursor-not-allowed rounded-none px-4 py-2.5 text-sm font-semibold text-gymora-bg uppercase tracking-wider transition-colors cursor-pointer">
              <Plus size={16} /> {isCreatingProf ? "Creando..." : "Agregar Profesor"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
