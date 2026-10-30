"use client";

import { useState } from "react";

type EntradaQrActionsProps = {
  uuid: string;
  qrDataUrl: string;
};

export default function EntradaQrActions({ uuid, qrDataUrl }: EntradaQrActionsProps) {
  const [generandoPdf, setGenerandoPdf] = useState(false);
  const [pdfError, setPdfError] = useState(false);
  const fileBaseName = `EntradaLegitimas${uuid}`;

  async function descargarPdf() {
    setGenerandoPdf(true);
    setPdfError(false);

    try {
      const { jsPDF } = await import("jspdf");
      const size = 600;
      const padding = 36;
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "px",
        format: [size, size],
        compress: true,
      });

      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, size, size, "F");
      pdf.addImage(qrDataUrl, "PNG", padding, padding, size - padding * 2, size - padding * 2);
      pdf.save(`${fileBaseName}.pdf`);
    } catch {
      setPdfError(true);
    } finally {
      setGenerandoPdf(false);
    }
  }

  return (
    <div className="entrada-qr-actions">
      <a className="entrada-qr-download" href={qrDataUrl} download={`${fileBaseName}.png`}>
        Descargar imagen
      </a>
      <button
        type="button"
        className="entrada-qr-download"
        onClick={descargarPdf}
        disabled={generandoPdf}
      >
        {generandoPdf ? "Generando PDF…" : "Descargar PDF"}
      </button>
      {pdfError && (
        <p className="entrada-qr-error" role="alert">
          No pudimos generar el PDF. Probá de nuevo.
        </p>
      )}
    </div>
  );
}
