# Componentes React

Todos los componentes viven en `src/main.jsx`. El árbol es plano — no hay subdirectorios de componentes.

## Árbol de componentes

```
App
├── Sidebar
│   └── paper-item (lista de botones)
├── main.workspace
│   ├── OpenTabs
│   └── DetailView  ──o  EmptyState
│       ├── PaperSummary  (modo lectura)
│       │   └── MediaPreview[]
│       └── form.paper-form  (modo edición)
│           ├── AuthorsEditor
│           │   └── author-row[]
│           └── MediaEditor
│               └── media-row[]  (con botón de upload)
```

## Componentes

### `App`
Componente raíz. Maneja todo el estado global y las operaciones de datos.

**Estado:**
| Variable | Tipo | Descripción |
|----------|------|-------------|
| `papers` | `Paper[]` | Lista completa cargada desde Supabase |
| `loading` | `boolean` | Muestra pantalla de carga inicial |
| `error` | `string\|null` | Error de conexión a Supabase |
| `openIds` | `string[]` | IDs de trabajos con pestaña abierta |
| `activeId` | `string\|null` | ID del trabajo visible actualmente |
| `searchTerm` | `string` | Texto del buscador |
| `updateTimers` | `ref` | Map de timers de debounce por paper ID |

**Funciones de datos:**
| Función | Descripción |
|---------|-------------|
| `loadPapers()` | Fetch inicial + migración desde localStorage si Supabase está vacío |
| `addPaper()` | Crea paper en blanco (optimistic + INSERT) |
| `updatePaper(id, patch)` | Actualiza campo (optimistic + debounced UPDATE) |
| `deletePaper(id)` | Confirma y ejecuta DELETE |
| `exportJson()` | Descarga todos los papers como JSON |
| `importJson(file)` | Reemplaza todos los papers desde un JSON |

---

### `Sidebar`
Panel izquierdo (360px desktop, full-width mobile).

**Props:** `papers`, `activeId`, `searchTerm`, `onSearch`, `onOpen`, `onNew`, `onExport`, `onImport`

Contiene: buscador, botón nuevo (+), botones exportar/importar, lista de papers filtrada.

---

### `OpenTabs`
Barra superior con pestañas cuando hay más de un trabajo abierto.

**Props:** `openPapers`, `activeId`, `activeLink`, `onActivate`, `onClose`

Solo muestra las tabs si `openPapers.length > 1`. El botón "Abrir documento" siempre está visible (deshabilitado si no hay link).

---

### `DetailView`
Orquesta la vista de un paper individual. Alterna entre modo lectura (`PaperSummary`) y modo edición (form).

**Props:** `paper`, `onUpdate`, `onDelete`

**Estado local:** `isEditing` — arranca en `true` si el paper es un borrador nuevo (`isDraftPaper()`).

Contiene las funciones `updateField`, `updateMedia`, `addMedia`, `removeMedia`, `uploadFile`.

**`uploadFile(index, file)`:** sube a Supabase Storage bucket `media`, detecta el tipo por MIME, llama `updateMedia` con la URL pública resultante. Path de storage: `{paperId}/{timestamp}-{uuid8}.{ext}`.

---

### `PaperSummary`
Vista de solo lectura de un paper. Muestra título, estado, autores (lista ordenada), abstract (truncado a 520 chars), tags, link externo y hasta 3 recursos multimedia.

**Props:** `paper`, `onEdit`, `onDelete`

---

### `AuthorsEditor`
Edición de la lista de autores con orden. Cada autor es un input con botones subir/bajar/quitar.

**Props:** `authors: string[]`, `onChange: (authors: string[]) => void`

Formato esperado por fila: `"Apellido, Nombre"`. Normaliza al perder foco (`onBlur`).

---

### `MediaEditor`
Edición de recursos multimedia. Cada fila tiene: selector de tipo, campo URL + botón de upload, descripción, botón quitar.

**Props:** `items`, `onUpdate`, `onRemove`, `onUpload`

**Estado local:** `uploadingIndices: Set<number>` — rastrea qué filas están subiendo un archivo para mostrar el spinner y deshabilitar el botón.

---

### `MediaPreview`
Renderiza un ítem multimedia según su tipo:
- `image` → `<img>`
- `video` + URL de YouTube/Vimeo → `<iframe>` con URL embed convertida por `toEmbedUrl()`
- `video` directo → `<video controls>`

**Props:** `item: { type, url, caption }`

---

### `EmptyState`
Placeholder cuando no hay ningún trabajo seleccionado.

---

## Helpers y utilidades

| Función | Descripción |
|---------|-------------|
| `fromDb(row)` | Mapea fila de Supabase (`updated_at`) al modelo de app (`updatedAt`) |
| `toDb(paper)` | Mapea modelo de app al schema de Supabase |
| `tryLoadLegacy()` | Lee el localStorage viejo para migración one-time |
| `createBlankPaper()` | Paper vacío con UUID generado client-side |
| `isDraftPaper(paper)` | `true` si el paper está completamente vacío |
| `normalizeTags(value)` | Acepta string CSV o array, devuelve `string[]` limpio |
| `normalizeAuthors(value)` | Acepta string separado por `;` o array, devuelve `string[]` |
| `formatAuthors(authors)` | Devuelve string `"Apellido, N.; Apellido2, N2."` para mostrar |
| `toEmbedUrl(url)` | Convierte URLs de YouTube/Vimeo a URL de embed para iframe |

## Modelo de datos en memoria (tipo `Paper`)

```ts
type Paper = {
  id: string            // UUID
  title: string
  authors: string[]     // ["Apellido, Nombre", ...]
  status: "Idea" | "En redaccion" | "Revision" | "Enviado" | "Publicado"
  link: string          // URL a Google Docs, DOI, Drive, etc.
  tags: string[]
  abstract: string
  media: MediaItem[]
  updatedAt: string     // ISO 8601
}

type MediaItem = {
  type: "image" | "video"
  url: string           // URL pública (externa o de Supabase Storage)
  caption: string
}
```
