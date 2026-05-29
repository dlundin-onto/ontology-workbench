# Contributing to Ontology Workbench

Thank you for your interest in contributing!

## Development setup

**Prerequisites:** Node.js 18+, npm 9+

```bash
git clone https://github.com/your-org/ontology-workbench.git
cd ontology-workbench
npm install
npm run dev          # start dev server at http://localhost:5173
npm run lint         # ESLint check
npm run format       # Prettier format
npm run build:html   # production single-file build → dist/ontology-workbench.html
```

## Project structure

```
src/
  components/   React components (one file per component)
  data/         Static data: personas, paradigms, platforms, principles, sample
  lib/          Pure logic: api, tools, storage, serialize, report
  types/        TypeScript interfaces (index.ts)
  tokens.ts     Design tokens (T), META, EW/EH, hexToRgb
  App.tsx       Root component and WorkbenchApp layout
  main.tsx      Vite entry point
```

## Code style

- ESLint + Prettier are enforced. Run `npm run lint` before opening a PR.
- All components use React inline styles (no CSS modules). Keep it consistent.
- Use `import type` for type-only imports.
- Avoid `any` except for dynamic API response shapes.

## Adding a new export format

1. Add a serializer function to `src/lib/serialize.ts`.
2. Add an entry to the `FORMATS` array in `src/components/ExportPanel.tsx`.

## Adding a new swarm persona

Add an entry to the `PERSONAS` array in `src/data/personas.ts`. Each persona needs `id`, `name`, `short`, `color`, `icon` (Tabler icon class), and `voice` (the system-prompt character description).

## Adding a new platform to the validator

Add an entry to the `PLATFORMS` array in `src/data/platforms.ts`. Include a detailed `context` string describing the platform's strengths and weaknesses — this is injected directly into the AI prompt.

## Submitting a pull request

1. Fork the repository and create a feature branch.
2. Make your changes and ensure `npm run lint` passes.
3. Open a PR with a clear description of what you changed and why.
4. PRs that add features should include a brief note in the PR description about how to test the change manually.

## Reporting bugs

Open a GitHub issue with:
- Steps to reproduce
- Expected vs actual behaviour
- Browser and OS
- Whether the issue occurs with the sample model or a custom one
