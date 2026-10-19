/**
 * Rejects if the given promise doesn't settle within `ms`, so a stalled
 * network request can never leave a loading screen spinning forever.
 */
export function withTimeout<T>(promise: PromiseLike<T>, ms: number, label = "Request"): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
