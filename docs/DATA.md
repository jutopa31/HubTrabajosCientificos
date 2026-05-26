# Capa de datos — Supabase

## Cliente

`src/supabase.js` exporta un singleton:

```js
import { createClient } from "@supabase/supabase-js";
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

Se importa directamente en `main.jsx`. Si el proyecto crece y necesita auth, este es el único lugar a modificar.

---

## Base de datos

### Tabla `papers`

```sql
create table papers (
  id          uuid        primary key default gen_random_uuid(),
  title       text        not null default 'Nuevo trabajo sin titulo',
  authors     text[]      not null default '{}',
  status      text        not null default 'Idea',
  link        text        not null default '',
  tags        text[]      not null default '{}',
  abstract    text        not null default '',
  media       jsonb       not null default '[]',
  updated_at  timestamptz not null default now()
);
```

**Decisiones de diseño:**
- `authors` y `tags` son `text[]` (arrays nativos de PostgreSQL). Evita una tabla de relación para un modelo tan simple.
- `media` es `jsonb`. Estructura flexible para `[{ type, url, caption }]` sin migración si se agregan campos.
- Sin RLS activo (no hay autenticación de usuarios). Si se agrega auth, habilitar RLS y agregar policy por `user_id`.
- Sin trigger `updated_at`. Se actualiza desde el cliente en cada write.

### Operaciones CRUD en el código

| Operación | Patrón |
|-----------|--------|
| Leer todos | `supabase.from("papers").select("*").order("updated_at", { ascending: false })` |
| Insertar | `supabase.from("papers").insert(toDb(paper)).select().single()` |
| Actualizar | `supabase.from("papers").update(toDb(paper)).eq("id", id)` |
| Eliminar | `supabase.from("papers").delete().eq("id", id)` |

### Gotcha crítico: queries son lazy en Supabase JS v2

El query builder no dispara el HTTP request hasta que se llama `.then()` o `await`. En callbacks de `setTimeout`, `setInterval` o event handlers que no son `async`, el query se construye pero **nunca se ejecuta**.

```js
// ❌ No ejecuta nada
setTimeout(() => {
  supabase.from("papers").update(data).eq("id", id);
}, 800);

// ✓ Correcto
setTimeout(async () => {
  await supabase.from("papers").update(data).eq("id", id);
}, 800);
```

Este bug causó que todos los updates de contenido se perdieran entre sesiones (el INSERT inicial funcionaba porque sí tenía `await`).

---

## Storage

### Bucket `media`

- **Visibilidad:** público (URLs accesibles sin token)
- **Límite por archivo:** 100 MB
- **MIME types permitidos:** `image/jpeg`, `image/jpg`, `image/png`, `image/gif`, `image/webp`, `video/mp4`, `video/webm`, `video/ogg`, `video/quicktime`
- **Policies:** lectura pública, insert y delete sin restricción (sin auth)

### Path de archivos

```
media/{paperId}/{timestamp}-{uuid8}.{ext}
```

Ejemplo: `media/d933233a-f9c4/1748200000000-a3f7b2c1.mp4`

Agrupa archivos por paper. No hay limpieza automática si se cambia la URL — los archivos huérfanos quedan en el bucket.

### Operaciones de storage en el código

```js
// Upload
const { error } = await supabase.storage.from("media").upload(path, file);

// URL pública
const { data: { publicUrl } } = supabase.storage.from("media").getPublicUrl(path);

// Delete (no implementado aún — ver mejoras pendientes)
await supabase.storage.from("media").remove([path]);
```

---

## Migraciones

Las migraciones se aplican con Supabase CLI:

```bash
supabase link --project-ref gbrjqidgkhwrabjaepnh
supabase db push
```

El orden de aplicación es por nombre de archivo (timestamp prefix):

| Archivo | Qué hace |
|---------|----------|
| `20260525000000_init_papers.sql` | Crea tabla `papers` |
| `20260525000001_storage_media.sql` | Crea bucket `media` y sus policies |

Para agregar una nueva migración:

```bash
# Crear archivo con timestamp actual
touch supabase/migrations/$(date +%Y%m%d%H%M%S)_descripcion.sql
# Escribir el SQL, luego:
supabase db push
```

---

## Migración desde localStorage

Al arrancar la app por primera vez con Supabase, si la tabla `papers` está vacía y el localStorage tiene datos bajo la clave `hub-trabajos-cientificos:v1`, la app los migra automáticamente y limpia el localStorage. Es un proceso one-time en `loadPapers()`.

---

## Mejoras pendientes

- **Limpieza de archivos en Storage:** cuando se cambia la URL de un media item o se elimina un trabajo, el archivo en el bucket queda huérfano. Implementar delete del archivo al cambiar/quitar el media.
- **RLS + auth:** si se quiere multi-usuario, habilitar RLS en `papers` y agregar columna `user_id`, plus auth de Supabase (magic link o email/password).
- **Trigger `updated_at`:** mover la actualización de `updated_at` a un trigger de PostgreSQL para no depender del cliente.
- **Paginación:** si los papers crecen mucho, agregar `.range()` en la query inicial.
