import { useEffect, useState } from "react";
import QRCode from "qrcode";

function QrCode({ value, size = 192, alt = "QR code" }) {
  const [dataUrl, setDataUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    if (!value) return undefined;

    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      color: { dark: "#0f172a", light: "#ffffff" },
    })
      .then((url) => {
        if (!cancelled) {
          setDataUrl(url);
          setError("");
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || "Failed to render QR code.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (error) {
    return <p className="form-error">{error}</p>;
  }

  if (!dataUrl) {
    return <div className="qr-placeholder" style={{ width: size, height: size }} />;
  }

  return <img className="qr-image" src={dataUrl} width={size} height={size} alt={alt} />;
}

export default QrCode;
