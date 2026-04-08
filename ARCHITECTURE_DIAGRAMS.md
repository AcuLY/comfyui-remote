# ComfyUI Remote - Architecture & Flow Diagrams

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Next.js App Server                         │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  Frontend (React)                                          │    │
│  │  ┌─────────────────────┐    ┌──────────────────────────┐   │    │
│  │  │ /settings/monitor   │◄───┤ Poll /api/comfy/status  │   │    │
│  │  │ (Monitor Dashboard) │    │ every 5 seconds         │   │    │
│  │  │                     │    └──────────────────────────┘   │    │
│  │  │ • Status badges     │            ↓                      │    │
│  │  │ • Action buttons    │    ┌──────────────────────────┐   │    │
│  │  │ • Live logs         │    │ POST /api/comfy/start    │   │    │
│  │  │ • State machine     │    │ POST /api/comfy/restart  │   │    │
│  │  └─────────────────────┘    └──────────────────────────┘   │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  Backend (Node.js)                                         │    │
│  │  ┌─────────────────────────────────────────────────────┐   │    │
│  │  │  ComfyUI Process Manager (Singleton)               │   │    │
│  │  │  ═════════════════════════════════════════════════ │   │    │
│  │  │                                                     │   │    │
│  │  │  • Spawns/kills child process                      │   │    │
│  │  │  • startHealthCheck() - every 10s                  │   │    │
│  │  │  • performHealthCheck()                            │   │    │
│  │  │  • maybeAutoRestart()                              │   │    │
│  │  │  • Ring buffer logs (200 lines)                    │   │    │
│  │  │  • State machine                                   │   │    │
│  │  │  • Rate limiting (3 in 5 min)                      │   │    │
│  │  └─────────────────────────────────────────────────────┘   │    │
│  │                      ↓                                      │    │
│  │  ┌─────────────────────────────────────────────────────┐   │    │
│  │  │  ComfyUI Process (Child)                            │   │    │
│  │  │  ═════════════════════════════════════════════════ │   │    │
│  │  │  • stdout/stderr captured & logged                 │   │    │
│  │  │  • UTF-8 encoding configured                       │   │    │
│  │  │  • SIGTERM/SIGKILL on stop                         │   │    │
│  │  │  • exit handler triggers auto-restart check        │   │    │
│  │  └─────────────────────────────────────────────────────┘   │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  Initialization: src/instrumentation.ts                            │
│  └─ Runs once at server startup                                    │
│  └─ Calls manager.initAutoStart()                                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                            ↓
                    (HTTP requests)
                            ↓
┌─────────────────────────────────────────────────────────────────────┐
│                  ComfyUI API Server                                 │
│                  http://127.0.0.1:8188                              │
│                                                                     │
│  • GET /system_stats  ← Health check target                         │
│  • POST /prompt       ← Queue workflow                              │
│  • GET /history       ← Poll job results                            │
│  • Other endpoints...                                               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Health Check Flow (Every 10 seconds)

```
┌──────────────────────────────┐
│  startHealthCheck()          │
│  ├─ Clear existing timer     │
│  ├─ Create interval          │
│  │  (COMFY_HEALTH_INTERVAL   │
│  │   = 10000ms default)      │
│  └─ Run first check          │
│     immediately              │
└──────────────┬───────────────┘
               │
               ↓
      ┌─────────────────────────────┐
      │ performHealthCheck()        │
      │ (called every 10 seconds)   │
      └──────────┬──────────────────┘
                 │
                 ↓
      ┌──────────────────────────────────┐
      │ try fetch(/system_stats, 5s)     │
      └──────────┬───────────────────────┘
                 │
                 ├─────────────────┬──────────────────┐
                 │                 │                  │
            Success (200)      Timeout (5s)      Network error
                 │                 │                  │
                 ↓                 ↓                  ↓
           lastHealthOk=true  lastHealthOk=false  lastHealthOk=false
           failures=0          failures++          failures++
                 │                 │                  │
                 └─────────────────┴──────────────────┘
                        │
                        ↓
           ┌──────────────────────────────┐
           │ In startup grace period?     │
           │ (now - spawnedAt < 120s)     │
           │ AND state="starting"?        │
           └──────────┬───────────────────┘
                      │
              ┌───────┴────────┐
              │                │
            YES (in grace)   NO (past grace)
              │                │
              ↓                ↓
        Log & continue   Check if failures >= 3
                              │
                      ┌───────┴─────────┐
                      │                 │
                    YES             NO
                  (3+ fails)    (< 3 fails)
                      │                 │
                      ↓                 ↓
                  Set state=     Continue
                "unhealthy"      monitoring
                      │
                      ↓
           maybeAutoRestart()
           (see next diagram)
```

---

## 3. Auto-Restart Decision Tree

