# ComfyUI Remote - Startup & Restart Quick Reference

## 🎯 Key Takeaways

### What's Implemented
✅ **Managed process lifecycle** - Start, stop, restart ComfyUI from UI  
✅ **Periodic health monitoring** - Checks `/system_stats` every 10s  
✅ **Automatic restart** - Recovers from crashes/failures automatically  
✅ **Rate limiting** - Prevents infinite restart loops (3 in 5 min)  
✅ **Startup grace period** - Allows 2 min boot time before treating as failed  
✅ **External process detection** - Works if ComfyUI started outside the app  
✅ **Live monitoring UI** - Dashboard with logs, state, controls at `/settings/monitor`  
✅ **Log capture** - Last 200 lines of stdout/stderr with color coding

---

## ⏱️ Timeout Settings (All Tunable)

| Setting | Default | Env Variable | Impact |
|---------|---------|--------------|--------|
| **Health check interval** | 10s | `COMFY_HEALTH_INTERVAL_MS` | How often we ping `/system_stats` |
| **Health check timeout** | 5s | *(hard-coded)* | Per-request timeout for each health check |
| **Startup grace period** | 120s | `COMFY_STARTUP_GRACE_MS` | Time to allow process to boot before counting failures |
| **Unhealthy threshold** | 3 failures | *(hard-coded)* | Consecutive health failures before restart |
| **Max auto-restarts** | 3 in 5 min | `COMFY_MAX_RESTARTS` + `COMFY_RESTART_WINDOW_MS` | Rate limit to prevent loops |
| **SIGTERM→SIGKILL** | 5s | *(hard-coded)* | Grace period for clean shutdown |
| **UI poll interval** | 5s | *(hard-coded)* | Monitor page refreshes every 5s |

---

## 🚀 Startup Flow

```
App starts
  ↓
instrumentation.ts runs (Next.js hook)
  ↓
getComfyProcessManager() initialized
  ↓
initAutoStart()
  ├─ If COMFY_LAUNCH_CMD not set:
  │   └─ "Managed mode disabled" (health checks only, no spawn)
  │
  ├─ If COMFY_AUTO_START = false:
  │   └─ Health monitoring only (wait for manual start)
  │
  └─ If COMFY_AUTO_START = true:
      └─ Start ComfyUI automatically
```

**Startup Grace Period** (120s default):
- Process spawned → state = "starting"
- Health checks begin failing (ComfyUI still loading)
- BUT: Within 120s grace period, failures are logged but don't trigger restart
- After 120s grace or first successful health check → state = "running"

---

## 🔄 Restart Scenarios

### 1. Manual Restart (User clicks "Restart" button)

```
User clicks button
  ↓
POST /api/comfy/restart (localhost only)
  ↓
resetMaxRestarts() - clears restart counter
  ↓
stop() - SIGTERM (5s grace), then SIGKILL
  ↓
sleep 1s
  ↓
start() - spawn process again
  ↓
startHealthCheck() resumes
```

**Key:** Manual restart always works even if auto-restart limit reached.

### 2. Automatic Restart (Health check fails)

```
performHealthCheck() runs every 10s
  ├─ Fetch /system_stats with 5s timeout
  │
  ├─ If success:
  │   └─ State = "running" ✓, reset failure counter
  │
  └─ If fail:
      ├─ Increment consecutiveHealthFailures
      │
      ├─ If in startup grace period & state="starting":
      │   └─ Log but don't act (still booting)
      │
      ├─ If 3+ failures & (state="running" or "starting"):
      │   └─ State = "unhealthy"
      │       └─ maybeAutoRestart()
      │
      └─ maybeAutoRestart() checks:
          ├─ Is COMFY_AUTO_RESTART enabled? (default: yes)
          ├─ Is COMFY_LAUNCH_CMD configured? (required for spawning)
          ├─ Have we exceeded restart limit in window?
          │   └─ If yes: State = "error", stop trying
          │   └─ If no: State = "restarting"
          │       ├─ Wait 2 seconds
          │       └─ spawnProcess() again
          │           └─ Back to "starting" state
          │               └─ Grace period applies again
          └─ Record timestamp for rate limiting
```

### 3. Process Crash (Process exits unexpectedly)

```
child.on('exit') handler triggered
  ├─ State changes from "running" → "error"
  ├─ errorMessage = "Process exited unexpectedly (code=N)"
  └─ handleProcessExit() → maybeAutoRestart()
      └─ Same logic as scenario #2 above
```

---

## 📊 Process States

| State | Meaning | Can Start | Can Stop | Can Restart | Auto-Restart? |
|-------|---------|-----------|----------|-------------|---------------|
| **stopped** | Not running | ✓ | - | - (becomes start) | No |
| **starting** | Spawned, initializing | - | ✓ | - | Yes (if fails after grace) |
| **running** | Healthy, responsive | - | ✓ | ✓ | Yes (if fails) |
| **unhealthy** | 3+ check failures | - | ✓ | ✓ | Yes (if enabled) |
| **restarting** | Killing old, spawning new | - | - | - | — (temporary) |
| **error** | Crashed or max restarts hit | ✓ | - | ✓ (manual ok) | No (stopped trying) |

