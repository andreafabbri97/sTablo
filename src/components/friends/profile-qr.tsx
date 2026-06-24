import QRCode from "qrcode";

/** Server component: renders an SVG QR code for the given URL. */
export async function ProfileQr({ url }: { url: string }) {
  let svg = "";
  try {
    svg = await QRCode.toString(url, {
      type: "svg",
      margin: 1,
      width: 180,
      color: { dark: "#0b1220", light: "#ffffff" },
    });
  } catch {
    return null;
  }
  return (
    <div
      className="inline-block overflow-hidden rounded-2xl border border-border bg-white p-2"
      // qrcode returns a self-contained, trusted SVG string
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
