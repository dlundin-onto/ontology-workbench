# Ontology Workbench

**Stop whiteboarding from scratch. Walk into the meeting with a model that's already been debated.**

Ontology Workbench is an AI-powered data and ontology modeling tool that runs entirely in your browser — no installation, no backend, no server. Open one HTML file, add your Anthropic API key, and go from blank canvas to a reviewed, AI-debated model draft in minutes.

👉 **[Try it live →](https://dlundin-onto.github.io/ontology-workbench)**
&nbsp;&nbsp;or&nbsp;&nbsp;
📥 **[Download latest release →](https://github.com/dlundin-onto/ontology-workbench/releases/latest)**

---

## The problem it solves

Every data project starts the same way: a room full of architects, analysts, and developers arguing about entities and relationships on a whiteboard. Half the time is spent re-explaining basics. Nobody agrees on a starting point. You leave with a blurry photo of a diagram and a follow-up booked for next week.

**Ontology Workbench short-circuits that ritual.**

Describe your domain in plain English → the AI generates a working model → the Agent Swarm debates it across 11 expert perspectives → you walk into the meeting with a reviewed, opinionated draft already on the canvas.

---

## Agent Swarm — the standout feature

The Swarm is a panel of AI expert personas who simultaneously debate your model, each challenging it from their own professional angle. Two rounds of debate — initial positions, then direct cross-challenge — before synthesising a consensus and proposing concrete model changes you can apply to the canvas in one click.

| Persona | What they challenge |
|---|---|
| **Information Architect** | Semantic correctness, metaclass use, taxonomy coherence |
| **Solution Architect** | Over-engineering, system boundaries, production survivability |
| **Business User** | Naming clarity, real-world concept alignment |
| **Process Owner** | Lifecycle completeness, end-to-end operational gaps |
| **IT Business Partner** | Business/IT misalignment, model vs. reality mismatches |
| **Developer** | Implementability, query patterns, developer pain points |
| **Integration Architect** | API contracts, event patterns, idempotency |
| **Database Admin** | Indexing, normalisation trade-offs, scale |
| **Data Steward** | Lineage, auditability, data quality enforcement |
| **Security Architect** | PII exposure, GDPR, access control patterns |
| **Domain Expert** | Domain accuracy, real-world nuances the model may miss |

**The result: the equivalent of a half-day workshop compressed into ~60 seconds.**

Personas are fully editable — rename them, adjust their voice, add new roles, or generate voice prompts with AI to tailor the debate to your organisation's specific concerns.

---

## Full feature set

| Feature | Description |
|---|---|
| 🖼 **Visual canvas** | Drag-and-drop entity–relation diagram with pan, zoom, and one-click wire drawing |
| 🤖 **AI Assistant** | Chat with Claude to build, extend, or refactor your model — changes execute live on the canvas |
| 🧠 **Agent Swarm** | 11-persona AI debate with consensus synthesis and one-click model application |
| ✅ **Platform Validator** | Scores your model across 7 platforms: SQL/RDBMS, Graph DB, Cloud Data Warehouse, Databricks, Metagraph/OWL, MongoDB, Kafka |
| 🌳 **Taxonomy Explorer** | Hierarchy detection, attribute inheritance visualisation, explicit vs. inferred edge confirmation |
| 📤 **Export** | OWL/Turtle, SHACL, JSON-LD, Model JSON, CSV, SVG canvas, HTML report |
| 📥 **Import** | Images (AI vision extraction), OWL/RDF, JSON-LD, PowerPoint, Visio |
| 📚 **Model library** | Save and load models in localStorage with up to 50 autosaved version checkpoints |
| 📋 **Executive report** | AI-generated briefing document summarising decisions, trade-offs, and platform fit |
| ⚙ **Work context** | Inject company, department, and project descriptions into every AI prompt for tailored output |
| 🔬 **Paradigms** | OWL/RDF and Metagraph modeling modes — each with its own AI guidance and validation rules |
| 📐 **Principles** | Configurable enterprise modeling principles injected into every AI interaction |

---

## Quick start — zero install

1. Download `ontology-workbench.html` from the [latest release](https://github.com/dlundin-onto/ontology-workbench/releases/latest)
2. Open it in Chrome, Firefox, Edge, or Safari
3. Click **Settings ⚙** and enter your [Anthropic API key](https://console.anthropic.com)
4. Start modeling

No server. No `npm install`. No Docker. One file, any machine, works offline.

> **API key security:** your key is stored only in `sessionStorage` for the current browser tab. It is never written to localStorage, never embedded in any exported file, and never sent anywhere except directly to `api.anthropic.com`. It is cleared automatically when you close the tab.

---

## Development setup

**Prerequisites:** Node.js 18+

```bash
git clone https://github.com/dlundin-onto/ontology-workbench.git
cd ontology-workbench
npm install
npm run dev        # → http://localhost:5173
```

### Build the standalone HTML

```bash
npm run build:html
# → dist/ontology-workbench.html  (~410 kB, fully self-contained)
```

### Scripts

```bash
npm run lint       # ESLint
npm run format     # Prettier
npm run preview    # Vite production preview
```

---

## Architecture

The AI assistant sends requests directly to the Claude API from the browser. Claude responds with a JSON action block; the workbench parses it client-side and executes it against the canvas state — no tool-use API, no backend, no proxy.

```
src/
  components/    ~20 React components — canvas, panels, modals
  data/          Static data: paradigms, personas, platforms, principles, sample model
  lib/           Pure logic: api, tools, storage, serialize, report, taxonomy
  types/         TypeScript interfaces for all domain objects
  tokens.ts      Design tokens and canvas geometry constants
  App.tsx        Root layout and shared application state
```

**Stack:** React 18 · TypeScript · Vite · `vite-plugin-singlefile` · Anthropic Claude API (direct browser access)

---

## Metaclass system

Every entity belongs to one of four metaclasses — the core modeling vocabulary:

| Metaclass | Meaning |
|---|---|
| **Entity** | A real-world concept: Customer, Product, Location |
| **Relation** | A reified relationship with its own identity and attributes: OrderLine, Employment |
| **Attribute** | A shared, reusable property structure: Description, ValidityPeriod |
| **ValueSet** | Reference data / enumeration: Status, Country, RoleType |

---

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## License

[GNU Affero General Public License v3.0](LICENSE)
