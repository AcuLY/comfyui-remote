# ComfyUI Remote - Exploration Summary

## Executive Summary

This document summarizes the comprehensive exploration of the ComfyUI Remote codebase, completed on **2026-04-08**.

### Documents Created

Three detailed documentation files have been generated:

1. **CODEBASE_EXPLORATION.md** (909 lines)
   - Complete technical reference
   - All timeout values explained
   - Full startup/restart flows
   - Health check implementation details
   - UI components breakdown
   - API routes documentation
   - Configuration reference

2. **STARTUP_RESTART_SUMMARY.md** (250+ lines)
   - Quick reference guide
   - Emoji-enhanced readability
   - Typical usage patterns
   - Debugging tips
   - Configuration checklist

3. **ARCHITECTURE_DIAGRAMS.md** (600+ lines)
   - 8 comprehensive ASCII diagrams
   - System architecture
   - Flow diagrams
   - State machine visualization
   - Timeline examples
   - Request/response cycles

---

## Key Findings

### ✅ What's Implemented

| Feature | Status | Location |
|---------|--------|----------|
| Process Management | ✅ Full | `comfy-process-manager.ts` |
| Health Monitoring | ✅ Automatic | Runs every 10s |
| Auto-Restart | ✅ With Rate Limiting | 3 in 5 minutes |
| Startup Grace Period | ✅ Implemented | 120s default |
| External Process Detection | ✅ Yes | `checkExistingComfyUI()` |
| Managed Mode Toggle | ✅ Yes | Based on `COMFY_LAUNCH_CMD` |
| UI Dashboard | ✅ Full Featured | `/settings/monitor` |
| Log Capture | ✅ Ring Buffer | Last 200 lines |
| Manual Controls | ✅ Start/Stop/Restart | Localhost only |
| API Endpoints | ✅ Complete | 3 endpoints + status |

### 🎯 Core Components

**Backend Singleton Service**
- Class: `ComfyProcessManager`
- File: `src/server/services/comfy-process-manager.ts` (660 lines)
- Responsibility: All lifecycle management
- Initialized: Via `src/instrumentation.ts` at server startup

**Frontend Dashboard**
- Component: `MonitorPage`
- File: `src/app/settings/monitor/page.tsx` (372 lines)
- Route: `/settings/monitor`
- Polling: Every 5 seconds

**API Routes**
- `GET /api/comfy/status` - Query current state
- `POST /api/comfy/start` - Start process
- `POST /api/comfy/restart` - Restart process
- All localhost-restricted

---

## Timeout Configuration

### Tunable (Environment Variables)

| Setting | Default | Min | Max | Use Case |
|---------|---------|-----|-----|----------|
| `COMFY_HEALTH_INTERVAL_MS` | 10,000ms | - | - | Health check frequency |
| `COMFY_STARTUP_GRACE_MS` | 120,000ms | - | - | Boot allowance |
| `COMFY_MAX_RESTARTS` | 3 | - | - | Rate limit count |
| `COMFY_RESTART_WINDOW_MS` | 300,000ms | - | - | Rate limit window |

### Hard-Coded (In Source)

| Setting | Value | Purpose |
|---------|-------|---------|
| Per-request timeout | 5,000ms | Health check fetch |
| Pre-launch timeout | 3,000ms | External detection |
| SIGTERM grace | 5,000ms | Kill grace period |
| Pre-restart delay | 2,000ms | Resource cleanup |
| Stop-restart delay | 1,000ms | Clean termination |
| Unhealthy threshold | 3 failures | Before action |
| UI poll interval | 5,000ms | Dashboard refresh |

---

## State Machine

### 6 Process States

```
stopped → starting → running ↔ unhealthy → restarting → error
   ↑                                                        ↑
   └─────────────────────────────────────────────────────┘
                  User stop() or exit()
```

### State Transitions

- **stopped → starting**: User clicks start OR auto-start enabled
- **starting → running**: Health check succeeds
- **starting → unhealthy**: 3+ failures after grace period
- **running → unhealthy**: 3+ consecutive health failures
- **unhealthy → restarting**: Auto-restart triggered (if enabled)
- **restarting → starting**: Process respawned
- **any → error**: Max restarts reached OR process crash
- **any → stopped**: User clicks stop

---

## Health Checking

### Mechanism

**Endpoint:** `GET {COMFY_API_URL}/system_stats`
- Expected: HTTP 200 OK
- Timeout: 5 seconds per request
- Frequency: Every 10 seconds (configurable)

### Grace Period

**Purpose:** Prevent false-positive restarts during slow boot

