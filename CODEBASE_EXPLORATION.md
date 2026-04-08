# ComfyUI Remote - Codebase Exploration Report

## Overview
This document provides a comprehensive analysis of the ComfyUI Remote project's startup/restart logic, health checking mechanisms, and UI controls.

**Project Location:** `/Users/luca/dev/comfyui-remote`
**Technology Stack:** Next.js 16 + React 19 + Node.js (Backend)

---

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Timeout Settings](#timeout-settings)
3. [Startup/Restart Logic](#startuprestart-logic)
4. [Health Checking Implementation](#health-checking-implementation)
5. [UI Components & Controls](#ui-components--controls)
6. [API Routes](#api-routes)
7. [Configuration & Environment](#configuration--environment)
8. [Process State Machine](#process-state-machine)

---

## Architecture Overview

### Key Components

1. **ComfyUI Process Manager** (`src/server/services/comfy-process-manager.ts`)
   - Singleton service managing ComfyUI lifecycle
   - Spawns/stops/restarts via Node.js `child_process`
   - Periodic health checks via ComfyUI's `/system_stats` endpoint
   - Automatic restart with sliding-window rate limiting
   - Ring-buffer log capture (max 200 lines)

2. **API Routes**
   - `POST /api/comfy/start` - Manual start (localhost only)
   - `POST /api/comfy/restart` - Manual restart (localhost only)
   - `GET /api/comfy/status` - Get process status & logs
   - `GET /api/health` - App health endpoint
   - `GET /api/worker/status` - Queue and connectivity stats

3. **Frontend UI**
   - `/settings/monitor` page - ComfyUI monitoring dashboard
   - Real-time status polling (5-second intervals)
   - Action buttons (Start, Stop, Restart)
   - Live log viewer with auto-scroll

4. **Server Initialization** (`src/instrumentation.ts`)
   - Runs once at server startup (Next.js instrumentation hook)
   - Initializes process manager for health monitoring
   - Triggers auto-start if enabled

---

## Timeout Settings

All timeout values are configurable via environment variables. **Default values are sensible for development/deployment.**

### 1. **Health Check Timeout (ComfyUI Response)**
- **Environment Variable:** `COMFY_HEALTH_INTERVAL_MS`
- **Default:** `10000` ms (10 seconds)
- **Location:** `src/lib/env.ts` line 42
- **Usage:** Interval between periodic health checks
- **Code:** `ComfyProcessManager.performHealthCheck()` uses `AbortSignal.timeout(5000)` for actual fetch

### 2. **Individual Health Check Request Timeout**
- **Hard-coded:** `5000` ms (5 seconds)
- **Location:** `src/server/services/comfy-process-manager.ts` lines 504, 462
- **Usage:** 
  - Line 462: Pre-launch check `checkExistingComfyUI()` → 3s timeout
  - Line 504: Periodic health check `performHealthCheck()` → 5s timeout
- **Effect:** If ComfyUI doesn't respond within 5s, considered unhealthy

### 3. **Startup Grace Period**
- **Environment Variable:** `COMFY_STARTUP_GRACE_MS`
- **Default:** `120000` ms (120 seconds / 2 minutes)
- **Location:** `src/lib/env.ts` line 46
- **Usage:** Grace period after spawn before health failures count
- **Code:** Lines 527-540 in `comfy-process-manager.ts`
- **Behavior:** 
  - During grace period, consecutive health failures are logged but don't trigger restart
  - Process must be in "starting" state
  - After grace period expires, 3 consecutive health check failures mark process as unhealthy
  - Prevents premature restarts when ComfyUI is still initializing

### 4. **Restart Rate Limiting**
- **Max Restarts:** `COMFY_MAX_RESTARTS` = `3` (default)
- **Window Duration:** `COMFY_RESTART_WINDOW_MS` = `300000` ms (5 minutes, default)
- **Location:** `src/lib/env.ts` lines 43-44
- **Usage:** Sliding window - max 3 restarts within any 5-minute window
- **Code:** `restartsInWindow()` method (lines 608-612)
- **Effect:** Prevents infinite restart loops

### 5. **Kill Timeout (Process Termination)**
- **Hard-coded:** `5000` ms (5 seconds)
- **Location:** `src/server/services/comfy-process-manager.ts` lines 319-330
- **Usage:** Time between SIGTERM and forced SIGKILL
- **Behavior:**
  - Send SIGTERM to process
  - After 5s, if still alive, send SIGKILL (force kill)

### 6. **Pre-Restart Delay**
- **Hard-coded:** `2000` ms (2 seconds)
- **Location:** `src/server/services/comfy-process-manager.ts` lines 601-605
- **Usage:** Delay before spawning new process after failure
- **Effect:** Gives resources time to clean up

### 7. **Stop-to-Restart Delay**
- **Hard-coded:** `1000` ms (1 second)
- **Location:** `src/server/services/comfy-process-manager.ts` lines 190-194
- **Usage:** Delay between `stop()` and `start()` in `restart()`
- **Effect:** Ensures clean process termination before restart

### 8. **ComfyUI Request Timeout**
- **Environment Variable:** `COMFY_REQUEST_TIMEOUT_MS`
- **Default:** `10000` ms (10 seconds)
- **Location:** `src/lib/env.ts` line 32
- **Usage:** HTTP request timeout when communicating with ComfyUI API
- **Not directly related to health checks** - for workflow execution requests

### 9. **History Poll Interval & Attempts**
- **Poll Interval:** `COMFY_HISTORY_POLL_INTERVAL_MS` = `2000` ms (default)
- **Max Attempts:** `COMFY_HISTORY_MAX_ATTEMPTS` = `300` (default)
- **Max Total Wait:** 300 × 2000 = 600s (10 minutes)
- **Location:** `src/lib/env.ts` lines 33-34
- **Usage:** Polling `/history` endpoint to track job completion

### 10. **Frontend Poll Interval (UI)**
- **Hard-coded:** `5000` ms (5 seconds)
- **Location:** `src/app/settings/monitor/page.tsx` line 184
- **Usage:** How often the monitor page fetches status from `/api/comfy/status`
- **Effect:** Status display refreshes every 5 seconds

---

## Startup/Restart Logic

### 1. **Initialization Flow (Server Startup)**

```
Server starts
  ↓
instrumentation.ts::register() called
  ↓
getComfyProcessManager() creates singleton
  ↓
manager.initAutoStart() called
  ├─ If COMFY_LAUNCH_CMD not set:
  │   └─ "Managed mode disabled" - only health monitoring
  │
  ├─ If COMFY_AUTO_START = false:
  │   └─ startHealthCheck() - wait for manual start
  │
  └─ If COMFY_AUTO_START = true:
      └─ manager.start() → spawnProcess()
         └─ startHealthCheck()
```

**Code Location:** 
- `src/instrumentation.ts` (lines 8-16)
- `src/server/services/comfy-process-manager.ts` (lines 198-217)

### 2. **Manual Start Flow (User clicks "Start" button)**

```
POST /api/comfy/start
  ↓
Verify request from localhost only
  ↓
manager.start()
  ├─ Check if COMFY_LAUNCH_CMD configured
  ├─ Check if already running/starting
  ├─ checkExistingComfyUI() - try 3s timeout fetch to /system_stats
  │   ├─ If reachable: externallyStarted = true, setState("running"), return success
  │   └─ If not reachable: continue to spawn
  ├─ Set state = "starting"
  └─ spawnProcess()
      ├─ spawn(cmd, [], { shell: true, cwd, stdio, env })
      ├─ Set startedAt = now, spawnedAt = now
      ├─ Attach stdout/stderr listeners with UTF-8 encoding
      ├─ Attach error/exit listeners
      ├─ startHealthCheck() - begin periodic checks every 10s
      └─ Return "ComfyUI starting"
```

**Code Location:** `src/server/services/comfy-process-manager.ts` (lines 143-305)

### 3. **Restart Flow (User clicks "Restart" button)**

```
POST /api/comfy/restart
  ↓
Verify request from localhost only
  ↓
manager.resetMaxRestarts() - clear restart counter
  ↓
manager.restart()
  ├─ await manager.stop()
  │   └─ Kill process (SIGTERM/SIGKILL) or killByPort() for external processes
  ├─ Sleep 1000ms
  └─ await manager.start()
      └─ Same as manual start flow above
```

**Code Location:** `src/server/services/comfy-process-manager.ts` (lines 190-195)

### 4. **Automatic Restart Flow (Health check fails)**

```
performHealthCheck() detects failure
  ├─ Mark lastHealthOk = false
  ├─ Increment consecutiveHealthFailures
  │
  ├─ If in startup grace period & state="starting":
  │   └─ Log but don't act (return)
  │
  ├─ Else if consecutiveHealthFailures >= 3 (UNHEALTHY_THRESHOLD):
  │   └─ setState("unhealthy")
  │       └─ maybeAutoRestart()
  │
  └─ If process exits unexpectedly:
      └─ setState("error")
          └─ handleProcessExit()
              └─ maybeAutoRestart()

maybeAutoRestart()
  ├─ Check if COMFY_AUTO_RESTART enabled
  ├─ Check if COMFY_LAUNCH_CMD configured
  ├─ Calculate restartsInWindow()
  │   └─ If >= COMFY_MAX_RESTARTS (e.g., 3):
  │       ├─ maxRestartsReached = true
  │       ├─ setState("error")
  │       └─ Return (give up)
  │
  ├─ Push current timestamp to restartTimestamps
  ├─ Increment restartCount
  ├─ setState("restarting")
  ├─ Log restart attempt (e.g., "2/3 in window")
  └─ setTimeout(2000) → spawnProcess()
```

**Code Location:** `src/server/services/comfy-process-manager.ts` (lines 498-606)

### 5. **Manual Restart with Rate Limit Reset**

When user clicks "Restart" button:
- API calls `manager.resetMaxRestarts()` BEFORE calling `manager.restart()`
- This clears the `maxRestartsReached` flag and `restartTimestamps` array
- Allows manual restart to always work even if auto-restart limit was reached

**Code Location:** `src/app/api/comfy/restart/route.ts` (lines 20-21)

---

## Health Checking Implementation

### 1. **Health Check Endpoint**

**ComfyUI's native endpoint used:**
- `GET {COMFY_API_URL}/system_stats`
- Expected response: HTTP 200 OK (any valid JSON)

**Code:** `src/server/services/comfy-process-manager.ts` lines 461, 503

### 2. **Health Check Cycle**

```
startHealthCheck()
  ├─ Clear existing timer
  ├─ Create interval timer (every COMFY_HEALTH_INTERVAL_MS = 10s default)
  │   └─ Call performHealthCheck()
  └─ Immediately call performHealthCheck() once
      └─ Run initial check right away (don't wait 10s)
```

**Code:** `src/server/services/comfy-process-manager.ts` (lines 478-489)

### 3. **Per-Check Logic**

```
performHealthCheck()
  ├─ Record timestamp (lastHealthCheck = ISO string)
  │
  ├─ TRY fetch with 5s timeout:
  │   ├─ res = await fetch(COMFY_API_URL/system_stats, timeout: 5000)
  │   │
  │   ├─ If res.ok:
  │   │   ├─ lastHealthOk = true
  │   │   ├─ consecutiveHealthFailures = 0 (reset)
  │   │   │
  │   │   ├─ If state is "starting" || "unhealthy" || "restarting":
  │   │   │   └─ setState("running") ✓
  │   │   │
  │   │   └─ Return (success)
  │   │
  │   └─ Else (not ok):
  │       └─ Fall through to failure
  │
  ├─ CATCH or non-ok response:
  │   ├─ lastHealthOk = false
  │   ├─ consecutiveHealthFailures++
  │   │
  │   ├─ Calculate grace period:
  │   │   ├─ inGracePeriod = (now - spawnedAt) < COMFY_STARTUP_GRACE_MS
  │   │   │
  │   │   ├─ If inGracePeriod && state="starting":
  │   │   │   ├─ Log startup progress (every ~60s to avoid spam)
  │   │   │   └─ Return (don't escalate)
  │   │   │
  │   │   └─ Else: continue to threshold check
  │   │
  │   ├─ If consecutiveHealthFailures >= 3 && (state="running" || "starting"):
  │   │   ├─ setState("unhealthy")
  │   │   └─ maybeAutoRestart()
  │   │
  │   └─ Return
```

**Code:** `src/server/services/comfy-process-manager.ts` (lines 498-553)

### 4. **Grace Period Mechanism**

Purpose: Prevent false-positive restarts during slow ComfyUI startup

**Timeline Example (COMFY_STARTUP_GRACE_MS = 120s, COMFY_HEALTH_INTERVAL_MS = 10s):**

```
t=0s    Process spawned (spawnedAt = 0)
t=0s    First health check → fails (no response yet)
        consecutiveHealthFailures = 1, but in grace period → log + continue
t=10s   Second check → fails (still loading)
        consecutiveHealthFailures = 2, still in grace period → log + continue
...
t=50s   Fifth check → ComfyUI responds ✓
        consecutiveHealthFailures = 0, state = "running" ✓
        (Within grace period, so success just advances state)

---OR---

t=0s    Process spawned
...
t=110s  Grace period about to expire (120s total)
        Last check before grace expiry → still failing
t=120s  Grace period EXPIRES
t=120s  Next check → fails
        consecutiveHealthFailures = 7, grace period expired
        Check threshold: 7 >= 3 → setState("unhealthy")
        → maybeAutoRestart()
```

**Configuration:**
- `COMFY_STARTUP_GRACE_MS` (default 120s)
- Not mentioned in `.env.example` (must add manually if needed)

**Code:** `src/server/services/comfy-process-manager.ts` (lines 526-540)

### 5. **Unhealthy Threshold**

- **UNHEALTHY_THRESHOLD** = 3 consecutive health check failures
- **After 3 failed checks** → state changes from "running" or "starting" to "unhealthy"
- Resets to 0 on successful check

**Code:** `src/server/services/comfy-process-manager.ts` (lines 114, 544)

### 6. **External Health Check (from UI)**

The monitoring page fetches `/api/worker/status` which includes:

```typescript
pingComfyUI() {
  // Try to reach /system_stats with 5s timeout
  // Returns boolean (reachable or not)
}
```

Used for display purposes, doesn't affect process state.

**Code:** `src/app/api/worker/status/route.ts` (lines 11-20)

---

## UI Components & Controls

### 1. **Monitor Page** (`src/app/settings/monitor/page.tsx`)

**URL:** `/settings/monitor`

**Type:** Client-side React component ("use client")

**Main Features:**

#### Status Display
- **State Badge:** Shows current process state with color coding
  ```
  States:    "stopped"    "starting"    "running"    "unhealthy"    "restarting"    "error"
  Chinese:   "已停止"      "启动中"       "运行中"      "不健康"       "重启中"        "错误"
  Color:     gray/zinc    amber          green        red            amber           red
  Indicator: pulsing dot on "running" state
  ```

- **Stats Grid:** 4 columns showing
  - 状态 (State) - color-coded
  - 运行时长 (Uptime) - human-readable format (e.g., "1h 23m")
  - PID - process ID or "—"
  - 重启次数 (Restart Count) - shows "(上限)" if max reached

- **Additional Info Box:**
  - API 地址 (API URL)
  - 上次健康检查 (Last Health Check) - timestamp + ✓/✗
  - 自动重启 (Auto-restart) - enabled/disabled
  - Error message display (if any) - red alert box

#### Action Buttons

**Button Styling:**
- Default variant: light gray, white text
- Danger variant: red (Stop button)
- Accent variant: blue (Start button)
- All buttons disabled when: action pending OR condition not met

**Buttons (conditionally rendered):**

| Button | Condition | Action | Disabled When |
|--------|-----------|--------|---------------|
| **启动** (Start) | Always in managed mode | `POST /api/comfy/start` | Already running/starting OR action pending |
| **停止** (Stop) | Always in managed mode | `POST /api/comfy/stop` | Already stopped OR action pending |
| **重启** (Restart) | `managedMode && state != "stopped"` | `POST /api/comfy/restart` | state="stopped" OR action pending |

**Enable Logic:**
```typescript
const canStart = status.state === "stopped" || status.state === "error";
const canStop = status.state === "running" || status.state === "starting" || status.state === "unhealthy";
const canRestart = status.managedMode && status.state !== "stopped";
```

#### Log Viewer

- **Container:** Max height 320px (max-h-80), scrollable
- **Lines:** Last 200 lines in ring buffer (MAX_LOG_LINES = 200)
- **Font:** Monospace, 11px, line-height 1.25rem
- **Auto-scroll:** Enabled by default, disables when user scrolls up
- **Scroll threshold:** Within 40px of bottom = auto-scroll active

**Log Line Coloring:**
```
[manager]                  → sky-400/70 (internal messages)
✓ (checkmark)             → emerald-400/70 (health check success)
✗ (X mark)                → red-400/80 (health check failure)
[stderr] + error pattern   → amber-400/80 (real errors)
  - "Traceback (most recent"
  - "Error:", "Exception:", "FAILED"
  - "ModuleNotFoundError", "SyntaxError"
  - etc.
[stderr] + harmless prefix → zinc-500 (info on stderr)
  - "[LoRA-Manager]"
  - "Import times for"
  - "Starting server"
  - etc.
stdout                     → default color
```

### 2. **Action Flow**

```
User clicks button
  ↓
performAction(action)
  ├─ setActionPending(true)
  ├─ fetch(`/api/comfy/{action}`, { method: "POST" })
  ├─ setTimeout(500) - delay before refreshing
  ├─ fetchStatus() - poll current status
  └─ setActionPending(false)

fetchStatus()
  └─ fetch("/api/comfy/status")
      └─ Get ComfyProcessStatus object
      └─ setStatus(json.data)
```

**Polling:** Every 5000ms (5 seconds)

### 3. **State-Specific UI**

**Loading State:**
- Show spinner with "正在获取状态..." (Getting status)

**Error State (no status data):**
- Show "无法获取状态" (Cannot get status)
- "无法连接到状态 API" (Cannot connect to status API)

**Managed Mode vs External Mode:**
- If `managedMode` = true: Show Start/Stop/Restart buttons
- If `managedMode` = false: Hide all action buttons, show "外部管理模式（仅健康检查）"

---

## API Routes

### 1. **GET /api/comfy/status**

**Purpose:** Get current ComfyUI process status

**Response:**
```typescript
{
  ok: true,
  data: {
    state: "running" | "stopped" | "starting" | "unhealthy" | "restarting" | "error",
    pid: number | null,
    uptime: number | null,  // seconds
    lastHealthCheck: string | null,  // ISO timestamp
    lastHealthOk: boolean,
    restartCount: number,
    restartsInWindow: number,
    maxRestartsReached: boolean,
    autoRestartEnabled: boolean,
    managedMode: boolean,
    logs: string[],  // last 200 lines
    comfyApiUrl: string,
    errorMessage: string | null,
  }
}
```

**Code:** `src/app/api/comfy/status/route.ts`

### 2. **POST /api/comfy/start**

**Purpose:** Manually start ComfyUI process

**Restrictions:** Localhost only (127.0.0.1, localhost, ::1, etc.)

**Response (Success):**
```json
{
  "ok": true,
  "data": {
    "message": "ComfyUI starting"
  }
}
```

**Response (Error):**
```json
{
  "ok": false,
  "message": "COMFY_LAUNCH_CMD is not configured",
  "statusCode": 400
}
```

**Code:** `src/app/api/comfy/start/route.ts`

### 3. **POST /api/comfy/restart**

**Purpose:** Manually restart ComfyUI (also resets restart counter)

**Restrictions:** Localhost only

**Side Effects:**
- Calls `manager.resetMaxRestarts()` first
- Clears restart counter so manual restart always works

**Response:** Same as `/api/comfy/start`

**Code:** `src/app/api/comfy/restart/route.ts`

### 4. **GET /api/comfy/stop** (Note: Not currently exposed, but possible)

Not directly exposed via API route (would need to be added), but `stop()` is called internally by `restart()`.

### 5. **GET /api/health**

**Purpose:** App-level health check (not process-specific)

**Response:**
```json
{
  "ok": true,
  "data": {
    "service": "comfyui-manager",
    "status": "ok",
    "timestamp": "2026-04-08T12:34:56.789Z"
  }
}
```

**Code:** `src/app/api/health/route.ts`

### 6. **GET /api/worker/status**

**Purpose:** Queue and connectivity stats (includes ComfyUI ping)

**Response:**
```typescript
{
  ok: true,
  data: {
    comfyui: {
      reachable: boolean,  // result of pingComfyUI()
      url: string,
    },
    queue: {
      queued: number,
      running: number,
    },
    recentDone: [{
      id: string,
      projectTitle: string,
      sectionName: string,
      imagesCount: number,
      finishedAt: Date,
    }],
    recentFailed: [{
      id: string,
      projectTitle: string,
      error: string | null,
      finishedAt: Date,
    }],
  }
}
```

**Code:** `src/app/api/worker/status/route.ts`

---

## Configuration & Environment

### Full Environment Variables List

All located in `src/lib/env.ts`:

```typescript
// ComfyUI Connection
COMFY_API_URL = "http://127.0.0.1:8188"
COMFY_REQUEST_TIMEOUT_MS = 10000  // workflow execution requests

// History Polling
COMFY_HISTORY_POLL_INTERVAL_MS = 2000
COMFY_HISTORY_MAX_ATTEMPTS = 300  // ~10 min max wait

// Process Management (requires COMFY_LAUNCH_CMD to be set)
COMFY_LAUNCH_CMD = ""  // e.g., "conda run -n comfyui python main.py"
COMFY_LAUNCH_CWD = ""  // working directory for command

// Auto-start/Auto-restart
COMFY_AUTO_START = false  // start ComfyUI when app boots?
COMFY_AUTO_RESTART = true  // restart on health check failure?

// Health Monitoring
COMFY_HEALTH_INTERVAL_MS = 10000  // check every 10 seconds
COMFY_STARTUP_GRACE_MS = 120000  // 2-minute grace period after spawn

// Rate Limiting (auto-restart)
COMFY_MAX_RESTARTS = 3  // max restarts...
COMFY_RESTART_WINDOW_MS = 300000  // ...in this 5-minute window
```

### Default Behavior Summary

| Setting | Default | Effect |
|---------|---------|--------|
| Auto-start | false | Don't start ComfyUI on app boot |
| Auto-restart | true | Restart if health checks fail |
| Health checks | Every 10s | Monitor every 10 seconds |
| Startup grace | 120s | Allow 2 min to fully start |
| Restart limit | 3 in 5 min | Prevent restart loops |
| Health timeout | 5s per check | Per-request timeout |
| Kill grace | 5s | Wait 5s before SIGKILL |

---

## Process State Machine

### State Transitions

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Initial: "stopped"                                        │
│                                                             │
│  User clicks START or COMFY_AUTO_START=true               │
│         ↓                                                  │
│    "starting" ─────────────────────────────────┐          │
│         │                                      │          │
│         │ Health check succeeds               │ Health check continues
│         │ (within or after grace period)      │ to fail beyond threshold
│         ↓                                      ↓          │
│    "running"                             "unhealthy"      │
│         │                                      │          │
│         │ Process crashes/exits unexpectedly  │          │
│         │ -OR- Health check fails 3 times    │          │
│         ├────────────────────────────────────┤          │
│         ↓                                      ↓          │
│    "error" ◄────────────────────────────────────          │
│     (also "restarting" briefly)                           │
│         │                                                │
│         │ maybeAutoRestart() triggered                   │
│         ├─ If max restarts NOT reached                   │
│         │  └─ setState("restarting")                     │
│         │     └─ Spawn new process                       │
│         │        └─ Go back to "starting" ─┐             │
│         │                                  │             │
│         └─ If max restarts REACHED         │             │
│            └─ setState("error")            │             │
│               └─ Stop trying               │             │
│                                           │             │
│  User clicks STOP or manual kill ◄──────┴──────         │
│         ↓                                               │
│    "stopped"                                            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### State Definitions

| State | Meaning | Restartable | User Can Action |
|-------|---------|-------------|-----------------|
| **stopped** | Not running | ✓ Start | Start, (Restart if was running before) |
| **starting** | Process spawned, initializing | — | Stop only |
| **running** | Healthy, responding to health checks | ✓ Auto-restart if fails | Start, Stop, Restart |
| **unhealthy** | 3+ consecutive health failures | ✓ Auto-restart | Stop, Restart |
| **restarting** | In process of restarting | — | (wait) |
| **error** | Process crashed or max restarts reached | ✗ Won't auto-restart | Start, Stop, Restart (manual override) |

### Detailed State Transitions

**Process Flow:**

1. **stopped → starting**
   - User clicks START or auto-start enabled
   - `spawnProcess()` called
   - Child process created

2. **starting → running**
   - Health check succeeds (gets HTTP 200 from `/system_stats`)
   - OR grace period expires and process is still responsive
   - State explicitly set to "running"

3. **starting → unhealthy** (if health fails during grace period)
   - Grace period expires
   - Consecutive health failures ≥ 3
   - `setState("unhealthy")`

4. **running → unhealthy**
   - 3+ consecutive health check failures
   - `setState("unhealthy")`
   - Triggers `maybeAutoRestart()` if enabled

5. **unhealthy → restarting → starting** (auto-restart)
   - `maybeAutoRestart()` checks conditions
   - If auto-restart enabled and max restarts not reached:
     - `setState("restarting")`
     - 2-second delay
     - `spawnProcess()` called
     - Back to "starting"

6. **unhealthy/restarting → error**
   - `maybeAutoRestart()` finds max restarts reached
   - `setState("error")`
   - Stops auto-restart attempts

7. **any → stopped**
   - User clicks STOP
   - `killProcess()` or `killByPort()` called
   - Process receives SIGTERM, then SIGKILL if needed
   - `setState("stopped")`

8. **any → error** (process crash)
   - Process exits unexpectedly
   - `on('exit')` handler fires
   - `setState("error")`
   - Triggers `maybeAutoRestart()`

### State Persistence

States are stored in:
```typescript
private state: ComfyProcessState = "stopped";  // Initial state
```

**Important:** State is NOT persisted to disk, so:
- Restarting the Next.js app resets everything to "stopped"
- ComfyUI process itself continues running independently
- Next time app starts, it will detect externally-running ComfyUI via `checkExistingComfyUI()`

---

## Key Implementation Details

### Ring Buffer for Logs

- **Capacity:** 200 lines (MAX_LOG_LINES)
- **Implementation:** Circular array with pointer
- **Behavior:** When full, new logs overwrite oldest
- **Access:** `logs.toArray()` returns in correct order

**Code:** `src/server/services/comfy-process-manager.ts` (lines 49-84)

### External Process Handling

When ComfyUI is started by external means (not spawned by manager):

1. **Detection:** `checkExistingComfyUI()` successfully reaches `/system_stats`
2. **Flag Set:** `externallyStarted = true`
3. **Consequence:** `stop()` must use port-based kill
   - macOS/Linux: `lsof -ti :PORT`
   - Windows: `netstat -ano | findstr :PORT`
4. **Fallback:** If port extraction fails, kills all python processes

**Code:** `src/server/services/comfy-process-manager.ts` (lines 338-364)

### UTF-8 Encoding for Child Process

Prevents UnicodeEncodeError on Windows when ComfyUI outputs emoji:

```typescript
env: {
  ...process.env,
  PYTHONIOENCODING: "utf-8",
  PYTHONLEGACYWINDOWSSTDIO: "0",
  PYTHONUTF8: "1",
}
```

**Code:** `src/server/services/comfy-process-manager.ts` (lines 243-248)

### Sliding Window Restart Rate Limiting

```typescript
restartsInWindow() {
  const cutoff = Date.now() - COMFY_RESTART_WINDOW_MS;
  // Remove timestamps older than window
  this.restartTimestamps = this.restartTimestamps.filter(ts => ts > cutoff);
  return this.restartTimestamps.length;
}
```

Example with COMFY_RESTART_WINDOW_MS = 300000 (5 min):
- t=0s: restart #1
- t=100s: restart #2
- t=200s: restart #3 (now at limit)
- t=250s: Check window: cutoff = 250 - 300 = -50, all 3 within window, can't restart
- t=301s: Check window: cutoff = 301 - 300 = 1, restart #1 aged out, can restart again!

**Code:** `src/server/services/comfy-process-manager.ts` (lines 608-612)

---

## Summary Table

### Timeouts at a Glance

| Setting | Value | Where Used | Purpose |
|---------|-------|-----------|---------|
| Health interval | 10s | env var | How often to check |
| Health check timeout | 5s | hard-coded | Per-request timeout |
| Pre-launch check timeout | 3s | hard-coded | Detect externally running |
| Startup grace period | 120s | env var | Allow time to boot |
| Unhealthy threshold | 3 failures | hard-coded | Trigger restart |
| Process kill grace | 5s | hard-coded | SIGTERM→SIGKILL window |
| Pre-restart delay | 2s | hard-coded | Resource cleanup |
| Stop-to-restart delay | 1s | hard-coded | Clean termination |
| Max restarts | 3 in 5min | env var | Rate limiting |
| UI poll interval | 5s | hard-coded | Dashboard refresh |

### Configuration Checklist

To enable process management:

1. ✓ Set `COMFY_LAUNCH_CMD` (e.g., `"conda run -n comfyui python main.py"`)
2. ✓ Optionally set `COMFY_LAUNCH_CWD` (working directory)
3. ✓ Set `COMFY_AUTO_START=true` to boot with app (or `false` for manual start)
4. ✓ Set `COMFY_AUTO_RESTART=true` (default) for auto-recovery
5. ✓ Adjust health check interval if needed (default 10s is good)
6. ✓ Adjust startup grace if ComfyUI takes >2 min to boot (add `COMFY_STARTUP_GRACE_MS`)
7. ✓ Tweak restart limits if hitting max (adjust `COMFY_MAX_RESTARTS` / `COMFY_RESTART_WINDOW_MS`)

Without `COMFY_LAUNCH_CMD`, managed mode is disabled and only health monitoring runs.

---

## File Index

**Backend Service:**
- `src/server/services/comfy-process-manager.ts` - Core manager (660 lines)

**API Routes:**
- `src/app/api/comfy/status/route.ts` - Get status
- `src/app/api/comfy/start/route.ts` - Start process
- `src/app/api/comfy/restart/route.ts` - Restart process
- `src/app/api/health/route.ts` - App health
- `src/app/api/worker/status/route.ts` - Queue + ComfyUI ping

**Frontend:**
- `src/app/settings/monitor/page.tsx` - Monitor dashboard (372 lines)
- `src/components/stat-chip.tsx` - Stats display component

**Configuration:**
- `src/lib/env.ts` - Environment variables (55 lines)
- `.env.example` - Environment template (67 lines)

**Initialization:**
- `src/instrumentation.ts` - Server startup hook (17 lines)

---

**Generated:** 2026-04-08
**Explored by:** Claude Code
