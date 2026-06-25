# Deployment Verification

After deployment, verify the website is reachable and has no 500 or resource loading errors.

- Local production service verification checks the relevant local port, for example `http://localhost:3001/login`.
- Public production deployment verification uses `https://comfy.bgmss.fun/`.
- Development service verification checks only the dev port, for example `http://localhost:3000/login`; see `../dev-service.md`.

Continue verification until all required requests are normal, or report the exact failing URL/status/error and stop with the deployment lock state preserved as required by `lock.md`.
