import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Download,
  ExternalLink,
  FileUp,
  ImagePlus,
  Library,
  Plus,
  Search,
  Trash2,
  X
} from "lucide-react";
import "./styles.css";

const STORAGE_KEY = "hub-trabajos-cientificos:v1";
const STATUSES = ["Idea", "En redaccion", "Revision", "Enviado", "Publicado"];

const seedPapers = [
  {
    id: crypto.randomUUID(),
    title: "Impacto de la inteligencia artificial en el triaje clinico",
    authors: "Jutopa, Julian; Equipo de investigacion",
    status: "En redaccion",
    link: "https://docs.google.com/",
    tags: ["IA", "triaje", "salud digital"],
    abstract:
      "Trabajo exploratorio sobre el uso de modelos de lenguaje para priorizacion inicial de pacientes, con foco en seguridad, trazabilidad y supervision clinica.",
    media: [
      {
        type: "image",
        url: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1200&q=80",
        caption: "Referencia visual para salud digital y analisis clinico."
      }
    ],
    updatedAt: new Date().toISOString()
  }
];

function loadPapers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed : seedPapers;
  } catch {
    return seedPapers;
  }
}

function normalizeTags(value) {
  if (Array.isArray(value)) return value.map((tag) => String(tag).trim()).filter(Boolean);
  return String(value)
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function createBlankPaper() {
  return {
    id: crypto.randomUUID(),
    title: "Nuevo trabajo sin titulo",
    authors: "",
    status: "Idea",
    link: "",
    tags: [],
    abstract: "",
    media: [],
    updatedAt: new Date().toISOString()
  };
}

function App() {
  const [papers, setPapers] = useState(loadPapers);
  const [openIds, setOpenIds] = useState(() => (papers[0] ? [papers[0].id] : []));
  const [activeId, setActiveId] = useState(() => papers[0]?.id ?? null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(papers));
  }, [papers]);

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
        paper.authors,
        paper.status,
        paper.abstract,
        ...(paper.tags ?? [])
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

  function addPaper() {
    const paper = createBlankPaper();
    setPapers((current) => [paper, ...current]);
    setOpenIds((current) => [paper.id, ...current]);
    setActiveId(paper.id);
  }

  function updatePaper(id, patch) {
    setPapers((current) =>
      current.map((paper) =>
        paper.id === id ? { ...paper, ...patch, updatedAt: new Date().toISOString() } : paper
      )
    );
  }

  function deletePaper(id) {
    const paper = papers.find((item) => item.id === id);
    if (!paper) return;

    const shouldDelete = window.confirm(`Eliminar "${paper.title}"? Esta accion no se puede deshacer.`);
    if (!shouldDelete) return;

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
        authors: paper.authors || "",
        status: STATUSES.includes(paper.status) ? paper.status : "Idea",
        link: paper.link || "",
        tags: normalizeTags(paper.tags || []),
        abstract: paper.abstract || "",
        media: Array.isArray(paper.media) ? paper.media : [],
        updatedAt: paper.updatedAt || new Date().toISOString()
      }));

      setPapers(nextPapers);
      setOpenIds(nextPapers[0] ? [nextPapers[0].id] : []);
      setActiveId(nextPapers[0]?.id ?? null);
    } catch (error) {
      window.alert(error.message || "No se pudo importar el archivo.");
    }
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

function Sidebar({ papers, activeId, searchTerm, onSearch, onOpen, onNew, onExport, onImport }) {
  return (
    <aside className="sidebar" aria-label="Biblioteca de trabajos">
      <div className="brand">
        <div>
          <p className="eyebrow">Archivo local</p>
          <h1>Hub de Trabajos Cientificos</h1>
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
              <span>{paper.authors || "Sin autores cargados"}</span>
              <small className="status-pill">{paper.status || "Idea"}</small>
            </button>
          ))
        ) : (
          <p className="muted-copy">No hay trabajos que coincidan con la busqueda.</p>
        )}
      </div>
    </aside>
  );
}

function OpenTabs({ openPapers, activeId, activeLink, onActivate, onClose }) {
  return (
    <section className="topbar" aria-label="Trabajos abiertos">
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
      media: [...(paper.media ?? []), { type: "image", url: "", caption: "" }]
    });
  }

  function removeMedia(index) {
    onUpdate(paper.id, {
      media: (paper.media ?? []).filter((_, itemIndex) => itemIndex !== index)
    });
  }

  return (
    <section className="detail-view">
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
          <button className="danger-button" type="button" onClick={() => onDelete(paper.id)}>
            <Trash2 size={16} aria-hidden="true" />
            Eliminar
          </button>
        </div>

        <div className="field-grid">
          <label>
            Autores
            <input
              value={paper.authors}
              placeholder="Apellido, Nombre; ..."
              onChange={(event) => updateField("authors", event.target.value)}
            />
          </label>
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
          <MediaEditor items={paper.media ?? []} onUpdate={updateMedia} onRemove={removeMedia} />
        </div>
      </form>

      <PreviewPanel paper={paper} />
    </section>
  );
}

function MediaEditor({ items, onUpdate, onRemove }) {
  if (!items.length) {
    return <p className="muted-copy">Agrega URLs de imagenes, YouTube, Vimeo o videos directos.</p>;
  }

  return (
    <div className="media-list">
      {items.map((item, index) => (
        <div className="media-row" key={`${index}-${item.type}`}>
          <select
            value={item.type}
            aria-label="Tipo de recurso"
            onChange={(event) => onUpdate(index, { type: event.target.value })}
          >
            <option value="image">Imagen</option>
            <option value="video">Video</option>
          </select>
          <input
            value={item.url}
            type="url"
            placeholder="URL de imagen o video"
            aria-label="URL de recurso"
            onChange={(event) => onUpdate(index, { url: event.target.value })}
          />
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
      ))}
    </div>
  );
}

function PreviewPanel({ paper }) {
  return (
    <aside className="preview-panel" aria-label="Vista previa">
      <p className="eyebrow">Vista rapida</p>
      <h2>{paper.title || "Sin titulo"}</h2>
      <p className="preview-meta">{[paper.authors, paper.status].filter(Boolean).join(" | ") || "Sin metadatos"}</p>
      <p className="preview-abstract">{paper.abstract || "Todavia no hay abstract cargado."}</p>
      <div className="tag-row">
        {(paper.tags ?? []).map((tag) => (
          <span className="tag" key={tag}>
            {tag}
          </span>
        ))}
      </div>
      <div className="preview-media">
        {(paper.media ?? [])
          .filter((item) => item.url)
          .map((item, index) => (
            <MediaPreview item={item} key={`${item.url}-${index}`} />
          ))}
      </div>
    </aside>
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
      <p className="eyebrow">MVP listo para usar</p>
      <Library size={34} aria-hidden="true" />
      <h2>Selecciona o crea un trabajo para empezar.</h2>
      <p>
        Los datos quedan guardados en este navegador mediante localStorage. La exportacion JSON deja
        preparado el camino para migrar luego a Supabase.
      </p>
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
