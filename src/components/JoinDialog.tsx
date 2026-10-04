"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  type SyntheticEvent,
} from "react";
import Image from "next/image";
import { guardarInscripcion, type InscripcionData } from "@/lib/inscripcion";
import { generateQr } from "@/utils/generateQr";
import { descargarEntradaPdf } from "@/utils/ticketPdf";
import EntradaTicket from "./EntradaTicket";

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
  // Toggle descriptivo de la obra (texto + afiche)
  const [showInfo, setShowInfo] = useState(false);
  // Preview a pantalla completa del afiche (visor tipo PDF)
  const [posterOpen, setPosterOpen] = useState(false);
  // uuid confirmado y su QR (data URL) para mostrarlo en la pantalla de éxito
  const [uuid, setUuid] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  // Nodo (fuera de pantalla) del ticket que se captura para generar el PDF.
  const ticketRef = useRef<HTMLDivElement | null>(null);
  const [generandoPdf, setGenerandoPdf] = useState(false);
  const [pdfError, setPdfError] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setStatus("idle");
      setShowInfo(false);
      setPosterOpen(false);
      setUuid(null);
      setQrDataUrl(null);
      setGenerandoPdf(false);
      setPdfError(false);
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Genera el QR de la entrada apenas se conoce el uuid (tras confirmar el alta).
  useEffect(() => {
    if (!uuid) return;
    let active = true;
    generateQr(uuid)
      .then((dataUrl) => {
        if (active) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (active) setQrDataUrl(null);
      });
    return () => {
      active = false;
    };
  }, [uuid]);

  // Cierra solo si la pulsación empezó fuera del contenido (no al seleccionar texto)
  const handleBackdropMouseDown = (event: ReactMouseEvent<HTMLDialogElement>) => {
    pressStartedOnBackdrop.current = event.target === dialogRef.current;
  };

  const handleBackdropClick = (event: ReactMouseEvent<HTMLDialogElement>) => {
    if (event.target === dialogRef.current && pressStartedOnBackdrop.current) {
      onClose();
    }
  };

  // ESC cierra primero el preview del afiche; el diálogo queda abierto.
  const handleDialogCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    if (posterOpen) {
      event.preventDefault();
      setPosterOpen(false);
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
      const { uuid: nuevoUuid } = await guardarInscripcion(inscripcion);
      form.reset();
      setUuid(nuevoUuid);
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  // Nombre completo de quien se registró, para la entrada y el PDF.
  const nombreCompleto =
    `${lastSubmission?.nombre ?? ""} ${lastSubmission?.apellido ?? ""}`.trim() || "Invitada";

  async function handleDownloadPdf() {
    const node = ticketRef.current;
    if (!node) return;
    setGenerandoPdf(true);
    setPdfError(false);
    try {
      await descargarEntradaPdf(node, `entrada-legitimas-${uuid ?? "invitada"}.pdf`);
    } catch {
      setPdfError(true);
    } finally {
      setGenerandoPdf(false);
    }
  }

  return (
    <>
    <dialog
      ref={dialogRef}
      id="join-dialog"
      className={`join-dialog${posterOpen ? " is-poster-open" : ""}`}
      onClose={onClose}
      onCancel={handleDialogCancel}
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

        {status !== "success" && (
          <>
            <button
              type="button"
              className="join-info-toggle"
              aria-expanded={showInfo}
              aria-controls="join-info"
              onClick={() => setShowInfo((prev) => !prev)}
            >
              <span>Registrate a una obra en el Cine UACH · 30 de diciembre</span>
              <span className="join-info-toggle-icon" aria-hidden="true">
                {showInfo ? "−" : "+"}
              </span>
            </button>

            <div id="join-info" className="join-info" hidden={!showInfo}>
              <p className="join-info-text">
                Vas a registrarte para la obra que se presenta en el Cine UACH el 30 de diciembre.
                Al terminar te damos un código QR: es tu entrada, no lo compartas.
              </p>
              <button
                type="button"
                className="join-poster-button"
                onClick={() => setPosterOpen(true)}
                aria-haspopup="dialog"
                aria-label="Ampliar el afiche de la obra"
              >
                <Image
                  className="join-poster"
                  src="/images/legitimas_afiche.png"
                  alt="Afiche de la obra en el Cine UACH el 30 de diciembre"
                  width={590}
                  height={834}
                  sizes="(max-width: 600px) 70vw, 260px"
                />
              </button>
            </div>
          </>
        )}

        {status === "success" ? (
          <div className="join-success" role="status">
            <p className="join-success-title">¡Gracias por sumarte!</p>
            <p>Tu inscripción quedó registrada. Muy pronto nos pondremos en contacto contigo.</p>
            {qrDataUrl && (
              <div className="join-qr">
                {/* data URL generado en el cliente: no pasa por el optimizador */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl} alt="Código QR de tu entrada" width={200} height={200} />
                <p className="join-qr-caption">Muestra este código en la entrada</p>
              </div>
            )}
            <div className="join-actions">
              <button
                type="button"
                className="join-submit"
                onClick={handleDownloadPdf}
                disabled={generandoPdf || !qrDataUrl}
              >
                {generandoPdf ? "Generando PDF…" : "Descargar entrada (PDF)"}
              </button>
              {pdfError && (
                <p className="join-download-error" role="alert">
                  No pudimos generar el PDF. Probá de nuevo.
                </p>
              )}
              <button type="button" className="join-secondary" onClick={onClose}>
                Cerrar
              </button>
            </div>
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

      {/* Preview del afiche: hijo directo del <dialog> para quedar en la
          top-layer. Es fixed, cubre el viewport y deja ver por detrás
          (opacity) las fotos y el canvas del sitio. */}
      {posterOpen && (
        <div
          className="poster-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Afiche de la obra ampliado"
          onClick={(event) => {
            if (event.target === event.currentTarget) setPosterOpen(false);
          }}
        >
          <div className="poster-lightbox-bar poster-lightbox-bar--top">
            <a
              className="poster-lightbox-btn poster-lightbox-download"
              href="/images/legitimas_afiche.png"
              download="legitimas-afiche.png"
            >
              Descargar
            </a>
            <button
              type="button"
              className="poster-lightbox-btn poster-lightbox-close"
              onClick={() => setPosterOpen(false)}
              aria-label="Cerrar"
              autoFocus
            >
              ✕
            </button>
          </div>

          <Image
            className="poster-lightbox-image"
            src="/images/legitimas_afiche.png"
            alt="Afiche de la obra en el Cine UACH el 30 de diciembre"
            width={590}
            height={834}
            sizes="100vw"
          />

        </div>
      )}
    </dialog>

      {/* Ticket fuera de pantalla: se captura con html2canvas para el PDF.
          Vive fuera del <dialog> para que ningún overflow lo recorte. */}
      {status === "success" && uuid && qrDataUrl && (
        <div className="ticket-capture" aria-hidden="true">
          <div ref={ticketRef}>
            <EntradaTicket nombre={nombreCompleto} qrDataUrl={qrDataUrl} uuid={uuid} />
          </div>
        </div>
      )}
    </>
  );
}
