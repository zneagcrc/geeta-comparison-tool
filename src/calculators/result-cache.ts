// A calculator called as a function, with each input calculated once: the mapping trace changes one input (or a batch)
// at a time and runs the adapter again, so most of the calls an adapter makes repeat the last run's exactly. Wrap the
// one function that calls your calculator:
//
//   import { resultCache } from "geeta-comparison-tool/src/calculators/result-cache";
//   const calculateOnce = resultCache((input: AcmeInput) => calculate(input));
//
// For a calculator whose result depends only on its input (no clock, randomness, files or network it reads). Results are
// handed out as copies, so an adapter that changes one doesn't change the cache. A throw isn't cached. GEETA_RESULT_CACHE=0
// turns it off (for comparing timings, or to rule it out).
//
// An API calculator doesn't need it: apiClient (src/http.ts) already sends identical requests once per run.

export type ResultCacheOptions<I, R> = {
  /** Results kept (default 2000); the oldest is dropped first. */
  max?: number;
  /** The cache key for an input (default JSON.stringify). */
  key?: (input: I) => string;
  /** How a cached result is handed out (default structuredClone; `(r) => r` if adapters never change results). */
  copy?: (result: R) => R;
};

export const resultCache = <I, R>(calculate: (input: I) => R, options: ResultCacheOptions<I, R> = {}) => {
  const { max = 2000, key = (i: I) => JSON.stringify(i), copy = (r: R) => structuredClone(r) } = options;
  const results = new Map<string, R>();
  const cached = (input: I): R => {
    if (process.env.GEETA_RESULT_CACHE === "0") return calculate(input);
    const k = key(input);
    let r = results.get(k);
    if (r === undefined) {
      r = calculate(input);
      if (results.size >= max) results.delete(results.keys().next().value as string);
      cached.misses++;
    } else {
      results.delete(k); // most recently used last
      cached.hits++;
    }
    results.set(k, r);
    return copy(r);
  };
  cached.hits = 0;
  cached.misses = 0;
  cached.clear = () => results.clear();
  return cached;
};
