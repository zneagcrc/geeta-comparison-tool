// HTTP for adapters, which are synchronous: requestJsonSync runs one request in a child Node process and waits for it.
// apiClient(id) is the client for a calculator released as an API (geeta.config.json "release": "http(s)://...").
//
//   import { apiClient } from "geeta-comparison-tool/src/http";
//   const api = apiClient("acme");   // the calculator's id
//   const adapter: Adapter = (input) => {
//     const response = api.post("enterprise-croppinggrains", toApiInput(input));   // <release URL>/<endpoint>
//     return toGeetaResults(response);
//   };
//   const plugin: CalculatorPlugin = { adapters, captureInputs: api.captureInputs };   // requests shown in the docs
import { execFileSync } from "node:child_process";
import type { InputCall } from "./calculators/types";
import { calculatorEntry, resolveCalculatorId } from "./calculators/config";

export type HttpResponse = { status: number; json?: any; text: string };

// Runs in the child process: reads { method, url, headers, body, timeoutMs } from stdin, writes { status, text }
const CHILD = `
let s = "";
process.stdin.on("data", (d) => (s += d)).on("end", async () => {
  const r = JSON.parse(s);
  try {
    const res = await fetch(r.url, { method: r.method, headers: r.headers, body: r.body, signal: AbortSignal.timeout(r.timeoutMs) });
    process.stdout.write(JSON.stringify({ status: res.status, text: await res.text() }));
  } catch (e) {
    process.stdout.write(JSON.stringify({ status: 0, text: String(e && e.cause ? e.cause.message || e.cause : e) }));
  }
});`;

/** One HTTP request, synchronously. Status 0 means no answer (the server isn't running, a timeout, ...). */
export const requestJsonSync = (
  method: string,
  url: string,
  body?: unknown,
  headers: Record<string, string> = {},
  timeoutMs = 120_000,
): HttpResponse => {
  const request = {
    method,
    url,
    headers: { Accept: "application/json", ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
    timeoutMs,
  };
  const out = execFileSync(process.execPath, ["-e", CHILD], { input: JSON.stringify(request), encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  const { status, text } = JSON.parse(out) as { status: number; text: string };
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { status, json, text };
};

/** The key for a calculator's API: the environment variable (or .env entry) its "apiKeyEnv" names. */
export const apiKey = (id: string): string | undefined => {
  const { apiKeyEnv } = calculatorEntry(id);
  if (!apiKeyEnv) return undefined;
  const key = process.env[apiKeyEnv];
  if (!key) throw new Error(`${id}'s API key isn't set: put ${apiKeyEnv}=<key> in the workspace's .env (or the environment)`);
  return key;
};

export type ApiClient = {
  /** The API's base URL, with the version filled in. */
  url: string;
  /** POSTs JSON to <url>/<endpoint> and returns the parsed response; throws on an error status. Identical requests in one run are sent once. */
  post: (endpoint: string, body: unknown) => any;
  /** GETs <url>/<endpoint> (JSON); throws on an error status. */
  get: (endpoint: string) => any;
  /** For the plug-in's captureInputs: the requests made while fn runs, shown in the scenario docs. */
  captureInputs: <T>(fn: () => T) => { result: T; inputs: InputCall[] };
};

/** The client for calculator `id`, released as an API ("release": "http(s)://..." in geeta.config.json). */
export const apiClient = (nameOrId: string): ApiClient => {
  const id = resolveCalculatorId(nameOrId) ?? nameOrId;
  const entry = calculatorEntry(id);
  if (entry.kind !== "api") throw new Error(`${id} isn't released as an API (its release is ${entry.release ?? "not set"})`);
  const url = entry.apiUrl!;
  const cache = new Map<string, any>();
  let capturing: InputCall[] | undefined;

  const call = (method: string, endpoint: string, body?: unknown) => {
    const target = `${url}/${endpoint.replace(/^\/+/, "")}`;
    capturing?.push({ schema: `${method} ${endpoint}`, input: body ?? null });
    const cacheKey = `${method} ${target} ${JSON.stringify(body ?? null)}`;
    if (cache.has(cacheKey)) return structuredClone(cache.get(cacheKey));
    const key = apiKey(id);
    const res = requestJsonSync(method, target, body, key ? { Authorization: `Bearer ${key}` } : {});
    if (res.status === 0) throw new Error(`${entry.name} didn't answer at ${target}: ${res.text}`);
    if (res.status >= 400) {
      const detail = res.json?.errors ?? res.json?.error ?? res.text;
      throw new Error(`${entry.name} ${method} ${endpoint}: HTTP ${res.status}: ${typeof detail === "string" ? detail : JSON.stringify(detail)}`.slice(0, 2000));
    }
    cache.set(cacheKey, res.json);
    return structuredClone(res.json);
  };

  return {
    url,
    post: (endpoint, body) => call("POST", endpoint, body),
    get: (endpoint) => call("GET", endpoint),
    captureInputs: <T>(fn: () => T) => {
      const outer = capturing;
      capturing = [];
      try {
        const result = fn();
        return { result, inputs: capturing };
      } finally {
        capturing = outer;
      }
    },
  };
};
