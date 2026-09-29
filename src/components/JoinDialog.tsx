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
        ) : (
          <form className="join-form" onSubmit={handleSubmit} aria-busy={status === "sending"}>
            <label className="join-field">
              <span>Correo</span>
              <input
                type="email"
                name="correo"
                placeholder="tu@correo.com"
                autoComplete="email"
                required
              />
            </label>

            <div className="join-grid">
              <label className="join-field">
                <span>Nombre</span>
                <input type="text" name="nombre" autoComplete="given-name" required />
              </label>
              <label className="join-field">
                <span>Apellido</span>
                <input type="text" name="apellido" autoComplete="family-name" required />
              </label>
            </div>

            <div className="join-grid">
              <label className="join-field">
                <span>Edad</span>
                <input type="number" name="edad" min={14} max={99} inputMode="numeric" required />
              </label>
              <label className="join-field">
                <span>Género</span>
                <select name="genero" defaultValue="" required>
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

            {status === "error" && (
              <p className="join-error" role="alert">
                No pudimos enviar tus datos. Revisá tu conexión e inténtalo de nuevo.
              </p>
            )}

            <button type="submit" className="join-submit" disabled={status === "sending"}>
              {status === "sending" ? "Enviando…" : "Quiero ser parte"}
            </button>
          </form>
        )}
      </div>
    </dialog>
  );
}
