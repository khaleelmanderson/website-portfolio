# Portfolio Site — Project Context

## Stack
Static site: HTML, CSS, vanilla JS, jQuery, Bootstrap, hosted on GitHub Pages. No build tools/frameworks.

## Backend
Supabase (table "Projects", capital P). Bucket "project-images". 
Auth: single admin user via Supabase Auth.
RLS: public can SELECT where status='published'; only authenticated can INSERT/UPDATE/DELETE.
Client uses the publishable key only, never the secret key, in frontend code.

## Schema (Projects table)
id, title, description, tags (JSON array string), project_link, image_url, 
status (draft/published), created_at, role, tools, focus, 
key_highlights (JSON array string), gallery_images (JSON array string)

## Key files
- admin.html / assets/js/admin.js — password-protected compose/edit/delete panel with drag-and-drop gallery upload
- assets/js/public-projects.js — homepage dynamic project feed
- project-detail.html / assets/js/project-detail.js — individual project pages via ?id=

## Established conventions
- All Supabase calls wrapped in try/catch, loading states cleared in finally
- Image uploads validated for MIME type and 5MB size limit
- Deleting a project cleans up its storage images (cover + gallery)
- Tags/highlights/gallery fields parsed defensively (string or array, fallback to empty array)
- Auth session checked before every write action, not just UI hiding

## Do not
- Don't reintroduce raw alert() for errors, use the existing styled error pattern
- Don't declare a second "supabase" variable name, use "supabaseClient"
