import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { MAX_UPLOAD_MB } from "./storagePath";
import { withTimeout } from "./withTimeout";

// Phone camera clips (H.264/HEVC, already hardware-encoded at reasonable bitrates) are typically
// far more efficiently compressed going in than a desktop screen recording is — re-encoding them
// through ffmpeg.wasm's single-threaded software x264 path is both less necessary and much slower
// on a phone's weaker CPU (no WASM SIMD/threads in the single-thread core this app uses). Skip
// compression on more mobile clips by raising the threshold, and if compression does still run,
// target a smaller frame so the encode itself finishes faster.
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

// Only worth compressing when a file is close to or over the limit — small files skip this
// entirely and upload as-is.
const COMPRESSION_THRESHOLD_MB = MAX_UPLOAD_MB * (isMobile ? 1.3 : 0.8);

// Leave headroom below the hard limit for container/muxing overhead so the compressed file
// reliably lands under it, not just barely over.
const TARGET_MB = MAX_UPLOAD_MB * 0.9;

// Mobile encodes at a lower cap resolution (480p vs 720p) — fewer pixels to push through the
// software encoder means a meaningfully shorter encode on phone-class CPUs.
const SCALE_FILTER = isMobile ? "scale='min(854,iw)':-2" : "scale='min(1280,iw)':-2";

const AUDIO_BITRATE_KBPS = 64;
const MIN_VIDEO_BITRATE_KBPS = 300;
// Caps the computed target bitrate for short-but-huge source files (e.g. a high-bitrate 4K clip
// only a few seconds long). Without this, a short clip's target-size-over-duration math can
// demand a bitrate so high it's effectively asking for near-lossless output — pointlessly slow to
// encode (worst case, minutes, for content with little redundancy to exploit) for no real size
// benefit, since 720p rarely needs more than this to look good anyway.
const MAX_VIDEO_BITRATE_KBPS = 4000;

// Absolute wall-clock cap per encode attempt. ffmpeg.wasm's progress event only fires once frames
// reach the encoder — if decode is the bottleneck (e.g. software HEVC decode, common for iPhone
// .mov clips, is brutally slow in a single-threaded WASM environment), progress can sit at 0% for
// a very long time while genuinely still working, indistinguishable from actually hung. Rather
// than leave the user staring at a frozen bar forever, fail loudly after this long instead. Mobile
// CPUs are meaningfully slower at this than desktop, so they get a longer budget before giving up.
const ENCODE_TIMEOUT_MS = isMobile ? 120_000 : 60_000;

// Wall-clock loading budget — a stalled fetch of the (~30MB) wasm core would otherwise leave the
// "Processing video..." spinner up forever with no way out.
const LOAD_TIMEOUT_MS = 30_000;

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoadPromise: Promise<FFmpeg> | null = null;

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;
  if (!ffmpegLoadPromise) {
    ffmpegLoadPromise = withTimeout(
      (async () => {
        const ffmpeg = new FFmpeg();
        // Surface ffmpeg's own stderr (codec/format detection, decode/encode diagnostics) to the
        // console — the main lead for diagnosing which codec a stuck clip actually uses.
        ffmpeg.on("log", ({ message }) => {
          console.log("[video-compression ffmpeg]", message);
        });
        // Must be the ESM build of ffmpeg-core, not UMD: @ffmpeg/ffmpeg's internal worker is
        // bundled by Vite as a module worker, where `importScripts` isn't available, so it falls
        // back to a dynamic `import()` of the core file — a UMD script has no default export for
        // that to resolve, which throws "failed to import ffmpeg-core.js". Copied into
        // /public/ffmpeg (see package.json's @ffmpeg/core dependency) and served same-origin,
        // matching that ESM path.
        const baseURL = "/ffmpeg";
        await ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
        });
        ffmpegInstance = ffmpeg;
        return ffmpeg;
      })(),
      LOAD_TIMEOUT_MS,
      () => new CompressionTimeoutError()
    ).catch((err) => {
      // A failed/timed-out load must not poison future attempts — clear the cached promise so the
      // next upload gets a fresh try instead of instantly failing forever.
      ffmpegLoadPromise = null;
      throw err;
    });
  }
  return ffmpegLoadPromise;
}

function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    video.preload = "metadata";
    video.src = url;
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to read video duration"));
    };
  });
}

function inputFileName(file: File): string {
  const dotIndex = file.name.lastIndexOf(".");
  const ext = dotIndex !== -1 ? file.name.slice(dotIndex + 1) : "mp4";
  return `input.${ext.replace(/[^a-zA-Z0-9]/g, "") || "mp4"}`;
}

export function needsCompression(file: File): boolean {
  return file.size > COMPRESSION_THRESHOLD_MB * 1024 * 1024;
}

export class CompressionInsufficientError extends Error {
  constructor(finalSizeMb: number) {
    super(
      `This clip is still ${finalSizeMb.toFixed(1)} MB after compression, over the ${MAX_UPLOAD_MB} MB limit. Try trimming it to a shorter clip.`
    );
    this.name = "CompressionInsufficientError";
  }
}

