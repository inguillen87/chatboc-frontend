import {accessibleForegroundHsl, normalizeColorHsl} from './color';

/** Backend theme first; explicit widget props override only valid supplied colors. */
export function widgetThemeVariables(theme: unknown, overrides: {primary?: unknown; secondary?: unknown; highContrast?: boolean} = {}): Record<string, string> {
  const colors = theme && typeof theme === 'object' && !Array.isArray(theme) ? theme as Record<string, unknown> : {};
  const variables: Record<string, string> = {};
  for (const name of ['primary', 'secondary'] as const) {
    const color = normalizeColorHsl(overrides[name]) ?? normalizeColorHsl(colors[name]);
    if (color) {
      variables[`--${name}`] = color;
      variables[`--${name}-foreground`] = accessibleForegroundHsl(color);
    }
  }
  const background = normalizeColorHsl(colors.background);
  const foreground = normalizeColorHsl(colors.text) ?? normalizeColorHsl(colors.foreground);
  if (background) {
    const readableText = accessibleForegroundHsl(background, overrides.highContrast ? undefined : foreground);
    const [h, s, l] = background.split(' ').map(parseFloat);
    const muted = `${h} ${s}% ${l > 50 ? Math.max(0, l - 6) : Math.min(100, l + 6)}%`;
    // Global input rules use --input with !important. Keep compose controls on
    // this readable surface instead of inheriting a contrasting host theme.
    for (const name of ['background', 'card', 'popover', 'input']) variables[`--${name}`] = background;
    for (const name of ['foreground', 'card-foreground', 'popover-foreground']) variables[`--${name}`] = readableText;
    variables['--muted'] = muted;
    variables['--muted-foreground'] = accessibleForegroundHsl(muted, readableText);
  } else if (foreground) variables['--foreground'] = foreground;
  return variables;
}

/** Keep theme mutations local and restore that exact scope on replacement/unmount. */
export function applyWidgetThemeVariables(target: HTMLElement, variables: Record<string, string>): () => void {
  const previous = Object.keys(variables).map(name => ({name, value: target.style.getPropertyValue(name), priority: target.style.getPropertyPriority(name)}));
  for (const [name, value] of Object.entries(variables)) target.style.setProperty(name, value);
  return () => {
    for (const {name, value, priority} of previous) {
      if (value) target.style.setProperty(name, value, priority);
      else target.style.removeProperty(name);
    }
  };
}
