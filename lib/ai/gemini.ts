import "server-only";
import { GoogleGenAI } from "@google/genai";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  if (!client) client = new GoogleGenAI({ apiKey: key });
  return client;
}

export const aiEnabled = () => !!process.env.GEMINI_API_KEY;

/** Race a promise against a timeout so a slow model never freezes the demo. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`Gemini timed out after ${ms}ms`)), ms))]);
}

/**
 * Ask Gemini for JSON. Returns null (never throws) when there is no key,
 * the call fails, or the output doesn't parse — callers then use a template.
 */
export async function generateJSON<T>(opts: {
  system: string;
  prompt: string;
  temperature?: number;
  timeoutMs?: number;
}): Promise<T | null> {
  const ai = getClient();
  if (!ai) return null;
  try {
    const res = await withTimeout(
      ai.models.generateContent({
        model: MODEL,
        contents: opts.prompt,
        config: {
          systemInstruction: opts.system,
          responseMimeType: "application/json",
          temperature: opts.temperature ?? 0.8,
        },
      }),
      opts.timeoutMs ?? 20000,
    );
    const text = (res.text ?? "").replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    return JSON.parse(text) as T;
  } catch (err) {
    console.error("[gemini] JSON call failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

/** Ask Gemini for plain text / markdown. Returns null on any failure. */
export async function generateText(opts: {
  system: string;
  prompt: string;
  temperature?: number;
  timeoutMs?: number;
}): Promise<string | null> {
  const ai = getClient();
  if (!ai) return null;
  try {
    const res = await withTimeout(
      ai.models.generateContent({
        model: MODEL,
        contents: opts.prompt,
        config: { systemInstruction: opts.system, temperature: opts.temperature ?? 0.7 },
      }),
      opts.timeoutMs ?? 25000,
    );
    return res.text?.trim() || null;
  } catch (err) {
    console.error("[gemini] text call failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
