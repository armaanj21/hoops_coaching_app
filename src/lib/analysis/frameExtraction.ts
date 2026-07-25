// Extracts frames from a video for vision analysis. Runs client-side via <video>/<canvas> since
// there's no server-side ffmpeg pipeline in this scaffold — see the note in claudeAnalysisClient.ts
// about moving this server-side (Supabase Edge Function) before production.

import { withTimeout } from "../withTimeout";

export interface NormalizedBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

// iOS Safari specifically can simply never fire `seeked` for a given seek — most commonly when
// the video hasn't buffered enough around the target time yet, or for certain HEVC streams — with
// no error event either, which is exactly the "hangs at frame extraction" symptom reported from a
// real iPhone (never reproduced on desktop/synthetic clips because desktop Chrome/Safari don't
// share this quirk). Every wait below has a hard timeout so that failure mode surfaces as an error
// instead of a silently frozen spinner.
const LOAD_TIMEOUT_MS = 20_000;
const SEEK_TIMEOUT_MS = 10_000;

// MediaError.code is a small numeric enum with no message text of its own — translate it so the
// diagnostic string means something without needing the spec open.
const MEDIA_ERROR_NAMES: Record<number, string> = {
  1: "MEDIA_ERR_ABORTED",
  2: "MEDIA_ERR_NETWORK",
  3: "MEDIA_ERR_DECODE",
  4: "MEDIA_ERR_SRC_NOT_SUPPORTED",
};

// Two prior fixes (removing the network fetch, then forcing faststart) didn't resolve this on the
// reporter's actual device — rather than guess a third cause blind, surface the video element's
// real state in the error message itself, so the next failure is diagnosable from what's already
// on screen instead of needing a cable-connected Mac + Safari Web Inspector.
function videoDiagnostics(video: HTMLVideoElement): string {
  const parts = [`readyState=${video.readyState}`, `networkState=${video.networkState}`];
  if (video.error) {
    parts.push(`error=${MEDIA_ERROR_NAMES[video.error.code] ?? video.error.code}`);
    if (video.error.message) parts.push(`errorMessage=${video.error.message}`);
  } else {
    parts.push("error=none");
  }
  if (!Number.isNaN(video.duration)) parts.push(`duration=${video.duration}`);
  parts.push(`videoWidth=${video.videoWidth}`, `videoHeight=${video.videoHeight}`);
  return parts.join(" ");
}

export class FrameExtractionTimeoutError extends Error {
  constructor(stage: "load" | "seek", diagnostics: string) {
    super(
      (stage === "load"
        ? "This video is taking too long to load for analysis. Try a shorter clip, or re-export it in a more compatible format (H.264 MP4) before uploading."
        : "This video got stuck while reading a frame for analysis — this can happen with certain phone video formats. Try a shorter clip, or re-export it in a more compatible format (H.264 MP4) before uploading.") +
        ` [diagnostics: ${diagnostics}]`
    );
    this.name = "FrameExtractionTimeoutError";
  }
}

async function loadVideo(videoUrl: string): Promise<HTMLVideoElement> {
  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = videoUrl;
  console.log("[frame-extraction] loading video", { videoUrl: videoUrl.slice(0, 60) });

  await withTimeout(
    new Promise<void>((resolve, reject) => {
      // Waiting on loadedmetadata alone (enough for dimensions/duration) isn't enough on iOS
      // Safari — seeking before Safari has actually buffered decodable frames around time 0 is a
      // common trigger for `seeked` never firing later. loadeddata guarantees at least one frame
      // is decoded and ready, which is the point Safari reliably allows seeking from.
      video.addEventListener("loadeddata", () => resolve(), { once: true });
      video.addEventListener(
        "error",
        () => reject(new Error(`Failed to load video for frame extraction [diagnostics: ${videoDiagnostics(video)}]`)),
        { once: true }
      );
      // Extra visibility into exactly how far the load gets before it (potentially) times out —
      // these fire even when loadeddata never does.
      for (const evt of ["loadstart", "durationchange", "loadedmetadata", "canplay", "stalled", "suspend"]) {
        video.addEventListener(evt, () => console.log(`[frame-extraction] video event: ${evt}`, videoDiagnostics(video)), {
          once: true,
        });
      }
    }),
    LOAD_TIMEOUT_MS,
    () => new FrameExtractionTimeoutError("load", videoDiagnostics(video))
  );

  // A known iOS Safari workaround: briefly playing (muted, so autoplay is allowed) and pausing
  // nudges Safari's decoder into a state where subsequent currentTime seeks actually complete.
  // Best-effort — if autoplay is blocked for any reason, seeking still gets a chance to work on
  // its own, so a failure here is silently ignored rather than surfaced.
  try {
    await video.play();
    video.pause();
  } catch {
    // ignored — see comment above
  }

  return video;
}