**Behavior:**
1. Process spawned, enters "starting" state
2. First 120 seconds (default): failures logged but don't count
3. After 120s OR first success: grace period ends
4. Subsequent 3+ failures → unhealthy state

**Timeline Example:**
```
t=0s    Process starts, health checks begin failing
t=50s   ComfyUI responds, state = "running" ✓
        (grace period still active but doesn't matter)
```

### Failure Counter

- **Increments:** Each failed health check
- **Resets:** On successful check
- **Threshold:** 3 consecutive failures triggers unhealthy state
- **Sliding Window:** Also tracks restart attempts (3 in 5 min)

---

## Restart Mechanisms

### Manual Restart
- Endpoint: `POST /api/comfy/restart`
- Resets restart counter automatically
- Always works (overcomes auto-restart limits)
- Flow: Stop → Wait 1s → Start

### Automatic Restart
- Triggered by health failure (3+ consecutive)
- Triggered by process crash/exit
- Limited by rate limiting (3 in 5 minutes)
- Graceful SIGTERM → Force SIGKILL after 5s

### Rate Limiting
- **Limit:** Max 3 restarts
- **Window:** 5-minute sliding window
- **When Hit:** State = "error", stops auto-restart
- **Reset:** User clicks "Restart" button (calls `resetMaxRestarts()`)

---

## Configuration for Deployment

### Minimal Setup (Health Check Only)

```bash
# .env
COMFY_API_URL="http://127.0.0.1:8188"
# No COMFY_LAUNCH_CMD = managed mode disabled
```

**Result:** Health monitoring only, no spawn/kill capabilities

### Full Managed Mode

```bash
# .env
COMFY_LAUNCH_CMD="conda run -n comfyui python main.py --listen 0.0.0.0"
COMFY_LAUNCH_CWD="/path/to/ComfyUI"
COMFY_AUTO_START=false          # Manual start (or true for auto-boot)
COMFY_AUTO_RESTART=true         # Recommended
COMFY_HEALTH_INTERVAL_MS=10000  # Check every 10s
COMFY_STARTUP_GRACE_MS=120000   # 2-minute boot allowance
```

**Result:** Full lifecycle management with health monitoring

### Tuning for Slow Startup

```bash
# If ComfyUI takes >2 minutes to boot
COMFY_STARTUP_GRACE_MS=180000   # 3 minutes

# Or reduce health check frequency
COMFY_HEALTH_INTERVAL_MS=15000  # 15 seconds
```

---

## UI Controls

### Monitor Dashboard (`/settings/monitor`)

**Display:**
- State badge (stopped/starting/running/unhealthy/restarting/error)
- Uptime in human-readable format (1h 23m 45s)
- Process ID
- Restart count with limit indicator
- Last health check timestamp
- Error message (if any)
- Live log viewer (last 200 lines, auto-scrolling)

**Controls:**
- Start button (enabled: state = stopped/error)
- Stop button (enabled: state = running/starting/unhealthy)
- Restart button (enabled: state ≠ stopped)

**All actions:**
- Require localhost origin (403 if remote)
- Show immediate UI feedback
- Auto-refresh status within 1 second

---

## Log System

### Capture

- Source: ComfyUI stdout/stderr
- Encoding: UTF-8 forced (handles emoji)
- Storage: Ring buffer (200 lines max)
- Format: `[timestamp] [level] message`

### Color Coding (Frontend)

```
[manager]           → Blue       (internal messages)
✓ (checkmark)      → Green      (health success)
✗ (X mark)         → Red        (health failure)
[stderr] + error   → Amber      (real errors: traceback, ModuleNotFoundError, etc.)
[stderr] + safe    → Gray       (harmless stderr: "Starting server", etc.)
stdout             → Default    (normal output)
```

### Features

- Auto-scrolls to bottom while viewing
- Preserves history (circular buffer)
- Color-coded for quick scanning
- Timestamp on each line

---

## External Process Detection

### Use Case

ComfyUI started outside the app (e.g., manual terminal, systemd service)

### Detection Flow

1. User clicks "Start" button
2. Manager attempts `checkExistingComfyUI()`
3. Tries `GET /system_stats` with 3s timeout
4. If success: Sets `externallyStarted = true`, state = "running"
5. Health checks continue normally

### Stopping External Process

When user clicks "Stop":
- Cannot send SIGTERM (no ChildProcess handle)
- Uses port-based kill:
  - **macOS/Linux:** `lsof -ti :PORT`
  - **Windows:** `netstat -ano | findstr :PORT`
- Falls back to `pkill -f python` if port extraction fails

---

## Implementation Details

### Process Spawning

