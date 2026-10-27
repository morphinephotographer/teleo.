import QRCode from "qrcode";
/** Encode the actual one-use invitation; no decoration may cover its modules/quiet zone. */
export function makeInvitationQR(url: string) {
  return QRCode.toDataURL(url, {
    width: 260,
    margin: 4,
    errorCorrectionLevel: "M",
  });
}
