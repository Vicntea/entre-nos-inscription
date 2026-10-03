import { EVENTO, LEGITIMAS } from "@/lib/evento";

type EntradaTicketProps = {
  /** Nombre completo de la persona registrada. */
  nombre: string;
  /** QR de la entrada como data URL (ver `@/utils/generateQr`). */
  qrDataUrl: string;
  /** UUID de la inscripción: se usa para el ID impreso en la entrada. */
  uuid: string;
};

/** Código corto y legible derivado del uuid para el pie de la entrada. */
function idCorto(uuid: string): string {
  return uuid.replace(/-/g, "").slice(0, 6).toUpperCase();
}

/**
 * Entrada (ticket) de la obra LEGÍTIMAS, en formato **vertical** (proporción de
 * celular) para que el PDF se vea grande en el teléfono y llene la página sin
 * dejar tanto relleno oscuro. Es una adaptación de
 * `src/templates/registro.html` y se usa únicamente para generar el PDF
 * descargable (se renderiza fuera de pantalla). Usa colores sólidos (sin
 * `backdrop-filter`) para que la captura con html2canvas salga fiel.
 */
export default function EntradaTicket({ nombre, qrDataUrl, uuid }: EntradaTicketProps) {
  return (
    <div className="ticket">
      {/* Banner superior */}
      <div className="ticket-header">
        <div className="ticket-header-tags">
          <span className="ticket-chip">Perspectiva de Género</span>
          <span className="ticket-header-divider">Teatro &amp; Memoria</span>
        </div>
        <span className="ticket-header-pass">Pase Digital</span>
      </div>

      <div className="ticket-body">
        <div className="ticket-hero">
          <h2 className="ticket-title">LEGÍTIMAS</h2>
          <p className="ticket-subtitle">Nunca más sin nosotras</p>
        </div>

        <div className="ticket-rule" />

        <div>
          <span className="ticket-label">Persona Registrada</span>
          <h3 className="ticket-name">{nombre}</h3>
        </div>

        <div className="ticket-meta">
          <div className="ticket-meta-card">
            <span className="ticket-meta-label">Fecha y Hora</span>
            <p className="ticket-meta-value">{EVENTO.fecha}</p>
          </div>

          <div className="ticket-meta-card">
            <span className="ticket-meta-label">Ubicación</span>
            <p className="ticket-meta-value">{EVENTO.lugar}</p>
          </div>

          <div className="ticket-meta-card ticket-meta-card--wide">
            <span className="ticket-meta-label">Duración Estimada</span>
            <p className="ticket-meta-value">{EVENTO.duracion}</p>
          </div>
        </div>

        <div className="ticket-synopsis">
          <span className="ticket-synopsis-label">Reseña / Sinopsis</span>
          <p className="ticket-synopsis-text">{EVENTO.sinopsis}</p>
        </div>

        {/* Divisor horizontal con muescas de ticket */}
        <div className="ticket-divider-h" aria-hidden="true">
          <div className="ticket-dash-h" />
          <span className="ticket-cutout ticket-cutout--left" />
          <span className="ticket-cutout ticket-cutout--right" />
        </div>

        {/* Bloque de acreditación con QR */}
        <div className="ticket-qr">
          <span className="ticket-qr-label">Acreditación QR</span>
          <div className="ticket-qr-box">
            {/* data URL generado en el cliente: no pasa por el optimizador */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt="Código QR de la entrada" width={200} height={200} />
          </div>
          <p className="ticket-qr-caption">
            Escanear para verificar el acceso en la entrada del {EVENTO.lugarCorto}.
          </p>
        </div>
      </div>

      {/* Pie de la entrada */}
      <div className="ticket-footer">
        <span className="ticket-footer-warn">Contenido sensible</span>
        <span className="ticket-footer-id">
          ID: {LEGITIMAS.idPrefix}-{idCorto(uuid)}
        </span>
      </div>
    </div>
  );
}

