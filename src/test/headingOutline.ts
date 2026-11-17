/**
 * Heading outline check for screen-reader navigation: lists every place where a heading
 * jumps more than one level below the previous one (for example h1 → h3).
 */
export function headingSkips(root: ParentNode = document.body): string[] {
  const headings = Array.from(root.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6,[role="heading"][aria-level]'));
  const skips: string[] = [];
  let previous = 0;
  for (const heading of headings) {
    const tag = /^H([1-6])$/.exec(heading.tagName);
    const level = tag ? Number(tag[1]) : Number(heading.getAttribute('aria-level'));
    if (previous && level > previous + 1) skips.push(`h${previous} → h${level}: ${heading.textContent?.trim() ?? ''}`);
    previous = level;
  }
  return skips;
}
