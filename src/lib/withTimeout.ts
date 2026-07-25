// Races any promise against a hard deadline, independent of whatever timeout mechanism (if any)
// the thing being awaited claims to have internally. Video processing on-device (ffmpeg.wasm
// encoding, <video> seeking) can wedge without ever rejecting on its own — especially on iOS
// Safari, where a seek can simply never fire its `seeked` event for certain codecs/buffering
// states. Whichever settles first — the real work or this timer — wins.
export function withTimeout<T>(promise: Promise<T>, ms: number, onTimeout: () => Error): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(onTimeout()), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}
