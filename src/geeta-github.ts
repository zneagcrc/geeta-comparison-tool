// Access to the GEETA releases on GitHub, public or private. A private repository's releases need a token: the
// environment variable (or .env entry) geeta.config.json "tokenEnv" names, GEETA_TOKEN by default. A fine-grained
// personal access token with read-only "Contents" access to the GEETA repository is enough. The token is only ever sent
// to api.github.com, never printed and never written anywhere.
//
// Without a token, assets are downloaded from their public URLs, as before. With one, through the GitHub API: the
// release by tag, then each asset by id, following the redirect to the file without the token (the storage it
// redirects to refuses requests that carry one).

export const DEFAULT_TOKEN_ENV = "GEETA_TOKEN";

const API = "https://api.github.com";
const headers = (token?: string, accept = "application/vnd.github+json") => ({
  "User-Agent": "geeta-comparison-tool",
  Accept: accept,
  "X-GitHub-Api-Version": "2022-11-28",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

/** What to tell someone whose request GitHub refused or couldn't find (a private repository answers 404 to strangers). */
export const accessHint = (repo: string, tokenEnv: string, token?: string) =>
  token
    ? `the token in ${tokenEnv} was refused or can't read ${repo}: it needs read access to the repository's contents`
    : `if ${repo} is private, put a GitHub token with read access to it in the workspace's .env as ${tokenEnv}=...`;

const fail = async (what: string, res: Response, repo: string, tokenEnv: string, token?: string): Promise<never> => {
  const hint = [401, 403, 404].includes(res.status) ? ` (${accessHint(repo, tokenEnv, token)})` : "";
  throw new Error(`${what}: HTTP ${res.status}${hint}`);
};

/** The releases of a repository, newest first (the API lists at most `perPage`). */
export const listReleases = async (repo: string, tokenEnv: string, token?: string, perPage = 20) => {
  const res = await fetch(`${API}/repos/${repo}/releases?per_page=${perPage}`, { headers: headers(token) });
  if (!res.ok) await fail(`listing the releases of ${repo}`, res, repo, tokenEnv, token);
  return (await res.json()) as { tag_name: string; draft: boolean; assets: { id: number; name: string }[] }[];
};

const releases = new Map<string, Promise<{ assets: { id: number; name: string }[] }>>();

/** One asset of a release, as bytes. */
export const downloadAsset = async (repo: string, release: string, asset: string, tokenEnv: string, token?: string): Promise<Uint8Array> => {
  if (!token) {
    const url = `https://github.com/${repo}/releases/download/${encodeURIComponent(release)}/${encodeURIComponent(asset)}`;
    const res = await fetch(url, { headers: { "User-Agent": "geeta-comparison-tool" } });
    if (!res.ok) await fail(`${asset} of ${release}`, res, repo, tokenEnv, token);
    return new Uint8Array(await res.arrayBuffer());
  }
  const key = `${repo}@${release}`;
  if (!releases.has(key))
    releases.set(
      key,
      (async () => {
        const res = await fetch(`${API}/repos/${repo}/releases/tags/${encodeURIComponent(release)}`, { headers: headers(token) });
        if (res.status === 404) throw new Error(`${repo} has no release ${release}, or the token in ${tokenEnv} can't see it`);
        if (!res.ok) await fail(`release ${release} of ${repo}`, res, repo, tokenEnv, token);
        return res.json();
      })(),
    );
  const found = (await releases.get(key)!).assets.find((a) => a.name === asset);
  if (!found) throw new Error(`${release} of ${repo} has no asset ${asset}`);
  // The API answers with a redirect to the file's storage, which must be fetched without the token
  const res = await fetch(`${API}/repos/${repo}/releases/assets/${found.id}`, { headers: headers(token, "application/octet-stream"), redirect: "manual" });
  const location = res.headers.get("location");
  const file = res.status >= 300 && res.status < 400 && location ? await fetch(location, { headers: { "User-Agent": "geeta-comparison-tool" } }) : res;
  if (!file.ok) await fail(`${asset} of ${release}`, file, repo, tokenEnv, token);
  return new Uint8Array(await file.arrayBuffer());
};