```typescript
spawn(cmd, [], {
  shell: true,
  cwd: launchCwd,
  stdio: ["ignore", "pipe", "pipe"],
  env: {
    ...process.env,
    PYTHONIOENCODING: "utf-8",     // Handle emoji on Windows
    PYTHONLEGACYWINDOWSSTDIO: "0", // Python 3.6+ Windows fix
    PYTHONUTF8: "1",               // Force UTF-8
  }
})
```

### Singleton Pattern

```typescript
const globalForComfy = globalThis as typeof globalThis & {
  __comfyProcessManager?: ComfyProcessManager;
};

export function getComfyProcessManager(): ComfyProcessManager {
  if (!globalForComfy.__comfyProcessManager) {
    globalForComfy.__comfyProcessManager = new ComfyProcessManager();
  }
  return globalForComfy.__comfyProcessManager;
}
```

### Ring Buffer (Log Storage)

- Circular array implementation
- Capacity: 200 lines
- Overwrites oldest when full
- `toArray()` returns in chronological order

---

## File Structure

```
src/
├── server/services/
│   └── comfy-process-manager.ts    (660 lines - core logic)
├── app/api/comfy/
│   ├── status/route.ts
│   ├── start/route.ts
│   └── restart/route.ts
├── app/settings/monitor/
│   └── page.tsx                    (372 lines - UI dashboard)
├── components/
│   └── stat-chip.tsx               (UI component)
├── lib/
│   └── env.ts                      (Config parsing)
├── instrumentation.ts              (Server init hook)
└── ...

.env.example                        (Config template)
```

---

## Known Limitations

1. **Not persisted**: Process state resets if Next.js app restarts
2. **Single instance**: Only one ComfyUI per app instance
3. **Localhost-only**: Start/stop/restart restricted to localhost
4. **Manual override required**: Max restart limit must be reset manually
5. **Grace period**: Fixed to process spawn, not individual endpoints
6. **Windows compatibility**: Tested but uses platform-specific kill methods

---

## Debugging Checklist

- [ ] Check `COMFY_LAUNCH_CMD` is set in `.env`
- [ ] Check `managedMode` is true in `/api/comfy/status` response
- [ ] Visit `/settings/monitor` and check logs for errors
- [ ] Verify ComfyUI is reachable at `COMFY_API_URL/system_stats`
- [ ] If auto-restart disabled, check `COMFY_AUTO_RESTART=true`
- [ ] If max restarts reached, click "Restart" to reset counter
- [ ] Check if still in startup grace period (logs will show elapsed time)
- [ ] Increase `COMFY_STARTUP_GRACE_MS` if boot is slow

---

## Quick Links

- **Main logic:** `src/server/services/comfy-process-manager.ts`
- **Dashboard:** `/settings/monitor` page
- **Config template:** `.env.example`
- **Environment parsing:** `src/lib/env.ts`
- **API endpoints:** `src/app/api/comfy/`

---

## Recommendations for Usage

### Development

```bash
COMFY_LAUNCH_CMD="conda run -n comfyui python main.py"
COMFY_AUTO_START=false
COMFY_AUTO_RESTART=true
COMFY_STARTUP_GRACE_MS=120000
```

### Production

```bash
COMFY_LAUNCH_CMD="path/to/startup.sh"
COMFY_AUTO_START=true
COMFY_AUTO_RESTART=true
COMFY_STARTUP_GRACE_MS=180000  # Allow more time in prod
COMFY_MAX_RESTARTS=5           # More restarts than dev
COMFY_RESTART_WINDOW_MS=600000 # Larger window (10 min)
```

### Slow Startup Environment

```bash
COMFY_STARTUP_GRACE_MS=300000  # 5 minutes
COMFY_HEALTH_INTERVAL_MS=15000 # Check every 15s
```

---

## Testing Commands

### Check Status
```bash
curl http://localhost:3000/api/comfy/status | jq
```

### Trigger Start
```bash
curl -X POST http://localhost:3000/api/comfy/start
```

### Trigger Restart
```bash
curl -X POST http://localhost:3000/api/comfy/restart
```

### Monitor Page
Open: `http://localhost:3000/settings/monitor` in browser

---

## Conclusion

ComfyUI Remote has a **complete, well-designed process management system** with:

✅ Robust lifecycle management (start/stop/restart)  
✅ Automatic recovery with rate limiting  
✅ Comprehensive health monitoring  
✅ Startup grace period for slow boots  
✅ Full UI dashboard for monitoring & control  
✅ External process detection  
✅ Detailed logging for debugging  
✅ Flexible configuration via environment variables  

The implementation is production-ready and suitable for both development and deployment scenarios.

---

**Exploration Completed:** 2026-04-08  
**Explored By:** Claude Code  
**Documents Generated:** 4 (this summary + 3 detailed docs)
