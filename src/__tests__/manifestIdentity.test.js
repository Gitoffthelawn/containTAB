import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const manifestPath = path.resolve(here, '../manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

function collectKeys(value, trail = []) {
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) => [
    [...trail, key].join('.'),
    ...collectKeys(child, [...trail, key]),
  ]);
}

describe('manifest Firefox identity', () => {
  it('uses a private local gecko id and no automatic update manifest', () => {
    const gecko = manifest.browser_specific_settings?.gecko;

    expect(manifest.applications).toBeUndefined();
    expect(gecko?.id).toBe('containtab@woolkingx.local');
    expect(gecko?.id).not.toContain('containerise');
    expect(gecko?.id).not.toContain('kinte');
    expect(collectKeys(manifest)).not.toContain('browser_specific_settings.gecko.update_url');
    expect(collectKeys(manifest).filter(key => key.endsWith('update_url'))).toEqual([]);
  });
});
