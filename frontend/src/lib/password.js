// Lightweight password strength scoring, no dependencies.

export function scorePassword(password) {
  if (!password) {
    return { score: 0, label: "Empty", checks: emptyChecks() };
  }

  const checks = {
    length12: password.length >= 12,
    length16: password.length >= 16,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
    notCommon: !isCommonPassword(password),
  };

  let score = 0;
  if (checks.length12) score += 1;
  if (checks.length16) score += 1;
  if (checks.upper && checks.lower) score += 1;
  if (checks.number) score += 1;
  if (checks.special) score += 1;
  if (checks.notCommon) score += 1;

  const label = ["Very weak", "Weak", "Okay", "Good", "Strong", "Strong", "Excellent"][score] || "Strong";

  return { score, label, checks };
}

function emptyChecks() {
  return {
    length12: false,
    length16: false,
    upper: false,
    lower: false,
    number: false,
    special: false,
    notCommon: false,
  };
}

const COMMON = new Set([
  "password",
  "password1",
  "password123",
  "qwerty",
  "qwerty123",
  "letmein",
  "111111",
  "123456",
  "12345678",
  "123456789",
  "iloveyou",
  "welcome",
  "admin",
  "abc123",
]);

function isCommonPassword(password) {
  return COMMON.has(password.toLowerCase());
}
