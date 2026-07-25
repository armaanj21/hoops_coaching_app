// Supabase Storage object keys reject spaces and many special characters — macOS filenames like
// "Screen Recording 2026-07-23 at 2.15.13 PM.mov" fail outright. Generate a clean key instead of
// embedding the original filename; nothing in the app currently needs to display the original name.
// The leading segment must be the uploader's own auth uid — the "uploads" bucket's INSERT policy
// requires storage.foldername(name)[1] = auth.uid(), regardless of whose content it logically is
// (a player's own video, or a coach's team film).
export function buildStorageObjectPath(ownerId: string, file: File, subfolder?: string): string {
  const dotIndex = file.name.lastIndexOf(".");
  const ext = dotIndex !== -1 ? file.name.slice(dotIndex + 1).replace(/[^a-zA-Z0-9]/g, "").toLowerCase() : "";
  const safeExt = ext || "mp4";
  const prefix = subfolder ? `${ownerId}/${subfolder}` : ownerId;
  return `${prefix}/${crypto.randomUUID()}.${safeExt}`;
}

export const MAX_UPLOAD_MB = Number(import.meta.env.VITE_MAX_UPLOAD_MB) || 50;

// Client-side check so oversized files are rejected immediately with a clear message, rather than
// failing opaquely against the Storage service after the upload request is already in flight.
export function checkFileSize(file: File): string | null {
  const maxBytes = MAX_UPLOAD_MB * 1024 * 1024;
  if (file.size > maxBytes) {
    const fileMb = (file.size / (1024 * 1024)).toFixed(1);
    return `This file is ${fileMb} MB, which is over the ${MAX_UPLOAD_MB} MB upload limit. Try a shorter clip or compress the video.`;
  }
  return null;
}
