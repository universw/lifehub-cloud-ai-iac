import { useEffect, useState } from "react";
import { sendEmailVerification, signOut } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytesResumable,
} from "firebase/storage";
import { auth, db, storage } from "../firebase";

const categories = [
  "Personal",
  "School",
  "Work",
  "Finance",
  "Health",
  "Travel",
];

const linkCategories = [
  "General",
  "School",
  "Work",
  "Portfolio",
  "Learning",
  "Tools",
  "Finance",
  "Travel",
];

const allowedExtensions = [
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".txt",
  ".md",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
];

const blockedExtensions = [
  ".env",
  ".js",
  ".ts",
  ".json",
  ".py",
  ".conf",
  ".pem",
  ".key",
  ".p12",
  ".pfx",
  ".crt",
  ".cer",
  ".config",
  ".yml",
  ".yaml",
];

function getFileExtension(fileName) {
  const lastDotIndex = fileName.lastIndexOf(".");
  if (lastDotIndex === -1) return "";
  return fileName.slice(lastDotIndex).toLowerCase();
}

function formatBytes(bytes) {
  if (!bytes) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, index);

  return `${size.toFixed(1)} ${units[index]}`;
}

function formatDate(timestamp) {
  if (!timestamp?.toDate) return "Just now";

  return timestamp.toDate().toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeUrl(url) {
  const trimmedUrl = url.trim();

  if (
    trimmedUrl.startsWith("https://") ||
    trimmedUrl.startsWith("http://")
  ) {
    return trimmedUrl;
  }

  return `https://${trimmedUrl}`;
}

function isValidUrl(url) {
  try {
    const parsedUrl = new URL(normalizeUrl(url));
    return parsedUrl.protocol === "https:" || parsedUrl.protocol === "http:";
  } catch {
    return false;
  }
}

function getDisplayDomain(url) {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

function getUpdatedOrCreatedLabel(item) {
  if (item.updatedAt) {
    return `Updated ${formatDate(item.updatedAt)}`;
  }

  return `Created ${formatDate(item.createdAt)}`;
}

function getTimestampValue(timestamp) {
  if (!timestamp?.toDate) return 0;
  return timestamp.toDate().getTime();
}

function sortItems(items, sortType, labelKey) {
  const nextItems = [...items];

  return nextItems.sort((a, b) => {
    if (sortType === "oldest") {
      return getTimestampValue(a.createdAt) - getTimestampValue(b.createdAt);
    }

    if (sortType === "name" || sortType === "title") {
      const firstLabel = (a[labelKey] || "").toLowerCase();
      const secondLabel = (b[labelKey] || "").toLowerCase();
      return firstLabel.localeCompare(secondLabel);
    }

    if (sortType === "size") {
      return (b.fileSize || 0) - (a.fileSize || 0);
    }

    return getTimestampValue(b.createdAt) - getTimestampValue(a.createdAt);
  });
}

function Dashboard({ user }) {
  const [activeView, setActiveView] = useState("dashboard");

  const [files, setFiles] = useState([]);
  const [notes, setNotes] = useState([]);
  const [links, setLinks] = useState([]);
  const [activities, setActivities] = useState([]);

  const [profile, setProfile] = useState(null);
  const [displayName, setDisplayName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");

  const [selectedFile, setSelectedFile] = useState(null);
  const [category, setCategory] = useState("Personal");
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [fileImportantOnly, setFileImportantOnly] = useState(false);
  const [fileSort, setFileSort] = useState("newest");

  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [noteSearchTerm, setNoteSearchTerm] = useState("");
  const [noteImportantOnly, setNoteImportantOnly] = useState(false);
  const [noteSort, setNoteSort] = useState("newest");

  const [editingNoteId, setEditingNoteId] = useState("");
  const [editingNoteTitle, setEditingNoteTitle] = useState("");
  const [editingNoteBody, setEditingNoteBody] = useState("");

  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkCategory, setLinkCategory] = useState("General");
  const [linkSearchTerm, setLinkSearchTerm] = useState("");
  const [linkCategoryFilter, setLinkCategoryFilter] = useState("All");
  const [linkImportantOnly, setLinkImportantOnly] = useState(false);
  const [linkSort, setLinkSort] = useState("newest");

  const [editingLinkId, setEditingLinkId] = useState("");
  const [editingLinkTitle, setEditingLinkTitle] = useState("");
  const [editingLinkUrl, setEditingLinkUrl] = useState("");
  const [editingLinkCategory, setEditingLinkCategory] = useState("General");

  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [savingLink, setSavingLink] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [updatingNote, setUpdatingNote] = useState(false);
  const [updatingLink, setUpdatingLink] = useState(false);
  const [updatingImportantId, setUpdatingImportantId] = useState("");
  const [deletingFileId, setDeletingFileId] = useState("");
  const [deletingNoteId, setDeletingNoteId] = useState("");
  const [deletingLinkId, setDeletingLinkId] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [sendingVerification, setSendingVerification] = useState(false);

  useEffect(() => {
    const filesRef = collection(db, "users", user.uid, "files");
    const filesQuery = query(filesRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      filesQuery,
      (snapshot) => {
        const nextFiles = snapshot.docs.map((docSnapshot) => ({
          id: docSnapshot.id,
          ...docSnapshot.data(),
        }));

        setFiles(nextFiles);
      },
      (snapshotError) => {
        setError(snapshotError.message || "Failed to load files.");
      }
    );

    return () => unsubscribe();
  }, [user.uid]);

  useEffect(() => {
    const notesRef = collection(db, "users", user.uid, "notes");
    const notesQuery = query(notesRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      notesQuery,
      (snapshot) => {
        const nextNotes = snapshot.docs.map((docSnapshot) => ({
          id: docSnapshot.id,
          ...docSnapshot.data(),
        }));

        setNotes(nextNotes);
      },
      (snapshotError) => {
        setError(snapshotError.message || "Failed to load notes.");
      }
    );

    return () => unsubscribe();
  }, [user.uid]);

  useEffect(() => {
    const linksRef = collection(db, "users", user.uid, "links");
    const linksQuery = query(linksRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      linksQuery,
      (snapshot) => {
        const nextLinks = snapshot.docs.map((docSnapshot) => ({
          id: docSnapshot.id,
          ...docSnapshot.data(),
        }));

        setLinks(nextLinks);
      },
      (snapshotError) => {
        setError(snapshotError.message || "Failed to load links.");
      }
    );

    return () => unsubscribe();
  }, [user.uid]);

  useEffect(() => {
    const profileRef = doc(db, "users", user.uid, "profile", "settings");

    const unsubscribe = onSnapshot(
      profileRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();

          setProfile(data);
          setDisplayName(data.displayName || "");
          setWorkspaceName(data.workspaceName || "");
        }
      },
      (snapshotError) => {
        setError(snapshotError.message || "Failed to load profile.");
      }
    );

    return () => unsubscribe();
  }, [user.uid]);

  useEffect(() => {
    const activityRef = collection(db, "users", user.uid, "activity");
    const activityQuery = query(
      activityRef,
      orderBy("createdAt", "desc"),
      limit(10)
    );

    const unsubscribe = onSnapshot(
      activityQuery,
      (snapshot) => {
        const nextActivities = snapshot.docs.map((docSnapshot) => ({
          id: docSnapshot.id,
          ...docSnapshot.data(),
        }));

        setActivities(nextActivities);
      },
      (snapshotError) => {
        setError(snapshotError.message || "Failed to load activity.");
      }
    );

    return () => unsubscribe();
  }, [user.uid]);

  const filteredFiles = sortItems(
    files.filter((file) => {
      const fileName = file.fileName || "";
      const matchesSearch = fileName
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

      const matchesCategory =
        categoryFilter === "All" || file.category === categoryFilter;

      const matchesImportant = !fileImportantOnly || file.isImportant;

      return matchesSearch && matchesCategory && matchesImportant;
    }),
    fileSort,
    "fileName"
  );

  const filteredNotes = sortItems(
    notes.filter((note) => {
      const title = note.title || "";
      const body = note.body || "";

      const matchesSearch =
        title.toLowerCase().includes(noteSearchTerm.toLowerCase()) ||
        body.toLowerCase().includes(noteSearchTerm.toLowerCase());

      const matchesImportant = !noteImportantOnly || note.isImportant;

      return matchesSearch && matchesImportant;
    }),
    noteSort,
    "title"
  );

  const filteredLinks = sortItems(
    links.filter((link) => {
      const title = link.title || "";
      const url = link.url || "";

      const matchesSearch =
        title.toLowerCase().includes(linkSearchTerm.toLowerCase()) ||
        url.toLowerCase().includes(linkSearchTerm.toLowerCase());

      const matchesCategory =
        linkCategoryFilter === "All" || link.category === linkCategoryFilter;

      const matchesImportant = !linkImportantOnly || link.isImportant;

      return matchesSearch && matchesCategory && matchesImportant;
    }),
    linkSort,
    "title"
  );

  const totalStorageBytes = files.reduce((total, file) => {
    return total + (file.fileSize || 0);
  }, 0);

  const importantFiles = files.filter((file) => file.isImportant);
  const importantNotes = notes.filter((note) => note.isImportant);
  const importantLinks = links.filter((link) => link.isImportant);
  const importantCount =
    importantFiles.length + importantNotes.length + importantLinks.length;

  const latestFiles = files.slice(0, 3);
  const latestNotes = notes.slice(0, 3);
  const latestLinks = links.slice(0, 3);

  async function handleLogout() {
    await signOut(auth);
  }

  async function handleSendVerificationEmail() {
    setError("");
    setSuccessMessage("");
    setSendingVerification(true);

    try {
      await sendEmailVerification(user);
      setSuccessMessage("Verification email sent. Please check your inbox or spam folder.");

      await logActivity(
        "verification_email_sent",
        "account",
        "Sent verification email"
      );
    } catch (err) {
      setError(err.message || "Failed to send verification email.");
    } finally {
      setSendingVerification(false);
    }
  }

  async function logActivity(action, itemType, message) {
    try {
      await addDoc(collection(db, "users", user.uid, "activity"), {
        action,
        itemType,
        message,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn("Failed to write activity log", err);
    }
  }

  async function handleSaveProfile(event) {
    event.preventDefault();

    if (!displayName.trim()) {
      setError("Please enter a display name.");
      return;
    }

    if (!workspaceName.trim()) {
      setError("Please enter a workspace name.");
      return;
    }

    setError("");
    setSavingProfile(true);

    try {
      await setDoc(
        doc(db, "users", user.uid, "profile", "settings"),
        {
          displayName: displayName.trim(),
          workspaceName: workspaceName.trim(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      await logActivity("profile_updated", "profile", "Updated profile settings");
    } catch (err) {
      setError(err.message || "Failed to save profile.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleToggleImportant(collectionName, item) {
    const importantKey = `${collectionName}-${item.id}`;

    setError("");
    setUpdatingImportantId(importantKey);

    try {
      const nextImportantState = !item.isImportant;

      await updateDoc(doc(db, "users", user.uid, collectionName, item.id), {
        isImportant: nextImportantState,
        updatedAt: serverTimestamp(),
      });

      await logActivity(
        nextImportantState ? "item_marked_important" : "item_unmarked_important",
        collectionName.slice(0, -1),
        nextImportantState ? "Marked an item as important" : "Unmarked an item as important"
      );
    } catch (err) {
      setError(err.message || "Failed to update important status.");
    } finally {
      setUpdatingImportantId("");
    }
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0];

    setError("");
    setUploadProgress(0);

    if (!file) {
      setSelectedFile(null);
      return;
    }

    const maxSizeMb = 10;
    const maxSizeBytes = maxSizeMb * 1024 * 1024;
    const extension = getFileExtension(file.name);

    if (file.size > maxSizeBytes) {
      setError(`File is too large. Please upload files under ${maxSizeMb}MB.`);
      setSelectedFile(null);
      event.target.value = "";
      return;
    }

    if (blockedExtensions.includes(extension)) {
      setError(
        `${extension} files are blocked in LifeHub Documents. Use the future encrypted Vault feature for secrets/config files.`
      );
      setSelectedFile(null);
      event.target.value = "";
      return;
    }

    if (!allowedExtensions.includes(extension)) {
      setError(`Unsupported file type. Allowed: ${allowedExtensions.join(", ")}`);
      setSelectedFile(null);
      event.target.value = "";
      return;
    }

    setSelectedFile(file);
  }

  async function handleUpload(event) {
    event.preventDefault();

    if (!selectedFile) {
      setError("Please choose a file first.");
      return;
    }

    setError("");
    setUploading(true);
    setUploadProgress(0);

    try {
      const safeName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const fileId = crypto.randomUUID();
      const storagePath = `users/${user.uid}/files/${fileId}-${safeName}`;
      const storageRef = ref(storage, storagePath);

      const uploadTask = uploadBytesResumable(storageRef, selectedFile, {
        contentType: selectedFile.type || "application/octet-stream",
      });

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress =
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100;

          setUploadProgress(Math.round(progress));
        },
        (uploadError) => {
          setError(uploadError.message || "Upload failed.");
          setUploading(false);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

          await addDoc(collection(db, "users", user.uid, "files"), {
            fileName: selectedFile.name,
            fileType: selectedFile.type || "unknown",
            fileSize: selectedFile.size,
            category,
            storagePath,
            downloadURL,
            isImportant: false,
            createdAt: serverTimestamp(),
          });

          await logActivity("file_uploaded", "file", "Uploaded a file");

          setSelectedFile(null);
          setUploadProgress(0);
          setUploading(false);
        }
      );
    } catch (err) {
      setError(err.message || "Upload failed.");
      setUploading(false);
    }
  }

  async function handleDeleteFile(file) {
    const confirmed = window.confirm(`Delete "${file.fileName}"?`);

    if (!confirmed) return;

    setError("");
    setDeletingFileId(file.id);

    try {
      const fileStorageRef = ref(storage, file.storagePath);

      await deleteObject(fileStorageRef);
      await deleteDoc(doc(db, "users", user.uid, "files", file.id));
      await logActivity("file_deleted", "file", "Deleted a file");
    } catch (err) {
      setError(err.message || "Failed to delete file.");
    } finally {
      setDeletingFileId("");
    }
  }

  async function handleCreateNote(event) {
    event.preventDefault();

    if (!noteTitle.trim()) {
      setError("Please enter a note title.");
      return;
    }

    if (!noteBody.trim()) {
      setError("Please enter note content.");
      return;
    }

    setError("");
    setSavingNote(true);

    try {
      await addDoc(collection(db, "users", user.uid, "notes"), {
        title: noteTitle.trim(),
        body: noteBody.trim(),
        isImportant: false,
        createdAt: serverTimestamp(),
      });

      await logActivity("note_created", "note", "Created a note");

      setNoteTitle("");
      setNoteBody("");
    } catch (err) {
      setError(err.message || "Failed to save note.");
    } finally {
      setSavingNote(false);
    }
  }

  function startEditNote(note) {
    setEditingNoteId(note.id);
    setEditingNoteTitle(note.title || "");
    setEditingNoteBody(note.body || "");
    setError("");
  }

  function cancelEditNote() {
    setEditingNoteId("");
    setEditingNoteTitle("");
    setEditingNoteBody("");
  }

  async function handleUpdateNote(event) {
    event.preventDefault();

    if (!editingNoteTitle.trim()) {
      setError("Please enter a note title.");
      return;
    }

    if (!editingNoteBody.trim()) {
      setError("Please enter note content.");
      return;
    }

    setError("");
    setUpdatingNote(true);

    try {
      await updateDoc(doc(db, "users", user.uid, "notes", editingNoteId), {
        title: editingNoteTitle.trim(),
        body: editingNoteBody.trim(),
        updatedAt: serverTimestamp(),
      });

      await logActivity("note_updated", "note", "Updated a note");

      cancelEditNote();
    } catch (err) {
      setError(err.message || "Failed to update note.");
    } finally {
      setUpdatingNote(false);
    }
  }

  async function handleDeleteNote(note) {
    const confirmed = window.confirm(`Delete note "${note.title}"?`);

    if (!confirmed) return;

    setError("");
    setDeletingNoteId(note.id);

    try {
      await deleteDoc(doc(db, "users", user.uid, "notes", note.id));
      await logActivity("note_deleted", "note", "Deleted a note");
    } catch (err) {
      setError(err.message || "Failed to delete note.");
    } finally {
      setDeletingNoteId("");
    }
  }

  async function handleCreateLink(event) {
    event.preventDefault();

    if (!linkTitle.trim()) {
      setError("Please enter a link title.");
      return;
    }

    if (!linkUrl.trim()) {
      setError("Please enter a link URL.");
      return;
    }

    if (!isValidUrl(linkUrl)) {
      setError("Please enter a valid URL.");
      return;
    }

    setError("");
    setSavingLink(true);

    try {
      const normalizedUrl = normalizeUrl(linkUrl);

      await addDoc(collection(db, "users", user.uid, "links"), {
        title: linkTitle.trim(),
        url: normalizedUrl,
        category: linkCategory,
        isImportant: false,
        createdAt: serverTimestamp(),
      });

      await logActivity("link_created", "link", "Created a link");

      setLinkTitle("");
      setLinkUrl("");
      setLinkCategory("General");
    } catch (err) {
      setError(err.message || "Failed to save link.");
    } finally {
      setSavingLink(false);
    }
  }

  function startEditLink(link) {
    setEditingLinkId(link.id);
    setEditingLinkTitle(link.title || "");
    setEditingLinkUrl(link.url || "");
    setEditingLinkCategory(link.category || "General");
    setError("");
  }

  function cancelEditLink() {
    setEditingLinkId("");
    setEditingLinkTitle("");
    setEditingLinkUrl("");
    setEditingLinkCategory("General");
  }

  async function handleUpdateLink(event) {
    event.preventDefault();

    if (!editingLinkTitle.trim()) {
      setError("Please enter a link title.");
      return;
    }

    if (!editingLinkUrl.trim()) {
      setError("Please enter a link URL.");
      return;
    }

    if (!isValidUrl(editingLinkUrl)) {
      setError("Please enter a valid URL.");
      return;
    }

    setError("");
    setUpdatingLink(true);

    try {
      const normalizedUrl = normalizeUrl(editingLinkUrl);

      await updateDoc(doc(db, "users", user.uid, "links", editingLinkId), {
        title: editingLinkTitle.trim(),
        url: normalizedUrl,
        category: editingLinkCategory,
        updatedAt: serverTimestamp(),
      });

      await logActivity("link_updated", "link", "Updated a link");

      cancelEditLink();
    } catch (err) {
      setError(err.message || "Failed to update link.");
    } finally {
      setUpdatingLink(false);
    }
  }

  async function handleDeleteLink(link) {
    const confirmed = window.confirm(`Delete link "${link.title}"?`);

    if (!confirmed) return;

    setError("");
    setDeletingLinkId(link.id);

    try {
      await deleteDoc(doc(db, "users", user.uid, "links", link.id));
      await logActivity("link_deleted", "link", "Deleted a link");
    } catch (err) {
      setError(err.message || "Failed to delete link.");
    } finally {
      setDeletingLinkId("");
    }
  }

  function openView(viewName) {
    setActiveView(viewName);
    setError("");
    setSuccessMessage("");
  }

  return (
    <main className="dashboard-page">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">LifeHub</p>
          <h2>AI Cloud</h2>
        </div>

        <nav className="sidebar-nav">
          <button
            className={activeView === "dashboard" ? "nav-item active" : "nav-item"}
            type="button"
            onClick={() => openView("dashboard")}
          >
            <span>🏠</span>
            Dashboard
          </button>

          <button
            className={activeView === "files" ? "nav-item active" : "nav-item"}
            type="button"
            onClick={() => openView("files")}
          >
            <span>📁</span>
            Files
          </button>

          <button
            className={activeView === "notes" ? "nav-item active" : "nav-item"}
            type="button"
            onClick={() => openView("notes")}
          >
            <span>📝</span>
            Notes
          </button>

          <button
            className={activeView === "links" ? "nav-item active" : "nav-item"}
            type="button"
            onClick={() => openView("links")}
          >
            <span>🔗</span>
            Links
          </button>

          <button
            className={activeView === "settings" ? "nav-item active" : "nav-item"}
            type="button"
            onClick={() => openView("settings")}
          >
            <span>⚙️</span>
            Settings
          </button>
        </nav>

        <button className="logout-button" type="button" onClick={handleLogout}>
          Logout
        </button>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">
              Welcome back{profile?.displayName ? `, ${profile.displayName}` : ""}
            </p>
            <h1>
              {activeView === "dashboard" &&
                (profile?.workspaceName || "Your LifeHub Dashboard")}
              {activeView === "files" && "Files"}
              {activeView === "notes" && "Notes"}
              {activeView === "links" && "Links"}
              {activeView === "settings" && "Settings"}
            </h1>
            <p className="muted">
              {activeView === "dashboard" &&
                "Manage your personal files, notes, links, and important life records."}
              {activeView === "files" &&
                "Upload, organize, search, and manage your personal documents."}
              {activeView === "notes" &&
                "Save private notes, reminders, checklists, and personal records."}
              {activeView === "links" &&
                "Save useful websites, tools, school resources, and portfolio references."}
              {activeView === "settings" &&
                "Manage your account, usage, security, and LifeHub preferences."}
            </p>
          </div>

          <div className="profile-pill">
            <span>
              {(profile?.displayName || user.email || "U").charAt(0).toUpperCase()}
            </span>
            <div>
              <p className="profile-label">Signed in as</p>
              <strong>{profile?.displayName || user.email}</strong>
            </div>
          </div>
        </header>

        {error && <p className="global-error">{error}</p>}
        {successMessage && <p className="global-success">{successMessage}</p>}

        {!user.emailVerified && (
          <section className="verification-banner">
            <div>
              <strong>Email not verified</strong>
              <p>
                Verify your email address to improve account trust and prepare your
                LifeHub workspace for future security features.
              </p>
            </div>

            <button
              type="button"
              className="secondary-button"
              disabled={sendingVerification}
              onClick={handleSendVerificationEmail}
            >
              {sendingVerification ? "Sending..." : "Send verification email"}
            </button>
          </section>
        )}

        {activeView === "dashboard" && (
          <>
            <section className="dashboard-grid">
              <article className="stat-card">
                <p className="muted">Files</p>
                <h2>{files.length}</h2>
                <p className="muted">Uploaded personal files and documents.</p>
              </article>

              <article className="stat-card">
                <p className="muted">Notes</p>
                <h2>{notes.length}</h2>
                <p className="muted">Private notes saved in your LifeHub.</p>
              </article>

              <article className="stat-card">
                <p className="muted">Links</p>
                <h2>{links.length}</h2>
                <p className="muted">Saved websites and resources.</p>
              </article>

              <article className="stat-card">
                <p className="muted">Important</p>
                <h2>{importantCount}</h2>
                <p className="muted">Pinned files, notes, and links.</p>
              </article>

              <article className="stat-card">
                <p className="muted">Activity</p>
                <h2>{activities.length}</h2>
                <p className="muted">Latest safe audit log entries.</p>
              </article>

              <article className="stat-card">
                <p className="muted">Storage used</p>
                <h2>{formatBytes(totalStorageBytes)}</h2>
                <p className="muted">Total size of your uploaded files.</p>
              </article>
            </section>

            <section className="quick-actions-card">
              <div>
                <p className="eyebrow">Quick actions</p>
                <h2>What do you want to do next?</h2>
                <p className="muted">
                  Jump directly into the most common LifeHub tasks.
                </p>
              </div>

              <div className="quick-actions-grid">
                <button type="button" onClick={() => openView("files")}>
                  <strong>📁 Upload file</strong>
                  <span>Store a document or image</span>
                </button>

                <button type="button" onClick={() => openView("notes")}>
                  <strong>📝 Create note</strong>
                  <span>Save a private note</span>
                </button>

                <button type="button" onClick={() => openView("links")}>
                  <strong>🔗 Save link</strong>
                  <span>Bookmark a useful resource</span>
                </button>
              </div>
            </section>

            <section className="overview-card activity-card">
              <div className="section-title">
                <div>
                  <h2>Recent activity</h2>
                  <p className="muted">
                    Safe audit log. Only generic activity is stored.
                  </p>
                </div>
              </div>

              {activities.length === 0 ? (
                <div className="empty-state">
                  <strong>No activity yet</strong>
                  <p className="muted">
                    Upload a file, create a note, save a link, or mark something
                    important. Your safe activity history will appear here.
                  </p>
                </div>
              ) : (
                <div className="activity-list">
                  {activities.map((activity) => (
                    <div className="activity-item" key={activity.id}>
                      <span>{activity.itemType}</span>
                      <div>
                        <strong>{activity.message}</strong>
                        <p className="meta-text">{formatDate(activity.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="overview-card important-overview">
              <div className="section-title">
                <div>
                  <h2>Important items</h2>
                  <p className="muted">Pinned files, notes, and links you care about most</p>
                </div>
              </div>

              {importantCount === 0 ? (
                <div className="empty-state">
                  <strong>No important items yet</strong>
                  <p className="muted">
                    Use the Mark important button on files, notes, or links to pin
                    the things you care about most.
                  </p>
                </div>
              ) : (
                <div className="important-grid">
                  <div>
                    <h3>Files</h3>
                    {importantFiles.length === 0 ? (
                      <p className="muted">No important files.</p>
                    ) : (
                      <div className="compact-list">
                        {importantFiles.slice(0, 3).map((file) => (
                          <a
                            href={file.downloadURL}
                            target="_blank"
                            rel="noreferrer"
                            key={file.id}
                          >
                            <strong>★ {file.fileName}</strong>
                            <span>
                              {file.category} · {formatBytes(file.fileSize)}
                            </span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <h3>Notes</h3>
                    {importantNotes.length === 0 ? (
                      <p className="muted">No important notes.</p>
                    ) : (
                      <div className="compact-list">
                        {importantNotes.slice(0, 3).map((note) => (
                          <button
                            type="button"
                            key={note.id}
                            onClick={() => openView("notes")}
                          >
                            <strong>★ {note.title}</strong>
                            <span>{note.body.slice(0, 80)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <h3>Links</h3>
                    {importantLinks.length === 0 ? (
                      <p className="muted">No important links.</p>
                    ) : (
                      <div className="compact-list">
                        {importantLinks.slice(0, 3).map((link) => (
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noreferrer"
                            key={link.id}
                          >
                            <strong>★ {link.title}</strong>
                            <span>
                              {link.category} · {getDisplayDomain(link.url)}
                            </span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>

            <section className="overview-grid">
              <article className="overview-card">
                <div className="section-title">
                  <div>
                    <h2>Recent files</h2>
                    <p className="muted">Latest uploaded documents</p>
                  </div>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => openView("files")}
                  >
                    View files
                  </button>
                </div>

                {latestFiles.length === 0 ? (
                  <p className="muted">No files uploaded yet.</p>
                ) : (
                  <div className="compact-list">
                    {latestFiles.map((file) => (
                      <a
                        href={file.downloadURL}
                        target="_blank"
                        rel="noreferrer"
                        key={file.id}
                      >
                        <strong>
                          {file.isImportant ? "★ " : ""}
                          {file.fileName}
                        </strong>
                        <span>
                          {file.category} · {formatBytes(file.fileSize)} · Uploaded{" "}
                          {formatDate(file.createdAt)}
                        </span>
                      </a>
                    ))}
                  </div>
                )}
              </article>

              <article className="overview-card">
                <div className="section-title">
                  <div>
                    <h2>Recent notes</h2>
                    <p className="muted">Latest private notes</p>
                  </div>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => openView("notes")}
                  >
                    View notes
                  </button>
                </div>

                {latestNotes.length === 0 ? (
                  <p className="muted">No notes yet.</p>
                ) : (
                  <div className="compact-list">
                    {latestNotes.map((note) => (
                      <button
                        type="button"
                        key={note.id}
                        onClick={() => openView("notes")}
                      >
                        <strong>
                          {note.isImportant ? "★ " : ""}
                          {note.title}
                        </strong>
                        <span>
                          {note.body.slice(0, 80)} · {getUpdatedOrCreatedLabel(note)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </article>

              <article className="overview-card">
                <div className="section-title">
                  <div>
                    <h2>Recent links</h2>
                    <p className="muted">Latest saved resources</p>
                  </div>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => openView("links")}
                  >
                    View links
                  </button>
                </div>

                {latestLinks.length === 0 ? (
                  <p className="muted">No links saved yet.</p>
                ) : (
                  <div className="compact-list">
                    {latestLinks.map((link) => (
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        key={link.id}
                      >
                        <strong>
                          {link.isImportant ? "★ " : ""}
                          {link.title}
                        </strong>
                        <span>
                          {link.category} · {getDisplayDomain(link.url)} ·{" "}
                          {getUpdatedOrCreatedLabel(link)}
                        </span>
                      </a>
                    ))}
                  </div>
                )}
              </article>
            </section>
          </>
        )}

        {activeView === "files" && (
          <>
            <section className="upload-card">
              <div>
                <h2>Upload a file</h2>
                <p className="muted">
                  Store documents, images, certificates, receipts, and personal
                  records.
                </p>
              </div>

              <form className="upload-form" onSubmit={handleUpload}>
                <label>
                  Category
                  <select
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                  >
                    {categories.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>

                <label>
                  File
                  <input
                    type="file"
                    accept={allowedExtensions.join(",")}
                    onChange={handleFileChange}
                  />
                </label>

                <p className="helper-text">
                  Allowed: PDF, images, text, Markdown, Word, Excel, and
                  PowerPoint files. Secret/config/code files like .env, .pem,
                  .key, .json, .js, .py, and .conf are blocked for now.
                </p>

                {selectedFile && (
                  <p className="muted">
                    Selected: <strong>{selectedFile.name}</strong>{" "}
                    ({formatBytes(selectedFile.size)})
                  </p>
                )}

                {uploading && (
                  <div className="progress">
                    <div style={{ width: `${uploadProgress}%` }} />
                  </div>
                )}

                {uploading && (
                  <p className="muted">Uploading {uploadProgress}%</p>
                )}

                <button type="submit" disabled={uploading}>
                  {uploading ? "Uploading..." : "Upload file"}
                </button>
              </form>
            </section>

            <section className="files-card">
              <div className="section-title">
                <div>
                  <h2>File library</h2>
                  <p className="muted">
                    Showing {filteredFiles.length} of {files.length} file(s)
                  </p>
                </div>
              </div>

              <div className="library-controls">
                <div className="file-toolbar">
                  <input
                    type="search"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search by file name..."
                  />

                  <select
                    value={fileSort}
                    onChange={(event) => setFileSort(event.target.value)}
                  >
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                    <option value="name">Name A-Z</option>
                    <option value="size">Largest size</option>
                  </select>
                </div>

                <div className="filter-chip-row">
                  <button
                    type="button"
                    className={categoryFilter === "All" ? "filter-chip active" : "filter-chip"}
                    onClick={() => setCategoryFilter("All")}
                  >
                    All
                  </button>

                  {categories.map((item) => (
                    <button
                      type="button"
                      key={item}
                      className={categoryFilter === item ? "filter-chip active" : "filter-chip"}
                      onClick={() => setCategoryFilter(item)}
                    >
                      {item}
                    </button>
                  ))}

                  <button
                    type="button"
                    className={fileImportantOnly ? "filter-chip active important-filter" : "filter-chip important-filter"}
                    onClick={() => setFileImportantOnly((current) => !current)}
                  >
                    ★ Important only
                  </button>
                </div>
              </div>

              {files.length === 0 ? (
                <div className="empty-state">
                  <strong>No files uploaded yet</strong>
                  <p className="muted">
                    Upload documents, images, receipts, certificates, or school files
                    to start building your LifeHub library.
                  </p>
                </div>
              ) : filteredFiles.length === 0 ? (
                <div className="empty-state">
                  <strong>No files match your controls</strong>
                  <p className="muted">
                    Try changing the search text, category chip, important filter,
                    or sort option.
                  </p>
                </div>
              ) : (
                <div className="file-list">
                  {filteredFiles.map((file) => (
                    <div className="file-row" key={file.id}>
                      <a
                        className="file-link"
                        href={file.downloadURL}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <div>
                          <strong>
                            {file.isImportant ? "★ " : ""}
                            {file.fileName}
                          </strong>
                          <p className="muted">
                            {file.category} · {formatBytes(file.fileSize)}
                          </p>
                          <p className="meta-text">
                            Uploaded {formatDate(file.createdAt)}
                          </p>
                        </div>

                        <span>Open</span>
                      </a>

                      <div className="action-row">
                        <button
                          type="button"
                          className={
                            file.isImportant
                              ? "important-button active"
                              : "important-button"
                          }
                          disabled={updatingImportantId === `files-${file.id}`}
                          onClick={() => handleToggleImportant("files", file)}
                        >
                          {file.isImportant ? "Unmark important" : "Mark important"}
                        </button>

                        <button
                          type="button"
                          className="danger-button"
                          disabled={deletingFileId === file.id}
                          onClick={() => handleDeleteFile(file)}
                        >
                          {deletingFileId === file.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {activeView === "notes" && (
          <section className="notes-card">
            <div className="section-title">
              <div>
                <h2>Notes</h2>
                <p className="muted">
                  Showing {filteredNotes.length} of {notes.length} note(s)
                </p>
              </div>
            </div>

            <form className="note-form" onSubmit={handleCreateNote}>
              <label>
                Note title
                <input
                  type="text"
                  value={noteTitle}
                  onChange={(event) => setNoteTitle(event.target.value)}
                  placeholder="Example: Visa renewal checklist"
                />
              </label>

              <label>
                Note content
                <textarea
                  value={noteBody}
                  onChange={(event) => setNoteBody(event.target.value)}
                  placeholder="Write your private note..."
                  rows="5"
                />
              </label>

              <button type="submit" disabled={savingNote}>
                {savingNote ? "Saving..." : "Save note"}
              </button>
            </form>

            <div className="library-controls notes-controls">
              <div className="file-toolbar">
                <input
                  type="search"
                  value={noteSearchTerm}
                  onChange={(event) => setNoteSearchTerm(event.target.value)}
                  placeholder="Search by title or content..."
                />

                <select
                  value={noteSort}
                  onChange={(event) => setNoteSort(event.target.value)}
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="title">Title A-Z</option>
                </select>
              </div>

              <div className="filter-chip-row">
                <button
                  type="button"
                  className={noteImportantOnly ? "filter-chip active important-filter" : "filter-chip important-filter"}
                  onClick={() => setNoteImportantOnly((current) => !current)}
                >
                  ★ Important only
                </button>
              </div>
            </div>

            {notes.length === 0 ? (
              <div className="empty-state">
                <strong>No notes yet</strong>
                <p className="muted">
                  Create your first private note for reminders, checklists,
                  school tasks, or personal records.
                </p>
              </div>
            ) : filteredNotes.length === 0 ? (
              <div className="empty-state">
                <strong>No notes match your controls</strong>
                <p className="muted">
                  Try changing your search, important filter, or sort option.
                </p>
              </div>
            ) : (
              <div className="note-list">
                {filteredNotes.map((note) => (
                  <article className="note-item" key={note.id}>
                    {editingNoteId === note.id ? (
                      <form className="edit-form" onSubmit={handleUpdateNote}>
                        <label>
                          Edit title
                          <input
                            type="text"
                            value={editingNoteTitle}
                            onChange={(event) =>
                              setEditingNoteTitle(event.target.value)
                            }
                          />
                        </label>

                        <label>
                          Edit content
                          <textarea
                            value={editingNoteBody}
                            onChange={(event) =>
                              setEditingNoteBody(event.target.value)
                            }
                            rows="5"
                          />
                        </label>

                        <div className="action-row">
                          <button type="submit" disabled={updatingNote}>
                            {updatingNote ? "Saving..." : "Save changes"}
                          </button>

                          <button
                            type="button"
                            className="secondary-button"
                            onClick={cancelEditNote}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div>
                          <h3>
                            {note.isImportant ? "★ " : ""}
                            {note.title}
                          </h3>
                          <p>{note.body}</p>
                          <p className="meta-text">
                            {getUpdatedOrCreatedLabel(note)}
                          </p>
                        </div>

                        <div className="action-row">
                          <button
                            type="button"
                            className={
                              note.isImportant
                                ? "important-button active"
                                : "important-button"
                            }
                            disabled={updatingImportantId === `notes-${note.id}`}
                            onClick={() => handleToggleImportant("notes", note)}
                          >
                            {note.isImportant ? "Unmark important" : "Mark important"}
                          </button>

                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => startEditNote(note)}
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            className="danger-button"
                            disabled={deletingNoteId === note.id}
                            onClick={() => handleDeleteNote(note)}
                          >
                            {deletingNoteId === note.id
                              ? "Deleting..."
                              : "Delete"}
                          </button>
                        </div>
                      </>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {activeView === "links" && (
          <>
            <section className="links-card">
              <div className="section-title">
                <div>
                  <h2>Save a link</h2>
                  <p className="muted">
                    Save useful websites, resources, tools, school pages, and
                    portfolio references.
                  </p>
                </div>
              </div>

              <form className="link-form" onSubmit={handleCreateLink}>
                <label>
                  Link title
                  <input
                    type="text"
                    value={linkTitle}
                    onChange={(event) => setLinkTitle(event.target.value)}
                    placeholder="Example: AWS Documentation"
                  />
                </label>

                <label>
                  URL
                  <input
                    type="url"
                    value={linkUrl}
                    onChange={(event) => setLinkUrl(event.target.value)}
                    placeholder="https://example.com"
                  />
                </label>

                <label>
                  Category
                  <select
                    value={linkCategory}
                    onChange={(event) => setLinkCategory(event.target.value)}
                  >
                    {linkCategories.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>

                <button type="submit" disabled={savingLink}>
                  {savingLink ? "Saving..." : "Save link"}
                </button>
              </form>
            </section>

            <section className="links-card">
              <div className="section-title">
                <div>
                  <h2>Link library</h2>
                  <p className="muted">
                    Showing {filteredLinks.length} of {links.length} link(s)
                  </p>
                </div>
              </div>

              <div className="library-controls">
                <div className="file-toolbar">
                  <input
                    type="search"
                    value={linkSearchTerm}
                    onChange={(event) => setLinkSearchTerm(event.target.value)}
                    placeholder="Search by title or URL..."
                  />

                  <select
                    value={linkSort}
                    onChange={(event) => setLinkSort(event.target.value)}
                  >
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                    <option value="title">Title A-Z</option>
                  </select>
                </div>

                <div className="filter-chip-row">
                  <button
                    type="button"
                    className={linkCategoryFilter === "All" ? "filter-chip active" : "filter-chip"}
                    onClick={() => setLinkCategoryFilter("All")}
                  >
                    All
                  </button>

                  {linkCategories.map((item) => (
                    <button
                      type="button"
                      key={item}
                      className={linkCategoryFilter === item ? "filter-chip active" : "filter-chip"}
                      onClick={() => setLinkCategoryFilter(item)}
                    >
                      {item}
                    </button>
                  ))}

                  <button
                    type="button"
                    className={linkImportantOnly ? "filter-chip active important-filter" : "filter-chip important-filter"}
                    onClick={() => setLinkImportantOnly((current) => !current)}
                  >
                    ★ Important only
                  </button>
                </div>
              </div>

              {links.length === 0 ? (
                <div className="empty-state">
                  <strong>No links saved yet</strong>
                  <p className="muted">
                    Save documentation, tools, learning resources, school pages,
                    or portfolio references.
                  </p>
                </div>
              ) : filteredLinks.length === 0 ? (
                <div className="empty-state">
                  <strong>No links match your controls</strong>
                  <p className="muted">
                    Try changing your search text, category chip, important filter,
                    or sort option.
                  </p>
                </div>
              ) : (
                <div className="link-list">
                  {filteredLinks.map((link) => (
                    <article className="link-item" key={link.id}>
                      {editingLinkId === link.id ? (
                        <form className="edit-form" onSubmit={handleUpdateLink}>
                          <label>
                            Edit title
                            <input
                              type="text"
                              value={editingLinkTitle}
                              onChange={(event) =>
                                setEditingLinkTitle(event.target.value)
                              }
                            />
                          </label>

                          <label>
                            Edit URL
                            <input
                              type="url"
                              value={editingLinkUrl}
                              onChange={(event) =>
                                setEditingLinkUrl(event.target.value)
                              }
                            />
                          </label>

                          <label>
                            Edit category
                            <select
                              value={editingLinkCategory}
                              onChange={(event) =>
                                setEditingLinkCategory(event.target.value)
                              }
                            >
                              {linkCategories.map((item) => (
                                <option key={item}>{item}</option>
                              ))}
                            </select>
                          </label>

                          <div className="action-row">
                            <button type="submit" disabled={updatingLink}>
                              {updatingLink ? "Saving..." : "Save changes"}
                            </button>

                            <button
                              type="button"
                              className="secondary-button"
                              onClick={cancelEditLink}
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : (
                        <>
                          <a href={link.url} target="_blank" rel="noreferrer">
                            <strong>
                              {link.isImportant ? "★ " : ""}
                              {link.title}
                            </strong>
                            <span>{getDisplayDomain(link.url)}</span>
                            <p>{link.category}</p>
                            <p className="meta-text">
                              {getUpdatedOrCreatedLabel(link)}
                            </p>
                          </a>

                          <div className="action-row">
                            <button
                              type="button"
                              className={
                                link.isImportant
                                  ? "important-button active"
                                  : "important-button"
                              }
                              disabled={updatingImportantId === `links-${link.id}`}
                              onClick={() => handleToggleImportant("links", link)}
                            >
                              {link.isImportant ? "Unmark important" : "Mark important"}
                            </button>

                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => startEditLink(link)}
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              className="danger-button"
                              disabled={deletingLinkId === link.id}
                              onClick={() => handleDeleteLink(link)}
                            >
                              {deletingLinkId === link.id
                                ? "Deleting..."
                                : "Delete"}
                            </button>
                          </div>
                        </>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {activeView === "settings" && (
          <section className="settings-page">
            <section className="settings-grid">
              <article className="settings-card">
                <p className="eyebrow">Account</p>
                <h2>Profile</h2>

                <form className="profile-form" onSubmit={handleSaveProfile}>
                  <label>
                    Display name
                    <input
                      type="text"
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                      placeholder="Example: Henry"
                    />
                  </label>

                  <label>
                    Workspace name
                    <input
                      type="text"
                      value={workspaceName}
                      onChange={(event) => setWorkspaceName(event.target.value)}
                      placeholder="Example: Henry's LifeHub"
                    />
                  </label>

                  <button type="submit" disabled={savingProfile}>
                    {savingProfile ? "Saving..." : "Save profile"}
                  </button>
                </form>

                <div className="settings-row">
                  <span>Email</span>
                  <strong>{user.email}</strong>
                </div>

                <div className="settings-row">
                  <span>Email verification</span>
                  <strong className={user.emailVerified ? "verified-text" : "unverified-text"}>
                    {user.emailVerified ? "Verified" : "Not verified"}
                  </strong>

                  {!user.emailVerified && (
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={sendingVerification}
                      onClick={handleSendVerificationEmail}
                    >
                      {sendingVerification ? "Sending..." : "Send verification email"}
                    </button>
                  )}
                </div>

                <div className="settings-row">
                  <span>User ID</span>
                  <strong className="mono-text">{user.uid}</strong>
                </div>

                <div className="settings-row">
                  <span>Plan</span>
                  <strong>Free</strong>
                </div>
              </article>

              <article className="settings-card">
                <p className="eyebrow">Usage</p>
                <h2>LifeHub storage</h2>

                <div className="usage-grid">
                  <div>
                    <span>Files</span>
                    <strong>{files.length}</strong>
                  </div>

                  <div>
                    <span>Notes</span>
                    <strong>{notes.length}</strong>
                  </div>

                  <div>
                    <span>Links</span>
                    <strong>{links.length}</strong>
                  </div>

                  <div>
                    <span>Important</span>
                    <strong>{importantCount}</strong>
                  </div>

                  <div>
                    <span>Activity</span>
                    <strong>{activities.length}</strong>
                  </div>

                  <div>
                    <span>Storage</span>
                    <strong>{formatBytes(totalStorageBytes)}</strong>
                  </div>
                </div>
              </article>
            </section>

            <section className="settings-card">
              <p className="eyebrow">Security</p>
              <h2>Current protection</h2>

              <div className="security-list">
                <div>
                  <strong>Authentication required</strong>
                  <p className="muted">
                    Users must log in before accessing their files, notes, and links.
                  </p>
                </div>

                <div>
                  <strong>User-isolated data</strong>
                  <p className="muted">
                    Firestore and Storage rules isolate each user under their own user ID.
                  </p>
                </div>

                <div>
                  <strong>Safer document uploads</strong>
                  <p className="muted">
                    Secret/config/code file types are blocked in LifeHub Documents.
                  </p>
                </div>
              </div>
            </section>

            <section className="settings-card vault-card">
              <p className="eyebrow">Coming later</p>
              <h2>LifeHub Vault</h2>
              <p className="muted">
                A future encrypted Vault will support secret files, private keys,
                recovery codes, and sensitive documents with client-side encryption.
              </p>

              <div className="vault-features">
                <span>Client-side encryption</span>
                <span>Master password</span>
                <span>Encrypted metadata</span>
                <span>Audit history</span>
              </div>
            </section>

            <section className="settings-card danger-zone">
              <p className="eyebrow">Danger zone</p>
              <h2>Session</h2>
              <p className="muted">
                Log out from this browser. Your files, notes, and links will remain saved.
              </p>

              <button type="button" className="danger-button" onClick={handleLogout}>
                Logout
              </button>
            </section>
          </section>
        )}
      </section>
    </main>
  );
}

export default Dashboard;
