# Next Build During Deploy

Before build, handle Next build competition and preserve `.next/cache`.

## Build Competition Check

Check whether a `next build` or `.next\build` subprocess already exists in the current project directory:

```powershell
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
  Where-Object { $_.CommandLine -like '*D:\Luca\Code\MyProject\comfyui-manager*' -and ($_.CommandLine -like '*next*build*' -or $_.CommandLine -like '*.next\build*') }
```

- If an active build process exists, do not start a second build. Wait for it to finish, or report the current build process information and stop.
- If Next reports `Another next build process is already running`, first confirm there is no active build or `.next\build` process. Only after confirming no active build may `.next\lock` be treated as stale and deleted before retrying.
- When build fails, write output to a dedicated log such as `build-prod.log`, then inspect the log and `.next/diagnostics` before retrying.

## Cache Policy

- Production build preserves `.next/cache` by default.
- Do not manually run `Remove-Item -Recurse -Force .next` before build.
- Do not delete `.next/cache`.
- Next 16 `cleanDistDir` normally cleans build output under `.next` while excluding `cache`, `dev`, and `lock`.
- Old static chunk risk is controlled through Next's dist cleanup, new `BUILD_ID`, service restart, and resource loading verification.
- Only if verification finds stale chunk 500s or obviously broken build artifacts should you diagnose or clean non-cache artifacts such as `.next/static`, `.next/server`, `.next/types`, manifests, or traces.

## Build Command

Use the webpack path:

```powershell
npx next build --webpack
```

If the current project directory already has a running `npm run dev` / `next dev` service, do not clean `.next` or `.next/dev`; cleaning can break the running dev service cache and cause 500s. In that case, skip production build cleanup actions and prefer the current dev service for verification.
