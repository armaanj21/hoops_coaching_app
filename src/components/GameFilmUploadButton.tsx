import { useRef, useState } from "react";
import { analyzeGameFilm } from "../lib/analysis/gameFilmAnalysisClient";
import { annotateFrameWithBox, extractFrameAt, type NormalizedBox } from "../lib/analysis/frameExtraction";
import { saveMarker, uploadGameFilm } from "../lib/gameFilm";
import { MAX_UPLOAD_MB } from "../lib/storagePath";
import { CompressionInsufficientError, compressVideo, needsCompression } from "../lib/videoCompression";
import PlayerMarker from "./PlayerMarker";

type Status = "idle" | "processing" | "uploading" | "extracting" | "marking" | "confirming" | "analyzing";

export default function GameFilmUploadButton({
  playerId,
  referenceProfileId,
  onDone,
}: {
  playerId: string;
  referenceProfileId: string;
  onDone: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [jerseyNumber, setJerseyNumber] = useState("");
  const [jerseyColor, setJerseyColor] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [compressionProgress, setCompressionProgress] = useState(0);

  const [pendingUploadId, setPendingUploadId] = useState<string | null>(null);
  const [pendingVideoUrl, setPendingVideoUrl] = useState<string | null>(null);
  const [referenceFrame, setReferenceFrame] = useState<string | null>(null);
  const [referenceFrameTime, setReferenceFrameTime] = useState<number | null>(null);
  const [pendingBox, setPendingBox] = useState<NormalizedBox | null>(null);
  const [debugFrame, setDebugFrame] = useState<string | null>(null);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!jerseyNumber.trim() || !jerseyColor.trim()) {
      setError("Enter your jersey number and color before uploading.");
      e.target.value = "";
      return;
    }
    setError(null);
    try {
      let uploadFile = file;
      if (needsCompression(file)) {
        setStatus("processing");
        setCompressionProgress(0);
        uploadFile = await compressVideo(file, setCompressionProgress);
      }

      setStatus("uploading");
      const upload = await uploadGameFilm(playerId, uploadFile, jerseyNumber, jerseyColor);
      setPendingUploadId(upload.id);
      setPendingVideoUrl(upload.video_url);

      setStatus("extracting");
      const frame = await extractFrameAt(upload.video_url);
      setReferenceFrame(`data:image/jpeg;base64,${frame.base64}`);
      setReferenceFrameTime(frame.time);
      setStatus("marking");
    } catch (err) {
      if (err instanceof CompressionInsufficientError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : "Upload failed.");
      }
      setStatus("idle");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // Re-extracts the exact marked frame (same call the analysis itself makes) and draws the box
  // onto it, so the player can visually confirm the box lands correctly on the real frame at its
  // native resolution before any analysis call is made — not just that it looked right in the
  // (possibly downscaled) drag UI.
  async function handleMarkConfirmed(box: NormalizedBox) {
    if (!pendingVideoUrl || referenceFrameTime === null) return;
    setError(null);
    try {
      setStatus("confirming");
      const markerFrame = await extractFrameAt(pendingVideoUrl, referenceFrameTime);
      const annotated = await annotateFrameWithBox(markerFrame.base64, box, markerFrame.width, markerFrame.height);
      console.log("[game-film debug] marker frame", {
        markerFrameTime: referenceFrameTime,
        box,
        nativeWidth: markerFrame.width,
        nativeHeight: markerFrame.height,
      });
      setPendingBox(box);
      setDebugFrame(`data:image/jpeg;base64,${annotated}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to render debug preview.");
      setStatus("marking");
    }
  }

  async function handleDebugApproved() {
    if (!pendingUploadId || !pendingVideoUrl || referenceFrameTime === null || !pendingBox) return;
    setError(null);
    try {
      setStatus("analyzing");
      await saveMarker(pendingUploadId, referenceFrameTime, pendingBox);
      await analyzeGameFilm(
        pendingUploadId,
        pendingVideoUrl,
        referenceProfileId,
        jerseyNumber,
        jerseyColor,
        referenceFrameTime,
        pendingBox
      );
      resetPending();
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed.");
      setStatus("confirming");
    }
  }

  function handleDebugRejected() {
    setPendingBox(null);
    setDebugFrame(null);
    setStatus("marking");
  }

  function resetPending() {
    setPendingUploadId(null);
    setPendingVideoUrl(null);
    setReferenceFrame(null);
    setReferenceFrameTime(null);
    setPendingBox(null);
    setDebugFrame(null);
    setStatus("idle");
    setJerseyNumber("");
    setJerseyColor("");
  }

  if (status === "marking" && referenceFrame) {
    return <PlayerMarkerStep frameSrc={referenceFrame} onConfirm={handleMarkConfirmed} error={error} />;
  }

  if ((status === "confirming" || status === "analyzing") && debugFrame) {
    return (
      <div>
        <p>
          This is the exact frame, at its native resolution, that will be sent to Claude with the box drawn on it.
          Confirm it lands on you before continuing.
        </p>
        <img src={debugFrame} alt="Debug preview of marked frame" style={{ maxWidth: "100%" }} />
        <div>
          <button onClick={handleDebugApproved} disabled={status === "analyzing"}>
            {status === "analyzing" ? "Analyzing..." : "Looks correct, run analysis"}
          </button>
          <button onClick={handleDebugRejected} disabled={status === "analyzing"}>
            Re-mark
          </button>
        </div>
        {error && <p style={{ color: "#f87171" }}>{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <label>
        Your jersey number
        <input
          type="text"
          value={jerseyNumber}
          onChange={(e) => setJerseyNumber(e.target.value)}
          placeholder="e.g. 23"
          required
          disabled={status !== "idle"}
        />
      </label>
      <label>
        Your jersey color
        <input
          type="text"
          value={jerseyColor}
          onChange={(e) => setJerseyColor(e.target.value)}
          placeholder="e.g. white, navy, red"
          required
          disabled={status !== "idle"}
        />
      </label>
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        onChange={handleFileSelected}
        disabled={status !== "idle"}
      />
      <p style={{ fontSize: "0.85em", opacity: 0.75 }}>
        Large clips are compressed automatically before upload (limit after compression: {MAX_UPLOAD_MB} MB).
      </p>
      {status === "processing" && <p>Processing video... {Math.round(compressionProgress * 100)}%</p>}
      {status === "uploading" && <p>Uploading game film...</p>}
      {status === "extracting" && <p>Extracting a reference frame...</p>}
      {error && <p style={{ color: "#f87171" }}>{error}</p>}
    </div>
  );
}

function PlayerMarkerStep({
  frameSrc,
  onConfirm,
  error,
}: {
  frameSrc: string;
  onConfirm: (box: NormalizedBox) => void;
  error: string | null;
}) {
  return (
    <div>
      <PlayerMarker frameSrc={frameSrc} onConfirm={onConfirm} />
      {error && <p style={{ color: "#f87171" }}>{error}</p>}
    </div>
  );
}
