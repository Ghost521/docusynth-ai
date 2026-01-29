import { describe, it, expect } from 'vitest';
import { PRESETS, Preset } from '../../data/presets';

describe('PRESETS', () => {
  it('has at least 10 presets', () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(10);
  });

  it('all have unique IDs', () => {
    const ids = PRESETS.map(p => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('all have required fields', () => {
    PRESETS.forEach((preset: Preset) => {
      expect(preset.id).toBeTruthy();
      expect(preset.title).toBeTruthy();
      expect(preset.description).toBeTruthy();
      expect(preset.value).toBeTruthy();
      expect(preset.mode).toBeTruthy();
      expect(preset.category).toBeTruthy();
      expect(preset.icon).toBeTruthy();
    });
  });

  it('all have valid mode values', () => {
    const validModes = ['search', 'crawl', 'github'];
    PRESETS.forEach(preset => {
      expect(validModes).toContain(preset.mode);
    });
  });

  it('all have valid category values', () => {
    const validCategories = ['popular', 'trending', 'skills', 'recent'];
    PRESETS.forEach(preset => {
      expect(validCategories).toContain(preset.category);
    });
  });

  it('github-mode presets have github.com URLs', () => {
    const githubPresets = PRESETS.filter(p => p.mode === 'github');
    expect(githubPresets.length).toBeGreaterThan(0);
    githubPresets.forEach(preset => {
      expect(preset.value.toLowerCase()).toContain('github.com');
    });
  });

  it('all have sourceDisplay field', () => {
    PRESETS.forEach(preset => {
      expect(preset.sourceDisplay).toBeTruthy();
    });
  });

  it('all have tokens and snippets fields', () => {
    PRESETS.forEach(preset => {
      expect(preset.tokens).toBeTruthy();
      expect(preset.snippets).toBeTruthy();
    });
  });

  it('all have updateTime field', () => {
    PRESETS.forEach(preset => {
      expect(preset.updateTime).toBeTruthy();
    });
  });

  it('contains a mix of categories', () => {
    const categories = new Set(PRESETS.map(p => p.category));
    expect(categories.size).toBeGreaterThanOrEqual(3);
  });
});
