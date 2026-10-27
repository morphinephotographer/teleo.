import QRCode from "qrcode";
/** Local compositing only. Never send the invitation/token to an external QR service. */
export async function makeInvitationQR(url: string) {
  const canvas = document.createElement("canvas");
  await QRCode.toCanvas(canvas, url, {
    scale: 4,
    margin: 4,
    errorCorrectionLevel: "H",
  });
  const context = canvas.getContext("2d");
  if (!context) throw Error("QR canvas unavailable");
  const width = Math.floor(canvas.width * 0.13),
    height = Math.floor(width * 0.55);
  const left = Math.floor((canvas.width - width) / 2),
    top = Math.floor((canvas.height - height) / 2);
  context.fillStyle = "#fff";
  context.beginPath();
  context.roundRect(left, top, width, height, Math.min(5, height / 4));
  context.fill();
  context.fillStyle = "#090909";
  context.font = `750 ${Math.floor(width * 0.29)}px Arial`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(
    "teleo.",
    canvas.width / 2,
    canvas.height / 2 + 0.5,
    width - 8,
  );
  return canvas.toDataURL("image/png");
}
