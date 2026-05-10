import { useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  base64ToBytes,
  bytesToBase64,
  constantTimeEquals,
  decryptString,
  deriveVaultKey,
  deriveVerifierHash,
  encryptString,
  generateSalt,
} from "../lib/crypto";
import { friendlyFirebaseError } from "../lib/errors";
import { scorePassword } from "../lib/password";
import { useConfirm } from "../components/confirmContext";
import { useToast } from "../components/toastContext";

const AUTO_LOCK_MS = 5 * 60 * 1000; // lock after 5 minutes idle
const ENTRY_KINDS = [
  { value: "password", label: "Password", icon: "🔑" },
  { value: "note", label: "Secure note", icon: "📓" },
  { value: "key", label: "Private key", icon: "🗝️" },
  { value: "recovery", label: "Recovery code", icon: "🛟" },
  { value: "card", label: "Card / ID", icon: "💳" },
  { value: "other", label: "Other secret", icon: "🔒" },
];

function getEntryIcon(kind) {
  const found = ENTRY_KINDS.find((entry) => entry.value === kind);
  return found ? found.icon : "🔒";
}

function VaultUnlockState({ onSetup, onUnlock, hasMaster, error, working }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const strength = scorePassword(password);

  if (!hasMaster) {
    return (
      <form
        className="vault-gate"
        onSubmit={(event) => {
          event.preventDefault();
          onSetup(password, confirmPassword);
          setPassword("");
          setConfirmPassword("");
        }}
      >
        <p className="eyebrow">Set up</p>
        <h2>Create your master password</h2>
        <p className="muted">
          The master password encrypts your Vault on this device. LifeHub never
          sees it. If you forget it, your Vault items cannot be recovered.
        </p>

        <label>
          Master password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Use at least 12 characters"
            autoComplete="new-password"
            minLength={12}
            required
          />
        </label>

        {password.length > 0 && (
          <div className={`password-meter strength-${strength.score}`}>
            <div className="password-meter-bar">
              <span style={{ width: `${(strength.score / 6) * 100}%` }} />
            </div>
            <p className="muted">
              Strength: <strong>{strength.label}</strong>
            </p>
            <ul className="password-checks">
              <li className={strength.checks.length12 ? "ok" : ""}>
                12+ characters
              </li>
              <li className={strength.checks.length16 ? "ok" : ""}>
                16+ characters (recommended)
              </li>
              <li className={strength.checks.upper && strength.checks.lower ? "ok" : ""}>
                Mix of upper- and lower-case
              </li>
              <li className={strength.checks.number ? "ok" : ""}>
                Includes a number
              </li>
              <li className={strength.checks.special ? "ok" : ""}>
                Includes a symbol
              </li>
              <li className={strength.checks.notCommon ? "ok" : ""}>
                Not a common password
              </li>
            </ul>
          </div>
        )}

        <label>
          Confirm master password
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Repeat your master password"
            autoComplete="new-password"
            minLength={12}
            required
          />
        </label>

        {error && <p className="form-error">{error}</p>}

        <button type="submit" disabled={working}>
          {working ? "Creating Vault..." : "Create Vault"}
        </button>
      </form>
    );
  }

  return (
    <form
      className="vault-gate"
      onSubmit={(event) => {
        event.preventDefault();
        onUnlock(password);
        setPassword("");
      }}
    >
      <p className="eyebrow">Unlock</p>
      <h2>Enter your master password</h2>
      <p className="muted">
        Your Vault is end-to-end encrypted. Enter the master password used to
        set it up to decrypt your items in this browser.
      </p>

      <label>
        Master password
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Master password"
          autoComplete="current-password"
          required
        />
      </label>

      {error && <p className="form-error">{error}</p>}

      <button type="submit" disabled={working}>
        {working ? "Unlocking..." : "Unlock Vault"}
      </button>
    </form>
  );
}

