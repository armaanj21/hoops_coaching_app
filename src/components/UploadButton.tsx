// TODO: wire up to Supabase Storage upload for the `uploads` bucket, then trigger the
// analysis module (see src/lib/analysis) once the video is stored.
export default function UploadButton({ drillId: _drillId }: { drillId: string }) {
  return <button>Upload video (stub)</button>;
}
