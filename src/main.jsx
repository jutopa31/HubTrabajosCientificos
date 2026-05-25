import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Download,
  ExternalLink,
  FileUp,
  ImagePlus,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X
} from "lucide-react";
import { supabase } from "./supabase.js";
import "./styles.css";

const LEGACY_KEY = "hub-trabajos-cientificos:v1";
const STATUSES = ["Idea", "En redaccion", "Revision", "Enviado", "Publicado"];

// ── DB mappers ────────────────────────────────────────────────────────────────

function fromDb(row) {
  return {
    id: row.id,
    title: row.title,
    authors: row.authors ?? [],
    status: row.status,
    link: row.link ?? "",
    tags: row.tags ?? [],
    abstract: row.abstract ?? "",
    media: row.media ?? [],
    updatedAt: row.updated_at,
  };
}

function toDb(paper) {
  return {
    id: paper.id,
    title: paper.title,
    authors: paper.authors,
    status: paper.status,
    link: paper.link,
    tags: paper.tags,
    abstract: paper.abstract,
    media: paper.media,
    updated_at: paper.updatedAt,
  };
}

function tryLoadLegacy() {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {}
  return [];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeTags(value) {
  if (Array.isArray(value)) return value.map((tag) => String(tag).trim()).filter(Boolean);
  return String(value).split(",").map((tag) => tag.trim()).filter(Boolean);
}

function normalizeAuthors(value) {
  if (Array.isArray(value)) return value.map((author) => String(author).trim()).filter(Boolean);
  return String(value).split(";").map((author) => author.trim()).filter(Boolean);
}

function editorAuthors(value) {
  if (Array.isArray(value)) return value.map((author) => String(author));
  return normalizeAuthors(value);
}

function formatAuthors(authors) {
  return normalizeAuthors(authors).join("; ");
}

function createBlankPaper() {
  return {
    id: crypto.randomUUID(),
    title: "Nuevo trabajo sin titulo",
    authors: [],
    status: "Idea",
    link: "",
    tags: [],
    abstract: "",
    media: [],
    updatedAt: new Date().toISOString(),
  };
}

function isDraftPaper(paper) {
  return (
    paper.title === "Nuevo trabajo sin titulo" &&
    !formatAuthors(paper.authors) &&
    !paper.abstract &&
    !(paper.media ?? []).length
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

function App() {
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openIds, setOpenIds] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const updateTimers = useRef({});

  useEffect(() => {
    loadPapers();
  }, []);

  async function loadPapers() {
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from("papers")
      .select("*")
      .order("updated_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    let loaded = (data ?? []).map(fromDb);

    // One-time migration from localStorage
    if (loaded.length === 0) {
      const legacy = tryLoadLegacy();
      if (legacy.length > 0) {
        const { data: migrated, error: migrateError } = await supabase
          .from("papers")
          .insert(legacy.map(toDb))
          .select();

        if (!migrateError) {
          localStorage.removeItem(LEGACY_KEY);
          loaded = (migrated ?? []).map(fromDb);
        }
      }
    }

    setPapers(loaded);
    if (loaded[0]) {
      setOpenIds([loaded[0].id]);
      setActiveId(loaded[0].id);
    }
    setLoading(false);
  }

  const activePaper = useMemo(
    () => papers.find((paper) => paper.id === activeId) ?? null,
    [activeId, papers]
  );

  const filteredPapers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return papers;
    return papers.filter((paper) => {
      const haystack = [
        paper.title,
        formatAuthors(paper.authors),
        paper.status,
        paper.abstract,
        ...(paper.tags ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [papers, searchTerm]);

  function openPaper(id) {
    setOpenIds((current) => (current.includes(id) ? current : [...current, id]));
    setActiveId(id);
  }

  function closePaper(id) {
    setOpenIds((current) => {
      const next = current.filter((openId) => openId !== id);
      if (activeId === id) setActiveId(next.at(-1) ?? null);
      return next;
    });
  }

  async function addPaper() {
    const paper = createBlankPaper();

    // Optimistic: show immediately while Supabase persists
    setPapers((current) => [paper, ...current]);
    setOpenIds((current) => [paper.id, ...current]);
    setActiveId(paper.id);

    const { data, error: insertError } = await supabase
      .from("papers")
      .insert(toDb(paper))
      .select()
      .single();

    if (insertError) {
      setPapers((current) => current.filter((p) => p.id !== paper.id));
      setOpenIds((current) => current.filter((id) => id !== paper.id));
      setActiveId((current) => (current === paper.id ? null : current));
      window.alert("Error al crear el trabajo: " + insertError.message);
      return;
    }

    // Replace optimistic entry with server-confirmed row
    const saved = fromDb(data);
    setPapers((current) => current.map((p) => (p.id === paper.id ? saved : p)));
  }

  function updatePaper(id, patch) {
    setPapers((current) => {
      const next = current.map((paper) =>
        paper.id === id
          ? { ...paper, ...patch, updatedAt: new Date().toISOString() }
          : paper
      );

      // Debounce Supabase write so rapid typing doesn't flood the DB
      const updated = next.find((p) => p.id === id);
      clearTimeout(updateTimers.current[id]);
      updateTimers.current[id] = setTimeout(() => {
        supabase.from("papers").update(toDb(updated)).eq("id", id);
      }, 800);

      return next;
    });
  }

  async function deletePaper(id) {
    const paper = papers.find((item) => item.id === id);
    if (!paper) return;

    const shouldDelete = window.confirm(
      `Eliminar "${paper.title}"? Esta accion no se puede deshacer.`
    );
    if (!shouldDelete) return;

    const { error: deleteError } = await supabase
      .from("papers")
      .delete()
      .eq("id", id);

    if (deleteError) {
      window.alert("Error al eliminar: " + deleteError.message);
      return;
    }

    setPapers((current) => current.filter((item) => item.id !== id));
    setOpenIds((current) => {
      const next = current.filter((openId) => openId !== id);
      setActiveId(next.at(-1) ?? null);
      return next;
    });
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(papers, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `hub-trabajos-cientificos-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importJson(file) {
    if (!file) return;

    try {
      const imported = JSON.parse(await file.text());
      if (!Array.isArray(imported)) throw new Error("El JSON debe ser una lista de trabajos.");

      const nextPapers = imported.map((paper) => ({
        id: paper.id || crypto.randomUUID(),
        title: paper.title || "Sin titulo",
        authors: normalizeAuthors(paper.authors || []),
        status: STATUSES.includes(paper.status) ? paper.status : "Idea",
        link: paper.link || "",
        tags: normalizeTags(paper.tags || []),
        abstract: paper.abstract || "",
        media: Array.isArray(paper.media) ? paper.media : [],
        updatedAt: paper.updatedAt || new Date().toISOString(),
      }));

      // Delete existing rows by ID, then insert imported ones
      const existingIds = papers.map((p) => p.id);
      if (existingIds.length > 0) {
        const { error: deleteError } = await supabase
          .from("papers")
          .delete()
          .in("id", existingIds);
        if (deleteError) throw new Error("Error al limpiar datos: " + deleteError.message);
      }

      const { data, error: insertError } = await supabase
        .from("papers")
        .insert(nextPapers.map(toDb))
        .select();

      if (insertError) throw new Error("Error al importar: " + insertError.message);

      const saved = (data ?? []).map(fromDb);
      setPapers(saved);
      setOpenIds(saved[0] ? [saved[0].id] : []);
      setActiveId(saved[0]?.id ?? null);
    } catch (err) {
      window.alert(err.message || "No se pudo importar el archivo.");
    }
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <p>Cargando trabajos...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="loading-screen">
        <p className="error-text">Error al conectar con la base de datos:</p>
        <p className="muted-copy">{error}</p>
        <p className="muted-copy">
          Verificá las variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en el archivo .env
        </p>
        <button className="ghost-button" type="button" onClick={loadPapers}>
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar
        papers={filteredPapers}
        activeId={activeId}
        searchTerm={searchTerm}
        onSearch={setSearchTerm}
        onOpen={openPaper}
        onNew={addPaper}
        onExport={exportJson}
        onImport={importJson}
      />

      <main className="workspace">
        <OpenTabs
          openPapers={openIds.map((id) => papers.find((paper) => paper.id === id)).filter(Boolean)}
          activeId={activeId}
          activeLink={activePaper?.link}
          onActivate={setActiveId}
          onClose={closePaper}
        />

        {activePaper ? (
          <DetailView paper={activePaper} onUpdate={updatePaper} onDelete={deletePaper} />
        ) : (
          <EmptyState />
        )}
      </main>
    </div>
  );
}

// ── UI components (sin cambios de lógica) ────────────────────────────────────

function Sidebar({ papers, activeId, searchTerm, onSearch, onOpen, onNew, onExport, onImport }) {
  return (
    <aside className="sidebar" aria-label="Biblioteca de trabajos">
      <div className="brand">
        <div>
          <h1>Trabajos Cientificos</h1>
        </div>
        <button className="icon-button primary" type="button" title="Nuevo trabajo" onClick={onNew}>
          <Plus size={21} aria-hidden="true" />
        </button>
      </div>

      <label className="search-box">
        <span>Buscar</span>
        <div className="input-with-icon">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            value={searchTerm}
            placeholder="Titulo, autor, etiqueta..."
            autoComplete="off"
            onChange={(event) => onSearch(event.target.value)}
          />
        </div>
      </label>

      <div className="sidebar-actions">
        <button className="ghost-button" type="button" onClick={onExport}>
          <Download size={16} aria-hidden="true" />
          Exportar
        </button>
        <label className="ghost-button file-button">
          <FileUp size={16} aria-hidden="true" />
          Importar
          <input
            type="file"
            accept="application/json"
            onChange={(event) => onImport(event.target.files?.[0])}
          />
        </label>
      </div>

      <div className="paper-list" role="list">
        {papers.length ? (
          papers.map((paper) => (
            <button
              key={paper.id}
              type="button"
              className={`paper-item ${paper.id === activeId ? "active" : ""}`}
              onClick={() => onOpen(paper.id)}
            >
              <strong>{paper.title || "Sin titulo"}</strong>
              {formatAuthors(paper.authors) ? <span>{formatAuthors(paper.authors)}</span> : null}
            </button>
          ))
        ) : (
          <p className="muted-copy">Sin resultados.</p>
        )}
      </div>
    </aside>
  );
}

function OpenTabs({ openPapers, activeId, activeLink, onActivate, onClose }) {
  return (
    <section className="topbar" aria-label="Trabajos abiertos">
      {openPapers.length > 1 ? (
        <div className="tabs" role="tablist">
          {openPapers.map((paper) => (
            <button
              key={paper.id}
              className={`tab ${paper.id === activeId ? "active" : ""}`}
              type="button"
              role="tab"
              aria-selected={paper.id === activeId}
              onClick={() => onActivate(paper.id)}
            >
              <span className="tab-title">{paper.title || "Sin titulo"}</span>
              <span
                className="tab-close"
                role="button"
                tabIndex={0}
                aria-label="Cerrar pestana"
                onClick={(event) => {
                  event.stopPropagation();
                  onClose(paper.id);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation();
                    onClose(paper.id);
                  }
                }}
              >
                <X size={14} aria-hidden="true" />
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div />
      )}

      <a
        className={`doc-link ${activeLink ? "" : "disabled"}`}
        href={activeLink || "#"}
        target="_blank"
        rel="noreferrer"
        aria-disabled={!activeLink}
      >
        <ExternalLink size={16} aria-hidden="true" />
        Abrir documento
      </a>
    </section>
  );
}

function DetailView({ paper, onUpdate, onDelete }) {
  const [isEditing, setIsEditing] = useState(() => isDraftPaper(paper));

  useEffect(() => {
    setIsEditing(isDraftPaper(paper));
  }, [paper.id]);

  function updateField(field, value) {
    onUpdate(paper.id, { [field]: value });
  }

  function updateMedia(index, patch) {
    const media = [...(paper.media ?? [])];
    media[index] = { ...media[index], ...patch };
    onUpdate(paper.id, { media });
  }

  function addMedia() {
    onUpdate(paper.id, {
      media: [...(paper.media ?? []), { type: "image", url: "", caption: "" }],
    });
  }

  function removeMedia(index) {
    onUpdate(paper.id, {
      media: (paper.media ?? []).filter((_, itemIndex) => itemIndex !== index),
    });
  }

  async function uploadFile(index, file) {
    const ext = file.name.split(".").pop();
    const path = `${paper.id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const type = file.type.startsWith("video/") ? "video" : "image";

    const { error } = await supabase.storage.from("media").upload(path, file);
    if (error) {
      window.alert("Error al subir el archivo: " + error.message);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from("media").getPublicUrl(path);
    updateMedia(index, { url: publicUrl, type });
  }

  if (!isEditing) {
    return (
      <PaperSummary
        paper={paper}
        onEdit={() => setIsEditing(true)}
        onDelete={() => onDelete(paper.id)}
      />
    );
  }

  return (
    <section className="detail-view edit-mode">
      <form className="paper-form" onSubmit={(event) => event.preventDefault()}>
        <div className="form-header">
          <label>
            Titulo
            <input
              className="title-input"
              value={paper.title}
              placeholder="Titulo del trabajo cientifico"
              required
              onChange={(event) => updateField("title", event.target.value)}
            />
          </label>
          <div className="form-actions">
            <button className="ghost-button" type="button" onClick={() => setIsEditing(false)}>
              <Check size={16} aria-hidden="true" />
              Listo
            </button>
            <button className="danger-button" type="button" onClick={() => onDelete(paper.id)}>
              <Trash2 size={16} aria-hidden="true" />
              Eliminar
            </button>
          </div>
        </div>

        <div className="field-grid">
          <label>
            Estado
            <select value={paper.status} onChange={(event) => updateField("status", event.target.value)}>
              {STATUSES.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
          <label>
            Link Google Docs / DOI / Drive
            <input
              value={paper.link}
              type="url"
              placeholder="https://docs.google.com/..."
              onChange={(event) => updateField("link", event.target.value)}
            />
          </label>
          <label>
            Etiquetas
            <input
              value={(paper.tags ?? []).join(", ")}
              placeholder="cardiologia, IA, revision"
              onChange={(event) => updateField("tags", normalizeTags(event.target.value))}
            />
          </label>
        </div>

        <AuthorsEditor
          authors={editorAuthors(paper.authors)}
          onChange={(authors) => updateField("authors", authors)}
        />

        <label>
          Abstract
          <textarea
            value={paper.abstract}
            rows={8}
            placeholder="Resumen estructurado, objetivos, metodologia, resultados esperados..."
            onChange={(event) => updateField("abstract", event.target.value)}
          />
        </label>

        <div className="media-section">
          <div className="section-title">
            <h2>Imagenes y videos</h2>
            <button className="ghost-button compact" type="button" onClick={addMedia}>
              <ImagePlus size={16} aria-hidden="true" />
              Agregar
            </button>
          </div>
          <MediaEditor items={paper.media ?? []} onUpdate={updateMedia} onRemove={removeMedia} onUpload={uploadFile} />
        </div>
      </form>
    </section>
  );
}

function MediaEditor({ items, onUpdate, onRemove, onUpload }) {
  const [uploadingIndices, setUploadingIndices] = useState(new Set());

  async function handleFileChange(index, file) {
    if (!file) return;
    setUploadingIndices((prev) => new Set([...prev, index]));
    await onUpload(index, file);
    setUploadingIndices((prev) => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  }

  if (!items.length) {
    return <p className="muted-copy">Agrega una URL o subí un archivo desde tu dispositivo.</p>;
  }

  return (
    <div className="media-list">
      {items.map((item, index) => {
        const isUploading = uploadingIndices.has(index);
        return (
          <div className="media-row" key={`${index}-${item.type}`}>
            <select
              value={item.type}
              aria-label="Tipo de recurso"
              onChange={(event) => onUpdate(index, { type: event.target.value })}
            >
              <option value="image">Imagen</option>
              <option value="video">Video</option>
            </select>

            <div className="media-url-group">
              <input
                value={item.url}
                type="url"
                placeholder="URL o subí un archivo →"
                aria-label="URL de recurso"
                onChange={(event) => onUpdate(index, { url: event.target.value })}
              />
              <label
                className={`icon-button upload-btn ${isUploading ? "uploading" : ""}`}
                title={isUploading ? "Subiendo..." : "Subir archivo"}
              >
                {isUploading ? (
                  <span className="spinner" aria-hidden="true" />
                ) : (
                  <Upload size={15} aria-hidden="true" />
                )}
                <input
                  type="file"
                  accept="image/*,video/mp4,video/webm,video/ogg,video/quicktime"
                  disabled={isUploading}
                  onChange={(e) => handleFileChange(index, e.target.files?.[0])}
                />
              </label>
            </div>

            <input
              value={item.caption}
              placeholder="Descripcion breve"
              aria-label="Descripcion"
              onChange={(event) => onUpdate(index, { caption: event.target.value })}
            />
            <button className="icon-button" type="button" title="Quitar recurso" onClick={() => onRemove(index)}>
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function PaperSummary({ paper, onEdit, onDelete }) {
  const authors = normalizeAuthors(paper.authors);
  const abstractPreview = paper.abstract?.trim()
    ? paper.abstract.trim().slice(0, 520)
    : "Sin abstract cargado.";
  const hasMoreAbstract = paper.abstract?.trim().length > 520;
  const mediaItems = (paper.media ?? []).filter((item) => item.url);

  return (
    <section className="paper-summary" aria-label="Detalle del trabajo">
      <div className="summary-header">
        <div>
          <h2>{paper.title || "Sin titulo"}</h2>
          <p className="preview-meta">{paper.status}</p>
        </div>
        <div className="form-actions">
          <button className="ghost-button" type="button" onClick={onEdit}>
            <Pencil size={16} aria-hidden="true" />
            Editar
          </button>
          <button className="danger-button" type="button" onClick={onDelete}>
            <Trash2 size={16} aria-hidden="true" />
            Eliminar
          </button>
        </div>
      </div>

      {authors.length ? (
        <section className="summary-block">
          <h3>Autores</h3>
          <ol className="ordered-authors">
            {authors.map((author, index) => (
              <li key={`${author}-${index}`}>{author}</li>
            ))}
          </ol>
        </section>
      ) : null}

      <section className="summary-block">
        <h3>Abstract</h3>
        <p className="preview-abstract">
          {abstractPreview}
          {hasMoreAbstract ? "..." : ""}
        </p>
      </section>

      {(paper.tags ?? []).length ? (
        <div className="tag-row">
          {(paper.tags ?? []).map((tag) => (
            <span className="tag" key={tag}>
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      {paper.link ? (
        <a className="summary-link" href={paper.link} target="_blank" rel="noreferrer">
          <ExternalLink size={16} aria-hidden="true" />
          Abrir documento
        </a>
      ) : null}

      {mediaItems.length ? (
        <div className="preview-media compact-media">
          {mediaItems.slice(0, 3).map((item, index) => (
            <MediaPreview item={item} key={`${item.url}-${index}`} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function MediaPreview({ item }) {
  const embedUrl = toEmbedUrl(item.url);

  return (
    <article className="media-preview-item">
      {item.type === "video" ? (
        embedUrl ? (
          <iframe
            src={embedUrl}
            title={item.caption || "Video del trabajo"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <video src={item.url} controls />
        )
      ) : (
        <img src={item.url} alt={item.caption || "Imagen del trabajo"} loading="lazy" />
      )}
      {item.caption ? <p>{item.caption}</p> : null}
    </article>
  );
}

function EmptyState() {
  return (
    <section className="empty-state">
      <h2>Sin trabajo seleccionado</h2>
      <p>Elegí un trabajo de la lista o creá uno nuevo.</p>
    </section>
  );
}

function AuthorsEditor({ authors, onChange }) {
  function updateAuthor(index, value) {
    const next = [...authors];
    next[index] = value;
    onChange(next);
  }

  function addAuthor() {
    onChange([...authors, ""]);
  }

  function removeAuthor(index) {
    onChange(authors.filter((_, authorIndex) => authorIndex !== index));
  }

  function moveAuthor(index, direction) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= authors.length) return;
    const next = [...authors];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    onChange(next);
  }

  return (
    <section className="authors-section" aria-label="Autores">
      <div className="section-title">
        <h2>Autores</h2>
        <button className="ghost-button compact" type="button" onClick={addAuthor}>
          <Plus size={16} aria-hidden="true" />
          Agregar
        </button>
      </div>

      {authors.length ? (
        <div className="author-list">
          {authors.map((author, index) => (
            <div className="author-row" key={index}>
              <span className="author-order">{index + 1}</span>
              <input
                value={author}
                placeholder="Apellido, Nombre"
                aria-label={`Autor ${index + 1}`}
                onChange={(event) => updateAuthor(index, event.target.value)}
                onBlur={() => onChange(normalizeAuthors(authors))}
              />
              <div className="author-actions">
                <button
                  className="icon-button"
                  type="button"
                  title="Subir autor"
                  disabled={index === 0}
                  onClick={() => moveAuthor(index, -1)}
                >
                  <ArrowUp size={15} aria-hidden="true" />
                </button>
                <button
                  className="icon-button"
                  type="button"
                  title="Bajar autor"
                  disabled={index === authors.length - 1}
                  onClick={() => moveAuthor(index, 1)}
                >
                  <ArrowDown size={15} aria-hidden="true" />
                </button>
                <button
                  className="icon-button"
                  type="button"
                  title="Quitar autor"
                  onClick={() => removeAuthor(index)}
                >
                  <X size={15} aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <button className="empty-inline-button" type="button" onClick={addAuthor}>
          Agregar autor
        </button>
      )}
    </section>
  );
}

function toEmbedUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtube.com")) {
      const id = parsed.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : "";
    }
    if (parsed.hostname.includes("youtu.be")) {
      return `https://www.youtube.com/embed/${parsed.pathname.slice(1)}`;
    }
    if (parsed.hostname.includes("vimeo.com")) {
      const id = parsed.pathname.split("/").filter(Boolean).at(-1);
      return id ? `https://player.vimeo.com/video/${id}` : "";
    }
  } catch {
    return "";
  }
  return "";
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
