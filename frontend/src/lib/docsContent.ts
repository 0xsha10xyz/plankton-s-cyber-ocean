type RawMod = string;

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

let cached: Map<string, string> | null = null;

function buildMap(): Map<string, string> {
  const out = new Map<string, string>();

  const underDocs = import.meta.glob("../../../docs/**/*.md", {
    eager: true,
    query: "?raw",
    import: "default",
  }) as Record<string, RawMod>;

  for (const [path, mod] of Object.entries(underDocs)) {
    const content = typeof mod === "string" ? mod : String(mod);
    out.set(pathToSlug(path), content);
  }

  const security = import.meta.glob("../../../SECURITY.md", {
    eager: true,
    query: "?raw",
    import: "default",
  }) as Record<string, RawMod>;

  for (const [, mod] of Object.entries(security)) {
    const content = typeof mod === "string" ? mod : String(mod);
    out.set("security", content);
  }

  return out;
}

export function getDocContentMap(): Map<string, string> {
  if (!cached) cached = buildMap();
  return cached;
}

export function getDocMarkdown(slug: string): string | undefined {
  return getDocContentMap().get(slug);
}

export function listDocSlugs(): string[] {
  return [...getDocContentMap().keys()].sort((a, b) => a.localeCompare(b));
}
