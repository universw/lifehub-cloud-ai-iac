import { useMemo, useState } from "react";
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
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

  if (message.includes("auth/missing-email")) {
    return "Please enter your email address first.";
  }

  if (message.includes("auth/too-many-requests")) {
    return "Too many attempts. Please wait a moment and try again.";
  }

  if (message.includes("auth/api-key-not-valid")) {
    return "Firebase API key is invalid. Please check your Firebase configuration.";
  }

  return message || "Authentication failed.";
}

function Login() {
  const [showAuth, setShowAuth] = useState(false);
  const [mode, setMode] = useState("login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
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
    setSuccessMessage("");
  }

  function openAuth(nextMode) {
    resetForm(nextMode);
    setShowAuth(true);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

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
          email.trim(),
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
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (err) {
      setError(getFriendlyError(err.message));
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordReset() {
    setError("");
    setSuccessMessage("");

    if (!email.trim()) {
      setError("Please enter your email first, then click Forgot password.");
      return;
    }

    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSuccessMessage(
        "Password reset email sent. Please check your inbox or spam folder."
      );
    } catch (err) {
      setError(getFriendlyError(err.message));
    } finally {
      setLoading(false);
    }
  }

  if (!showAuth) {
    return (
      <main className="landing-page">
        <header className="landing-nav">
          <div>
            <p className="eyebrow">LifeHub</p>
            <strong>AI Cloud</strong>
          </div>

          <div className="landing-nav-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => openAuth("login")}
            >
              Log in
            </button>

            <button type="button" onClick={() => openAuth("register")}>
              Create account
            </button>
          </div>
        </header>

        <section className="landing-hero">
          <div className="landing-hero-content">
            <p className="eyebrow">Secure personal cloud workspace</p>
            <h1>Organize your files, notes, links, and life records in one place.</h1>
            <p className="muted">
              LifeHub AI Cloud is a personal productivity and document management
              workspace built with Firebase, Google Cloud, React, and Terraform.
              It helps you keep important information searchable, organized, and
              protected by user-isolated cloud security rules.
            </p>

            <div className="landing-actions">
              <button type="button" onClick={() => openAuth("register")}>
                Start your LifeHub
              </button>

              <button
                type="button"
                className="secondary-button"
                onClick={() => openAuth("login")}
              >
                I already have an account
              </button>
            </div>

            <div className="landing-proof">
              <span>Firebase Auth</span>
              <span>Firestore</span>
              <span>Cloud Storage</span>
              <span>App Check</span>
              <span>Cloud Functions</span>
            </div>
          </div>

          <div className="landing-preview-card">
            <div className="preview-window-bar">
              <span />
              <span />
              <span />
            </div>

            <div className="preview-dashboard">
              <div>
                <p className="eyebrow">Workspace overview</p>
                <h2>Henry&apos;s LifeHub</h2>
              </div>

              <div className="preview-stats">
                <article>
                  <span>📁</span>
                  <strong>Files</strong>
                  <p>Documents, receipts, certificates</p>
                </article>

                <article>
                  <span>📝</span>
                  <strong>Notes</strong>
                  <p>Private checklists and reminders</p>
                </article>

                <article>
                  <span>🔗</span>
                  <strong>Links</strong>
                  <p>Resources, tools, and references</p>
                </article>

                <article>
                  <span>📊</span>
                  <strong>Activity</strong>
                  <p>Safe audit history</p>
                </article>
              </div>

              <div className="preview-security">
                <strong>Security center</strong>
                <p>User data isolation enabled</p>
                <p>Safer uploads enabled</p>
                <p>App Check monitoring active</p>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-feature-grid">
          <article>
            <span>📁</span>
            <h3>File library</h3>
            <p>
              Upload and organize important personal documents by category,
              search, size, and important status.
            </p>
          </article>

          <article>
            <span>📝</span>
            <h3>Private notes</h3>
            <p>
              Save checklists, reminders, study plans, personal records, and
              important ideas inside your workspace.
            </p>
          </article>

          <article>
            <span>🔗</span>
            <h3>Useful links</h3>
            <p>
              Store school resources, portfolio references, learning pages,
              finance links, and tools.
            </p>
          </article>

          <article>
            <span>🛡️</span>
            <h3>Security-first design</h3>
            <p>
              User-isolated Firestore and Storage rules keep each account&apos;s
              data scoped to its own user ID.
            </p>
          </article>

          <article>
            <span>📊</span>
            <h3>Activity log</h3>
            <p>
              Track safe, generic audit events so users can understand what
              happened in their workspace.
            </p>
          </article>

          <article>
            <span>☁️</span>
            <h3>Cloud portfolio stack</h3>
            <p>
              Built with React, Firebase, Google Cloud, Cloud Functions, App
              Check, and Terraform.
            </p>
          </article>
        </section>

        <section className="landing-cta-card">
          <div>
            <p className="eyebrow">Portfolio-ready product</p>
            <h2>Built like a real cloud SaaS app.</h2>
            <p className="muted">
              LifeHub demonstrates authentication, cloud storage, database
              security rules, serverless functions, activity logging, and a
              polished frontend product experience.
            </p>
          </div>

          <button type="button" onClick={() => openAuth("register")}>
            Create account
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <button
          type="button"
          className="auth-back-button"
          onClick={() => {
            setShowAuth(false);
            setError("");
            setSuccessMessage("");
          }}
        >
          ← Back to overview
        </button>

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
              onChange={(event) => {
                setEmail(event.target.value);
                setError("");
                setSuccessMessage("");
              }}
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

          {!isRegister && (
            <button
              type="button"
              className="forgot-password-button"
              onClick={handlePasswordReset}
              disabled={loading}
            >
              Forgot password?
            </button>
          )}

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
                    onChange={(event) => setConfirmPassword(event.target.value)}
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

          {successMessage && <p className="success-text">{successMessage}</p>}
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