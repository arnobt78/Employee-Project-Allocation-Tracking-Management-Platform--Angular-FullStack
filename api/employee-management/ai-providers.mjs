/**
 * Multi-provider free-tier LLM fallback (OpenAI-compatible + Gemini native).
 *
 * Priority: Gemini → Groq → OpenRouter (:free) → Hugging Face router.
 * See docs/LLM_MODEL_SELECTION.md for the architecture and model notes.
 *
 * Secrets: read ONLY unprefixed server env vars — never NG_APP_* for API keys.
 */

const SYSTEM_PROMPT =
  "You are a helpful project brief assistant. Always return valid JSON without markdown fences.";

const RETRIABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

/**
 * Resolve first non-empty env var from a list of aliases.
 * @param {string[]} keys
 * @returns {string|null}
 */
function firstEnv(keys) {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

/**
 * Optional env override that prepends a model id to a provider chain.
 * @param {string} envKey
 * @param {string[]} models
 */
function withOptionalModelOverride(envKey, models) {
  const override = firstEnv([envKey]);
  if (!override) {
    return models;
  }
  if (models.includes(override)) {
    return models;
  }
  return [override, ...models];
}

/**
 * Layer 1 — provider registry (order = fallback priority).
 * Gemini uses native generateContent; others use /chat/completions.
 */
export const AI_PROVIDERS = [
  {
    id: "gemini",
    label: "Google AI Studio (Gemini)",
    kind: "gemini",
    envKeys: ["GOOGLE_GEMINI_API_KEY", "Google_Gemini_API_KEY"],
    models: withOptionalModelOverride("GEMINI_MODEL", [
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
    ]),
  },
  {
    id: "groq",
    label: "GroqCloud",
    kind: "openai",
    envKeys: ["GROQ_LLAMA_API_KEY", "Groq_Llama_API_KEY", "GROQ_API_KEY"],
    baseUrl: "https://api.groq.com/openai/v1",
    models: withOptionalModelOverride("GROQ_MODEL", [
      "openai/gpt-oss-120b",
      "openai/gpt-oss-20b",
      "qwen/qwen3.6-27b",
    ]),
  },
  {
    id: "openrouter",
    label: "OpenRouter (:free)",
    kind: "openai",
    envKeys: ["OPENROUTER_API_KEY"],
    baseUrl: "https://openrouter.ai/api/v1",
    // OpenRouter free variants MUST use the :free suffix (see LLM_MODEL_SELECTION.md).
    models: withOptionalModelOverride("OPENROUTER_MODEL", [
      "openai/gpt-oss-120b:free",
      "openai/gpt-oss-20b:free",
      "google/gemma-4-31b-it:free",
    ]),
    extraHeaders: () => ({
      "HTTP-Referer":
        process.env.APP_BASE_URL ||
        "https://employee-project-management.vercel.app",
      "X-Title": "EmpowerHub Employee Management",
    }),
  },
  {
    id: "huggingface",
    label: "Hugging Face Inference Providers",
    kind: "openai",
    envKeys: ["HUGGINGFACE_API_KEY", "HF_TOKEN"],
    baseUrl: "https://router.huggingface.co/v1",
    models: withOptionalModelOverride("HUGGINGFACE_MODEL", [
      "openai/gpt-oss-20b:fastest",
      "meta-llama/Llama-3.1-8B-Instruct",
    ]),
  },
];

/**
 * @param {number} [status]
 * @param {string} [bodyText]
 */
function classifyFailure(status, bodyText = "") {
  if (status === 402) {
    return "billing";
  }
  if (status != null && RETRIABLE_STATUS.has(status)) {
    return "rate_limit";
  }
  if (
    status === 404 ||
    status === 410 ||
    /deprecated|not found|unavailable|model_not_found/i.test(bodyText)
  ) {
    return "upstream";
  }
  if (status != null && status >= 500) {
    return "upstream";
  }
  if (status != null && status >= 400) {
    return "upstream";
  }
  return "upstream";
}

/**
 * Native Gemini generateContent (not OpenAI-compatible).
 * @param {string} apiKey
 * @param {string} model
 * @param {string} prompt
 */
async function callGeminiNative(apiKey, model, prompt) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          topK: 32,
          topP: 0.95,
        },
      }),
    });
  } catch (error) {
    // Network/DNS failures must be retriable so Groq/OpenRouter/HF still run.
    return {
      ok: false,
      kind: "upstream",
      message: error?.message || "Network error talking to Gemini.",
    };
  }
  const bodyText = await response.text();
  if (!response.ok) {
    return {
      ok: false,
      kind: classifyFailure(response.status, bodyText),
      status: response.status,
      message: `Gemini ${model} failed (${response.status}): ${bodyText.slice(0, 400)}`,
    };
  }
  let data;
  try {
    data = JSON.parse(bodyText);
  } catch {
    return {
      ok: false,
      kind: "upstream",
      message: "Gemini returned non-JSON body.",
    };
  }
  const text =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ??
    data?.candidates?.[0]?.output_text ??
    null;
  if (!text) {
    return {
      ok: false,
      kind: "upstream",
      message: "Gemini response did not include text.",
    };
  }
  return { ok: true, text };
}

