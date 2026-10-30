import type { Metadata } from "next";
import { generateQr } from "@/utils/generateQr";
import EntradaQrActions from "@/components/EntradaQrActions";

type EntradaPageProps = {
  params: Promise<{ uuid: string }>;
};

export async function generateMetadata({ params }: EntradaPageProps): Promise<Metadata> {
  const { uuid } = await params;

  return {
    title: `Entrada ${uuid} — ENTRE NOS`,
    description: "Código QR de tu entrada.",
  };
}

export default async function EntradaPage({ params }: EntradaPageProps) {
  const { uuid } = await params;
  const qrDataUrl = await generateQr(uuid);

  return (
    <main className="entrada-qr-page">
      {/* data URL generado en el servidor: no necesita pasar por el optimizador */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="entrada-qr-image" src={qrDataUrl} alt="Código QR de la entrada" />
      <EntradaQrActions uuid={uuid} qrDataUrl={qrDataUrl} />
    </main>
  );
}
