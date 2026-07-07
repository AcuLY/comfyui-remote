# Config, Runtime Assets, And Generated Code

Classification: runbook
Update trigger: config schema changes, ComfyUI target resolution changes, runtime artifact policy changes, public asset additions/removals, generated Prisma output changes, or local DB fixture decisions.

This runbook owns non-code artifact policy for configuration files, generated Prisma clients, public assets, and runtime-only local files.

## Config Files

| File | Owner | Schema | Runtime relation | Verification |
| --- | --- | --- | --- | --- |
| `config/path-maps.json` | `runtime-config` | JSON object with `loraCategories`, a map from product category ids to relative directories under `MODEL_BASE_DIR/loras`. Values must be relative directory names, not absolute paths. | Served through `/api/path-maps` and used to keep LoRA category browsing predictable. | `npx tsx --test tests/test-config-runtime-governance.test.ts` |
| `config/comfy-targets.example.json` | `comfy-runtime` | JSON object with optional `active` and required `targets`. Each target is either `mode: "local"` or `mode: "ssh"`. | Loaded by `COMFY_TARGET_CONFIG_PATH`; `COMFY_ACTIVE_TARGET` can override `active`. | `npx tsx --test tests/test-comfy-target-config.test.ts tests/test-config-runtime-governance.test.ts` |

## Comfy Target Fields

Local targets:

- `apiUrl`: ComfyUI API URL. Falls back to `COMFY_API_URL`.
- `modelBaseDir`: model root used to derive `loras` and `checkpoints`. Falls back to `MODEL_BASE_DIR`.
- `comfyLaunchCmd`: local launch command. Falls back to `COMFY_LAUNCH_CMD`.
- `comfyLaunchCwd`: launch working directory. Falls back to `COMFY_LAUNCH_CWD`.

SSH targets:

- `sshHost`, `sshPort`, and `sshKeyPath`: SSH connection details.
- `localApiUrl`: local tunnel URL exposed to the app.
- `remoteApiHost` and `remoteApiPort`: ComfyUI API address from the remote host.
- `remoteComfyRoot` and `remoteModelsRoot`: remote ComfyUI checkout and model roots.
- `startCommand`, `stopCommand`, `restartCommand`, and `logCommand`: optional remote service commands.
- `hashCommandTemplate`: optional remote file hash command with `{path}` placeholder.
- `tunnelAutoStart`: whether the app may start an SSH tunnel automatically.

## Generated Prisma

`src/generated/**`, including `src/generated/prisma.ts`, `src/generated/prisma/`, and `src/generated/prisma-sqlite/`, is generated Prisma output. Regenerate it through the Prisma scripts; do not manually refactor or format generated files in cleanup tasks.

Generated Prisma rule: regenerate, then review the generated diff; never manually edit generated client files.

## Runtime Files

Runtime-only local areas are ignored and must not be committed:

- `.next/**`
- `data/**`
- `logs/**`
- `.tmp/**`
- `.deploy.lock/**`
- `server-dev-*.log`
- `server-prod-*.log`
- `build-prod*.log`
- local DB files such as `data/comfyui.db` and `prisma/data/comfyui.db`

`data/comfyui.db` and `prisma/data/comfyui.db` are runtime data, not fixtures; do not track them. Tests that need SQLite state should create fresh temp DB/file fixtures through `tests/fixtures/sqlite-db.ts` or an equivalent per-test temp setup.

## Public Assets

Default Next.js starter assets under `public/file.svg`, `public/globe.svg`, `public/next.svg`, `public/vercel.svg`, and `public/window.svg` are removed when no route or component references them. New public assets need an owning route or doc entry before they are committed.
