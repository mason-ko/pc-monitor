"""System metric collectors for the PC Monitor dashboard.

Every value is measured from the machine actually running the server.
Metrics that cannot be measured are returned as ``None`` together with an
``error``/``reason`` string -- they are never silently replaced by ``0``.
"""
from __future__ import annotations

import platform
import shutil
import socket
import subprocess
import sys
import threading
import time
from datetime import datetime, timezone
from typing import Any, Optional

import psutil

GPU_TIMEOUT_SECONDS = 3.0
CPU_SAMPLE_SECONDS = 0.2
RATE_SAMPLE_SECONDS = 0.3
PROC_SAMPLE_SECONDS = 0.3


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _join_errors(errors: list[str]) -> Optional[str]:
    return "; ".join(errors) if errors else None


# ---------------------------------------------------------------------------
# Static information (OS / hostname / CPU model)
# ---------------------------------------------------------------------------

def _read_registry_value(key_path: str, value_name: str) -> Optional[str]:
    """Read an HKLM registry value on Windows; return None if unavailable."""
    if sys.platform != "win32":
        return None
    import winreg

    try:
        with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, key_path) as key:
            value = winreg.QueryValueEx(key, value_name)[0]
        return str(value) if value is not None else None
    except OSError:
        return None


def _windows_version_label(build: int, product_name: Optional[str],
                           display_version: Optional[str]) -> str:
    """Build a marketing version label from real registry values.

    The registry ``ProductName`` value on Windows 11 still contains
    "Windows 10" (a long-standing Microsoft compatibility quirk), so the
    marketing name (10 vs 11) is derived from the real build number while
    the edition ("Home"/"Pro"/...) is taken from the registry verbatim.
    """
    if build >= 22000:
        marketing = "Windows 11"
    elif build >= 10240:
        marketing = "Windows 10"
    else:
        marketing = "Windows"
    edition = ""
    if product_name:
        parts = product_name.split(" ", 2)
        if len(parts) >= 3:
            edition = parts[2].strip()
    label = marketing + (f" {edition}" if edition else "")
    if display_version:
        label += f" {display_version}"
    return f"{label} (build {build})"


def collect_os() -> dict[str, Any]:
    errors: list[str] = []
    system = platform.system()
    release = platform.release()
    build: Optional[str] = None
    product_name: Optional[str] = None
    display_version: Optional[str] = None
    version_label: Optional[str] = None
    try:
        if system == "Windows":
            wv = sys.getwindowsversion()
            build = str(wv.build)
            product_name = _read_registry_value(
                r"SOFTWARE\Microsoft\Windows NT\CurrentVersion", "ProductName")
            display_version = _read_registry_value(
                r"SOFTWARE\Microsoft\Windows NT\CurrentVersion", "DisplayVersion")
            version_label = _windows_version_label(wv.build, product_name, display_version)
        else:
            version_label = f"{system} {release}"
    except Exception as exc:  # pragma: no cover - defensive
        errors.append(f"os info unavailable: {exc}")
        version_label = version_label or f"{system} {release}"
    return {
        "system": system,
        "version_label": version_label,
        "release": release,
        "version": platform.version(),
        "build": build,
        "product_name": product_name,
        "display_version": display_version,
        "error": _join_errors(errors),
    }


def _cpu_model() -> Optional[str]:
    name = _read_registry_value(
        r"HARDWARE\DESCRIPTION\System\CentralProcessor\0", "ProcessorNameString")
    if name:
        return name.strip()
    fallback = platform.processor().strip()
    return fallback or None


# ---------------------------------------------------------------------------
# CPU
# ---------------------------------------------------------------------------

def collect_cpu() -> dict[str, Any]:
    errors: list[str] = []
    model: Optional[str] = None
    cores_logical: Optional[int] = None
    cores_physical: Optional[int] = None
    usage_percent: Optional[float] = None
    try:
        model = _cpu_model()
        cores_logical = psutil.cpu_count(logical=True)
        cores_physical = psutil.cpu_count(logical=False)
    except Exception as exc:
        errors.append(f"cpu static info unavailable: {exc}")
    try:
        # A short blocking sample gives a real utilization measurement.
        usage_percent = psutil.cpu_percent(interval=CPU_SAMPLE_SECONDS)
    except Exception as exc:
        errors.append(f"cpu utilization measurement failed: {exc}")
    return {
        "model": model,
        "cores_logical": cores_logical,
        "cores_physical": cores_physical,
        "usage_percent": usage_percent,
        "error": _join_errors(errors),
    }


# ---------------------------------------------------------------------------
# Memory
# ---------------------------------------------------------------------------

def collect_memory() -> dict[str, Any]:
    result: dict[str, Any] = {
        "total": None, "used": None, "available": None,
        "percent": None, "error": None,
    }
    try:
        vm = psutil.virtual_memory()
        result.update(total=vm.total, used=vm.used, available=vm.available,
                      percent=vm.percent)
    except Exception as exc:
        result["error"] = f"memory measurement failed: {exc}"
    return result


