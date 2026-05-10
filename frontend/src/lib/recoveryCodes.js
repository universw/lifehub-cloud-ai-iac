// Generate one-time MFA recovery codes and SHA-256 hash them for storage.
// Plaintext codes are shown to the user once; only hashes are persisted.

import { bytesToBase64, getRandomBytes } from "./crypto";

const CODE_GROUPS = 2;
const CODE_GROUP_LENGTH = 5;
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // no 0/O/1/I to avoid confusion

const textEncoder = new TextEncoder();

function randomGroup() {
  const bytes = getRandomBytes(CODE_GROUP_LENGTH);
  let out = "";
  for (let i = 0; i < CODE_GROUP_LENGTH; i += 1) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

function generateOneCode() {
  const groups = [];
  for (let i = 0; i < CODE_GROUPS; i += 1) {
    groups.push(randomGroup());
  }
  return groups.join("-");
}

export function generateRecoveryCodes(count = 8) {
  const codes = [];
  while (codes.length < count) {
    const code = generateOneCode();
    if (!codes.includes(code)) codes.push(code);
  }
  return codes;
}

export function normalizeRecoveryCode(input) {
  return String(input || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "");
}

export async function hashRecoveryCode(code) {
  const normalized = normalizeRecoveryCode(code);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    textEncoder.encode(normalized)
  );
  return bytesToBase64(new Uint8Array(digest));
}

export async function hashRecoveryCodes(codes) {
  const hashes = [];
  for (const code of codes) {
    hashes.push(await hashRecoveryCode(code));
  }
  return hashes;
}
