"""FastAPI application exposing real system metrics for the PC Monitor UI."""
from __future__ import annotations

import os
import sys
import time
from typing import Literal

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import collectors

_START_MONOTONIC = time.monotonic()

app = FastAPI(title="PC Monitor API", version="1.0.0")

# The frontend talks to the API through the Vite dev proxy, so CORS is not
# required, but allowing loopback origins makes direct access work too.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:4173",
        "http://localhost:4173",
    ],
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Never leak a raw stack trace or crash the server on unexpected errors."""
    return JSONResponse(
        status_code=500,
        content={"error": "internal_error", "detail": str(exc)},
    )


@app.get("/api/health")
def health() -> dict:
    return {
        "status": "ok",
        "timestamp": collectors.utc_now_iso(),
        "uptime_seconds": round(time.monotonic() - _START_MONOTONIC, 1),
        "python_version": sys.version.split()[0],
        "pid": os.getpid(),
    }


@app.get("/api/system")
def system() -> dict:
    try:
        return collectors.collect_system_snapshot()
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"system metrics collection failed: {exc}"
        ) from exc


@app.get("/api/processes")
def processes(
    limit: int = Query(500, ge=1, le=5000),
    sort: Literal["cpu", "memory"] = "memory",
) -> dict:
    try:
        return collectors.collect_processes(limit=limit, sort=sort)
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"process collection failed: {exc}"
        ) from exc
