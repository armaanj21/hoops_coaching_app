import { useEffect, useState } from "react";
import { getPlayerAnalysisHistory, detectProgressPatterns, detectIssueOutcomes } from "../lib/progress";
import { getIssueDrillLinksForPlayer } from "../lib/issueDrillLinks";
import type { AnalysisHistoryEntry, IssueDrillLink, IssueOutcome, ProgressPattern } from "../types";

export default function AnalysisHistoryView({ playerId }: { playerId: string }) {
  const [history, setHistory] = useState<AnalysisHistoryEntry[]>([]);
  const [links, setLinks] = useState<IssueDrillLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [patterns, setPatterns] = useState<ProgressPattern[] | null>(null);
  const [patternsLoading, setPatternsLoading] = useState(false);
  const [patternsError, setPatternsError] = useState<string | null>(null);

  const [outcomes, setOutcomes] = useState<IssueOutcome[] | null>(null);
  const [outcomesLoading, setOutcomesLoading] = useState(false);
  const [outcomesError, setOutcomesError] = useState<string | null>(null);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId]);

  async function load() {
    setLoading(true);
    setError(null);
    setPatterns(null);
    setOutcomes(null);
    try {
      const [entries, linkRows] = await Promise.all([
        getPlayerAnalysisHistory(playerId),
        getIssueDrillLinksForPlayer(playerId),
      ]);
      setHistory(entries);
      setLinks(linkRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analysis history.");
    } finally {
      setLoading(false);
    }
  }

  async function loadPatterns() {
    setPatternsLoading(true);
    setPatternsError(null);
    try {
      setPatterns(await detectProgressPatterns(history));
    } catch (err) {
      setPatternsError(err instanceof Error ? err.message : "Failed to detect patterns.");
    } finally {
      setPatternsLoading(false);
    }
  }

  async function loadOutcomes() {
    setOutcomesLoading(true);
    setOutcomesError(null);
    try {
      setOutcomes(await detectIssueOutcomes(links, history));
    } catch (err) {
      setOutcomesError(err instanceof Error ? err.message : "Failed to check drill outcomes.");
    } finally {
      setOutcomesLoading(false);
    }
  }

  if (loading) return <p>Loading analysis history...</p>;
  if (error) return <p style={{ color: "#f87171" }}>{error}</p>;
  if (history.length === 0) return <p>No analyses yet — once game film or drill videos are analyzed, they'll show up here.</p>;

  return (
    <div>
      <div className="card">
        <h2>Recurring patterns</h2>
        {patterns === null && !patternsLoading && (
          <>
            <p>Look for issues that show up across multiple analyses, rather than reading each report in isolation.</p>
            <button onClick={() => void loadPatterns()} disabled={history.filter((h) => h.issues.length > 0).length < 2}>
              Find recurring patterns
            </button>
            {history.filter((h) => h.issues.length > 0).length < 2 && (
              <p style={{ fontSize: "0.85em", opacity: 0.75 }}>Needs at least two analyses with flagged issues to compare.</p>
            )}
          </>
        )}
        {patternsLoading && <p>Looking for patterns across {history.length} analyses...</p>}
        {patternsError && <p style={{ color: "#f87171" }}>{patternsError}</p>}
        {patterns !== null && patterns.length === 0 && !patternsLoading && (
          <p>No recurring issues found — nothing has shown up more than once yet.</p>
        )}
        {patterns !== null && patterns.length > 0 && (
          <ul>
            {patterns.map((p, i) => (
              <li key={i}>
                <strong>{p.theme}</strong> (appears in {p.analysisIds.length} analyses) — {p.summary}
              </li>
            ))}
          </ul>
        )}
      </div>

      {links.length > 0 && (
        <div className="card">
          <h2>Drill outcomes</h2>
          {outcomes === null && !outcomesLoading && (
            <>
              <p>Check whether issues addressed by an assigned drill actually improved in the next analysis.</p>
              <button onClick={() => void loadOutcomes()}>Check drill outcomes</button>
            </>
          )}
          {outcomesLoading && <p>Checking outcomes for {links.length} linked drill(s)...</p>}
          {outcomesError && <p style={{ color: "#f87171" }}>{outcomesError}</p>}
        </div>
      )}

      <div className="card">
        <h2>Analysis timeline</h2>
        <ul>
          {history.map((entry) => {
            const flaggedByPattern = patterns?.filter((p) => p.analysisIds.includes(entry.id)) ?? [];
            const linksFromThisEntry = links.filter((l) => l.analysisResultId === entry.id);
            return (
              <li key={entry.id} style={{ marginBottom: "1em" }}>
                <p>
                  <strong>{new Date(entry.createdAt).toLocaleDateString()}</strong> —{" "}
                  {entry.kind === "drill" ? `Drill: ${entry.drillTitle}` : "Game film"} vs. {entry.referenceName}
                </p>
                <p>{entry.overallNote}</p>
                {entry.issues.length > 0 && (
                  <ul>
                    {entry.issues.map((issue, i) => (
                      <li key={i}>{issue}</li>
                    ))}
                  </ul>
                )}
                {flaggedByPattern.length > 0 && (
                  <p style={{ color: "#f59e0b" }}>
                    Part of a pattern: {flaggedByPattern.map((p) => p.theme).join(", ")}
                  </p>
                )}
                {linksFromThisEntry.map((link) => {
                  const outcome = outcomes?.find((o) => o.link.id === link.id);
                  return (
                    <div key={link.id} style={{ borderLeft: "3px solid #4ade80", paddingLeft: "0.75em", marginTop: "0.5em" }}>
                      <p>
                        → Addressed with <strong>{link.drillTitle}</strong>, assigned {new Date(link.createdAt).toLocaleDateString()}
                        <br />
                        <em>Targeting: "{link.issueDescription}"</em>
                      </p>
                      {!outcomes && <p style={{ fontSize: "0.85em", opacity: 0.75 }}>Click "Check drill outcomes" above to see what happened next.</p>}
                      {outcome && outcome.narration && (
                        <p style={{ color: outcome.reappeared ? "#f87171" : "#4ade80" }}>→ {outcome.narration}</p>
                      )}
                      {outcome && !outcome.narration && (
                        <p style={{ fontSize: "0.85em", opacity: 0.75 }}>→ No analysis since this drill was assigned yet — outcome pending.</p>
                      )}
                    </div>
                  );
                })}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