---

## 🎮 UI Controls

### Monitor Page Location
`/settings/monitor`

### Display Elements

**Status Badge**
- Shows current state with color
- Green pulsing dot when running
- Red for errors/unhealthy

**Stats Grid** (4 items)
```
[ State ]  [ Uptime ]  [ PID ]  [ Restarts ]
```

**Action Buttons** (only in managed mode)
```
[🎬 启动]      [⏹️ 停止]      [🔄 重启]
 (Start)       (Stop)       (Restart)
```

**Conditions**
- Start button: Enabled if state = "stopped" or "error"
- Stop button: Enabled if state = "running", "starting", or "unhealthy"
- Restart button: Enabled if state ≠ "stopped"

**Log Viewer**
- Last 200 lines
- Auto-scrolls to bottom (user can scroll up to disable)
- Color-coded:
  - 🔵 `[manager]` messages = blue
  - 🟢 `✓` (health success) = green
  - 🔴 `✗` (health failure) = red
  - 🟠 Real errors in stderr = amber
  - ⚪ Harmless stderr info = gray

---

## 🔧 Configuration

### Enable Managed Mode

Set in `.env`:
```bash
COMFY_LAUNCH_CMD="conda run -n comfyui python main.py --listen 0.0.0.0"
COMFY_LAUNCH_CWD="/path/to/ComfyUI"
```

Without `COMFY_LAUNCH_CMD`, process management is disabled (health-check only).

### Auto-Start (Optional)
```bash
COMFY_AUTO_START=true          # Default: false
COMFY_AUTO_RESTART=true        # Default: true (recommended)
```

### Tuning Timeouts (Optional)

```bash
# If ComfyUI takes >2 min to start, increase grace period:
COMFY_STARTUP_GRACE_MS=180000  # 3 minutes

# If want faster health checks:
COMFY_HEALTH_INTERVAL_MS=5000  # Every 5 seconds

# If hitting restart limit too often:
COMFY_MAX_RESTARTS=5           # Allow 5 restarts
COMFY_RESTART_WINDOW_MS=600000 # In 10 minutes
```

---

## 🔍 Health Check Details

### What We Check
- Endpoint: `GET {COMFY_API_URL}/system_stats`
- Expected: HTTP 200 OK
- Timeout: 5 seconds per request

### Grace Period Behavior

**Example Timeline** (with 120s grace, 10s check interval):

```
t=0s    Process spawned
t=0s    1st check → fails (ComfyUI loading)
        → In grace period, log but continue
        
t=10s   2nd check → fails (still loading)
        → Log: "ComfyUI starting up (10s elapsed, grace 120s)"
        
t=50s   5th check → SUCCESS ✓
        → State = "running" ✓
        
---OR if ComfyUI never comes up---

t=120s  Grace period EXPIRES
        All previous failures now count

t=130s  Next check fails
        consecutiveHealthFailures = 1+
        
t=150s  Another fails
        consecutiveHealthFailures = 2+
        
t=160s  Third fails
        consecutiveHealthFailures = 3
        → State = "unhealthy"
        → maybeAutoRestart() triggered
```

---

## 📝 Implementation Files

**Backend**
- `src/server/services/comfy-process-manager.ts` - 660 lines, all the logic

**API Routes**
- `src/app/api/comfy/{status,start,restart}/route.ts`

**Frontend**
- `src/app/settings/monitor/page.tsx` - 372 lines, dashboard

**Config**
- `src/lib/env.ts` - Environment variable parsing
- `.env.example` - Template with all settings

**Init**
- `src/instrumentation.ts` - Server startup hook

---

## 🐛 Debugging Tips

### Check logs
Visit `/settings/monitor` page → scroll through log viewer

### Check status
- API: `GET /api/comfy/status` (returns full JSON)
- Check `state`, `lastHealthOk`, `errorMessage` fields

### If auto-restart not working
1. Check `COMFY_AUTO_RESTART=true` in `.env`
2. Check `COMFY_LAUNCH_CMD` is set
3. Check `managedMode` is true in status response
4. If `maxRestartsReached=true`, click "Restart" button to reset counter

### If stuck in "starting"
- Grace period may still be active (log shows elapsed time)
- OR health checks are failing and grace period hasn't expired
- Wait for grace period (default 120s) or click "Stop"

### Force kill ComfyUI
If process is stuck:
- macOS/Linux: `lsof -ti :8188 | xargs kill -9`
- Windows: `taskkill /F /IM python.exe`

---

## 🎯 Typical Usage

1. **First time setup**
   - Configure `COMFY_LAUNCH_CMD` and `COMFY_LAUNCH_CWD` in `.env`
   - Set `COMFY_AUTO_START=true` to auto-boot
   - Restart app

2. **Monitor status**
   - Visit `/settings/monitor`
   - See real-time logs and state

3. **Manual control**
   - Click Start/Stop/Restart buttons as needed
   - Logs update automatically every 5s

4. **Troubleshoot issues**
   - Check log viewer for error messages
   - Click "Restart" to force recovery
   - Increase grace period if startup is slow

---

**Last Updated:** 2026-04-08
