# Hub de Trabajos Cientificos

MVP local para organizar trabajos cientificos con titulo, autores, estado, abstract, link externo y recursos multimedia.

## Uso rapido

```bash
npm install
npm run dev
```

La app guarda los datos en `localStorage`, asi que funciona sin base de datos.

## Funciones incluidas

- Lista local de trabajos cientificos.
- Pestañas internas para mantener varios trabajos abiertos.
- Link externo por trabajo, pensado para Google Docs, DOI o Drive.
- Vista y edicion de titulo, autores, estado, etiquetas y abstract.
- Soporte de imagenes y videos por URL, incluyendo YouTube y Vimeo.
- Exportacion e importacion JSON para respaldo o migracion futura.
- UI React con estado local preparado para reemplazar luego por llamadas a Supabase.

## Siguiente paso natural

Cuando quieras conectar Supabase, el modelo de datos ya esta separado en objetos JSON:

```json
{
  "id": "uuid",
  "title": "string",
  "authors": "string",
  "status": "Idea | En redaccion | Revision | Enviado | Publicado",
  "link": "string",
  "tags": ["string"],
  "abstract": "string",
  "media": [{ "type": "image | video", "url": "string", "caption": "string" }],
  "updatedAt": "ISO date"
}
```
