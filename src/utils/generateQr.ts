import QRCode from "qrcode";

export async function generateQr(uuid: string): Promise<string> {
  return QRCode.toDataURL(uuid, {
    width: 300,
    margin: 2,
    errorCorrectionLevel: "M",
  });
}