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

function removeVideo(video: HTMLVideoElement): void {
  video.pause();
  video.removeAttribute("src");
  video.load();
  video.remove();
}

async function loadVideo(videoUrl: string): Promise<HTMLVideoElement> {
  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  // WebKit/Safari is known to be unreliable about seeking (and sometimes even fully loading) a
  // <video> element that was never attached to the document — seeks can simply never fire
  // `seeked`, which is exactly the timeout confirmed on a real device after the load-stage bug was
  // fixed. Chrome tolerates detached video elements fine, which is why this never showed up in
  // desktop testing. Kept out of the visible layout (not display:none, which some engines also
  // treat as "don't bother decoding") via offscreen positioning instead.
  video.style.position = "fixed";
  video.style.top = "-9999px";
  video.style.left = "-9999px";
  video.style.width = "1px";
  video.style.height = "1px";
  document.body.appendChild(video);
  video.src = videoUrl;
  console.log("[frame-extraction] loading video", { videoUrl: videoUrl.slice(0, 60) });

  const logEvent = (evt: string) => console.log(`[frame-extraction] video event: ${evt}`, videoDiagnostics(video));
  for (const evt of ["loadstart", "durationchange", "loadedmetadata", "loadeddata", "canplay", "stalled", "suspend"]) {
    video.addEventListener(evt, () => logEvent(evt));
  }

  // Confirmed via a real device diagnostic: Safari can sit at readyState=1 (metadata only,
  // networkState idle — not even trying to fetch more) indefinitely for a video it isn't actively
  // playing. It needs an explicit play() to start actually buffering/decoding frame data at all.
  // This has to happen right after metadata (not after loadeddata, which is exactly the event
  // stuck waiting on the nudge in the first place — a bug in the previous version of this file,
  // where the nudge ran after the wait it was meant to unstick).
  await withTimeout(
    new Promise<void>((resolve, reject) => {
      video.addEventListener("loadedmetadata", () => resolve(), { once: true });
      video.addEventListener(
        "error",
        () => reject(new Error(`Failed to load video metadata [diagnostics: ${videoDiagnostics(video)}]`)),
        { once: true }
      );
    }),
    LOAD_TIMEOUT_MS,
    () => new FrameExtractionTimeoutError("load", videoDiagnostics(video))
  );

  // Muted autoplay, so this doesn't need a user gesture — best-effort, but log failures instead of
  // silently swallowing them now, since this nudge turned out to be load-bearing rather than
  // cosmetic and a silent failure here was exactly what made the last round undiagnosable.
  try {
    await video.play();
    video.pause();
  } catch (err) {
    console.log("[frame-extraction] play/pause nudge failed", err, videoDiagnostics(video));
  }

  await withTimeout(
    new Promise<void>((resolve, reject) => {
      if (video.readyState >= 2) {
        // HAVE_CURRENT_DATA or better — already past this point, e.g. the play/pause nudge
        // itself pushed it there and the event already fired before this listener was attached.
        resolve();
        return;
      }
      video.addEventListener("loadeddata", () => resolve(), { once: true });
      video.addEventListener(
        "error",
        () => reject(new Error(`Failed to load video for frame extraction [diagnostics: ${videoDiagnostics(video)}]`)),
        { once: true }
      );
    }),
    LOAD_TIMEOUT_MS,
    () => new FrameExtractionTimeoutError("load", videoDiagnostics(video))
  );

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
  try {
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
  } finally {
    removeVideo(video);
  }
}

// Extracts a single frame, defaulting to an early point in the clip (clear of any startup black
// frames but still near the beginning) — used as the reference frame the player marks themselves
// in before analysis.
export async function extractFrameAt(
  videoUrl: string,
  time?: number
): Promise<{ base64: string; width: number; height: number; duration: number; time: number }> {
  const video = await loadVideo(videoUrl);
  try {
    const { canvas, ctx } = makeCanvas(video);
    const duration = video.duration;
    const t = time ?? duration * 0.2;

    await seekTo(video, t);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64 = canvas.toDataURL("image/jpeg", 0.9).split(",")[1];

    return { base64, width: canvas.width, height: canvas.height, duration, time: t };
  } finally {
    removeVideo(video);
  }
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
  try {
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
  } finally {
    removeVideo(video);
  }
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
