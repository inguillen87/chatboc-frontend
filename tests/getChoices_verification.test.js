import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getChoices } from '../widgetAttention.js';

describe('getChoices', () => {
  const originalEnv = process.env.ATTENTION_BUBBLE_CHOICES;

  beforeEach(() => {
    // We might need to reset module cache here if we want to re-evaluate the cached value
    // However, if we cache the value, we are stuck with it unless we reload the module.
    // This is the challenge with caching.
    // For now, let's just verify the behavior without caching first.
    process.env.ATTENTION_BUBBLE_CHOICES = originalEnv;
    vi.resetModules();
  });

  it('should parse choices separated by |', async () => {
    // Re-import to ensure fresh env var read if cache is implemented
    const { getChoices } = await import('../widgetAttention.js');
    process.env.ATTENTION_BUBBLE_CHOICES = 'A|B|C';
    expect(getChoices()).toEqual(['A', 'B', 'C']);
  });

  it('should trim whitespace', async () => {
    const { getChoices } = await import('../widgetAttention.js');
    process.env.ATTENTION_BUBBLE_CHOICES = ' A | B | C ';
    expect(getChoices()).toEqual(['A', 'B', 'C']);
  });

  it('should filter empty choices', async () => {
    const { getChoices } = await import('../widgetAttention.js');
    process.env.ATTENTION_BUBBLE_CHOICES = 'A||C|';
    expect(getChoices()).toEqual(['A', 'C']);
  });

  it('should return empty array if no env var', async () => {
    const { getChoices } = await import('../widgetAttention.js');
    delete process.env.ATTENTION_BUBBLE_CHOICES;
    expect(getChoices()).toEqual([]);
  });
});
