"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { guardarInscripcion, type InscripcionData } from "@/lib/inscripcion";

/**
 * `value` en minúsculas porque es lo que espera el Apps Script
 * (ej. "prefiero no decirlo"); `label` es solo lo visible.
 */
const GENEROS = [
  { value: "femenino", label: "Femenino" },
  { value: "masculino", label: "Masculino" },
  { value: "no binario", label: "No binario" },
  { value: "prefiero no decirlo", label: "Prefiero no decirlo" },
  { value: "otro", label: "Otro" },
];

type Status = "idle" | "sending" | "success" | "error";

type JoinDialogProps = {
  open: boolean;
  onClose: () => void;
};

export default function JoinDialog({ open, onClose }: JoinDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const pressStartedOnBackdrop = useRef(false);
  const [status, setStatus] = useState<Status>("idle");
  // Lo último que se intentó enviar: al reintentar (o al volver del error)
  // repuebla el formulario, que se desmonta cuando se muestra la pantalla de falla.
  const [lastSubmission, setLastSubmission] = useState<InscripcionData | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setStatus("idle");
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Cierra solo si la pulsación empezó fuera del contenido (no al seleccionar texto)
  const handleBackdropMouseDown = (event: ReactMouseEvent<HTMLDialogElement>) => {
    pressStartedOnBackdrop.current = event.target === dialogRef.current;
  };

  const handleBackdropClick = (event: ReactMouseEvent<HTMLDialogElement>) => {
    if (event.target === dialogRef.current && pressStartedOnBackdrop.current) {
      onClose();
    }
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    const inscripcion: InscripcionData = {
      correo: String(formData.get("correo") ?? "").trim(),
      nombre: String(formData.get("nombre") ?? "").trim(),
      apellido: String(formData.get("apellido") ?? "").trim(),
      edad: Number(formData.get("edad")),
      genero: String(formData.get("genero") ?? ""),
    };

    try {
      setStatus("sending");
      setLastSubmission(inscripcion);
      await guardarInscripcion(inscripcion);
      form.reset();
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  return (
    <dialog
      ref={dialogRef}
      id="join-dialog"
      className="join-dialog"
      onClose={onClose}
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
      aria-labelledby="join-dialog-title"
    >
      <button type="button" className="join-dialog-close" onClick={onClose} aria-label="Cerrar">
        ✕
      </button>

      <div className="join-dialog-body">
        <h2 className="join-dialog-title" id="join-dialog-title">
          ¿Quieres ser parte <span>del cambio?</span>
        </h2>
        <p className="join-dialog-sub">Déjanos tus datos y te contactaremos</p>

        {status === "success" ? (
          <div className="join-success" role="status">
            <p className="join-success-title">¡Gracias por sumarte!</p>
            <p>Tu inscripción quedó registrada. Muy pronto nos pondremos en contacto contigo.</p>
            <button type="button" className="join-submit" onClick={onClose}>
              Cerrar
            </button>
          </div>
        ) : status === "error" ? (
          <div className="join-fallback" role="alert">
            <p className="join-fallback-title">No pudimos registrarte</p>
            <p>
              Puede haber sido un problema de conexión. Tus datos quedaron cargados: probá de
              nuevo.
            </p>
            <div className="join-fallback-actions">
              <button type="button" className="join-submit" onClick={() => setStatus("idle")}>
                Reintentar
              </button>
              <button type="button" className="join-fallback-cancel" onClick={onClose}>
                Cerrar
              </button>
            </div>
          </div>
        ) : (
          <form className="join-form" onSubmit={handleSubmit} aria-busy={status === "sending"}>
            <label className="join-field">
              <span>Correo</span>
              <input
                type="email"
                name="correo"
                placeholder="tu@correo.com"
                autoComplete="email"
                defaultValue={lastSubmission?.correo ?? ""}
                required
              />
            </label>

            <div className="join-grid">
              <label className="join-field">
                <span>Nombre</span>
                <input
                  type="text"
                  name="nombre"
                  autoComplete="given-name"
                  defaultValue={lastSubmission?.nombre ?? ""}
                  required
                />
              </label>
              <label className="join-field">
                <span>Apellido</span>
                <input
                  type="text"
                  name="apellido"
                  autoComplete="family-name"
                  defaultValue={lastSubmission?.apellido ?? ""}
                  required
                />
              </label>
            </div>

            <div className="join-grid">
              <label className="join-field">
                <span>Edad</span>
                <input
                  type="number"
                  name="edad"
                  min={14}
                  max={99}
                  inputMode="numeric"
                  defaultValue={lastSubmission?.edad ?? ""}
                  required
                />
              </label>
              <label className="join-field">
                <span>Género</span>
                <select name="genero" defaultValue={lastSubmission?.genero ?? ""} required>
                  <option value="" disabled>
                    Selecciona…
                  </option>
                  {GENEROS.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <button type="submit" className="join-submit" disabled={status === "sending"}>
              {status === "sending" ? "Enviando…" : "Quiero ser parte"}
            </button>
          </form>
        )}
      </div>
    </dialog>
  );
}
