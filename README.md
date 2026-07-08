# ComfyUI Remote

Classification: current
Update trigger: product entrypoint, setup path, maintained source map, or documentation ownership changes.

ComfyUI Remote is a mobile-first management app for ComfyUI generation work. It organizes generation projects, review queues, asset libraries, training workflows, Comfy runtime control, and automation surfaces for agents.

This README is the human entrypoint. Agents should start with [`docs/index.md`](docs/index.md), then use [`docs/documentation-map.md`](docs/documentation-map.md) and the generated [`docs/repo-inventory.md`](docs/repo-inventory.md) to find the current source of truth. Do not treat this file as the route, API, environment-variable, or repository-structure inventory.

## What This App Owns

- Generation workspace: projects, sections, prompt blocks, LoRA and sampler parameters, templates, and preset-driven batch runs.
- Review and export: queue review, image keep/discard decisions, lightbox review, result galleries, and export workflows.
- Asset library: model files, LoRA files, preset categories, preset folders, preset variants, preset groups, and project templates.
- Training workspace: LoRA training projects, dataset revision, generation tasks, training runs, worker queues, presets, and templates.
- Comfy runtime: ComfyUI target configuration, queue/worker execution, process monitoring, generated image handling, thumbnails, and optional auto-censor post-processing.
- Agent API and MCP: high-level `/api/agent/**` workflows, broader `/api/**` automation routes, and the streamable HTTP MCP server at `/api/mcp`.

## Start Locally

Prerequisites:

- Node.js 20+
- A reachable ComfyUI instance, normally `http://127.0.0.1:8188`
- PostgreSQL through Docker, or SQLite for a lighter local setup

PostgreSQL path:

```bash
cp .env.example .env
npm install
docker compose up -d
npm run db:bootstrap
npm run dev
```

SQLite path:

```bash
cp .env.example .env
npm install
DB_PROVIDER=sqlite DATABASE_URL="file:./data/comfyui.db" npm run db:bootstrap:sqlite
DB_PROVIDER=sqlite DATABASE_URL="file:./data/comfyui.db" npm run dev
```

Open `http://localhost:3000` after the dev server starts. For auth, protected pages, ComfyUI checks, dev vs production service boundaries, and verification commands, use [`docs/local-verification.md`](docs/local-verification.md).

## Maintained Sources

| Need | Current source |
| --- | --- |
| Documentation routing and classification | [`docs/index.md`](docs/index.md), [`docs/documentation-map.md`](docs/documentation-map.md), [`docs/repo-inventory.md`](docs/repo-inventory.md) |
| Local setup and runtime config | [`.env.example`](.env.example), [`docs/local-verification.md`](docs/local-verification.md), [`docs/runbooks/config-runtime-assets.md`](docs/runbooks/config-runtime-assets.md) |
| Agent API, route contracts, MCP, and workflow JSON | [`docs/agent-api.md`](docs/agent-api.md), [`docs/api/README.md`](docs/api/README.md), [`docs/workflow.api.json`](docs/workflow.api.json), [`src/server/mcp/server.ts`](src/server/mcp/server.ts) |
| UI and product design direction | [`DESIGN.md`](DESIGN.md), [`docs/frontend-design-guide.md`](docs/frontend-design-guide.md), [`docs/ui/README.md`](docs/ui/README.md) |
| Database and Prisma provider behavior | [`docs/prisma-provider-matrix.md`](docs/prisma-provider-matrix.md), [`docs/prisma-schema-compatibility.md`](docs/prisma-schema-compatibility.md), [`prisma/schema.prisma`](prisma/schema.prisma), [`prisma/schema.sqlite.prisma`](prisma/schema.sqlite.prisma) |
| Training current implementation | [`src/app/training/[[...route]]/page.tsx`](src/app/training/[[...route]]/page.tsx), [`src/features/training`](src/features/training), [`src/server/services/training`](src/server/services/training), [`docs/prototypes/README.md`](docs/prototypes/README.md) |
| Queue, worker, and deployment workflow | [`docs/worker-boundaries.md`](docs/worker-boundaries.md), [`AGENTS.md`](AGENTS.md), [`agent-rules`](agent-rules) |

## Common Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local Next.js dev server. |
| `npm run build` | Build the production Next.js app. |
| `npm run start` | Start the built production app. |
| `npm run test` | Run the repository test suite. |
| `npm run lint` | Run ESLint. |
| `npm run db:bootstrap` | Initialize the PostgreSQL development database. |
| `npm run db:bootstrap:sqlite` | Initialize the SQLite development database. |
| `npm run training:workers` | Start real training worker processes. |
| `npm run training:workers:mock` | Start mock training workers for local workflow checks. |

## Documentation Policy

- Keep README stable and short. It should route readers to maintained sources rather than duplicate volatile facts.
- Do not add exact page inventories, API endpoint counts, MCP tool counts, environment-variable default tables, or large repository trees here.
- When behavior changes, update the owning source from the table above and adjust [`docs/index.md`](docs/index.md) or [`docs/documentation-map.md`](docs/documentation-map.md) only if ownership changes.
- Re-run `npx tsx scripts/docs/generate-repo-inventory.ts` when tracked files are added, removed, renamed, or moved.

## License

Private project.
