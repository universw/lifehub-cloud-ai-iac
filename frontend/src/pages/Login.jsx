import { useMemo, useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

function validatePassword(password) {
  return {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
}

function getFriendlyError(message) {
  if (message.includes("auth/email-already-in-use")) {
    return "This email is already registered. Please log in instead.";
  }

  if (message.includes("auth/invalid-email")) {
    return "Please enter a valid email address.";
  }

  if (message.includes("auth/weak-password")) {
    return "Password is too weak. Please use a stronger password.";
  }

  if (message.includes("auth/invalid-credential")) {
    return "Incorrect email or password.";
  }

  if (message.includes("auth/wrong-password")) {
    return "Incorrect password.";
  }

  if (message.includes("auth/user-not-found")) {
    return "No account found with this email.";
  }

  if (message.includes("auth/api-key-not-valid")) {
    return "Firebase API key is invalid. Please check your Firebase configuration.";
  }

  return message || "Authentication failed.";
}

function Login() {
  const [mode, setMode] = useState("login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isRegister = mode === "register";

  const passwordChecks = useMemo(() => validatePassword(password), [password]);
  const isStrongPassword = Object.values(passwordChecks).every(Boolean);
  const passwordsMatch =
    password.length > 0 &&
    confirmPassword.length > 0 &&
    password === confirmPassword;

  function resetForm(nextMode) {
    setMode(nextMode);
    setDisplayName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (isRegister) {
      if (!displayName.trim()) {
        setError("Please enter your display name.");
        return;
      }

      if (!isStrongPassword) {
        setError("Please create a stronger password.");
        return;
      }

      if (password !== confirmPassword) {
        setError("Password and confirm password do not match.");
        return;
      }
    }

    setLoading(true);

    try {
      if (isRegister) {
        const credential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );

        await setDoc(doc(db, "users", credential.user.uid), {
          uid: credential.user.uid,
          email: credential.user.email,
          displayName: displayName.trim(),
          plan: "free",
          createdAt: serverTimestamp(),
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setError(getFriendlyError(err.message));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-header">
          <p className="eyebrow">LifeHub AI Cloud</p>
          <h1>{isRegister ? "Create your account" : "Welcome back"}</h1>
          <p className="muted">
            Store your files, notes, links, and life documents securely in the cloud.
          </p>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={!isRegister ? "tab active" : "tab"}
            onClick={() => resetForm("login")}
          >
            Log in
          </button>

          <button
            type="button"
            className={isRegister ? "tab active" : "tab"}
            onClick={() => resetForm("register")}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="form">
          {isRegister && (
            <label>
              Display name
              <input
                type="text"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Henry Nguyen"
                required
              />
            </label>
          )}

          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>

          <label>
            Password
            <div className="password-input-row">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={
                  isRegister ? "Create a strong password" : "Enter your password"
                }
                required
              />

              <button
                type="button"
                className="small-button"
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </label>

          {isRegister && (
            <>
              <div className="password-rules">
                <p className={passwordChecks.length ? "valid" : ""}>
                  At least 8 characters
                </p>
                <p className={passwordChecks.uppercase ? "valid" : ""}>
                  One uppercase letter
                </p>
                <p className={passwordChecks.lowercase ? "valid" : ""}>
                  One lowercase letter
                </p>
                <p className={passwordChecks.number ? "valid" : ""}>
                  One number
                </p>
                <p className={passwordChecks.special ? "valid" : ""}>
                  One special character
                </p>
              </div>

              <label>
                Confirm password
                <div className="password-input-row">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(event.target.value)
                    }
                    placeholder="Re-enter your password"
                    required
                  />

                  <button
                    type="button"
                    className="small-button"
                    onClick={() =>
                      setShowConfirmPassword((current) => !current)
                    }
                  >
                    {showConfirmPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </label>

              {confirmPassword && (
                <p
                  className={
                    passwordsMatch ? "match-text valid" : "match-text error"
                  }
                >
                  {passwordsMatch
                    ? "Passwords match."
                    : "Passwords do not match."}
                </p>
              )}
            </>
          )}

          {error && <p className="error">{error}</p>}

          <button type="submit" disabled={loading}>
            {loading
              ? "Please wait..."
              : isRegister
              ? "Create account"
              : "Log in"}
          </button>
        </form>
      </section>
    </main>
  );
}

export default Login;
