import QRCode from "qrcode";

export async function generateQr(uuid: string): Promise<string> {
  return QRCode.toDataURL(uuid, {
    width: 300,
    margin: 2,
    errorCorrectionLevel: "M",
    // Tinte vino del afiche (#741919) para que combine con la estética; el
    // fondo blanco mantiene el contraste necesario para que siga escaneable.
    color: {
      dark: "#741919",
      light: "#FFFFFF",
    },
  });
}