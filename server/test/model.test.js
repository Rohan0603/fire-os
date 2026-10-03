import { describe, expect, it } from 'vitest';
import {
  DEFAULT_OPENROUTER_FALLBACKS,
  DEFAULT_OPENROUTER_MODEL,
  getOpenRouterModels,
} from '../lib/model.js';

describe('getOpenRouterModels', () => {
  it('uses the free router and default free model fallbacks', () => {
    expect(getOpenRouterModels()).toEqual([
      DEFAULT_OPENROUTER_MODEL,
      ...DEFAULT_OPENROUTER_FALLBACKS,
    ]);
    expect(DEFAULT_OPENROUTER_MODEL).toBe('openrouter/free');
  });

  it('parses, trims, and de-duplicates configured fallbacks', () => {
    expect(
      getOpenRouterModels(' nvidia/example:free, google/example:free, nvidia/example:free '),
    ).toEqual(['openrouter/free', 'nvidia/example:free', 'google/example:free']);
  });

  it('caps custom routes at OpenRouter’s three-model limit', () => {
    expect(getOpenRouterModels('model-a:free,model-b:free,model-c:free,model-d:free')).toEqual([
      'openrouter/free',
      'model-a:free',
      'model-b:free',
    ]);
  });
});