async function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  await withTimeout(
    new Promise<void>((resolve, reject) => {
      video.addEventListener("seeked", () => resolve(), { once: true });
      video.addEventListener(
        "error",
        () => reject(new Error(`Failed to seek video [diagnostics: ${videoDiagnostics(video)}]`)),
        { once: true }
      );
      video.currentTime = time;
    }),
    SEEK_TIMEOUT_MS,
    () => new FrameExtractionTimeoutError("seek", videoDiagnostics(video))
  );
}

function makeCanvas(video: HTMLVideoElement): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  return { canvas, ctx };
}

export async function extractFrames(videoUrl: string, count = 3): Promise<string[]> {
  const video = await loadVideo(videoUrl);
  const { canvas, ctx } = makeCanvas(video);
  const duration = video.duration;
  const frames: string[] = [];

  for (let i = 0; i < count; i++) {
    const t = (duration * (i + 1)) / (count + 1);
    await seekTo(video, t);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    frames.push(canvas.toDataURL("image/jpeg", 0.8).split(",")[1]);
  }

  return frames;
}

// Extracts a single frame, defaulting to an early point in the clip (clear of any startup black
// frames but still near the beginning) — used as the reference frame the player marks themselves
// in before analysis.
export async function extractFrameAt(
  videoUrl: string,
  time?: number
): Promise<{ base64: string; width: number; height: number; duration: number; time: number }> {
  const video = await loadVideo(videoUrl);
  const { canvas, ctx } = makeCanvas(video);
  const duration = video.duration;
  const t = time ?? duration * 0.2;

  await seekTo(video, t);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const base64 = canvas.toDataURL("image/jpeg", 0.9).split(",")[1];

  return { base64, width: canvas.width, height: canvas.height, duration, time: t };
}

// Samples frames clustered close in time around a reference point (rather than spread evenly
// across the whole clip), so the model has more continuity to track the same marked person
// frame-to-frame instead of re-identifying them from scratch each time.
export async function extractFramesNear(
  videoUrl: string,
  centerTime: number,
  count = 6,
  spreadSeconds = 2
): Promise<{ frames: string[]; width: number; height: number }> {
  const video = await loadVideo(videoUrl);
  const { canvas, ctx } = makeCanvas(video);
  const duration = video.duration;
  const start = Math.max(0, centerTime - spreadSeconds);
  const end = Math.min(duration, centerTime + spreadSeconds);
  const frames: string[] = [];

  for (let i = 0; i < count; i++) {
    const t = count === 1 ? centerTime : start + ((end - start) * i) / (count - 1);
    await seekTo(video, t);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    frames.push(canvas.toDataURL("image/jpeg", 0.8).split(",")[1]);
  }

  return { frames, width: canvas.width, height: canvas.height };
}

// Draws a visible box directly onto a frame so the model sees an unambiguous visual marker,
// rather than relying on it interpreting raw coordinate numbers from text.
export async function annotateFrameWithBox(
  base64: string,
  box: NormalizedBox,
  width: number,
  height: number
): Promise<string> {
  const img = new Image();
  const loaded = new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to load frame for annotation"));
  });
  img.src = `data:image/jpeg;base64,${base64}`;
  await loaded;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  ctx.drawImage(img, 0, 0, width, height);
  ctx.strokeStyle = "#ff0000";
  ctx.lineWidth = Math.max(3, Math.round(width * 0.006));
  ctx.strokeRect(box.x * width, box.y * height, box.width * width, box.height * height);

  return canvas.toDataURL("image/jpeg", 0.9).split(",")[1];
}
