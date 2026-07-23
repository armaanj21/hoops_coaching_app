// Extracts frames from a video for vision analysis. Runs client-side via <video>/<canvas> since
// there's no server-side ffmpeg pipeline in this scaffold — see the note in claudeAnalysisClient.ts
// about moving this server-side (Supabase Edge Function) before production.

export interface NormalizedBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

async function loadVideo(videoUrl: string): Promise<HTMLVideoElement> {
  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.muted = true;
  video.src = videoUrl;

  await new Promise<void>((resolve, reject) => {
    video.addEventListener("loadedmetadata", () => resolve(), { once: true });
    video.addEventListener("error", () => reject(new Error("Failed to load video for frame extraction")), {
      once: true,
    });
  });

  return video;
}

async function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    video.addEventListener("seeked", () => resolve(), { once: true });
    video.addEventListener("error", () => reject(new Error("Failed to seek video")), { once: true });
    video.currentTime = time;
  });
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
