// RFC 4648 Base32 (used by TOTP secrets / otpauth URIs).

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function bytesToBase32(bytes) {
  let bits = 0;
  let value = 0;
  let output = "";

  for (let i = 0; i < bytes.length; i += 1) {
    value = (value << 8) | bytes[i];
    bits += 8;

    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += ALPHABET[(value << (5 - bits)) & 0x1f];
  }

  return output;
}

export function base32ToBytes(base32) {
  const cleaned = base32.replace(/=+$/g, "").replace(/\s+/g, "").toUpperCase();
  const bytes = [];

  let bits = 0;
  let value = 0;

  for (let i = 0; i < cleaned.length; i += 1) {
    const index = ALPHABET.indexOf(cleaned[i]);
    if (index === -1) {
      throw new Error("Invalid base32 character");
    }
    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return new Uint8Array(bytes);
}
