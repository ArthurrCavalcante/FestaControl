# Graph Report - .  (2026-07-18)

## Corpus Check
- Corpus is ~36,339 words - fits in a single context window. You may not need a graph.

## Summary
- 256 nodes · 490 edges · 36 communities (18 shown, 18 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.95)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Frontend UI & Core
- Backend Providers & Webhooks
- Database Services & CRM
- Package Components
- Src Components
- Src Components
- Package Components
- Supabase Components
- Public Components
- Oxlintrc Components
- Readme Components
- Scratch Components
- Scratch Components
- Scratch Components
- Supabase Components
- Scratch Components
- Scratch Components
- Scratch Components
- Src Components
- Index Components
- Scratch Components
- Supabase Components
- Supabase Components
- Supabase Components
- Public Components
- Public Components
- Public Components
- Public Components
- Public Components
- Public Components
- Public Components
- Src Components
- Src Components

## God Nodes (most connected - your core abstractions)
1. `react` - 35 edges
2. `Button()` - 21 edges
3. `useCompany()` - 17 edges
4. `supabase` - 17 edges
5. `Provider` - 14 edges
6. `Card()` - 12 edges
7. `logActivity()` - 9 edges
8. `Modal()` - 8 edges
9. `NormalizedMessage` - 7 edges
10. `FichaCliente()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `Agenda()` --references--> `react`  [EXTRACTED]
  src/components/Agenda.jsx → package.json
- `KanbanBoard()` --references--> `react`  [EXTRACTED]
  src/components/KanbanBoard.jsx → package.json
- `Privacy Policy` --references--> `Supabase`  [EXTRACTED]
  public/privacy.html → README.md
- `App()` --calls--> `useCompany()`  [EXTRACTED]
  src/App.jsx → src/hooks/useCompany.js
- `Automacoes()` --calls--> `useCompany()`  [EXTRACTED]
  src/components/Automacoes.jsx → src/hooks/useCompany.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Tech Stack** — readme_react, readme_vite, readme_supabase, readme_gemini_api, readme_vercel [EXTRACTED 1.00]
- **Social Media Icons** — public_icons_bluesky_icon, public_icons_discord_icon, public_icons_github_icon, public_icons_x_icon [INFERRED 0.95]

## Communities (36 total, 18 thin omitted)

### Community 0 - "Frontend UI & Core"
Cohesion: 0.19
Nodes (9): react, STATUS_MAP, Badge(), Button(), Card(), EmptyState(), Modal(), PIPELINE_STAGES (+1 more)

### Community 1 - "Backend Providers & Webhooks"
Cohesion: 0.10
Nodes (11): corsHeaders, EvolutionProvider, FacebookProvider, MessengerProvider, NormalizedMessage, Provider, ProviderFactory, supabase (+3 more)

### Community 2 - "Database Services & CRM"
Cohesion: 0.16
Nodes (20): App(), Catalogo(), isVideo(), FichaCliente(), ConfirmDialog(), ErrorState(), PromptDialog(), Skeleton() (+12 more)

### Community 3 - "Package Components"
Cohesion: 0.10
Nodes (20): oxlint, devDependencies, oxlint, @types/react, @types/react-dom, vite, @vitejs/plugin-react, name (+12 more)

### Community 4 - "Src Components"
Cohesion: 0.12
Nodes (15): Acervo, Agenda, Automacoes, BaseClientes, CaixaEntrada, Catalogo, FichaCliente, GeradorOrcamento (+7 more)

### Community 5 - "Src Components"
Cohesion: 0.21
Nodes (10): Automacoes(), CONNECTIONS, Configuracoes(), Dashboard(), GeradorOrcamento(), WizardConexao(), CompanyContext, CompanyProvider() (+2 more)

### Community 6 - "Package Components"
Cohesion: 0.15
Nodes (13): lucide-react, dependencies, lucide-react, react, react-dom, react-hot-toast, @supabase/supabase-js, react (+5 more)

### Community 7 - "Supabase Components"
Cohesion: 0.24
Nodes (6): corsHeaders, supabase, corsHeaders, supabase, analyzeConversation(), MediaService

### Community 8 - "Public Components"
Cohesion: 0.22
Nodes (8): background_color, description, display, icons, name, short_name, start_url, theme_color

### Community 9 - "Oxlintrc Components"
Cohesion: 0.25
Nodes (7): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema, oxc, warn

### Community 10 - "Readme Components"
Cohesion: 0.25
Nodes (8): Privacy Policy, WhatsApp Integration, FestaFlow, Gemini API, React, Supabase, Vercel, Vite

### Community 11 - "Scratch Components"
Cohesion: 0.40
Nodes (3): env, envFile, supabase

### Community 12 - "Scratch Components"
Cohesion: 0.50
Nodes (4): envConfig, runScenario(), startTests(), supabase

### Community 14 - "Supabase Components"
Cohesion: 0.50
Nodes (3): imports, @supabase/functions-js, @supabase/server

### Community 18 - "Src Components"
Cohesion: 1.00
Nodes (3): Textured Purple Bottom Layer, Isometric Layer Illustration, Top Layer Wireframe

## Knowledge Gaps
- **80 isolated node(s):** `$schema`, `oxc`, `react/rules-of-hooks`, `warn`, `name` (+75 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **18 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Package Components` to `Package Components`?**
  _High betweenness centrality (0.104) - this node is a cross-community bridge._
- **Why does `react` connect `Frontend UI & Core` to `Oxlintrc Components`, `Database Services & CRM`, `Src Components`, `Src Components`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **What connects `$schema`, `oxc`, `react/rules-of-hooks` to the rest of the system?**
  _80 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Backend Providers & Webhooks` be split into smaller, more focused modules?**
  _Cohesion score 0.10338680926916222 - nodes in this community are weakly interconnected._
- **Should `Package Components` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._
- **Should `Src Components` be split into smaller, more focused modules?**
  _Cohesion score 0.12418300653594772 - nodes in this community are weakly interconnected._