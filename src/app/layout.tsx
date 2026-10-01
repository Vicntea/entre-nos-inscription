import type { Metadata, Viewport } from "next";
import { DM_Mono } from "next/font/google";
import "./globals.css";

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "ENTRE NOS — Archivo Feminista",
  description: "Mueve el cursor, rompe el papel. ¿Quieres ser parte del cambio?",
};

/* Móvil: `viewportFit: cover` habilita las safe areas (notch y barra del
   celular) que usa el layout, y el color de barra acompaña al fondo. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#111111",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${dmMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
