/** OpenRouter's free router chooses from currently available free models. */
export const DEFAULT_OPENROUTER_MODEL = 'openrouter/free';
export const DEFAULT_OPENROUTER_FALLBACKS = Object.freeze([
  'qwen/qwen3.8-27b:free',
  'google/gemma-4-31b-it:free',
]);

const MAX_OPENROUTER_MODELS = 3;

export function getOpenRouterModels(rawFallbacks) {
  const fallbacks =
    typeof rawFallbacks === 'string' && rawFallbacks.trim()
      ? rawFallbacks
          .split(',')
          .map((model) => model.trim())
          .filter(Boolean)
      : DEFAULT_OPENROUTER_FALLBACKS;
  return [...new Set([DEFAULT_OPENROUTER_MODEL, ...fallbacks])].slice(0, MAX_OPENROUTER_MODELS);
}

export function extractUpstreamMessage(text) {
  try {
    const parsed = JSON.parse(text);
    const error = parsed?.error;
    if (typeof error === 'string' && error) return error;
    if (error?.message) return String(error.message);
    if (error?.error?.message) return String(error.error.message);
    if (parsed?.message) return String(parsed.message);
    return '';
  } catch {
    return '';
  }
}