# ---------------------------------------------------------------------------
# Disk partitions
# ---------------------------------------------------------------------------

def collect_disks() -> dict[str, Any]:
    result: dict[str, Any] = {"partitions": [], "error": None}
    try:
        partitions = psutil.disk_partitions(all=False)
    except Exception as exc:
        result["error"] = f"could not enumerate disk partitions: {exc}"
        return result
    for part in partitions:
        entry: dict[str, Any] = {
            "mountpoint": part.mountpoint, "fstype": part.fstype,
            "total": None, "used": None, "free": None,
            "percent": None, "error": None,
        }
        try:
            usage = psutil.disk_usage(part.mountpoint)
            entry.update(total=usage.total, used=usage.used,
                         free=usage.free, percent=usage.percent)
        except (PermissionError, OSError, psutil.Error) as exc:
            entry["error"] = f"disk usage unavailable: {exc}"
        result["partitions"].append(entry)
    return result


# ---------------------------------------------------------------------------
# GPU (NVIDIA via nvidia-smi)
# ---------------------------------------------------------------------------

GPU_QUERY_ARGS = [
    "--query-gpu=name,utilization.gpu,memory.used,memory.total",
    "--format=csv,noheader,nounits",
]


def _parse_int(raw: str) -> Optional[int]:
    raw = raw.strip()
    try:
        return int(raw)
    except ValueError:
        return None  # e.g. "[N/A]" from nvidia-smi


def collect_gpu() -> dict[str, Any]:
    """Query NVIDIA GPUs via nvidia-smi.

    Returns ``available=False`` with a human-readable ``reason`` when the
    command is missing, fails, or times out -- the caller must keep working
    in that case and the frontend shows the metric as unavailable.
    """
    result: dict[str, Any] = {
        "available": False,
        "source": "nvidia-smi",
        "name": None,
        "utilization_percent": None,
        "memory_used_bytes": None,
        "memory_total_bytes": None,
        "gpu_count": None,
        "reason": None,
    }
    exe = shutil.which("nvidia-smi")
    if not exe:
        result["reason"] = ("nvidia-smi is not available on this system "
                            "(no NVIDIA driver tooling found on PATH)")
        return result
    try:
        proc = subprocess.run(
            [exe, *GPU_QUERY_ARGS],
            capture_output=True, text=True, timeout=GPU_TIMEOUT_SECONDS,
        )
    except FileNotFoundError as exc:
        result["reason"] = f"could not execute nvidia-smi: {exc}"
        return result
    except subprocess.TimeoutExpired:
        result["reason"] = (f"nvidia-smi timed out "
                            f"(no response within {GPU_TIMEOUT_SECONDS:g}s)")
        return result
    except OSError as exc:
        result["reason"] = f"could not execute nvidia-smi: {exc}"
        return result
    if proc.returncode != 0:
        stderr = (proc.stderr or "").strip()[:200]
        result["reason"] = (f"nvidia-smi exited with code {proc.returncode}"
                            + (f": {stderr}" if stderr else ""))
        return result
    lines = (proc.stdout or "").strip().splitlines()
    if not lines:
        result["reason"] = "nvidia-smi returned no GPU information"
        return result
    result["gpu_count"] = len(lines)
    parts = [p.strip() for p in lines[0].split(",")]
    if len(parts) < 4:
        result["reason"] = f"unexpected nvidia-smi output: {lines[0][:120]!r}"
        return result
    utilization = _parse_int(parts[1])
    mem_used_mib = _parse_int(parts[2])
    mem_total_mib = _parse_int(parts[3])
    result["available"] = True
    result["name"] = parts[0] or None
    result["utilization_percent"] = utilization
    result["memory_used_bytes"] = (mem_used_mib * 1024 * 1024
                                   if mem_used_mib is not None else None)
    result["memory_total_bytes"] = (mem_total_mib * 1024 * 1024
                                    if mem_total_mib is not None else None)
    missing = [label for label, value in
               (("utilization", utilization), ("VRAM used", mem_used_mib),
                ("VRAM total", mem_total_mib))
               if value is None]
    if missing:
        result["reason"] = ("nvidia-smi reported N/A for: "
                            + ", ".join(missing))
    return result


# ---------------------------------------------------------------------------
# Network
# ---------------------------------------------------------------------------

class _NetState:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.prev: Optional[dict[str, Any]] = None


_net_state = _NetState()


def _rate(current: int, previous: int, dt: float) -> Optional[float]:
    delta = current - previous
    if delta < 0:  # counter reset/wrap -- unreliable, report as unavailable
        return None
    return delta / dt


