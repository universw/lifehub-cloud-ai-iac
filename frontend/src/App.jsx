import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "./firebase";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import MfaChallenge from "./pages/MfaChallenge";
import "./App.css";

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

  if (authLoading) {
    return (
      <main className="app-shell">
        <p>Loading LifeHub...</p>
      </main>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (!mfaLoaded) {
    return (
      <main className="app-shell">
        <p>Loading account security...</p>
      </main>
    );
  }

  const mfaEnabled = mfaConfig?.enabled && mfaConfig?.secret;
  const needsMfa = mfaEnabled && !mfaPassedAt;

  if (needsMfa) {
    return (
      <MfaChallenge
        user={user}
        mfaConfig={mfaConfig}
        onSuccess={() => setMfaPassedAt(Date.now())}
      />
    );
  }

  return <Dashboard user={user} />;
}

export default App;