```
┌─────────────────────────────────┐
│ maybeAutoRestart()              │
│ (triggered by health failure    │
│  or process crash)              │
└────────────┬────────────────────┘
             │
             ↓
┌────────────────────────────────────┐
│ Is COMFY_AUTO_RESTART enabled?     │
│ (env: default=true)                │
└────────┬──────────────────────┬────┘
         │                      │
       YES                     NO
         │                      │
         ↓                      ↓
┌──────────────────┐      [Stop trying]
│ Check managed    │
│ mode (launch     │
│ command set?)    │
└────┬──────────┬──┘
     │          │
    YES        NO
     │          │
     ↓          ↓
┌──────────────────┐      [Stop trying]
│ Calculate       │
│ restartsInWindow│
│ (sliding 5 min) │
└────┬──────────┬──┘
     │          │
    <3        >=3 (limit reached)
     │          │
     ↓          ↓
┌──────────────┐  ┌─────────────────┐
│ Safe to      │  │ Set state       │
│ restart      │  │ = "error"       │
└────┬─────────┘  │ maxRestartsReached=true
     │            │ Give up         │
     │            └─────────────────┘
     ↓
┌─────────────────────────┐
│ Set state               │
│ = "restarting"          │
│ Log restart attempt     │
│ (e.g., "2/3 in window") │
└────────┬────────────────┘
         │
         ↓
    setTimeout(2000ms)
    (Resource cleanup pause)
         │
         ↓
    spawnProcess()
    ├─ Set state = "starting"
    ├─ spawn(cmd, [])
    ├─ startedAt = now
    ├─ spawnedAt = now (restart grace applies)
    ├─ Attach stdout/stderr handlers
    ├─ Attach exit handler
    └─ startHealthCheck()
         │
         ↓
    Back to "starting" state
    Grace period begins again (120s)
```

---

## 4. Process State Machine (Complete)

```
                          ┌──────────────┐
                          │              │
                          ▼              │
                      ┌──────────┐       │
                      │ Stopped  │───────┘ (exit/init)
                      └────┬─────┘
                           │
             ┌─────────────┴──────────────┐
             │                            │
        User Start OR         Check if already
        COMFY_AUTO_START      running external?
             │                    │
      ┌──────┴─────┐         ┌────┴──────┐
      │             │        │            │
    Success    Found running Already External
      │        already        │            │
      ↓           │           ↓            ↓
  ┌─────────┐     │       Spawn     ┌──────────┐
  │ Starting│     │         │       │Running   │
  │ (process)    │         │       │(external)│
  └────┬────┘     │         │       └────┬─────┘
       │          │         │            │
       │   ┌──────┴────┐    │            │
       └───┤ (merges)  │    │            │
           └─────┬─────┘    │            │
                 │          │            │
  Health check   │          │            │
  within grace   │          │            │
  period:        │          │            │
  • Log but      │          │            │
    don't count  │          │            │
    failures     │          │            │
                 │          │            │
  After grace    │          │            │
  OR success:    │          │            │
                 ↓          ↓            ↓
            ┌──────────────────────────┐
            │      Running             │
            │ (health checks passing)  │
            └─────────┬────────────────┘
                      │
          Health check fails
          3+ consecutive times
                      │
                      ↓
            ┌──────────────────────────┐
            │     Unhealthy            │
            │ (3+ check failures)      │
            └─────────┬────────────────┘
                      │
        ┌─────────────┴──────────────┐
        │                            │
   If auto-restart   If max restarts
   NOT reached:      reached:
        │                    │
        ↓                    ↓
  ┌──────────────┐   ┌──────────┐
  │ Restarting   │   │  Error   │
  │ (temp state) │   │ (stopped)│
  └────┬─────────┘   └──────────┘
       │ (2s delay)
       │ spawnProcess()
       │
       └──→ [goes back to Starting]

User-initiated:
    Stop button
    any state → Stopped

Process crash:
    any state → Error → (auto-restart if enabled)
```

---

## 5. Startup Grace Period Timeline

```
COMFY_STARTUP_GRACE_MS = 120000 (2 minutes default)
COMFY_HEALTH_INTERVAL_MS = 10000 (10 seconds default)

Timeline with ComfyUI that boots at 50s:

t=0s    ├─ Process spawned
        ├─ state = "starting"
        ├─ spawnedAt = 0
        ├─ 1st health check → FAIL
        │  (ComfyUI loading, no response)
        │  consecutiveHealthFailures = 1
        │  Grace: 0-0 < 120000? YES
        │  → Log, don't count as unhealthy
        │
t=10s   ├─ 2nd check → FAIL
        │  consecutiveHealthFailures = 2
        │  Grace: 10000-0 < 120000? YES
        │  → Log, don't count
        │
t=20s   ├─ 3rd check → FAIL
        │  consecutiveHealthFailures = 3
        │  Grace: 20000-0 < 120000? YES
        │  → Log, don't count (even though 3+ failures!)
        │
...
t=50s   ├─ 6th check → SUCCESS ✓
        │  lastHealthOk = true
        │  consecutiveHealthFailures = 0 (RESET)
        │  state = "running" ✓
        │  (grace period doesn't matter anymore)
        │
t=60s   ├─ 7th check → SUCCESS ✓
        │
t=120s  ├─ Grace period expires (120 - 0 = 120s elapsed)
        │  But we're in "running" so it doesn't matter
        │
...
(if process stayed down)

t=0s    ├─ Process spawned, fails all checks
        │
t=120s  ├─ Grace period EXPIRES
        │  (120000 - 0 = 120000, NOT < anymore)
        │  Check: (120000 - 0) < 120000? NO
        │  Grace period ended
        │
t=130s  ├─ 14th check → FAIL
        │  consecutiveHealthFailures = 14
        │  Grace: 130000-0 < 120000? NO
        │  Check threshold: 14 >= 3? YES
        │  state = "running" or "starting"? YES
        │  → setState("unhealthy")
        │  → maybeAutoRestart()
```