def collect_network() -> dict[str, Any]:
    result: dict[str, Any] = {
        "interfaces": [], "rx_rate_bps": None, "tx_rate_bps": None,
        "error": None,
    }
    try:
        current_pernic = psutil.net_io_counters(pernic=True)
        current_total = psutil.net_io_counters()
    except Exception as exc:
        result["error"] = f"network counters unavailable: {exc}"
        return result

    now = time.monotonic()
    with _net_state.lock:
        prev = _net_state.prev
        if prev is None:
            # First snapshot: take a short timed sample so the very first
            # request still returns real rates instead of zeros.
            prev = {"t": now, "pernic": current_pernic, "total": current_total}
            time.sleep(RATE_SAMPLE_SECONDS)
            current_pernic = psutil.net_io_counters(pernic=True)
            current_total = psutil.net_io_counters()
            now = time.monotonic()
        _net_state.prev = {"t": now, "pernic": current_pernic,
                           "total": current_total}

    dt = max(now - prev["t"], 1e-3)
    result["rx_rate_bps"] = _rate(current_total.bytes_recv, prev["total"].bytes_recv, dt)
    result["tx_rate_bps"] = _rate(current_total.bytes_sent, prev["total"].bytes_sent, dt)
    for name, counters in current_pernic.items():
        old = prev["pernic"].get(name)
        if old is None:
            rx_rate = tx_rate = None
        else:
            rx_rate = _rate(counters.bytes_recv, old.bytes_recv, dt)
            tx_rate = _rate(counters.bytes_sent, old.bytes_sent, dt)
        result["interfaces"].append({
            "name": name,
            "rx_bytes": counters.bytes_recv,
            "tx_bytes": counters.bytes_sent,
            "rx_rate_bps": rx_rate,
            "tx_rate_bps": tx_rate,
        })
    return result


# ---------------------------------------------------------------------------
# Processes
# ---------------------------------------------------------------------------

class _ProcState:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.primed = False


_proc_state = _ProcState()


def collect_processes(limit: int = 500, sort: str = "memory") -> dict[str, Any]:
    """Snapshot running processes.

    Processes that vanish mid-scan are skipped; processes that deny access
    are returned with ``None`` values and an ``error`` note instead of
    crashing the scan. Per-process CPU percent is measured between
    successive calls (psutil semantics), which is why the first call
    primes a short sample window before returning real values.
    """
    procs = list(psutil.process_iter(["pid", "name", "username"]))
    rows: list[dict[str, Any]] = []
    with _proc_state.lock:
        if not _proc_state.primed:
            for proc in procs:
                try:
                    proc.cpu_percent(None)
                except Exception:
                    continue
            time.sleep(PROC_SAMPLE_SECONDS)
            _proc_state.primed = True
        for proc in procs:
            pid = proc.info.get("pid")
            if pid is None:
                continue  # vanished before its info could be read
            name = proc.info.get("name")
            username = proc.info.get("username")
            cpu_percent: Optional[float] = None
            memory_bytes: Optional[int] = None
            errors: list[str] = []
            try:
                cpu_percent = proc.cpu_percent(None)
            except psutil.NoSuchProcess:
                continue
            except psutil.AccessDenied:
                errors.append("access denied")
            except Exception as exc:
                errors.append(f"cpu measurement failed: {exc}")
            try:
                memory_bytes = proc.memory_info().rss
            except psutil.NoSuchProcess:
                continue
            except psutil.AccessDenied:
                errors.append("access denied")
            except Exception as exc:
                errors.append(f"memory measurement failed: {exc}")
            rows.append({
                "pid": pid,
                "name": name,
                "username": username,
                "cpu_percent": cpu_percent,
                "memory_bytes": memory_bytes,
                "error": _join_errors(errors),
            })

    if sort == "cpu":
        rows.sort(key=lambda r: (r["cpu_percent"] is None,
                                 -(r["cpu_percent"] or 0.0)))
    else:
        rows.sort(key=lambda r: (r["memory_bytes"] is None,
                                 -(r["memory_bytes"] or 0)))

    total = len(rows)
    returned_rows = rows[:limit]
    return {
        "processes": returned_rows,
        "count": total,
        "returned": len(returned_rows),
        "truncated": total > limit,
        "timestamp": utc_now_iso(),
    }


# ---------------------------------------------------------------------------
# System snapshot
# ---------------------------------------------------------------------------

def collect_system_snapshot() -> dict[str, Any]:
    hostname = socket.gethostname()
    boot_time = psutil.boot_time()
    return {
        "hostname": hostname,
        "timestamp": utc_now_iso(),
        "os": collect_os(),
        "cpu": collect_cpu(),
        "memory": collect_memory(),
        "disks": collect_disks(),
        "gpu": collect_gpu(),
        "network": collect_network(),
        "boot_time": datetime.fromtimestamp(boot_time, timezone.utc)
        .isoformat(timespec="seconds"),
    }
