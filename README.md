# Invitora — Digital Invitation Upload & Customization Studio

A monochrome, browser-side digital invitation editor built for Etsy stationery sellers and buyers. Customers upload the original design file (`SVG`, `PDF`, `PNG`, or `JPG`) they received from their Etsy purchase, preview it, customize text, Google Fonts, colors, and overlays, and export final **PDF**, **300 DPI PNG**, and **300 DPI JPG** files.

---

## Customer Workflow

1. Seller creates an invitation design and lists it as a digital download on Etsy.
2. Customer purchases the listing and downloads their original design file (`SVG`, `PDF`, `PNG`, or `JPG`).
3. Customer opens this website and uploads their design via drag-and-drop or **Browse Files**.
4. The app validates file type/signature and size (`25 MB` max), displays a live preview, and opens the design in the editor.
5. Customer customizes wording, typography, colors, or text overlays, inspects zoom/live preview, and downloads print-ready **PDF**, **PNG**, or **JPG** files.
6. Customer can click **Start Over** at any time to clear their current file and edits from the browser.

---

## Format Handling & Capabilities

- **SVG**: Sanitizes external scripts/event handlers while keeping vector paths, shapes, gradients, colors, and `<text>` elements intact (never flattened into an image).
- **PDF**: Imports and renders pages cleanly in-browser via `pdfjs-dist` with multi-page selection, extracts selectable text lines where available (with an optional flattened-background toggle), and clearly communicates font-matching or outlined-PDF limitations.
- **PNG / JPG**: Loads as a protected high-resolution background image while letting customers add, drag, style, and export editable text overlays.
- **Google Fonts Studio (`GoogleFontsPicker`)**: 36 curated Google Fonts bundled locally via `@fontsource/*`, organized across 12 style categories with live hover preview, weight/italic toggles, and curated pairings.
- **Browser Privacy**: All parsing, rendering, `localStorage` draft autosave, and export generation run strictly inside the visitor's browser—no files are stored on a backend server.

---

## Local Development (Node.js)

```bash
npm install
npm run lint     # TypeScript check (tsc --noEmit)
npm run dev      # Starts Vite dev server on http://localhost:3000
npm run build    # Builds static production bundle in dist/
```

---

## Deployment

Because all file parsing and PDF/PNG/JPG export happens client-side inside the browser, deploy `dist/` to any static host (Netlify, Cloudflare Pages, Vercel, etc.) with zero server-side template environment variables required.
