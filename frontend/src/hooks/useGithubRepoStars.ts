import { useEffect, useState } from "react";
import { GITHUB_REPO_API } from "@/lib/githubRepo";

export function useGithubRepoStars(): { stars: number | null; loading: boolean } {
  const [stars, setStars] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(GITHUB_REPO_API);
        if (!res.ok) throw new Error(String(res.status));
        const data: unknown = await res.json();
        if (cancelled) return;
        if (typeof data === "object" && data !== null && "stargazers_count" in data) {
          const n = (data as { stargazers_count: unknown }).stargazers_count;
          setStars(typeof n === "number" ? n : null);
        } else {
          setStars(null);
        }
      } catch {
        if (!cancelled) setStars(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { stars, loading };
}
