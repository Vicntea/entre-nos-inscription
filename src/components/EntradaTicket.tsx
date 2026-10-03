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
 * Entrada (ticket) de la obra LEGÍTIMAS. Es una versión fiel de
 * `src/templates/registro.html` que se muestra en la pantalla de éxito y se usa
 * para generar el PDF descargable. Usa colores sólidos (sin `backdrop-filter`)
 * para que la captura con html2canvas salga fiel.
 *
 * Es de tamaño fijo (ver `.ticket` en globals.css) para que el PDF tenga
 * siempre la misma composición horizontal.
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
        {/* Detalles de la entrada */}
        <div className="ticket-details">
          <div>
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
        </div>

        {/* Divisor vertical con muescas de ticket */}
        <div className="ticket-divider" aria-hidden="true">
          <div className="ticket-dash" />
          <span className="ticket-cutout ticket-cutout--top" />
          <span className="ticket-cutout ticket-cutout--bottom" />
        </div>

        {/* Bloque de acreditación con QR */}
        <div className="ticket-qr">
          <span className="ticket-qr-label">Acreditación QR</span>
          <div className="ticket-qr-box">
            {/* data URL generado en el cliente: no pasa por el optimizador */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt="Código QR de la entrada" width={170} height={170} />
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
