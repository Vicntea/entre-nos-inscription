/**
 * Genera y descarga un PDF a partir del nodo HTML de la entrada (el ticket que
 * replica `src/templates/registro.html`), incluyendo el código QR.
 *
 * Estrategia: se captura el nodo tal cual se ve en pantalla con
 * `html2canvas-pro` y la imagen resultante se coloca sobre una página vertical
 * con proporción de celular (9:16) y fondo oscuro. Así, al abrir el PDF en un
 * teléfono, el visor muestra la página casi a pantalla completa y la entrada no
 * queda diminuta. La entrada se escala para ocupar todo el ancho; lo que sobra
 * arriba/abajo es del mismo fondo oscuro (no aparecen bordes blancos).
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

  const SCALE = 2;

  const canvas = await html2canvas(node, {
    scale: SCALE,
    backgroundColor: "#111116",
    useCORS: true,
    logging: false,
  });

  const imgData = canvas.toDataURL("image/png");

  // Tamaño CSS del ticket (el canvas viene multiplicado por SCALE).
  const widthPx = canvas.width / SCALE;
  const heightPx = canvas.height / SCALE;

  // Página vertical con proporción de celular (9:16). `pageWidth` iguala el
  // ancho del ticket para que este llene todo el ancho disponible. Si el ticket
  // es más alto que 9:16 (resumen largo), la página crece con él para no dejarlo
  // más chico ni agregar bandas laterales.
  const PAGE_ALTO_SOBRE_ANCHO = 16 / 9;
  const pageWidth = widthPx;
  const pageHeight = Math.max(widthPx * PAGE_ALTO_SOBRE_ANCHO, heightPx);

  // Escala para entrar en la página (normalmente 1).
  const fit = Math.min(pageWidth / widthPx, pageHeight / heightPx);
  const renderWidth = widthPx * fit;
  const renderHeight = heightPx * fit;
  const x = (pageWidth - renderWidth) / 2;
  const y = (pageHeight - renderHeight) / 2;

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "px",
    format: [pageWidth, pageHeight],
    compress: true,
  });

  // Fondo oscuro en toda la página (bandas de arriba/abajo del ticket).
  pdf.setFillColor(17, 17, 22);
  pdf.rect(0, 0, pageWidth, pageHeight, "F");

  pdf.addImage(imgData, "PNG", x, y, renderWidth, renderHeight);
  pdf.save(fileName);
}
