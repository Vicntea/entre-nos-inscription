import type { Metadata } from "next";
import ScanEntradas from "@/components/ScanEntradas";

export const metadata: Metadata = {
  title: "Revisor de entradas — ENTRE NOS",
  description: "Escaneá el código QR de la entrada para registrar la presencia.",
};

export default function MobileRevisorEntradasPage() {
  return <ScanEntradas />;
}
