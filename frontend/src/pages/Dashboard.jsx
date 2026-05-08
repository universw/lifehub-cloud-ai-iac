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

function formatBytes(bytes) {
  if (!bytes) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, index);

  return `${size.toFixed(1)} ${units[index]}`;
}

function Dashboard({ user }) {
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [category, setCategory] = useState("Personal");
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");

  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [deletingFileId, setDeletingFileId] = useState("");
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

  const filteredFiles = files.filter((file) => {
    const fileName = file.fileName || "";
    const matchesSearch = fileName
      .toLowerCase()
      .includes(searchTerm.toLowerCase());

    const matchesCategory =
      categoryFilter === "All" || file.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

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

    if (file.size > maxSizeBytes) {
      setError(`File is too large. Please upload files under ${maxSizeMb}MB.`);
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

  return (
    <main className="dashboard-page">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">LifeHub</p>
          <h2>AI Cloud</h2>
        </div>

        <nav className="sidebar-nav">
          <button className="nav-item active">Dashboard</button>
          <button className="nav-item">Files</button>
          <button className="nav-item">Notes</button>
          <button className="nav-item">Links</button>
          <button className="nav-item">Settings</button>
        </nav>

        <button className="logout-button" type="button" onClick={handleLogout}>
          Logout
        </button>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">Welcome back</p>
            <h1>Your LifeHub Dashboard</h1>
            <p className="muted">
              Manage your personal files, notes, links, and important life records.
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

        <section className="dashboard-grid">
          <article className="stat-card">
            <p className="muted">Files</p>
            <h2>{files.length}</h2>
            <p className="muted">Uploaded personal files and documents.</p>
          </article>

          <article className="stat-card">
            <p className="muted">Notes</p>
            <h2>0</h2>
            <p className="muted">Notes feature comes later.</p>
          </article>

          <article className="stat-card">
            <p className="muted">Links</p>
            <h2>0</h2>
            <p className="muted">Links feature comes later.</p>
          </article>
        </section>

        <section className="upload-card">
          <div>
            <h2>Upload a file</h2>
            <p className="muted">
              Store documents, images, certificates, receipts, and personal records.
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
              <input type="file" onChange={handleFileChange} />
            </label>

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

            {uploading && <p className="muted">Uploading {uploadProgress}%</p>}

            {error && <p className="error">{error}</p>}

            <button type="submit" disabled={uploading}>
              {uploading ? "Uploading..." : "Upload file"}
            </button>
          </form>
        </section>

        <section className="files-card">
          <div className="section-title">
            <div>
              <h2>Recent files</h2>
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
      </section>
    </main>
  );
}

export default Dashboard;