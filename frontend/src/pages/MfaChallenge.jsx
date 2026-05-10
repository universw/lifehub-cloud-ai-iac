import { useState } from "react";
import { signOut } from "firebase/auth";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { verifyTotpCode } from "../lib/totp";
import {
  hashRecoveryCode,
  normalizeRecoveryCode,
} from "../lib/recoveryCodes";
import { friendlyFirebaseError } from "../lib/errors";

function MfaChallenge({ user, mfaConfig, onSuccess }) {
  const [mode, setMode] = useState("totp");
  const [code, setCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);

  async function handleTotpSubmit(event) {
    event.preventDefault();
    setError("");

    if (!/^\d{6}$/.test(code.trim())) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }

    setVerifying(true);
    try {
      const valid = await verifyTotpCode({
        secret: mfaConfig.secret,
        code: code.trim(),
      });
      if (!valid) {
        setError("That code didn't match. Try the latest 6 digits.");
        return;
      }
      onSuccess();
    } catch (err) {
      setError(friendlyFirebaseError(err, "Failed to verify code."));
    } finally {
      setVerifying(false);
    }
  }

  async function handleRecoverySubmit(event) {
    event.preventDefault();
    setError("");

    const normalized = normalizeRecoveryCode(recoveryCode);
    if (!normalized) {
      setError("Enter one of your saved recovery codes.");
      return;
    }

    setVerifying(true);
    try {
      const candidateHash = await hashRecoveryCode(normalized);
      const remaining = (mfaConfig.recoveryCodeHashes || []).filter(
        (hash) => hash !== candidateHash
      );

      if (remaining.length === (mfaConfig.recoveryCodeHashes || []).length) {
        setError(
          "That recovery code didn't match. Each code can be used only once."
        );
        return;
      }

      await updateDoc(doc(db, "users", user.uid, "security", "mfa"), {
        recoveryCodeHashes: remaining,
        lastRecoveryUsedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      onSuccess();
    } catch (err) {
      setError(friendlyFirebaseError(err, "Failed to verify recovery code."));
    } finally {
      setVerifying(false);
    }
  }

  return (
    <main className="app-shell mfa-challenge-shell">
      <section className="mfa-challenge-card">
        <p className="eyebrow">Two-factor authentication</p>
        <h1>Verify it's you</h1>
        <p className="muted">
          Signed in as <strong>{user.email}</strong>. Enter the current 6-digit
          code from your authenticator app to access LifeHub.
        </p>

        {mode === "totp" ? (
          <form onSubmit={handleTotpSubmit}>
            <label>
              Authenticator code
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="123456"
                maxLength={6}
                required
                autoFocus
              />
            </label>

            {error && <p className="form-error">{error}</p>}

            <button type="submit" disabled={verifying}>
              {verifying ? "Verifying..." : "Verify and continue"}
            </button>

            {mfaConfig.recoveryCodeHashes?.length > 0 && (
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setMode("recovery");
                  setError("");
                }}
              >
                Use a recovery code instead
              </button>
            )}
          </form>
        ) : (
          <form onSubmit={handleRecoverySubmit}>
            <label>
              Recovery code
              <input
                type="text"
                value={recoveryCode}
                onChange={(event) => setRecoveryCode(event.target.value)}
                placeholder="ABCDE-23456"
                required
                autoFocus
              />
            </label>

            {error && <p className="form-error">{error}</p>}

            <button type="submit" disabled={verifying}>
              {verifying ? "Verifying..." : "Use recovery code"}
            </button>

            <button
              type="button"
              className="link-button"
              onClick={() => {
                setMode("totp");
                setError("");
              }}
            >
              Back to authenticator code
            </button>
          </form>
        )}

        <button
          type="button"
          className="link-button"
          onClick={() => signOut(auth)}
        >
          Sign out
        </button>
      </section>
    </main>
  );
}

export default MfaChallenge;