function Vault({ user, logActivity }) {
  const confirm = useConfirm();
  const toast = useToast();
  const [vaultMeta, setVaultMeta] = useState(null);
  const [vaultMetaLoaded, setVaultMetaLoaded] = useState(false);
  const [vaultKey, setVaultKey] = useState(null);
  const [encryptedItems, setEncryptedItems] = useState([]);
  const [decryptedItems, setDecryptedItems] = useState([]);
  const [auditEntries, setAuditEntries] = useState([]);

  const [unlockError, setUnlockError] = useState("");
  const [unlocking, setUnlocking] = useState(false);

  const [draftName, setDraftName] = useState("");
  const [draftKind, setDraftKind] = useState("password");
  const [draftSecret, setDraftSecret] = useState("");
  const [draftNotes, setDraftNotes] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);
  const [formError, setFormError] = useState("");

  const [revealed, setRevealed] = useState({});
  const [editingId, setEditingId] = useState("");
  const [editName, setEditName] = useState("");
  const [editKind, setEditKind] = useState("password");
  const [editSecret, setEditSecret] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const lockTimerRef = useRef(null);

  // Subscribe to vault metadata.
  useEffect(() => {
    const metaRef = doc(db, "users", user.uid, "vault", "meta");

    const unsubscribe = onSnapshot(
      metaRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setVaultMeta(snapshot.data());
        } else {
          setVaultMeta(null);
        }
        setVaultMetaLoaded(true);
      },
      () => setVaultMetaLoaded(true)
    );

    return () => unsubscribe();
  }, [user.uid]);

  // Subscribe to encrypted items only after the vault is unlocked.
  useEffect(() => {
    if (!vaultKey) return undefined;

    const itemsRef = collection(db, "users", user.uid, "vault", "items", "entries");
    const itemsQuery = query(itemsRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(itemsQuery, (snapshot) => {
      setEncryptedItems(
        snapshot.docs.map((docSnapshot) => ({
          id: docSnapshot.id,
          ...docSnapshot.data(),
        }))
      );
    });

    return () => unsubscribe();
  }, [user.uid, vaultKey]);

  // Subscribe to vault audit history.
  useEffect(() => {
    if (!vaultKey) return undefined;

    const auditRef = collection(db, "users", user.uid, "vault", "items", "audit");
    const auditQuery = query(auditRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(auditQuery, (snapshot) => {
      setAuditEntries(
        snapshot.docs.map((docSnapshot) => ({
          id: docSnapshot.id,
          ...docSnapshot.data(),
        }))
      );
    });

    return () => unsubscribe();
  }, [user.uid, vaultKey]);

  // Decrypt items as they arrive.
  useEffect(() => {
    let cancelled = false;

    async function decryptAll() {
      if (!vaultKey) {
        setDecryptedItems([]);
        return;
      }

      const next = [];
      for (const item of encryptedItems) {
        try {
          const name = await decryptString(vaultKey, item.nameIv, item.nameCipher);
          const secret = await decryptString(
            vaultKey,
            item.secretIv,
            item.secretCipher
          );
          const notes = item.notesCipher
            ? await decryptString(vaultKey, item.notesIv, item.notesCipher)
            : "";

          next.push({
            id: item.id,
            kind: item.kind || "other",
            name,
            secret,
            notes,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
          });
        } catch {
          next.push({
            id: item.id,
            kind: item.kind || "other",
            name: "Could not decrypt",
            secret: "",
            notes: "",
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
            corrupted: true,
          });
        }
      }

      if (!cancelled) setDecryptedItems(next);
    }

    decryptAll();
    return () => {
      cancelled = true;
    };
  }, [encryptedItems, vaultKey]);

  // Auto-lock after inactivity.
  useEffect(() => {
    if (!vaultKey) return undefined;

    function resetTimer() {
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
      lockTimerRef.current = setTimeout(() => {
        lock("Auto-locked after inactivity");
      }, AUTO_LOCK_MS);
    }

    const events = ["mousemove", "keydown", "click", "touchstart"];
    events.forEach((event) => window.addEventListener(event, resetTimer));
    resetTimer();

    return () => {
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
      events.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [vaultKey]);

  function lock(reason) {
    setVaultKey(null);
    setEncryptedItems([]);
    setDecryptedItems([]);
    setAuditEntries([]);
    setRevealed({});
    setEditingId("");
    setUnlockError(reason || "");
  }

  async function writeAudit(action, message) {
    try {
      await addDoc(
        collection(db, "users", user.uid, "vault", "items", "audit"),
        {
          action,
          message,
          createdAt: serverTimestamp(),
        }
      );
    } catch {
      // audit log failures should not break the user flow
    }

    if (typeof logActivity === "function") {
      logActivity(action, "vault", message);
    }
  }

  async function handleSetup(password, confirmPassword) {
    setUnlockError("");

    if (password.length < 12) {
      setUnlockError("Master password must be at least 12 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setUnlockError("Passwords do not match.");
      return;
    }

    setUnlocking(true);
    try {
      const saltBytes = generateSalt();
      const saltBase64 = bytesToBase64(saltBytes);

      const verifier = await deriveVerifierHash(password, saltBytes);
      const key = await deriveVaultKey(password, saltBytes);

      await setDoc(doc(db, "users", user.uid, "vault", "meta"), {
        salt: saltBase64,
        verifier,
        algorithm: "AES-GCM-256",
        kdf: "PBKDF2-SHA256-250000",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setVaultKey(key);
      writeAudit("vault_created", "Created the LifeHub Vault");
    } catch (err) {
      setUnlockError(friendlyFirebaseError(err, "Failed to create Vault."));
    } finally {
      setUnlocking(false);
    }
  }

  async function handleUnlock(password) {
    setUnlockError("");

    if (!vaultMeta?.salt || !vaultMeta?.verifier) {
      setUnlockError("Vault is not initialized.");
      return;
    }

    setUnlocking(true);
    try {
      const saltBytes = base64ToBytes(vaultMeta.salt);
      const verifier = await deriveVerifierHash(password, saltBytes);

      if (!constantTimeEquals(verifier, vaultMeta.verifier)) {
        setUnlockError("Incorrect master password.");
        return;
      }

      const key = await deriveVaultKey(password, saltBytes);
      setVaultKey(key);
      writeAudit("vault_unlocked", "Unlocked the Vault");
    } catch (err) {
      setUnlockError(friendlyFirebaseError(err, "Failed to unlock Vault."));
    } finally {
      setUnlocking(false);
    }
  }

  async function handleAddEntry(event) {
    event.preventDefault();
    setFormError("");

    if (!vaultKey) {
      setFormError("Vault is locked.");
      return;
    }
    if (!draftName.trim()) {
      setFormError("Please enter a name for this entry.");
      return;
    }
    if (!draftSecret) {
      setFormError("Please enter the secret value to encrypt.");
      return;
    }

    setSavingDraft(true);
    try {
      const nameEncrypted = await encryptString(vaultKey, draftName.trim());
      const secretEncrypted = await encryptString(vaultKey, draftSecret);
      const notesEncrypted = draftNotes
        ? await encryptString(vaultKey, draftNotes)
        : null;

      await addDoc(
        collection(db, "users", user.uid, "vault", "items", "entries"),
        {
          kind: draftKind,
          nameIv: nameEncrypted.iv,
          nameCipher: nameEncrypted.ciphertext,
          secretIv: secretEncrypted.iv,
          secretCipher: secretEncrypted.ciphertext,
          notesIv: notesEncrypted?.iv || null,
          notesCipher: notesEncrypted?.ciphertext || null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      );

      writeAudit("vault_item_added", `Encrypted a new ${draftKind} entry`);

      setDraftName("");
      setDraftKind("password");
      setDraftSecret("");
      setDraftNotes("");
    } catch (err) {
      setFormError(friendlyFirebaseError(err, "Failed to encrypt the entry."));
    } finally {
      setSavingDraft(false);
    }
  }

  function startEdit(item) {
    setEditingId(item.id);
    setEditName(item.name);
    setEditKind(item.kind);
    setEditSecret(item.secret);
    setEditNotes(item.notes);
  }

  async function handleSaveEdit(event) {
    event.preventDefault();
    if (!vaultKey || !editingId) return;

    try {
      const nameEncrypted = await encryptString(vaultKey, editName.trim());
      const secretEncrypted = await encryptString(vaultKey, editSecret);
      const notesEncrypted = editNotes
        ? await encryptString(vaultKey, editNotes)
        : null;

      await updateDoc(
        doc(db, "users", user.uid, "vault", "items", "entries", editingId),
        {
          kind: editKind,
          nameIv: nameEncrypted.iv,
          nameCipher: nameEncrypted.ciphertext,
          secretIv: secretEncrypted.iv,
          secretCipher: secretEncrypted.ciphertext,
          notesIv: notesEncrypted?.iv || null,
          notesCipher: notesEncrypted?.ciphertext || null,
          updatedAt: serverTimestamp(),
        }
      );

      writeAudit("vault_item_updated", "Updated a Vault entry");
      setEditingId("");
    } catch (err) {
      setFormError(friendlyFirebaseError(err, "Failed to update entry."));
    }
  }

  async function handleDeleteEntry(item) {
    const confirmed = await confirm({
      title: "Delete this Vault entry?",
      message: `"${item.name}" will be permanently removed. This cannot be undone.`,
      confirmLabel: "Delete entry",
      tone: "danger",
    });
    if (!confirmed) return;

    try {
      await deleteDoc(
        doc(db, "users", user.uid, "vault", "items", "entries", item.id)
      );
      writeAudit("vault_item_deleted", "Deleted a Vault entry");
      toast.success("Vault entry deleted.");
      setRevealed((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
    } catch (err) {
      setFormError(friendlyFirebaseError(err, "Failed to delete entry."));
    }
  }

  async function copyToClipboard(value, label) {
    try {
      await navigator.clipboard.writeText(value);
      writeAudit("vault_item_copied", `Copied ${label} to clipboard`);
      toast.success(`Copied ${label} to clipboard.`);
    } catch {
      toast.error("Could not access the clipboard.");
    }
  }

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return decryptedItems;
    const needle = searchTerm.toLowerCase();
    return decryptedItems.filter(
      (item) =>
        item.name.toLowerCase().includes(needle) ||
        item.kind.toLowerCase().includes(needle) ||
        item.notes.toLowerCase().includes(needle)
    );
  }, [decryptedItems, searchTerm]);

  if (!vaultMetaLoaded) {
    return (
      <section className="vault-shell">
        <p className="muted">Loading Vault...</p>
      </section>
    );
  }

  if (!vaultKey) {
    return (
      <section className="vault-shell">
        <VaultUnlockState
          hasMaster={Boolean(vaultMeta)}
          onSetup={handleSetup}
          onUnlock={handleUnlock}
          error={unlockError}
          working={unlocking}
        />
      </section>
    );
  }

  return (
    <section className="vault-shell unlocked">
      <header className="vault-header">
        <div>
          <p className="eyebrow">Encrypted vault</p>
          <h2>Your secrets are unlocked on this device</h2>
          <p className="muted">
            Items are encrypted with AES-GCM 256 using a key derived from your
            master password. Auto-locks after 5 minutes of inactivity.
          </p>
        </div>

        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            writeAudit("vault_locked", "Locked the Vault manually");
            lock("");
          }}
        >
          Lock Vault
        </button>
      </header>

      <section className="vault-add-card">
        <form className="vault-add-form" onSubmit={handleAddEntry}>
          <p className="eyebrow">Add entry</p>
          <h3>Encrypt a new secret</h3>

          <label>
            Name
            <input
              type="text"
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              placeholder="e.g. AWS production access key"
              maxLength={120}
              required
            />
          </label>

          <label>
            Type
            <select
              value={draftKind}
              onChange={(event) => setDraftKind(event.target.value)}
            >
              {ENTRY_KINDS.map((kind) => (
                <option key={kind.value} value={kind.value}>
                  {kind.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Secret
            <textarea
              value={draftSecret}
              onChange={(event) => setDraftSecret(event.target.value)}
              placeholder="Paste the value to encrypt"
              rows={3}
              required
            />
          </label>

          <label>
            Notes (optional)
            <textarea
              value={draftNotes}
              onChange={(event) => setDraftNotes(event.target.value)}
              placeholder="Hint, account, expiry date..."
              rows={2}
            />
          </label>

          {formError && <p className="form-error">{formError}</p>}

          <button type="submit" disabled={savingDraft}>
            {savingDraft ? "Encrypting..." : "Encrypt and save"}
          </button>
        </form>
      </section>

      <section className="vault-list-card">
        <div className="vault-list-toolbar">
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search Vault..."
          />
          <span className="muted">
            {decryptedItems.length} encrypted item
            {decryptedItems.length === 1 ? "" : "s"}
          </span>
        </div>

        {filteredItems.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-icon" aria-hidden="true">🔐</span>
            <strong>
              {searchTerm
                ? "No matches in your Vault"
                : "Your Vault is ready for its first secret"}
            </strong>
            <p className="muted">
              {searchTerm
                ? "Try a different search term, or clear the search to see all entries."
                : "Use the form above to add a password, recovery code, or private key. Items are encrypted on this device with AES-GCM 256 before they're saved."}
            </p>
          </div>
        ) : (
          <ul className="vault-item-list">
            {filteredItems.map((item) => {
              const isRevealed = Boolean(revealed[item.id]);
              const isEditing = editingId === item.id;

              if (isEditing) {
                return (
                  <li key={item.id} className="vault-item editing">
                    <form onSubmit={handleSaveEdit}>
                      <input
                        type="text"
                        value={editName}
                        onChange={(event) => setEditName(event.target.value)}
                        required
                      />
                      <select
                        value={editKind}
                        onChange={(event) => setEditKind(event.target.value)}
                      >
                        {ENTRY_KINDS.map((kind) => (
                          <option key={kind.value} value={kind.value}>
                            {kind.label}
                          </option>
                        ))}
                      </select>
                      <textarea
                        value={editSecret}
                        onChange={(event) => setEditSecret(event.target.value)}
                        rows={3}
                        required
                      />
                      <textarea
                        value={editNotes}
                        onChange={(event) => setEditNotes(event.target.value)}
                        rows={2}
                        placeholder="Notes"
                      />
                      <div className="vault-item-actions">
                        <button type="submit">Save</button>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => setEditingId("")}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </li>
                );
              }

              return (
                <li key={item.id} className="vault-item">
                  <div className="vault-item-head">
                    <div className="vault-item-title">
                      <span className="vault-item-icon" aria-hidden="true">
                        {getEntryIcon(item.kind)}
                      </span>
                      <div>
                        <strong>{item.name}</strong>
                        <span className={`vault-kind-tag kind-${item.kind}`}>
                          {item.kind}
                        </span>
                      </div>
                    </div>
                    {item.corrupted && (
                      <span className="form-error">decryption failed</span>
                    )}
                  </div>

                  <div className="vault-secret-row">
                    <code className={isRevealed ? "" : "masked"}>
                      {isRevealed ? item.secret : "••••••••••••••••"}
                    </code>
                    <div className="vault-secret-actions">
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() =>
                          setRevealed((current) => ({
                            ...current,
                            [item.id]: !isRevealed,
                          }))
                        }
                      >
                        {isRevealed ? "Hide" : "Reveal"}
                      </button>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => copyToClipboard(item.secret, item.name)}
                      >
                        Copy
                      </button>
                    </div>
                  </div>

                  {item.notes && (
                    <p className="vault-notes muted">{item.notes}</p>
                  )}

                  <div className="vault-item-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => startEdit(item)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => handleDeleteEntry(item)}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="vault-audit-card">
        <p className="eyebrow">Audit history</p>
        <h3>Recent Vault activity</h3>
        <p className="muted">
          A tamper-evident log of unlock, add, edit, and delete events scoped to
          this user.
        </p>

        {auditEntries.length === 0 ? (
          <p className="muted">No Vault events yet.</p>
        ) : (
          <ul className="vault-audit-list">
            {auditEntries.slice(0, 25).map((entry) => (
              <li key={entry.id}>
                <span className="vault-audit-action">{entry.action}</span>
                <span>{entry.message}</span>
                <span className="muted">
                  {entry.createdAt?.toDate
                    ? entry.createdAt.toDate().toLocaleString()
                    : "Just now"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}

export default Vault;
