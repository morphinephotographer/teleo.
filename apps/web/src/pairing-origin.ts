/** Loopback invitations are usable only by another context on this computer. */
export function loopbackOrigin(origin: string) {
  const host = new URL(origin).hostname.toLowerCase();
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "[::1]" ||
    /^127\./.test(host)
  );
}
export function phonePairingIssue(
  origin: string,
): "localPairingOnly" | "securePairingRequired" | null {
  if (loopbackOrigin(origin)) return "localPairingOnly";
  return new URL(origin).protocol === "https:" ? null : "securePairingRequired";
}