/**
 * Layer 2 — one OpenAI-compatible /chat/completions client.
 * @param {{ baseUrl: string, apiKey: string, model: string, prompt: string, extraHeaders?: Record<string,string> }} opts
 */
async function callOpenAiCompatible({
  baseUrl,
  apiKey,
  model,
  prompt,
  extraHeaders = {},
}) {
  const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...extraHeaders,
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
      }),
    });
  } catch (error) {
    return {
      ok: false,
      kind: "upstream",
      message: error?.message || "Network error talking to LLM provider.",
    };
  }

  const bodyText = await response.text();
  if (!response.ok) {
    return {
      ok: false,
      kind: classifyFailure(response.status, bodyText),
      status: response.status,
      message: `LLM ${model} failed (${response.status}): ${bodyText.slice(0, 400)}`,
    };
  }

  let data;
  try {
    data = JSON.parse(bodyText);
  } catch {
    return {
      ok: false,
      kind: "upstream",
      message: "LLM returned non-JSON body.",
    };
  }

  const text = data?.choices?.[0]?.message?.content;
  if (!text || typeof text !== "string") {
    return {
      ok: false,
      kind: "upstream",
      message: "LLM response did not include text.",
    };
  }
  return { ok: true, text };
}

/**
 * Try every model in one provider; on 429 skip remaining models for that provider.
 * @param {typeof AI_PROVIDERS[number]} provider
 * @param {string} apiKey
 * @param {string} prompt
 */
async function tryProvider(provider, apiKey, prompt) {
  let lastFailure = {
    ok: false,
    kind: "upstream",
    provider: provider.id,
    message: "No models attempted.",
  };

  for (const model of provider.models) {
    let result;
    if (provider.kind === "gemini") {
      result = await callGeminiNative(apiKey, model, prompt);
    } else {
      const extraHeaders =
        typeof provider.extraHeaders === "function"
          ? provider.extraHeaders()
          : provider.extraHeaders || {};
      result = await callOpenAiCompatible({
        baseUrl: provider.baseUrl,
        apiKey,
        model,
        prompt,
        extraHeaders,
      });
    }

    if (result.ok) {
      return {
        ok: true,
        text: result.text,
        provider: provider.id,
        model,
      };
    }

    lastFailure = {
      ok: false,
      kind: result.kind || "upstream",
      provider: provider.id,
      status: result.status,
      message: result.message,
      model,
    };

    // Fast-skip: rate limit usually applies to the whole key/window.
    if (result.kind === "rate_limit" || result.status === 429) {
      break;
    }
  }

  return lastFailure;
}

/**
 * Layer 3 — walk providers in priority order; skip unconfigured keys.
 * @param {string} prompt
 * @returns {Promise<
 *   | { ok: true; text: string; provider: string; model: string }
 *   | { ok: false; kind: string; provider?: string; status?: number; message?: string }
 * >}
 */
export async function completeChatWithFallback(prompt) {
  let lastFailure = {
    ok: false,
    kind: "not_configured",
    message: "No AI providers configured (missing API keys).",
  };

  for (const provider of AI_PROVIDERS) {
    const apiKey = firstEnv(provider.envKeys);
    if (!apiKey) {
      continue;
    }

    const result = await tryProvider(provider, apiKey, prompt);
    if (result.ok) {
      return result;
    }

    lastFailure = result;

    // Billing exhausted — surface distinctly; still try next free provider.
    if (result.kind === "billing") {
      continue;
    }
  }

  return lastFailure;
}
