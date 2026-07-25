import { useRef, useState } from "react";
import { analysisClient } from "../lib/analysis/claudeAnalysisClient";
import { getReferenceProfileByName, uploadDrillVideo } from "../lib/uploads";
import { MAX_UPLOAD_MB } from "../lib/storagePath";
import { CompressionInsufficientError, compressVideo, ensureFastStart, needsCompression } from "../lib/videoCompression";

export default function UploadButton({
  drillId,
  playerId,
  onDone,
}: {
  drillId: string;
  playerId: string;
  onDone: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "processing" | "uploading" | "analyzing">("idle");
  const [error, setError] = useState<string | null>(null);
  const [compressionProgress, setCompressionProgress] = useState(0);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      let uploadFile = file;
      if (needsCompression(file)) {
        setStatus("processing");
        setCompressionProgress(0);
        uploadFile = await compressVideo(file, setCompressionProgress);
      } else {
        // See videoCompression.ts's ensureFastStart for why this runs when compression is
        // skipped — best-effort, falls back to the original file if it fails.
        try {
          uploadFile = await ensureFastStart(file);
        } catch {
          uploadFile = file;
        }
      }

      // Extract frames from a local blob: URL of the file already in the browser rather than the
      // remote Supabase Storage URL — fetching a cross-origin video over a real network, with the
      // CORS/range-request handling that requires, is a known source of hangs on mobile Safari.
      // A same-origin blob needs neither.
      const localUrl = URL.createObjectURL(uploadFile);

      setStatus("uploading");
      const upload = await uploadDrillVideo(playerId, drillId, uploadFile);

      setStatus("analyzing");
      // Starting with a single reference profile (Curry) to validate quality before
      // expanding to player-chosen profiles across the library.
      const referenceProfile = await getReferenceProfileByName("Stephen Curry");
      try {
        await analysisClient.analyzeUpload(upload.id, localUrl, referenceProfile.id);
      } finally {
        URL.revokeObjectURL(localUrl);
      }

      onDone();
    } catch (err) {
      if (err instanceof CompressionInsufficientError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong uploading your video. Please try again.");
      }
    } finally {
      setStatus("idle");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div>
      <input ref={fileInputRef} type="file" accept="video/*" onChange={handleFileSelected} disabled={status !== "idle"} />
      <p style={{ fontSize: "0.85em", opacity: 0.75 }}>
        Large clips are compressed automatically before upload (limit after compression: {MAX_UPLOAD_MB} MB).
      </p>
      {status === "processing" && <p>Processing video... {Math.round(compressionProgress * 100)}%</p>}
      {status === "uploading" && <p>Uploading video...</p>}
      {status === "analyzing" && <p>Analyzing your form against Stephen Curry...</p>}
      {error && <p style={{ color: "#f87171" }}>{error}</p>}
    </div>
  );
}
