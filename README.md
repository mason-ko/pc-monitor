# PC Monitor

A local web dashboard that shows real-time information about the Windows PC it
runs on: system specs, CPU/RAM/GPU utilization with live charts, network
transfer rates, disk usage, and a searchable/sortable process explorer.

Everything displayed is measured from the actual machine via `psutil` and
`nvidia-smi`. Metrics that cannot be measured are shown as **"Unavailable"**
with a reason — they are never faked with zeros.

## Requirements

- **Windows** with Python 3.11+ and Node.js 18+ (tested on Node 22)
- NVIDIA GPU metrics require `nvidia-smi` on PATH; everything else runs
  without it (the GPU card then shows an explicit "unavailable" state).

## Quick start (Windows)

```bat
start.bat
```

That installs any missing dependencies and opens two console windows:

- **Backend** — FastAPI + Uvicorn at `http://127.0.0.1:8000` (API docs at `/docs`)
- **Frontend** — Vite dev server at `http://127.0.0.1:5173` ← open this in a browser

The Vite dev server proxies `/api/*` to the backend, so no backend URLs need
to be configured in the frontend. Both servers bind to `127.0.0.1` only and
are not reachable from other machines.

## Manual start

```bat
:: Backend
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000

:: Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

Production build (optional):

```bat
cd frontend
npm run build      :: type-checks with tsc and builds into dist/
```

## Tests

```bat
cd backend
python -m pip install -r requirements.txt
python -m pytest
```

16 tests cover: health/system/process endpoint structure, real-value
sanity checks against psutil, collection-error handling (JSON 500), GPU
fallbacks (missing `nvidia-smi`, non-zero exit, timeout, `N/A` values),
disappearing/access-denied processes, and invalid requests (422/404/405).
Mocks are used only for those exceptional paths; normal operation collects
real system data.

## API

| Endpoint | Description |
|---|---|
| `GET /api/health` | status, timestamp, server uptime |
| `GET /api/system` | hostname, OS version, CPU (model/cores/usage), RAM, disk partitions, GPU (nvidia-smi), network interfaces + rates |
| `GET /api/processes?limit=&sort=cpu\|memory` | process list (name, PID, CPU %, memory RSS) |

Unavailable metrics appear as `null` plus an `error`/`reason` field, never as
`0`.

## Architecture

```
pc-monitor/
├── backend/
│   ├── app/main.py        FastAPI routes + error handling
│   ├── app/collectors.py  psutil / nvidia-smi / registry collectors
│   ├── tests/test_api.py  pytest suite (FastAPI TestClient)
│   └── requirements.txt
├── frontend/
│   ├── src/App.tsx        layout, polling, chart history
│   ├── src/usePolling.ts  single-timer polling with overlap guard
│   ├── src/components/    gauges, live chart, panels, process explorer
│   └── vite.config.ts     /api proxy → 127.0.0.1:8000
├── start.bat
└── README.md
```

The frontend polls `/api/system` and `/api/processes` every 2 s using one
interval per feed, with an in-flight guard so slow responses never stack.
Chart history holds the last ~60 samples (~2 minutes). No page reloads.

## Notes and caveats

- **Windows 11 label**: the registry `ProductName` still says "Windows 10" on
  Windows 11 (a Microsoft compatibility quirk), so the marketing name is
  derived from the real build number while the edition ("Home", "Pro", …) is
  taken verbatim from the registry.
- **System Idle Process (PID 0)** can show very high CPU % — that is genuine
  Windows behavior (its idle threads occupy all free core time), the same as
  Task Manager shows.
- **Per-process CPU %** is measured between successive polls (psutil
  semantics). The first request primes a short sample window so even the
  first page load shows real values.
- **Per-core vs total**: utilization values are totals for the whole machine
  (CPU) or the whole GPU, as reported by the OS/driver.
