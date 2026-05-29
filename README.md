# Ontology Workbench

**AI-powered enterprise data modeling — runs entirely in the browser, no backend required.**

Ontology Workbench is an open-source tool for building and reasoning about enterprise ontologies and data models. It combines a visual canvas, an AI assistant powered by Claude, a multi-persona agent swarm for modeling debates, and a platform fit validator — all in a single HTML file you can open locally.

## Features

| Feature | Description |
|---|---|
| **Visual canvas** | Drag-and-drop entity–relation diagram with pan, zoom, and wire drawing |
| **AI assistant** | Chat with Claude to modify the model — changes execute live on the canvas |
| **Agent Swarm** | 11 expert personas debate your model (IA, SA, Developer, DBA, Security, …) |
| **Platform Validator** | Scores your model against SQL, Graph DB, Snowflake, Databricks, Inorigo, MongoDB, Kafka |
| **Export** | OWL/Turtle, SHACL, JSON-LD, Model JSON, CSV, SVG, HTML report |
| **Import** | Images (AI vision extraction), OWL/RDF, JSON-LD, PowerPoint, Visio |
| **Model Library** | Save and load models in browser localStorage |
| **Executive Report** | AI-generated briefing document summarising decisions and trade-offs |
| **Paradigms** | OWL/RDF and Metagraph modeling modes |
| **Principles** | Configurable enterprise modeling principles injected into every AI prompt |

## Quick start — zero install

1. Download `ontology-workbench.html` from the [latest release](https://github.com/your-org/ontology-workbench/releases).
2. Open it in any modern browser (Chrome, Firefox, Edge, Safari).
3. Enter your [Anthropic API key](https://console.anthropic.com) when prompted.
4. Start modeling.

Your API key is stored only in `sessionStorage` for the current tab. It is never sent anywhere except directly to `api.anthropic.com`.

## Development setup

**Prerequisites:** Node.js 18 or later

```bash
git clone https://github.com/your-org/ontology-workbench.git
cd ontology-workbench
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

### Build the standalone HTML

```bash
npm run build:html
# Output: dist/ontology-workbench.html  (single self-contained file)
```

### Other scripts

```bash
npm run lint      # ESLint
npm run format    # Prettier
npm run preview   # Preview the production build
```

## API key and security

- Your key is entered once in the app and stored in `sessionStorage` (cleared on tab close).
- It is sent **only** to `api.anthropic.com` — no proxy, no logging, no third-party servers.
- The key is never written to localStorage or embedded in any exported file.
- Get a key at [console.anthropic.com](https://console.anthropic.com).

## Architecture

```
src/
  components/     One .tsx file per UI component (~18 components)
  data/           Static data: paradigms, personas, platforms, principles, sample model
  lib/            Pure logic modules: api, tools, storage, serialize, report
  types/          TypeScript interfaces for all domain objects
  tokens.ts       Design tokens, metaclass colours, canvas geometry helpers
  App.tsx         Root layout and WorkbenchApp state
  main.tsx        Vite entry point
```

The AI assistant communicates with the Claude API directly from the browser. It outputs JSON action blocks that are parsed client-side and executed against the canvas state — no tool-use API required, no backend.

## Metaclass system

Every entity belongs to one of four metaclasses:

- **Entity** — a real-world concept (Customer, Product)
- **Relation** — a reified relationship with its own identity and attributes (OrderLine, Employment)
- **Attribute** — a shared, implementable property structure (Description, ValidityPeriod)
- **ValueSet** — reference data / enumeration (Status, Country)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[GNU Affero General Public License v3.0](LICENSE) — see the full text at https://www.gnu.org/licenses/agpl-3.0.txt
