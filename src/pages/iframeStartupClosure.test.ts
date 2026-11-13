import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');
const staticImports = (source: string) =>
  [...source.matchAll(/^import\s[^;]*?from\s+["']([^"']+)["'];?/gm)].map((match) => match[1]);

describe('iframe startup closure', () => {
  it('keeps the animation library out of the static imports of the embedded widget entry', () => {
    for (const file of ['src/pages/iframe.tsx', 'src/pages/IframePage.tsx']) {
      const imports = staticImports(read(file));
      expect(imports, file).not.toContain('framer-motion');
      expect(imports, file).not.toContain('@/components/app-shell/AccessibleMotionProvider');
      expect(imports, file).not.toContain('@/components/chat/ChatWidget');
    }
  });

  it('still wraps the lazily loaded widget with the reduced-motion provider', () => {
    const page = read('src/pages/IframePage.tsx');
    expect(page).toMatch(/import\(["']@\/components\/app-shell\/AccessibleMotionProvider["']\)/);
    expect(page).toMatch(/<AccessibleMotionProvider>\s*<ChatWidget \{\.\.\.props\} \/>\s*<\/AccessibleMotionProvider>/);
  });
});
