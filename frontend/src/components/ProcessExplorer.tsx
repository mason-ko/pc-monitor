import { useMemo, useState } from "react";
import type { ProcessRow, ProcessesResponse } from "../api";
import { fmtBytes, fmtPercent } from "../format";

type SortKey = "cpu" | "memory";

const MAX_VISIBLE_ROWS = 120;

interface ProcessExplorerProps {
  response: ProcessesResponse | null;
  loading: boolean;
  error: string | null;
}

function compareNullable(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1; // unknown values sort last
  if (b === null) return -1;
  return b - a; // descending
}

export function ProcessExplorer({ response, loading, error }: ProcessExplorerProps) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("memory");

  const rows = useMemo(() => {
    if (!response) return [];
    const q = query.trim().toLowerCase();
    const filtered = q
      ? response.processes.filter(
          (p) =>
            (p.name !== null && p.name.toLowerCase().includes(q)) ||
            String(p.pid) === q,
        )
      : response.processes;
    const sorted = [...filtered];
    sorted.sort((a, b) =>
      sortKey === "cpu"
        ? compareNullable(a.cpu_percent, b.cpu_percent)
        : compareNullable(a.memory_bytes, b.memory_bytes),
    );
    return sorted;
  }, [response, query, sortKey]);

  if (loading && !response) {
    return <p className="muted">Loading process list…</p>;
  }

  return (
    <div>
      {error && response && (
        <p className="banner banner-error" role="alert">
          ⚠ Process refresh failed: {error}
        </p>
      )}
      <div className="proc-controls">
        <input
          type="search"
          className="search"
          placeholder="Search by name or PID…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search processes"
        />
        <div className="sort-buttons" role="group" aria-label="Sort processes">
          <button
            type="button"
            className={sortKey === "cpu" ? "active" : ""}
            aria-pressed={sortKey === "cpu"}
            onClick={() => setSortKey("cpu")}
          >
            Sort by CPU
          </button>
          <button
            type="button"
            className={sortKey === "memory" ? "active" : ""}
            aria-pressed={sortKey === "memory"}
            onClick={() => setSortKey("memory")}
          >
            Sort by Memory
          </button>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="muted">
          {query
            ? `No processes match “${query}”.`
            : "No processes were reported."}
        </p>
      ) : (
        <>
          <table className="table">
            <thead>
              <tr>
                <th>Process</th>
                <th className="num">PID</th>
                <th className="num">CPU</th>
                <th className="num">Memory</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, MAX_VISIBLE_ROWS).map((row: ProcessRow) => (
                <tr key={row.pid}>
                  <td className="truncate" title={row.error ?? row.name ?? undefined}>
                    {row.name && row.name.trim() ? row.name : `PID ${row.pid}`}
                    {row.error && <span className="denied-badge"> restricted</span>}
                  </td>
                  <td className="num">{row.pid}</td>
                  <td className="num">{fmtPercent(row.cpu_percent)}</td>
                  <td className="num">{fmtBytes(row.memory_bytes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted proc-count">
            Showing {Math.min(rows.length, MAX_VISIBLE_ROWS)} of {rows.length}
            {response?.truncated && rows.length === response.returned
              ? ` (of ${response.count} running processes total)`
              : ""}
          </p>
        </>
      )}
    </div>
  );
}
