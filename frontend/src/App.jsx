import { lazy, Suspense, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "./firebase";
import Login from "./pages/Login";
import { ConfirmProvider } from "./components/ConfirmDialog";
import { ToastProvider } from "./components/Toast";
import "./App.css";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const MfaChallenge = lazy(() => import("./pages/MfaChallenge"));

function FullScreenLoader({ label = "Loading LifeHub..." }) {
  return (
    <main className="app-shell app-loader">
      <div className="loader-card">
        <div className="loader-spinner" aria-hidden="true" />
        <p>{label}</p>
      </div>
    </main>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [mfaConfig, setMfaConfig] = useState(null);
  const [mfaLoaded, setMfaLoaded] = useState(false);
  const [mfaPassedAt, setMfaPassedAt] = useState(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      setMfaPassedAt(0);
      setMfaLoaded(false);
      setMfaConfig(null);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return undefined;

    const mfaRef = doc(db, "users", user.uid, "security", "mfa");
    const unsubscribe = onSnapshot(
      mfaRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setMfaConfig(snapshot.data());
        } else {
          setMfaConfig(null);
        }
        setMfaLoaded(true);
      },
      () => setMfaLoaded(true)
    );

    return () => unsubscribe();
  }, [user]);

  let content;

  if (authLoading) {
    content = <FullScreenLoader />;
  } else if (!user) {
    content = <Login />;
  } else if (!mfaLoaded) {
    content = <FullScreenLoader label="Loading account security..." />;
  } else {
    const mfaEnabled = mfaConfig?.enabled && mfaConfig?.secret;
    const needsMfa = mfaEnabled && !mfaPassedAt;

    if (needsMfa) {
      content = (
        <Suspense fallback={<FullScreenLoader label="Loading sign-in..." />}>
          <MfaChallenge
            user={user}
            mfaConfig={mfaConfig}
            onSuccess={() => setMfaPassedAt(Date.now())}
          />
        </Suspense>
      );
    } else {
      content = (
        <Suspense fallback={<FullScreenLoader label="Loading workspace..." />}>
          <Dashboard user={user} />
        </Suspense>
      );
    }
  }

  return (
    <ToastProvider>
      <ConfirmProvider>{content}</ConfirmProvider>
    </ToastProvider>
  );
}

export default App;