---

## 6. API Request/Response Cycle

```
┌──────────────────────────┐
│   User (Browser)         │
└──────────┬───────────────┘
           │
           │ 1. Poll status every 5s
           │
           ↓
    GET /api/comfy/status
    (localhost check: ✓ or ✗)
           │
           ↓
    Response:
    {
      "ok": true,
      "data": {
        "state": "running",
        "pid": 12345,
        "uptime": 3600,
        "lastHealthCheck": "2026-04-08T12:34:56.789Z",
        "lastHealthOk": true,
        "restartCount": 2,
        "restartsInWindow": 0,
        "maxRestartsReached": false,
        "autoRestartEnabled": true,
        "managedMode": true,
        "logs": ["[manager] Starting...", ...],
        "comfyApiUrl": "http://127.0.0.1:8188",
        "errorMessage": null
      }
    }
           │
           ↓
    Update UI (status badge, stats, logs)
           │
           │ 2. User clicks button
           │
           ↓
    POST /api/comfy/restart
    (body: empty, localhost check: ✓ or ✗)
           │
           ↓
    Backend:
    ├─ resetMaxRestarts()
    ├─ stop() → kill process
    ├─ sleep(1000)
    └─ start() → spawn process
           │
           ↓
    Response:
    {
      "ok": true,
      "data": {
        "message": "ComfyUI starting"
      }
    }
           │
           ↓
    Frontend waits 500ms
           │
           ↓
    Poll status again (GET /api/comfy/status)
           │
           ↓
    New state reflected in UI
```

---

## 7. Log Capture & Ring Buffer

```
┌─────────────────────────────────────────┐
│  ComfyUI Process stdout/stderr          │
│  ├─ [stdout] Lines from ComfyUI         │
│  ├─ [stderr] Errors & warnings          │
│  ├─ [manager] Internal messages         │
│  ├─ [health] Check results (✓ or ✗)    │
│  └─ Timestamps (ISO format)             │
└────────────┬────────────────────────────┘
             │
             ↓
    ┌─────────────────────────────┐
    │  RingBuffer (200 lines max) │
    │                             │
    │  When < 200 lines:          │
    │  └─ Append to array         │
    │                             │
    │  When ≥ 200 lines:          │
    │  ├─ Overwrite oldest        │
    │  │  (at pointer position)   │
    │  ├─ Advance pointer         │
    │  └─ Maintain circular order │
    └────────────┬────────────────┘
                 │
                 ↓
    Status API call: getStatus()
    └─ returns logs.toArray()
       (in correct chronological order)
             │
             ↓
    Frontend renders with colors:
    ├─ [manager] → sky-400/70
    ├─ ✓ → emerald-400/70
    ├─ ✗ → red-400/80
    ├─ Real errors → amber-400/80
    └─ Harmless stderr → zinc-500
```

---

## 8. Environment Configuration Hierarchy

```
System Environment
    ↓
    ├─ COMFY_LAUNCH_CMD               (required for managed mode)
    ├─ COMFY_LAUNCH_CWD               (optional, working dir)
    ├─ COMFY_API_URL                  (default: http://127.0.0.1:8188)
    │
    ├─ COMFY_AUTO_START               (default: false)
    ├─ COMFY_AUTO_RESTART             (default: true)
    │
    ├─ COMFY_HEALTH_INTERVAL_MS       (default: 10000)
    ├─ COMFY_STARTUP_GRACE_MS         (default: 120000)
    ├─ COMFY_MAX_RESTARTS             (default: 3)
    └─ COMFY_RESTART_WINDOW_MS        (default: 300000)
        │
        ↓
    src/lib/env.ts (parsing & defaults)
        │
        ↓
    ComfyProcessManager (uses env)
        │
        ├─ If COMFY_LAUNCH_CMD empty:
        │  └─ Managed mode = DISABLED
        │     (health checks only)
        │
        └─ If COMFY_LAUNCH_CMD set:
           └─ Managed mode = ENABLED
              (can spawn/kill/restart)
```

---

**Last Updated:** 2026-04-08
