# Deploy y configuración

## Variables de entorno requeridas

```env
VITE_SUPABASE_URL=https://gbrjqidgkhwrabjaepnh.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

El prefijo `VITE_` es necesario para que Vite las exponga al bundle del cliente. Sin él, las variables son `undefined` en el browser.

Archivo local: `.env` (en `.gitignore`, nunca se commitea).
Plantilla: `.env.example`.

---

## Desarrollo local

```bash
# 1. Instalar dependencias
npm install

# 2. Crear .env con las credenciales (copiar de .env.example)
cp .env.example .env
# Completar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY

# 3. Arrancar servidor de desarrollo
npm run dev
# Disponible en http://127.0.0.1:5173
```

---

## Supabase CLI

```bash
# Ver proyectos
supabase projects list

# Linkear el directorio al proyecto remoto
supabase link --project-ref gbrjqidgkhwrabjaepnh

# Aplicar migraciones pendientes
supabase db push

# Ver API keys
supabase projects api-keys --project-ref gbrjqidgkhwrabjaepnh
```

El proyecto está linkeado. La referencia está en `supabase/.temp/project-ref`.

---

## Vercel

```bash
# Preview deploy
vercel

# Deploy a producción
vercel --prod
```

### Variables de entorno en Vercel

Están configuradas para los tres ambientes (production, preview, development):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Para agregar o modificar variables:
```bash
# Agregar
vercel env add NOMBRE_VARIABLE production

# Listar
vercel env ls

# La CLI v50 tiene un bug con preview sin branch — usar la API directamente:
curl -X POST "https://api.vercel.com/v10/projects/PROJECT_ID/env" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key":"VAR","value":"value","type":"plain","target":["preview"]}'
```

El token está en `~/.local/share/com.vercel.cli/auth.json`. El Project ID en `.vercel/project.json`.

### Nota sobre la CLI de Vercel

La CLI instalada localmente es v50 (antigua). La versión en producción es v54. Algunos flags (`--value` para preview) no funcionan en v50 pero sí en el servidor. Para actualizar:
```bash
npm install -g vercel@latest
```

---

## Build manual

```bash
npm run build
# Output en dist/ — archivos estáticos listos para cualquier hosting
```

---

## Flujo de deploy completo

```
Cambio en código
     │
     ▼
git add + git commit + git push
     │
     ▼
vercel --prod
     │
     ├── Vercel descarga archivos
     ├── npm install
     ├── npm run build (Vite inyecta VITE_* vars)
     └── Sirve dist/ como sitio estático
```

La DB (Supabase) es independiente del deploy — no requiere ningún paso adicional salvo cuando hay migraciones nuevas (`supabase db push`).

---

## Crear el proyecto desde cero (referencia)

Si hubiera que recrear todo desde cero:

```bash
# 1. Clonar repo
git clone https://github.com/jutopa31/HubTrabajosCientificos
cd HubTrabajosCientificos
npm install

# 2. Crear proyecto en Supabase
supabase projects create HubTrabajosCientificos \
  --org-id suhycmlnxplzjjvkfmhz \
  --region sa-east-1 \
  --db-password "password-seguro"

# 3. Linkear y aplicar migraciones
supabase link --project-ref REF_ID
supabase db push

# 4. Obtener credenciales y completar .env
supabase projects api-keys --project-ref REF_ID

# 5. Configurar y deployar en Vercel
vercel
vercel env add VITE_SUPABASE_URL production
vercel env add VITE_SUPABASE_ANON_KEY production
vercel --prod
```
