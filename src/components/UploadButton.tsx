import { useRef, useState } from "react";
import { analysisClient } from "../lib/analysis/claudeAnalysisClient";
import { getReferenceProfileByName, uploadDrillVideo } from "../lib/uploads";
import { MAX_UPLOAD_MB } from "../lib/storagePath";
import { CompressionInsufficientError, compressVideo, needsCompression } from "../lib/videoCompression";

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
      }

      setStatus("uploading");
      const upload = await uploadDrillVideo(playerId, drillId, uploadFile);

      setStatus("analyzing");
      // Starting with a single reference profile (Curry) to validate quality before
      // expanding to player-chosen profiles across the library.
      const referenceProfile = await getReferenceProfileByName("Stephen Curry");
      await analysisClient.analyzeUpload(upload.id, upload.video_url, referenceProfile.id);

      onDone();
    } catch (err) {
      if (err instanceof CompressionInsufficientError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : "Upload or analysis failed.");
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
