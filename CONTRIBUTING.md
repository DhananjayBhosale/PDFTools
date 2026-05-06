# Contributing to PDF Chef

Thanks for helping improve PDF Chef. Keep contributions focused, privacy-preserving, and easy to review.

## Development setup

```bash
npm install
npm run dev
```

Before opening a pull request, run:

```bash
npm run lint
npm run test:catalog
npm run build
```

## Contribution principles

- Keep PDF processing in the browser unless there is a clear, documented reason not to.
- Do not add server uploads for user documents.
- Avoid large dependencies when a small browser-side implementation is enough.
- Match the existing UI patterns before introducing new controls.
- Keep copy short and direct.
- Add route metadata and sitemap coverage for new public tools.

## Adding a new tool

1. Add the tool UI under `components/Tools`.
2. Put PDF logic in `services` when it can be reused.
3. Add the route in `App.tsx`.
4. Add the card in `components/Tools/Dashboard.tsx`.
5. Add metadata in `components/SEO/RouteSEO.tsx`.
6. Add the route to `public/sitemap.xml`.
7. Run `npm run test:catalog`.

## Pull request checklist

- [ ] The change preserves the no-upload privacy model.
- [ ] TypeScript passes.
- [ ] Production build passes.
- [ ] New public routes have SEO and sitemap entries.
- [ ] UI changes work on mobile and desktop.
- [ ] The README or docs are updated if behavior changes.