export class CompressionTimeoutError extends Error {
  constructor() {
    super(
      "Compression is taking too long for this clip — it may use a format this browser struggles to decode efficiently (e.g. HEVC/H.265, common on iPhone). Try trimming it to a shorter clip, or re-exporting it in a more compatible format (H.264) before uploading."
    );
    this.name = "CompressionTimeoutError";
  }
}

export class CompressionFailedError extends Error {
  constructor() {
    super(
      "Compression failed for this clip — it may use a video format or codec this browser can't process. Try re-exporting it in a more common format (H.264 MP4) before uploading."
    );
    this.name = "CompressionFailedError";
  }
}

async function encode(
  ffmpeg: FFmpeg,
  file: File,
  inputName: string,
  videoBitrateKbps: number
): Promise<Uint8Array> {
  await ffmpeg.writeFile(inputName, await fetchFile(file));
  const outputName = "output.mp4";
  const startedAt = Date.now();
  // Backstopped by withTimeout independently of ffmpeg's own `timeout` param — see its comment on
  // getFFmpeg for why the internal mechanism alone isn't trustworthy under a truly wedged worker.
  const returnCode = await withTimeout(
    ffmpeg.exec(
      [
        "-i",
        inputName,
        "-vf",
        SCALE_FILTER,
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-b:v",
        `${videoBitrateKbps}k`,
        "-maxrate",
        `${Math.round(videoBitrateKbps * 1.5)}k`,
        "-bufsize",
        `${videoBitrateKbps * 2}k`,
        "-c:a",
        "aac",
        "-b:a",
        `${AUDIO_BITRATE_KBPS}k`,
        "-movflags",
        "+faststart",
        outputName,
      ],
      ENCODE_TIMEOUT_MS
    ),
    ENCODE_TIMEOUT_MS + 5_000,
    () => new CompressionTimeoutError()
  );
  if (returnCode !== 0) {
    // A nonzero code covers both an actual timeout and a fast ffmpeg failure (e.g. unsupported
    // codec) — disambiguate by elapsed time rather than trusting the code alone, since ffmpeg's
    // own docs note ordinary errors can also return the same code timeouts use.
    const elapsedMs = Date.now() - startedAt;
    if (elapsedMs >= ENCODE_TIMEOUT_MS * 0.9) {
      throw new CompressionTimeoutError();
    }
    throw new CompressionFailedError();
  }
  const data = await ffmpeg.readFile(outputName);
  await ffmpeg.deleteFile(outputName);
  return data as Uint8Array;
}

// Compresses a video down toward the upload size limit by re-encoding at a computed bitrate
// (and capping resolution at 720p). Retries once at a lower bitrate if the first pass still
// lands over the limit; if that still isn't enough, throws CompressionInsufficientError so the
// caller can fall back to asking the user to trim the clip — meant to be a rare case, not the
// normal path.
export async function compressVideo(file: File, onProgress: (ratio: number) => void): Promise<File> {
  const ffmpeg = await getFFmpeg();
  const duration = await getVideoDuration(file);
  const targetBytes = TARGET_MB * 1024 * 1024;
  const targetBitsTotal = targetBytes * 8;
  const audioBitsTotal = AUDIO_BITRATE_KBPS * 1000 * duration;
  let videoBitrateKbps = Math.min(
    MAX_VIDEO_BITRATE_KBPS,
    Math.max(MIN_VIDEO_BITRATE_KBPS, Math.round((targetBitsTotal - audioBitsTotal) / duration / 1000))
  );

  const progressHandler = ({ progress }: { progress: number }) => {
    onProgress(Math.min(Math.max(progress, 0), 1));
  };
  ffmpeg.on("progress", progressHandler);

  try {
    const inputName = inputFileName(file);
    let data = await encode(ffmpeg, file, inputName, videoBitrateKbps);

    if (data.byteLength > MAX_UPLOAD_MB * 1024 * 1024) {
      // First pass still too big — retry once at a meaningfully lower bitrate.
      videoBitrateKbps = Math.max(MIN_VIDEO_BITRATE_KBPS, Math.round(videoBitrateKbps * 0.6));
      data = await encode(ffmpeg, file, inputName, videoBitrateKbps);
    }

    await ffmpeg.deleteFile(inputName);

    if (data.byteLength > MAX_UPLOAD_MB * 1024 * 1024) {
      throw new CompressionInsufficientError(data.byteLength / (1024 * 1024));
    }

    const blob = new Blob([data.buffer as BlobPart], { type: "video/mp4" });
    const baseName = file.name.replace(/\.[^/.]+$/, "");
    return new File([blob], `${baseName}-compressed.mp4`, { type: "video/mp4" });
  } catch (err) {
    if (err instanceof CompressionTimeoutError) {
      // The worker may still be wedged after our outer race gave up on it — kill it and drop the
      // cached instance so the next upload attempt gets a fresh worker instead of hanging again.
      try {
        ffmpeg.terminate();
      } catch {
        // best-effort; the worker may already be dead
      }
      ffmpegInstance = null;
      ffmpegLoadPromise = null;
    }
    throw err;
  } finally {
    ffmpeg.off("progress", progressHandler);
  }
}
