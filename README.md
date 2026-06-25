# lex-control-admin

Panel de administración de **LEX Control** para el **rol ADMIN de plataforma**: gestiona
despachos cliente (empresas), el catálogo de servicios, planes, usuarios, facturación,
el catálogo de procesos y el módulo comercial. Corre en **`:3000`**.

- **Stack:** Next.js 16 (App Router), React 19, Tailwind CSS v4, TypeScript.
- Rutas bajo `src/app/(dashboard)/`; navegación data-driven en `src/lib/nav.tsx`;
  primitivas de UI compartidas en `src/components/ui.tsx`. Alias `@/` → `src/`.

## Comandos

```bash
pnpm dev      # dev server → http://localhost:3000
pnpm build    # next build (output: standalone)
pnpm start    # sirve el build de producción
pnpm lint     # eslint
```

## Entorno

`lex-control-admin/.env.local`:

- `API_PROXY_TARGET` — destino del proxy `/api/*` (rewrites de `next.config.ts`); el
  navegador llama same-origin y Next reenvía a la API. Default `http://localhost:4000`;
  en Docker `http://api:4000`. **Ojo:** se evalúa en build (pasalo como build arg).
- `NEXT_PUBLIC_API_URL` — URL de la API para el código de cliente.

---

Setup completo, variables de entorno y cómo levantar toda la plataforma: ver el
[README del repo paraguas](../README.md).
