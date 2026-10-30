"""Backend API tests.

Tests 1-3 and the process count exercise the *real* collectors against the
actual machine. Mocks are used only for the exceptional-condition tests
(required by the spec): broken sensors, missing/failing nvidia-smi, and
access-denied / disappearing processes.
"""
from __future__ import annotations

import subprocess as real_subprocess
from types import SimpleNamespace

import psutil
import pytest
from fastapi.testclient import TestClient

import app.collectors as collectors
from app.main import app


@pytest.fixture()
def client() -> TestClient:
    return TestClient(app)


# ---------------------------------------------------------------------------
# 1. Health endpoint
# ---------------------------------------------------------------------------

def test_health_returns_valid_response(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert isinstance(body["uptime_seconds"], (int, float))
    assert body["timestamp"]
    assert isinstance(body["pid"], int)


# ---------------------------------------------------------------------------
# 2. System endpoint -- required fields, real values
# ---------------------------------------------------------------------------

def test_system_contains_required_fields(client):
    r = client.get("/api/system")
    assert r.status_code == 200
    b = r.json()
    for key in ("hostname", "timestamp", "os", "cpu", "memory",
                "disks", "gpu", "network", "boot_time"):
        assert key in b, f"missing field {key!r}"

    assert b["hostname"]
    assert b["os"]["version_label"]

    cpu = b["cpu"]
    assert cpu["model"], "CPU model must be collected from the real machine"
    assert cpu["cores_logical"] == psutil.cpu_count(logical=True)
    assert cpu["usage_percent"] is None or 0.0 <= cpu["usage_percent"] <= 100.0

    mem = b["memory"]
    assert mem["total"] == psutil.virtual_memory().total
    assert mem["used"] >= 0
    assert mem["available"] >= 0
    assert 0.0 <= mem["percent"] <= 100.0

    parts = b["disks"]["partitions"]
    assert isinstance(parts, list) and len(parts) >= 1
    for part in parts:
        assert part["mountpoint"]
        if part["error"] is None:
            assert part["total"] > 0
            assert part["used"] >= 0
            assert part["free"] >= 0

    gpu = b["gpu"]
    assert isinstance(gpu["available"], bool)
    if gpu["available"]:
        assert gpu["name"]
        assert gpu["utilization_percent"] is None or 0 <= gpu["utilization_percent"] <= 100
        if gpu["memory_total_bytes"] is not None:
            assert gpu["memory_total_bytes"] > 0
            assert (gpu["memory_used_bytes"] is None
                    or gpu["memory_used_bytes"] <= gpu["memory_total_bytes"])
    else:
        # Unavailable GPU must be flagged, not zeroed.
        assert gpu["reason"]
        assert gpu["utilization_percent"] is None

    net = b["network"]
    assert isinstance(net["interfaces"], list)
    assert net["rx_rate_bps"] is None or net["rx_rate_bps"] >= 0
    assert net["tx_rate_bps"] is None or net["tx_rate_bps"] >= 0


def test_system_gpu_real_when_nvidia_smi_present(client):
    if collectors.shutil.which("nvidia-smi") is None:
        pytest.skip("nvidia-smi not present on this machine")
    gpu = client.get("/api/system").json()["gpu"]
    assert gpu["available"] is True
    assert gpu["memory_total_bytes"] is None or gpu["memory_total_bytes"] > 1_000_000


# ---------------------------------------------------------------------------
# 3. Processes endpoint structure
# ---------------------------------------------------------------------------

def test_processes_response_structure(client):
    r = client.get("/api/processes?limit=200&sort=cpu")
    assert r.status_code == 200
    b = r.json()
    assert b["count"] >= b["returned"]
    assert b["returned"] <= 200
    assert b["timestamp"]
    assert len(b["processes"]) == b["returned"]
    assert b["count"] > 0, "expected at least one running process"
    for row in b["processes"]:
        # PID 0 is the legitimate System Idle Process on Windows.
        assert isinstance(row["pid"], int) and row["pid"] >= 0
        assert row["name"] is None or isinstance(row["name"], str)
        assert row["cpu_percent"] is None or row["cpu_percent"] >= 0
        assert row["memory_bytes"] is None or row["memory_bytes"] >= 0
    # Sorted by CPU descending, None values last.
    present = [p["cpu_percent"] for p in b["processes"]
               if p["cpu_percent"] is not None]
    assert present == sorted(present, reverse=True)
    flags = [p["cpu_percent"] is not None for p in b["processes"]]
    assert flags == sorted(flags, reverse=True)


def test_processes_default_sort_is_memory(client):
    b = client.get("/api/processes").json()
    present = [p["memory_bytes"] for p in b["processes"]
               if p["memory_bytes"] is not None]
    assert present == sorted(present, reverse=True)


def test_processes_truncation(client):
    b = client.get("/api/processes?limit=5").json()
    assert b["returned"] == 5
    assert b["count"] > 5
    assert b["truncated"] is True


# ---------------------------------------------------------------------------
# 4. Collection errors are handled appropriately
# ---------------------------------------------------------------------------

def test_cpu_sensor_error_is_marked_not_fabricated(client, monkeypatch):
    def boom(interval=None):
        raise RuntimeError("sensor exploded")

    monkeypatch.setattr(psutil, "cpu_percent", boom)
    r = client.get("/api/system")
    assert r.status_code == 200
    b = r.json()
    assert b["cpu"]["usage_percent"] is None
    assert b["cpu"]["error"] and "sensor exploded" in b["cpu"]["error"]
    # Other sections still return real data.
    assert b["memory"]["total"] > 0


def test_snapshot_hard_failure_returns_json_500(client, monkeypatch):
    def boom():
        raise RuntimeError("hostname lookup failed")

    monkeypatch.setattr(collectors.socket, "gethostname", boom)
    r = client.get("/api/system")
    assert r.status_code == 500
    body = r.json()
    assert "hostname lookup failed" in body["detail"]


def test_process_enumeration_failure_returns_json_500(client, monkeypatch):
    def boom(attrs=None):
        raise RuntimeError("cannot enumerate processes")

    monkeypatch.setattr(collectors.psutil, "process_iter", boom)
    r = client.get("/api/processes")
    assert r.status_code == 500
    assert "cannot enumerate processes" in r.json()["detail"]


# ---------------------------------------------------------------------------
# 5. GPU unavailable / nvidia-smi failures keep the app functional
# ---------------------------------------------------------------------------

def test_gpu_unavailable_when_nvidia_smi_missing(client, monkeypatch):
    monkeypatch.setattr(collectors.shutil, "which", lambda name: None)
    r = client.get("/api/system")
    assert r.status_code == 200
    gpu = r.json()["gpu"]
    assert gpu["available"] is False
    assert gpu["utilization_percent"] is None
    assert gpu["memory_used_bytes"] is None
    assert gpu["memory_total_bytes"] is None
    assert gpu["reason"] and "nvidia-smi" in gpu["reason"]
    # Everything else still works.
    assert r.json()["memory"]["total"] > 0


def test_gpu_nvidia_smi_nonzero_exit(client, monkeypatch):
    monkeypatch.setattr(collectors.shutil, "which",
                        lambda name: r"C:\fake\nvidia-smi.exe")
    fake = SimpleNamespace(returncode=1, stdout="", stderr="driver error")
    monkeypatch.setattr(collectors.subprocess, "run",
                        lambda *a, **k: fake)
    gpu = client.get("/api/system").json()["gpu"]
    assert gpu["available"] is False
    assert "driver error" in gpu["reason"]
    assert gpu["name"] is None


def test_gpu_nvidia_smi_timeout(client, monkeypatch):
    monkeypatch.setattr(collectors.shutil, "which", lambda name: "nvidia-smi")

    def fake_run(*args, **kwargs):
        raise real_subprocess.TimeoutExpired("nvidia-smi", 3)

    monkeypatch.setattr(collectors.subprocess, "run", fake_run)
    gpu = client.get("/api/system").json()["gpu"]
    assert gpu["available"] is False
    assert "timed out" in gpu["reason"]


def test_gpu_na_values_are_unavailable_not_zero(client, monkeypatch):
    monkeypatch.setattr(collectors.shutil, "which", lambda name: "nvidia-smi")
    fake = SimpleNamespace(returncode=0,
                           stdout="Mystery GPU, [N/A], [N/A], [N/A]\n",
                           stderr="")
    monkeypatch.setattr(collectors.subprocess, "run",
                        lambda *a, **k: fake)
    gpu = client.get("/api/system").json()["gpu"]
    assert gpu["available"] is True
    assert gpu["name"] == "Mystery GPU"
    assert gpu["utilization_percent"] is None
    assert gpu["memory_used_bytes"] is None
    assert gpu["memory_total_bytes"] is None
    assert "N/A" in (gpu["reason"] or "")


# ---------------------------------------------------------------------------
# 6. Access-denied and disappearing processes do not crash the app
# ---------------------------------------------------------------------------

class FakeProcess:
    def __init__(self, pid, name, cpu=None, rss=None,
                 cpu_exc=None, rss_exc=None):
        self.info = {"pid": pid, "name": name, "username": "tester"}
        self._cpu = cpu
        self._rss = rss
        self._cpu_exc = cpu_exc
        self._rss_exc = rss_exc

    def cpu_percent(self, interval):
        if self._cpu_exc is not None:
            raise self._cpu_exc
        return self._cpu

    def memory_info(self):
        if self._rss_exc is not None:
            raise self._rss_exc
        return SimpleNamespace(rss=self._rss)


def test_disappearing_and_denied_processes_do_not_crash(client, monkeypatch):
    procs = [
        FakeProcess(1001, "normal.exe", cpu=12.5, rss=123456),
        FakeProcess(1002, "vanished.exe", cpu_exc=psutil.NoSuchProcess(1002)),
        FakeProcess(1003, "denied_mem.exe", cpu=3.0,
                    rss_exc=psutil.AccessDenied(1003)),
        FakeProcess(1004, "denied_cpu.exe", cpu_exc=psutil.AccessDenied(1004),
                    rss=999),
        FakeProcess(1005, "gone_on_mem.exe", cpu=7.0,
                    rss_exc=psutil.NoSuchProcess(1005)),
    ]
    monkeypatch.setattr(collectors.psutil, "process_iter",
                        lambda attrs=None: iter(procs))
    r = client.get("/api/processes")
    assert r.status_code == 200
    rows = {p["pid"]: p for p in r.json()["processes"]}
    assert 1002 not in rows and 1005 not in rows  # vanished processes skipped
    assert rows[1001]["cpu_percent"] == 12.5
    assert rows[1001]["memory_bytes"] == 123456
    assert rows[1003]["cpu_percent"] == 3.0
    assert rows[1003]["memory_bytes"] is None
    assert rows[1003]["error"] and "denied" in rows[1003]["error"]
    assert rows[1004]["cpu_percent"] is None
    assert rows[1004]["memory_bytes"] == 999


# ---------------------------------------------------------------------------
# 7. Invalid requests
# ---------------------------------------------------------------------------

def test_invalid_query_parameters_get_422(client):
    assert client.get("/api/processes?limit=abc").status_code == 422
    assert client.get("/api/processes?limit=0").status_code == 422
    assert client.get("/api/processes?limit=-5").status_code == 422
    assert client.get("/api/processes?sort=banana").status_code == 422


def test_unknown_route_is_404_and_wrong_method_is_405(client):
    assert client.get("/api/nope").status_code == 404
    assert client.post("/api/health").status_code == 405
    assert client.post("/api/system").status_code == 405
