// RFC 6238 Time-based One-Time Passwords using Web Crypto HMAC-SHA1.
// Compatible with Google Authenticator, 1Password, Authy, etc.

import { base32ToBytes, bytesToBase32 } from "./base32";
import { getRandomBytes } from "./crypto";

const DEFAULT_DIGITS = 6;
const DEFAULT_PERIOD_SECONDS = 30;

export function generateTotpSecret(byteLength = 20) {
  return bytesToBase32(getRandomBytes(byteLength));
}

export function buildOtpAuthUri({
  secret,
  accountName,
  issuer = "LifeHub AI Cloud",
  digits = DEFAULT_DIGITS,
  period = DEFAULT_PERIOD_SECONDS,
}) {
  const label = encodeURIComponent(`${issuer}:${accountName}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(digits),
    period: String(period),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

function counterToBytes(counter) {
  const bytes = new Uint8Array(8);
  let value = BigInt(counter);
  for (let i = 7; i >= 0; i -= 1) {
    bytes[i] = Number(value & 0xffn);
    value >>= 8n;
  }
  return bytes;
}

async function hmacSha1(keyBytes, messageBytes) {
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, messageBytes);
  return new Uint8Array(signature);
}

export async function generateTotpCode({
  secret,
  timestampSeconds = Math.floor(Date.now() / 1000),
  digits = DEFAULT_DIGITS,
  period = DEFAULT_PERIOD_SECONDS,
}) {
  const keyBytes = base32ToBytes(secret);
  const counter = Math.floor(timestampSeconds / period);
  const counterBytes = counterToBytes(counter);

  const hash = await hmacSha1(keyBytes, counterBytes);
  const offset = hash[hash.length - 1] & 0x0f;

  const binary =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  const code = binary % 10 ** digits;
  return code.toString().padStart(digits, "0");
}

export async function verifyTotpCode({
  secret,
  code,
  windowSteps = 1,
  digits = DEFAULT_DIGITS,
  period = DEFAULT_PERIOD_SECONDS,
}) {
  if (typeof code !== "string") return false;
  const cleaned = code.replace(/\s+/g, "");
  if (!/^\d{6,8}$/.test(cleaned)) return false;

  const now = Math.floor(Date.now() / 1000);

  for (let step = -windowSteps; step <= windowSteps; step += 1) {
    const candidate = await generateTotpCode({
      secret,
      timestampSeconds: now + step * period,
      digits,
      period,
    });

    if (candidate === cleaned) return true;
  }

  return false;
}
