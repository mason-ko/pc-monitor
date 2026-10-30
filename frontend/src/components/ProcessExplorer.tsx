import { memo, useContext, useMemo, useState } from "react";
import type { ProcessRow, ProcessesResponse } from "../api";
import { I18nContext, tr } from "../i18n";
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

/**
 * Memoized for the same reason as LiveChart: the system poll (every 2 s)
 * re-renders App with an unchanged `response` reference, and re-rendering
 * the visible process rows on those ticks is pure churn. The props are a
 * fresh object only when the processes poll actually returns new data.
 */
export const ProcessExplorer = memo(function ProcessExplorer({
  response,
  loading,
  error,
}: ProcessExplorerProps) {
  const { t } = useContext(I18nContext);
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
    // A polite live region so screen readers announce the transition from
    // "loading" to the table arriving (or failing) without stealing focus.
    return (
      <p className="muted" role="status">
        {t.processes.loading}
      </p>
    );
  }

  return (
    <div>
      {error && response && (
        <p className="banner banner-error" role="alert">
          {tr(t.processes.refreshFailed, { error })}
        </p>
      )}
      <div className="proc-controls">
        <input
          type="search"
          className="search"
          placeholder={t.processes.searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={t.processes.searchAria}
        />
        <div className="sort-buttons" role="group" aria-label={t.processes.sortAria}>
          <button
            type="button"
            className={sortKey === "cpu" ? "active" : ""}
            aria-pressed={sortKey === "cpu"}
            onClick={() => setSortKey("cpu")}
          >
            {t.processes.sortByCpu}
          </button>
          <button
            type="button"
            className={sortKey === "memory" ? "active" : ""}
            aria-pressed={sortKey === "memory"}
            onClick={() => setSortKey("memory")}
          >
            {t.processes.sortByMemory}
          </button>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="muted">
          {query ? tr(t.processes.noMatch, { query }) : t.processes.noneReported}
        </p>
      ) : (
        <>
          <table className="table">
            <thead>
              <tr>
                <th scope="col">{t.processes.colProcess}</th>
                <th scope="col" className="num">{t.processes.colPid}</th>
                <th scope="col" className="num">{t.processes.colCpu}</th>
                <th scope="col" className="num">{t.processes.colMemory}</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, MAX_VISIBLE_ROWS).map((row: ProcessRow) => (
                <tr key={row.pid}>
                  <td className="truncate" title={row.error ?? row.name ?? undefined}>
                    {row.name && row.name.trim() ? row.name : tr(t.processes.pidLabel, { pid: row.pid })}
                    {row.error && <span className="denied-badge">{t.processes.restricted}</span>}
                  </td>
                  <td className="num">{row.pid}</td>
                  <td className="num">{fmtPercent(row.cpu_percent)}</td>
                  <td className="num">{fmtBytes(row.memory_bytes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted proc-count">
            {tr(t.processes.showing, {
              shown: Math.min(rows.length, MAX_VISIBLE_ROWS),
              total: rows.length,
            })}
            {response?.truncated && rows.length === response.returned
              ? tr(t.processes.ofRunning, { count: response.count })
              : ""}
          </p>
        </>
      )}
    </div>
  );
});
