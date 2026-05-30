import { useEffect, useMemo, useRef, useState } from "react";
import {
  Cloud,
  CloudOff,
  Download,
  Edit3,
  FileText,
  Plus,
  Save,
  Search,
  Share2,
  Trash2,
  Upload,
  X
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import notesMark from "../assets/notes-mark.svg";
import { firebaseNotes } from "./firebase";

const STORAGE_KEY = "study-notes-organizer-react-v1";
const spring = { type: "spring", stiffness: 420, damping: 34 };
const softSpring = { type: "spring", stiffness: 240, damping: 28 };

const contentVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.24, ease: "easeOut" } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.16, ease: "easeIn" } }
};

function hoverMotion(reduceMotion, scale = 1.015) {
  return reduceMotion ? undefined : { scale };
}

function tapMotion(reduceMotion) {
  return reduceMotion ? undefined : { scale: 0.985 };
}

function createId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function now() {
  return new Date().toISOString();
}

function createStarterState() {
  const createdAt = now();
  return {
    activeCategoryId: "isc",
    categories: [
      {
        id: "isc",
        name: "ISC",
        description: "Class 11 and 12 study notes.",
        createdAt,
        notes: [
          {
            id: createId(),
            title: "Physics revision",
            content: "Add formulas, important derivations, and chapter-wise doubts here.",
            tags: ["physics", "revision"],
            createdAt,
            updatedAt: createdAt
          }
        ]
      },
      {
        id: "hsc",
        name: "HSC",
        description: "Board exam preparation and topic summaries.",
        createdAt,
        notes: [
          {
            id: createId(),
            title: "Study plan",
            content: "Write subject-wise plans, practice papers, and important reminders here.",
            tags: ["exam"],
            createdAt,
            updatedAt: createdAt
          }
        ]
      }
    ]
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.categories?.length) return saved;
  } catch (error) {
    console.warn("Could not load notes", error);
  }
  return createStarterState();
}

function formatDate(value) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

function normalizeTags(value) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function countWords(notes) {
  return notes.reduce((total, note) => {
    const text = `${note.title} ${note.content}`.trim();
    return total + (text ? text.split(/\s+/).length : 0);
  }, 0);
}

function emptyCategoryForm() {
  return { id: "", name: "", description: "" };
}

function emptyNoteForm() {
  return { id: "", title: "", content: "", tags: "" };
}

