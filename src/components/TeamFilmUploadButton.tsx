import { useRef, useState } from "react";
import { uploadTeamFilm } from "../lib/teamFilm";
import { analyzeTeamFilm } from "../lib/analysis/teamFilmAnalysisClient";
import { MAX_UPLOAD_MB } from "../lib/storagePath";
import { CompressionInsufficientError, compressVideo, ensureFastStart, needsCompression } from "../lib/videoCompression";

export default function TeamFilmUploadButton({
  teamId,
  coachId,
  onDone,
}: {
  teamId: string;
  coachId: string;
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

      // See UploadButton.tsx/GameFilmUploadButton.tsx for why this reads from a local blob: URL
      // rather than the remote Storage URL — avoids the mobile Safari CORS/network hang.
      const localUrl = URL.createObjectURL(uploadFile);

      setStatus("uploading");
      const upload = await uploadTeamFilm(teamId, coachId, uploadFile);

      setStatus("analyzing");
      try {
        await analyzeTeamFilm(upload.id, localUrl);
      } finally {
        URL.revokeObjectURL(localUrl);
      }

      onDone();
    } catch (err) {
      if (err instanceof CompressionInsufficientError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong uploading your team film. Please try again.");
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
      {status === "uploading" && <p>Uploading team film...</p>}
      {status === "analyzing" && <p>Analyzing team footage...</p>}
      {error && <p style={{ color: "#f87171" }}>{error}</p>}
    </div>
  );
}
