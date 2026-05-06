function pathToSlug(fsPath: string): string {
  const norm = fsPath.replace(/\\/g, "/");
  if (/\/SECURITY\.md$/i.test(norm)) return "security";

  const m = norm.match(/\/docs\/(.+)\.md$/i);
  if (!m) return "readme";
  return m[1]
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/\s+/g, "-")
    .replace(/\//g, "-");
}

type RawLoader = () => Promise<unknown>;
type RawGlob = Record<string, RawLoader>;

let cached: Map<string, string> | null = null;
let slugToLoader: Map<string, RawLoader> | null = null;

function getSlugToLoader(): Map<string, RawLoader> {
  if (slugToLoader) return slugToLoader;

  const out = new Map<string, RawLoader>();

  const underDocs = import.meta.glob("../../../docs/**/*.md", {
    query: "?raw",
    import: "default",
  }) as RawGlob;

  for (const [path, loader] of Object.entries(underDocs)) {
    out.set(pathToSlug(path), loader);
  }

  const security = import.meta.glob("../../../SECURITY.md", {
    query: "?raw",
    import: "default",
  }) as RawGlob;

  for (const [, loader] of Object.entries(security)) {
    out.set("security", loader);
  }

  slugToLoader = out;
  return out;
}

export function getDocContentMap(): Map<string, string> {
  if (!cached) cached = new Map<string, string>();
  return cached;
}

export async function getDocMarkdown(slug: string): Promise<string | undefined> {
  const cache = getDocContentMap();
  const hit = cache.get(slug);
  if (hit !== undefined) return hit;

  const loader = getSlugToLoader().get(slug);
  if (!loader) return undefined;

  const mod = await loader();
  const content = typeof mod === "string" ? mod : String(mod);
  cache.set(slug, content);
  return content;
}

export function listDocSlugs(): string[] {
  return [...getSlugToLoader().keys()].sort((a, b) => a.localeCompare(b));
}