export default function App() {
  const reduceMotion = useReducedMotion();
  const [state, setState] = useState(loadState);
  const [categoryForm, setCategoryForm] = useState(emptyCategoryForm);
  const [noteForm, setNoteForm] = useState(emptyNoteForm);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState("updated");
  const [toast, setToast] = useState("");
  const [syncStatus, setSyncStatus] = useState(
    firebaseNotes.enabled ? "Connecting to Firebase" : "Local storage"
  );
  const fileInputRef = useRef(null);
  const initialStateRef = useRef(state);
  const cloudReadyRef = useRef(!firebaseNotes.enabled);
  const applyingCloudStateRef = useRef(false);
  const lastCloudJsonRef = useRef("");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

    if (!firebaseNotes.enabled || !cloudReadyRef.current) return undefined;

    const stateJson = JSON.stringify(state);
    if (applyingCloudStateRef.current) {
      applyingCloudStateRef.current = false;
      return undefined;
    }
    if (stateJson === lastCloudJsonRef.current) return undefined;

    setSyncStatus("Saving to Firebase...");
    const saveTimer = window.setTimeout(() => {
      setDoc(
        firebaseNotes.notesDocRef,
        {
          schemaVersion: 1,
          state,
          updatedAt: serverTimestamp()
        },
        { merge: true }
      )
        .then(() => {
          lastCloudJsonRef.current = stateJson;
          setSyncStatus("Synced to Firebase");
        })
        .catch((error) => {
          setSyncStatus("Firebase save failed");
          console.error("Could not save notes to Firebase", error);
        });
    }, 450);

    return () => window.clearTimeout(saveTimer);
  }, [state]);

  useEffect(() => {
    if (!firebaseNotes.enabled) {
      setSyncStatus("Local storage (Firebase config missing)");
      return undefined;
    }

    setSyncStatus("Connecting to Firebase");
    const unsubscribe = onSnapshot(
      firebaseNotes.notesDocRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          const stateJson = JSON.stringify(initialStateRef.current);
          setDoc(
            firebaseNotes.notesDocRef,
            {
              schemaVersion: 1,
              state: initialStateRef.current,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            },
            { merge: true }
          )
            .then(() => {
              lastCloudJsonRef.current = stateJson;
              cloudReadyRef.current = true;
              setSyncStatus("Synced to Firebase");
            })
            .catch((error) => {
              setSyncStatus("Firebase setup failed");
              console.error("Could not create Firebase notes document", error);
            });
          return;
        }

        const remoteState = snapshot.data()?.state;
        if (!remoteState?.categories?.length) {
          cloudReadyRef.current = true;
          setSyncStatus("Firebase document is empty");
          return;
        }

        const remoteJson = JSON.stringify(remoteState);
        if (remoteJson === lastCloudJsonRef.current) {
          cloudReadyRef.current = true;
          setSyncStatus("Synced to Firebase");
          return;
        }

        applyingCloudStateRef.current = true;
        lastCloudJsonRef.current = remoteJson;
        cloudReadyRef.current = true;
        setState(remoteState);
        setSyncStatus("Synced to Firebase");
      },
      (error) => {
        cloudReadyRef.current = true;
        setSyncStatus("Firebase connection failed");
        console.error("Firebase notes subscription failed", error);
      }
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (firebaseNotes.enabled && firebaseNotes.workspaceId) {
      const params = new URLSearchParams(window.location.search);
      if (params.get("workspace") !== firebaseNotes.workspaceId) {
        params.set("workspace", firebaseNotes.workspaceId);
        const newUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
        window.history.replaceState({ path: newUrl }, "", newUrl);
      }
    }
  }, []);

  function shareWorkspace() {
    if (!firebaseNotes.enabled) {
      setToast("Firebase is not enabled");
      return;
    }
    const shareUrl = `${window.location.origin}${window.location.pathname}?workspace=${firebaseNotes.workspaceId}`;
    
    if (navigator.share) {
      navigator.share({
        title: "Study Notes - Shared Workspace",
        text: "Join my real-time collaborative Study Notes workspace!",
        url: shareUrl
      })
      .then(() => setToast("Workspace shared successfully!"))
      .catch((error) => {
        if (error.name !== "AbortError") {
          navigator.clipboard.writeText(shareUrl)
            .then(() => setToast("Link copied to clipboard!"))
            .catch(() => setToast("Failed to copy link"));
        }
      });
    } else {
      navigator.clipboard.writeText(shareUrl)
        .then(() => setToast("Link copied to clipboard!"))
        .catch(() => setToast("Failed to copy link"));
    }
  }

  const activeCategory = useMemo(() => {
    return (
      state.categories.find((category) => category.id === state.activeCategoryId) ||
      state.categories[0]
    );
  }, [state]);

  const filteredNotes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return [...activeCategory.notes]
      .filter((note) => {
        if (!query) return true;
        return [note.title, note.content, note.tags.join(" ")]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort((a, b) => {
        if (sortMode === "title") return a.title.localeCompare(b.title);
        if (sortMode === "created") return new Date(a.createdAt) - new Date(b.createdAt);
        return new Date(b.updatedAt) - new Date(a.updatedAt);
      });
  }, [activeCategory.notes, searchQuery, sortMode]);

  const stats = useMemo(() => {
    const updated = activeCategory.notes
      .map((note) => note.updatedAt)
      .filter(Boolean)
      .sort((a, b) => new Date(b) - new Date(a));
    return {
      notes: activeCategory.notes.length,
      words: countWords(activeCategory.notes),
      lastUpdated: updated.length ? formatDate(updated[0]) : "Never"
    };
  }, [activeCategory.notes]);

  const syncDetails = firebaseNotes.enabled
    ? `Workspace: ${firebaseNotes.workspaceId}`
    : `Missing Firebase keys: ${firebaseNotes.missingKeys.join(", ")}`;

  function selectCategory(id) {
    setState((current) => ({ ...current, activeCategoryId: id }));
    setCategoryForm(emptyCategoryForm());
    setNoteForm(emptyNoteForm());
  }

  function saveCategory(event) {
    event.preventDefault();
    const name = categoryForm.name.trim();
    const description = categoryForm.description.trim();
    if (!name) return;

    if (categoryForm.id) {
      setState((current) => ({
        ...current,
        categories: current.categories.map((category) =>
          category.id === categoryForm.id ? { ...category, name, description } : category
        )
      }));
      setToast("Section updated");
    } else {
      const id = createId();
      setState((current) => ({
        activeCategoryId: id,
        categories: [
          {
            id,
            name,
            description,
            createdAt: now(),
            notes: []
          },
          ...current.categories
        ]
      }));
      setNoteForm(emptyNoteForm());
      setToast("Section added");
    }

    setCategoryForm(emptyCategoryForm());
  }

  function editCategory() {
    setCategoryForm({
      id: activeCategory.id,
      name: activeCategory.name,
      description: activeCategory.description || ""
    });
  }

  function deleteCategory() {
    if (state.categories.length === 1) {
      setToast("Keep at least one section");
      return;
    }
    const confirmed = window.confirm(`Delete "${activeCategory.name}" and all notes under it?`);
    if (!confirmed) return;

    setState((current) => {
      const categories = current.categories.filter((category) => category.id !== activeCategory.id);
      return { activeCategoryId: categories[0].id, categories };
    });
    setCategoryForm(emptyCategoryForm());
    setNoteForm(emptyNoteForm());
    setToast("Section deleted");
  }

  function saveNote(event) {
    event.preventDefault();
    const title = noteForm.title.trim();
    const content = noteForm.content.trim();
    if (!title || !content) return;

    const noteData = {
      title,
      content,
      tags: normalizeTags(noteForm.tags),
      updatedAt: now()
    };

    setState((current) => ({
      ...current,
      categories: current.categories.map((category) => {
        if (category.id !== activeCategory.id) return category;
        if (noteForm.id) {
          return {
            ...category,
            notes: category.notes.map((note) =>
              note.id === noteForm.id ? { ...note, ...noteData } : note
            )
          };
        }
        return {
          ...category,
          notes: [
            {
              id: createId(),
              ...noteData,
              createdAt: now()
            },
            ...category.notes
          ]
        };
      })
    }));

    setNoteForm(emptyNoteForm());
    setToast(noteForm.id ? "Note updated" : "Note added");
  }

  function editNote(note) {
    setNoteForm({
      id: note.id,
      title: note.title,
      content: note.content,
      tags: note.tags.join(", ")
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function deleteNote(note) {
    const confirmed = window.confirm(`Delete "${note.title}"?`);
    if (!confirmed) return;

    setState((current) => ({
      ...current,
      categories: current.categories.map((category) =>
        category.id === activeCategory.id
          ? { ...category, notes: category.notes.filter((item) => item.id !== note.id) }
          : category
      )
    }));
    if (noteForm.id === note.id) setNoteForm(emptyNoteForm());
    setToast("Note deleted");
  }

  function exportNotes() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "study-notes-backup.json";
    link.click();
    URL.revokeObjectURL(link.href);
    setToast("Backup downloaded");
  }

  function importNotes(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      try {
        const imported = JSON.parse(String(reader.result));
        if (!imported?.categories?.length) throw new Error("Invalid backup");
        setState(imported);
        setCategoryForm(emptyCategoryForm());
        setNoteForm(emptyNoteForm());
        setToast("Backup imported");
      } catch (error) {
        setToast("Invalid backup file");
      } finally {
        event.target.value = "";
      }
    });
    reader.readAsText(file);
  }

  return (
    <div className="app-shell">
      <motion.header className="topbar" layout>
        <div className="brand">
          <img src={notesMark} alt="" className="brand-mark" />
          <div>
            <h1>Study Notes</h1>
            <p>Organize subjects, chapters, and quick notes in one clean space.</p>
            <span
              className={`sync-pill ${firebaseNotes.enabled ? "online" : "local"}`}
              title={syncDetails}
            >
              {firebaseNotes.enabled ? <Cloud size={14} /> : <CloudOff size={14} />}
              {syncStatus}
            </span>
          </div>
        </div>

        <div className="top-actions">
          <label className="search-box">
            <Search aria-hidden="true" size={18} />
            <span className="sr-only">Search notes</span>
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              type="search"
              placeholder="Search notes..."
              autoComplete="off"
            />
          </label>
          {firebaseNotes.enabled && (
            <motion.button
              className="icon-button"
              type="button"
              onClick={shareWorkspace}
              title="Share workspace link"
              whileHover={hoverMotion(reduceMotion, 1.04)}
              whileTap={tapMotion(reduceMotion)}
              transition={spring}
            >
              <Share2 size={18} />
            </motion.button>
          )}
          <motion.button
            className="icon-button"
            type="button"
            onClick={exportNotes}
            title="Export notes"
            whileHover={hoverMotion(reduceMotion, 1.04)}
            whileTap={tapMotion(reduceMotion)}
            transition={spring}
          >
            <Download size={18} />
          </motion.button>
          <motion.button
            className="icon-button"
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Import notes"
            whileHover={hoverMotion(reduceMotion, 1.04)}
            whileTap={tapMotion(reduceMotion)}
            transition={spring}
          >
            <Upload size={18} />
          </motion.button>
          <input
            ref={fileInputRef}
            className="file-input"
            type="file"
            accept="application/json"
            onChange={importNotes}
          />
        </div>
      </motion.header>

      <main className="workspace">
        <aside className="sidebar" aria-label="Note sections">
          <SectionForm
            form={categoryForm}
            setForm={setCategoryForm}
            onSubmit={saveCategory}
            onCancel={() => setCategoryForm(emptyCategoryForm())}
            reduceMotion={reduceMotion}
          />

          <motion.section
            className="panel category-panel"
            layout
          >
            <div className="panel-heading">
              <h2>Sections</h2>
              <span>{state.categories.length}</span>
            </div>
            <motion.div className="category-list" layout>
              <AnimatePresence initial={false}>
              {state.categories.map((category) => (
                <motion.button
                  key={category.id}
                  layout
                  type="button"
                  className={`category-item ${
                    category.id === activeCategory.id ? "active" : ""
                  }`}
                  onClick={() => selectCategory(category.id)}
                  initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0, y: -10 }}
                  whileHover={hoverMotion(reduceMotion)}
                  whileTap={tapMotion(reduceMotion)}
                  transition={spring}
                >
                  <span>
                    <span className="category-title">{category.name}</span>
                    <span className="category-description">
                      {category.description || "No description added"}
                    </span>
                  </span>
                  <span className="category-meta">{pluralize(category.notes.length, "note")}</span>
                </motion.button>
              ))}
              </AnimatePresence>
            </motion.div>
          </motion.section>
        </aside>

        <section className="content-area">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeCategory.id}
              className="section-header"
              variants={reduceMotion ? undefined : contentVariants}
              initial={reduceMotion ? false : "hidden"}
              animate="visible"
              exit={reduceMotion ? undefined : "exit"}
              layout
            >
              <div>
                <p className="eyebrow">Selected section</p>
                <h2>{activeCategory.name}</h2>
                <p>{activeCategory.description || "Use this section for related notes and reminders."}</p>
              </div>
              <div className="section-actions">
                <motion.button
                  className="secondary-button"
                  type="button"
                  onClick={editCategory}
                  whileHover={hoverMotion(reduceMotion)}
                  whileTap={tapMotion(reduceMotion)}
                  transition={spring}
                >
                  <Edit3 size={17} />
                  Edit Section
                </motion.button>
                <motion.button
                  className="danger-button"
                  type="button"
                  onClick={deleteCategory}
                  whileHover={hoverMotion(reduceMotion)}
                  whileTap={tapMotion(reduceMotion)}
                  transition={spring}
                >
                  <Trash2 size={17} />
                  Delete
                </motion.button>
              </div>
            </motion.div>
          </AnimatePresence>

          <motion.div
            className="stats-row"
            aria-label="Notes overview"
            layout
          >
            <Stat value={stats.notes} label="Notes" />
            <Stat value={stats.words} label="Words" />
            <Stat value={stats.lastUpdated} label="Last updated" />
          </motion.div>

          <div className="editor-layout">
            <NoteForm
              form={noteForm}
              setForm={setNoteForm}
              onSubmit={saveNote}
              onClear={() => setNoteForm(emptyNoteForm())}
              sectionName={activeCategory.name}
              reduceMotion={reduceMotion}
            />

            <motion.section
              className="notes-column"
              aria-label="Saved notes"
              layout
            >
              <div className="notes-toolbar">
                <h2>Saved Notes</h2>
                <select
                  value={sortMode}
                  onChange={(event) => setSortMode(event.target.value)}
                  aria-label="Sort notes"
                >
                  <option value="updated">Recent first</option>
                  <option value="title">Title A-Z</option>
                  <option value="created">Created first</option>
                </select>
              </div>

              <motion.div className="notes-list" layout>
                <AnimatePresence mode="popLayout" initial={false}>
                {filteredNotes.length ? (
                  filteredNotes.map((note) => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      isMatch={Boolean(searchQuery.trim())}
                      onEdit={() => editNote(note)}
                      onDelete={() => deleteNote(note)}
                      reduceMotion={reduceMotion}
                    />
                  ))
                ) : (
                  <EmptyState key="empty" reduceMotion={reduceMotion} />
                )}
                </AnimatePresence>
              </motion.div>
            </motion.section>
          </div>
        </section>
      </main>

      <AnimatePresence>
        {toast && (
          <motion.div
            className="toast"
            role="status"
            initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: 12, scale: 0.98 }}
            transition={softSpring}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SectionForm({ form, setForm, onSubmit, onCancel, reduceMotion }) {
  const isEditing = Boolean(form.id);

  return (
    <motion.section
      className="panel add-panel"
      layout
    >
      <div className="panel-heading">
        <h2>{isEditing ? "Edit Section" : "Add Section"}</h2>
      </div>
      <form className="stacked-form" onSubmit={onSubmit}>
        <label>
          Section name
          <input
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            type="text"
            placeholder="Example: ISC"
            maxLength={40}
            required
          />
        </label>
        <label>
          Short description
          <input
            value={form.description}
            onChange={(event) =>
              setForm((current) => ({ ...current, description: event.target.value }))
            }
            type="text"
            placeholder="Optional"
            maxLength={90}
          />
        </label>
        <div className="form-actions">
          <motion.button
            className="primary-button"
            type="submit"
            whileHover={hoverMotion(reduceMotion)}
            whileTap={tapMotion(reduceMotion)}
            transition={spring}
          >
            {isEditing ? <Save size={17} /> : <Plus size={17} />}
            {isEditing ? "Update Section" : "Add Section"}
          </motion.button>
          <AnimatePresence initial={false}>
            {isEditing && (
              <motion.button
                className="secondary-button"
                type="button"
                onClick={onCancel}
                initial={reduceMotion ? false : { opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, x: -8 }}
                whileHover={hoverMotion(reduceMotion)}
                whileTap={tapMotion(reduceMotion)}
                transition={spring}
              >
                <X size={17} />
                Cancel
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </form>
    </motion.section>
  );
}

function Stat({ value, label }) {
  return (
    <div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function NoteForm({ form, setForm, onSubmit, onClear, sectionName, reduceMotion }) {
  const isEditing = Boolean(form.id);

  return (
    <motion.section
      className="panel editor-panel"
      aria-label="Note editor"
      layout
    >
      <div className="panel-heading editor-heading">
        <div>
          <h2>{isEditing ? "Edit Note" : "Write Note"}</h2>
          <p>{isEditing ? "Update this saved note." : `Add details under ${sectionName}.`}</p>
        </div>
        <motion.button
          className="ghost-button"
          type="button"
          onClick={onClear}
          whileHover={hoverMotion(reduceMotion)}
          whileTap={tapMotion(reduceMotion)}
          transition={spring}
        >
          Clear
        </motion.button>
      </div>
      <form className="note-form" onSubmit={onSubmit}>
        <label>
          Note title
          <input
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            type="text"
            placeholder="Example: Physics formulas"
            maxLength={90}
            required
          />
        </label>
        <label>
          Note content
          <textarea
            value={form.content}
            onChange={(event) =>
              setForm((current) => ({ ...current, content: event.target.value }))
            }
            placeholder="Write your note here..."
            rows={12}
            required
          />
        </label>
        <label>
          Tags
          <input
            value={form.tags}
            onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))}
            type="text"
            placeholder="exam, revision, chapter 1"
            maxLength={120}
          />
        </label>
        <div className="form-actions">
          <motion.button
            className="primary-button"
            type="submit"
            whileHover={hoverMotion(reduceMotion)}
            whileTap={tapMotion(reduceMotion)}
            transition={spring}
          >
            <Save size={17} />
            Save Note
          </motion.button>
          <motion.button
            className="secondary-button"
            type="button"
            onClick={onClear}
            whileHover={hoverMotion(reduceMotion)}
            whileTap={tapMotion(reduceMotion)}
            transition={spring}
          >
            New Note
          </motion.button>
        </div>
      </form>
    </motion.section>
  );
}

function NoteCard({ note, isMatch, onEdit, onDelete, reduceMotion }) {
  return (
    <motion.article
      layout
      className={`note-card${isMatch ? " is-match" : ""}`}
      initial={reduceMotion ? false : { opacity: 0, y: 14, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduceMotion ? undefined : { opacity: 0, y: -12, scale: 0.985 }}
      whileHover={hoverMotion(reduceMotion, 1.008)}
      transition={softSpring}
    >
      <div>
        <h3>{note.title}</h3>
        <div className="note-meta">
          <span>Updated {formatDate(note.updatedAt)}</span>
        </div>
      </div>
      <p className="note-preview">{note.content}</p>
      {note.tags.length > 0 && (
        <div className="tags">
          {note.tags.map((tag) => (
            <span className="tag" key={tag}>
              {tag}
            </span>
          ))}
        </div>
      )}
      <div className="note-actions">
        <motion.button
          className="secondary-button"
          type="button"
          onClick={onEdit}
          whileHover={hoverMotion(reduceMotion)}
          whileTap={tapMotion(reduceMotion)}
          transition={spring}
        >
          <Edit3 size={16} />
          Edit
        </motion.button>
        <motion.button
          className="danger-button"
          type="button"
          onClick={onDelete}
          whileHover={hoverMotion(reduceMotion)}
          whileTap={tapMotion(reduceMotion)}
          transition={spring}
        >
          <Trash2 size={16} />
          Delete
        </motion.button>
      </div>
    </motion.article>
  );
}

function EmptyState({ reduceMotion }) {
  return (
    <motion.div
      className="empty-state"
      layout
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, y: -12 }}
      transition={softSpring}
    >
      <FileText aria-hidden="true" size={48} />
      <h3>No notes found</h3>
      <p>Create a note in this section or adjust the search text.</p>
    </motion.div>
  );
}
