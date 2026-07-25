import { useRef, useState } from "react";
import { analyzeGameFilm } from "../lib/analysis/gameFilmAnalysisClient";
import { annotateFrameWithBox, extractFrameAt, type NormalizedBox } from "../lib/analysis/frameExtraction";
import { saveMarker, uploadGameFilm } from "../lib/gameFilm";
import { MAX_UPLOAD_MB } from "../lib/storagePath";
import { CompressionInsufficientError, compressVideo, ensureFastStart, needsCompression } from "../lib/videoCompression";
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
  // Frame extraction/marking reads from this local blob: URL of the file already sitting in the
  // browser, not the remote Supabase Storage URL — fetching a cross-origin video over a real
  // mobile network, with all the CORS/range-request quirks iOS Safari has around that, was
  // causing extraction to hang or time out on-device even though it worked fine on desktop with
  // small local test clips. A blob URL needs no network round trip and no cross-origin video
  // element at all, so it sidesteps that whole class of failure for the parts of this flow that
  // still have the original file in memory. Revoked once the upload flow finishes or resets.
  const [pendingLocalUrl, setPendingLocalUrl] = useState<string | null>(null);
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
    // Surfaced in the error message on failure below — the last two attempts at fixing this
    // blind (removing the network fetch, then forcing faststart) both failed to reproduce-fix on
    // the reporter's actual device, so this trades guessing for an actual on-screen diagnostic.
    let remuxOutcome = "not attempted (compression ran instead)";
    try {
      let uploadFile = file;
      console.log("[game-film upload] original file", { name: file.name, size: file.size, type: file.type });
      if (needsCompression(file)) {
        setStatus("processing");
        setCompressionProgress(0);
        uploadFile = await compressVideo(file, setCompressionProgress);
        remuxOutcome = "compressed (includes faststart)";
      } else {
        // compressVideo's own encode always sets +faststart; when compression is skipped, do a
        // cheap remux-only pass instead so frame extraction can still seek reliably. Best-effort —
        // if this fails for some reason, fall back to the original file rather than blocking the
        // whole upload on it.
        try {
          uploadFile = await ensureFastStart(file);
          remuxOutcome = "faststart remux succeeded";
        } catch (remuxErr) {
          uploadFile = file;
          remuxOutcome = `faststart remux FAILED, used original file: ${remuxErr instanceof Error ? remuxErr.message : String(remuxErr)}`;
        }
      }
      console.log("[game-film upload] remux outcome", remuxOutcome);
      console.log("[game-film upload] final upload file", {
        name: uploadFile.name,
        size: uploadFile.size,
        type: uploadFile.type,
      });

      const localUrl = URL.createObjectURL(uploadFile);
      setPendingLocalUrl(localUrl);

      setStatus("uploading");
      const upload = await uploadGameFilm(playerId, uploadFile, jerseyNumber, jerseyColor);
      setPendingUploadId(upload.id);

      setStatus("extracting");
      const frame = await extractFrameAt(localUrl);
      setReferenceFrame(`data:image/jpeg;base64,${frame.base64}`);
      setReferenceFrameTime(frame.time);
      setStatus("marking");
    } catch (err) {
      if (err instanceof CompressionInsufficientError) {
        setError(err.message);
      } else {
        const baseMessage =
          err instanceof Error ? err.message : "Something went wrong uploading your video. Please try again.";
        setError(`${baseMessage} [file: ${file.name}, ${file.size} bytes, ${file.type || "unknown type"}; remux: ${remuxOutcome}]`);
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
    if (!pendingLocalUrl || referenceFrameTime === null) return;
    setError(null);
    try {
      setStatus("confirming");
      const markerFrame = await extractFrameAt(pendingLocalUrl, referenceFrameTime);
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
      setError(err instanceof Error ? err.message : "Something went wrong preparing the preview. Please try again.");
      setStatus("marking");
    }
  }

  async function handleDebugApproved() {
    if (!pendingUploadId || !pendingLocalUrl || referenceFrameTime === null || !pendingBox) return;
    setError(null);
    try {
      setStatus("analyzing");
      await saveMarker(pendingUploadId, referenceFrameTime, pendingBox);
      // Also reads frames from the local blob URL, same reasoning as above — this still runs
      // within the same page session, so the file is still in memory.
      await analyzeGameFilm(
        pendingUploadId,
        pendingLocalUrl,
        referenceProfileId,
        jerseyNumber,
        jerseyColor,
        referenceFrameTime,
        pendingBox
      );
      resetPending();
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong running the analysis. Please try again.");
      setStatus("confirming");
    }
  }

  function handleDebugRejected() {
    setPendingBox(null);
    setDebugFrame(null);
    setStatus("marking");
  }

  function resetPending() {
    if (pendingLocalUrl) URL.revokeObjectURL(pendingLocalUrl);
    setPendingUploadId(null);
    setPendingLocalUrl(null);
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
