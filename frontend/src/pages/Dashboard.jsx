import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
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

function Dashboard({ user }) {
  const [activeView, setActiveView] = useState("dashboard");

  const [files, setFiles] = useState([]);
  const [notes, setNotes] = useState([]);

  const [selectedFile, setSelectedFile] = useState(null);
  const [category, setCategory] = useState("Personal");
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");

  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");

  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [deletingFileId, setDeletingFileId] = useState("");
  const [deletingNoteId, setDeletingNoteId] = useState("");
  const [error, setError] = useState("");

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

  const filteredFiles = files.filter((file) => {
    const fileName = file.fileName || "";
    const matchesSearch = fileName
      .toLowerCase()
      .includes(searchTerm.toLowerCase());

    const matchesCategory =
      categoryFilter === "All" || file.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  const totalStorageBytes = files.reduce((total, file) => {
    return total + (file.fileSize || 0);
  }, 0);

  const latestFiles = files.slice(0, 3);
  const latestNotes = notes.slice(0, 3);

  async function handleLogout() {
    await signOut(auth);
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
            createdAt: serverTimestamp(),
          });

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
        createdAt: serverTimestamp(),
      });

      setNoteTitle("");
      setNoteBody("");
    } catch (err) {
      setError(err.message || "Failed to save note.");
    } finally {
      setSavingNote(false);
    }
  }

  async function handleDeleteNote(note) {
    const confirmed = window.confirm(`Delete note "${note.title}"?`);

    if (!confirmed) return;

    setError("");
    setDeletingNoteId(note.id);

    try {
      await deleteDoc(doc(db, "users", user.uid, "notes", note.id));
    } catch (err) {
      setError(err.message || "Failed to delete note.");
    } finally {
      setDeletingNoteId("");
    }
  }

  function openView(viewName) {
    setActiveView(viewName);
    setError("");
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
            Dashboard
          </button>

          <button
            className={activeView === "files" ? "nav-item active" : "nav-item"}
            type="button"
            onClick={() => openView("files")}
          >
            Files
          </button>

          <button
            className={activeView === "notes" ? "nav-item active" : "nav-item"}
            type="button"
            onClick={() => openView("notes")}
          >
            Notes
          </button>

          <button
            className={activeView === "links" ? "nav-item active" : "nav-item"}
            type="button"
            onClick={() => openView("links")}
          >
            Links
          </button>

          <button
            className={activeView === "settings" ? "nav-item active" : "nav-item"}
            type="button"
            onClick={() => openView("settings")}
          >
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
            <p className="eyebrow">Welcome back</p>
            <h1>
              {activeView === "dashboard" && "Your LifeHub Dashboard"}
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
                "Save useful links and resources in one place."}
              {activeView === "settings" &&
                "Manage your account and LifeHub preferences."}
            </p>
          </div>

          <div className="profile-pill">
            <span>{user.email?.charAt(0).toUpperCase()}</span>
            <div>
              <p className="profile-label">Signed in as</p>
              <strong>{user.email}</strong>
            </div>
          </div>
        </header>

        {error && <p className="global-error">{error}</p>}

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
                <p className="muted">Storage used</p>
                <h2>{formatBytes(totalStorageBytes)}</h2>
                <p className="muted">Total size of your uploaded files.</p>
              </article>
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
                        <strong>{file.fileName}</strong>
                        <span>
                          {file.category} · {formatBytes(file.fileSize)}
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
                        <strong>{note.title}</strong>
                        <span>{note.body.slice(0, 80)}</span>
                      </button>
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

              <div className="file-toolbar">
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search by file name..."
                />

                <select
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                >
                  <option>All</option>
                  {categories.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </div>

              {files.length === 0 ? (
                <p className="muted">No files uploaded yet.</p>
              ) : filteredFiles.length === 0 ? (
                <p className="muted">No files match your search or filter.</p>
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
                          <strong>{file.fileName}</strong>
                          <p className="muted">
                            {file.category} · {formatBytes(file.fileSize)}
                          </p>
                        </div>

                        <span>Open</span>
                      </a>

                      <button
                        type="button"
                        className="danger-button"
                        disabled={deletingFileId === file.id}
                        onClick={() => handleDeleteFile(file)}
                      >
                        {deletingFileId === file.id ? "Deleting..." : "Delete"}
                      </button>
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
                <p className="muted">{notes.length} note(s)</p>
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

            {notes.length === 0 ? (
              <p className="muted">No notes yet.</p>
            ) : (
              <div className="note-list">
                {notes.map((note) => (
                  <article className="note-item" key={note.id}>
                    <div>
                      <h3>{note.title}</h3>
                      <p>{note.body}</p>
                    </div>

                    <button
                      type="button"
                      className="danger-button"
                      disabled={deletingNoteId === note.id}
                      onClick={() => handleDeleteNote(note)}
                    >
                      {deletingNoteId === note.id ? "Deleting..." : "Delete"}
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {activeView === "links" && (
          <section className="empty-product-card">
            <h2>Links are coming next</h2>
            <p className="muted">
              This section will let users save important websites, resources,
              portfolio links, school links, documents, and references.
            </p>
            <button
              type="button"
              className="secondary-button"
              onClick={() => openView("dashboard")}
            >
              Back to dashboard
            </button>
          </section>
        )}

        {activeView === "settings" && (
          <section className="empty-product-card">
            <h2>Settings</h2>
            <p className="muted">
              Account settings, profile preferences, storage usage, and future
              security controls will live here.
            </p>
            <button
              type="button"
              className="secondary-button"
              onClick={() => openView("dashboard")}
            >
              Back to dashboard
            </button>
          </section>
        )}
      </section>
    </main>
  );
}

export default Dashboard;