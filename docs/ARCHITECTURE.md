# Arquitectura — Hub de Trabajos Científicos

## Stack

| Capa | Tecnología | Versión |
|------|-----------|---------|
| UI | React | 19 |
| Build | Vite | 6 |
| Estilos | CSS custom properties (sin framework) | — |
| Íconos | lucide-react | 0.468 |
| Base de datos | Supabase (PostgreSQL) | JS SDK v2 |
| Storage | Supabase Storage (bucket `media`) | — |
| Deploy | Vercel | — |

## Estructura de archivos

```
HubTrabajosCientificos/
├── src/
│   ├── main.jsx          # Toda la lógica y UI (componentes + data layer)
│   ├── styles.css        # Estilos globales con CSS custom properties
│   └── supabase.js       # Cliente Supabase (singleton)
├── supabase/
│   ├── schema.sql        # DDL de referencia (no se usa en migrations)
│   └── migrations/
│       ├── 20260525000000_init_papers.sql   # Tabla papers
│       └── 20260525000001_storage_media.sql # Bucket media + policies
├── index.html            # Entry point HTML (carga fuentes Google)
├── vite.config.js        # Config mínima: plugin react
├── .env                  # Variables de entorno locales (no commiteado)
└── .env.example          # Plantilla de variables requeridas
```

## Cómo fluye la información

```
Usuario
  │
  ▼
React (estado en memoria)
  │
  ├── Lectura inicial ──► Supabase DB (tabla papers) ──► setPapers()
  │
  ├── Crear trabajo ──► optimistic update → INSERT en Supabase
  │
  ├── Editar campo ──► optimistic update → debounce 800ms → UPDATE en Supabase
  │
  ├── Subir archivo ──► Supabase Storage (bucket media) → URL pública → updateMedia()
  │
  └── Eliminar ──► confirm dialog → DELETE en Supabase → setState
```

## Principios de diseño actuales

- **Single-file frontend:** toda la lógica y componentes en `main.jsx`. Facilita el mantenimiento mientras el proyecto es pequeño. Si crece, separar en `src/components/` y `src/hooks/`.
- **Sin auth:** acceso público con anon key. Apropiado para uso personal. Ver `docs/DEPLOYMENT.md` para agregar auth.
- **Optimistic UI:** crear y editar actualizan el estado local antes de confirmar con Supabase, para que la UI se sienta instantánea.
- **Debounce en updates:** 800ms de espera tras el último keystroke antes de escribir a Supabase. Evita saturar la DB al tipear.
- **CSS puro:** sin Tailwind ni CSS-in-JS. Variables CSS en `:root` para theming consistente.

## Recursos externos

- **Proyecto Supabase:** `gbrjqidgkhwrabjaepnh` (región: São Paulo)
- **Proyecto Vercel:** `julianmartinalonso-1393s-projects/hub-trabajos-cientificos`
- **Repositorio:** `github.com/jutopa31/HubTrabajosCientificos`
- **URL producción:** `hub-trabajos-cientificos.vercel.app`
- **Fuentes:** Google Fonts — Literata (títulos serif) + Public Sans (UI sans)
