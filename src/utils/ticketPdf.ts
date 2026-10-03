/**
 * Genera y descarga un PDF a partir del nodo HTML de la entrada (el ticket que
 * replica `src/templates/registro.html`), incluyendo el código QR.
 *
 * Estrategia: se captura el nodo tal cual se ve en pantalla con
 * `html2canvas-pro` y la imagen resultante se coloca centrada en una hoja A4
 * horizontal con `jspdf`.
 *
 * Las dos librerías se importan de forma dinámica: solo se descargan cuando la
 * persona pulsa "Descargar entrada (PDF)", así no engordan el bundle inicial.
 */
export async function descargarEntradaPdf(
  node: HTMLElement,
  fileName: string
): Promise<void> {
  // Esperamos a que las tipografías web (Cinzel/Cormorant) estén listas: si se
  // captura antes, el PDF sale con la fuente de respaldo.
  if (typeof document !== "undefined" && document.fonts?.ready) {
    await document.fonts.ready;
  }

  const [html2canvasModule, jsPdfModule] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);

  const html2canvas = html2canvasModule.default;
  const { jsPDF } = jsPdfModule;

  const canvas = await html2canvas(node, {
    scale: 2,
    backgroundColor: "#111116",
    useCORS: true,
    logging: false,
  });

  const imgData = canvas.toDataURL("image/png");

  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 28;

  const ratio = Math.min(
    (pageWidth - margin * 2) / canvas.width,
    (pageHeight - margin * 2) / canvas.height
  );

  const renderWidth = canvas.width * ratio;
  const renderHeight = canvas.height * ratio;
  const x = (pageWidth - renderWidth) / 2;
  const y = (pageHeight - renderHeight) / 2;

  pdf.addImage(imgData, "PNG", x, y, renderWidth, renderHeight);
  pdf.save(fileName);
}
