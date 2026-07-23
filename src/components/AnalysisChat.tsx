import { useEffect, useState } from "react";
import type { AnalysisMessage, GameFilmAnalysisResult } from "../types";
import { getMessages, sendChatMessage } from "../lib/analysis/analysisChat";

export default function AnalysisChat({
  analysisResultId,
  canSend,
  onAnalysisUpdated,
}: {
  analysisResultId: string;
  canSend: boolean;
  onAnalysisUpdated: (updated: GameFilmAnalysisResult) => void;
}) {
  const [messages, setMessages] = useState<AnalysisMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [correctionNote, setCorrectionNote] = useState<string | null>(null);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisResultId]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setMessages(await getMessages(analysisResultId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load chat.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const message = input.trim();
    if (!message || sending) return;
    setError(null);
    setCorrectionNote(null);
    setSending(true);
    // Optimistic: show the player's message immediately rather than waiting on the round trip.
    const optimisticUserMessage: AnalysisMessage = {
      id: `pending-${Date.now()}`,
      analysis_result_id: analysisResultId,
      role: "user",
      content: message,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUserMessage]);
    setInput("");
    try {
      const { assistantMessage, updatedAnalysis } = await sendChatMessage(analysisResultId, message);
      setMessages((prev) => [...prev, assistantMessage]);
      if (updatedAnalysis) {
        onAnalysisUpdated(updatedAnalysis);
        setCorrectionNote("The stored analysis was updated based on your correction.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message.");
    } finally {
      setSending(false);
    }
  }

  if (loading) return <p>Loading chat...</p>;

  return (
    <div>
      <h4>Follow-up chat</h4>
      {messages.length === 0 && <p>Ask a follow-up question, or correct anything the analysis got wrong.</p>}
      <ul>
        {messages.map((m) => (
          <li key={m.id}>
            <strong>{m.role === "user" ? "You" : "AI"}:</strong> {m.content}
          </li>
        ))}
      </ul>
      {correctionNote && <p style={{ color: "#4ade80" }}>{correctionNote}</p>}
      {error && <p style={{ color: "#f87171" }}>{error}</p>}
      {canSend && (
        <form onSubmit={handleSend}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question or correct a detail..."
            disabled={sending}
          />
          <button type="submit" disabled={sending || !input.trim()}>
            {sending ? "Sending..." : "Send"}
          </button>
        </form>
      )}
    </div>
  );
}
