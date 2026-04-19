import { fetchWithRetry } from "../lib/fetchRetry.js";

/**
 * Optional Perplexity Sonar for news context (server-side only).
 * https://docs.perplexity.ai/
 */
export async function fetchNewsContext(query: string, signal?: AbortSignal): Promise<string | null> {
  const key = process.env.PERPLEXITY_API_KEY?.trim();
  if (!key) return null;

  const model = process.env.PERPLEXITY_MODEL?.trim() || "sonar";
  const body = {
    model,
    messages: [
      {
        role: "user",
        content: `Brief factual summary (max 8 sentences) for prediction-market research. Query: ${query}`,
      },
    ],
    max_tokens: 400,
    temperature: 0.2,
  };

  try {
    const res = await fetchWithRetry("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    return text && text.length > 0 ? text.slice(0, 4000) : null;
  } catch {
    return null;
  }
}
