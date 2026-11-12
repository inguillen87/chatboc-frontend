import {describe, expect, it} from 'vitest';
import {accessibleForegroundHsl, hexToHsl, normalizeColorHsl} from './color';
import {applyWidgetThemeVariables, widgetThemeVariables} from './widgetTheme';

describe('scoped widget theme color contracts', () => {
  it.each([
    ['#000000', '0 0% 0%'], ['#fff', '0 0% 100%'], ['#005bb5', '210 100% 35%'],
    ['210 100% 35%', '210 100% 35%'], ['hsl(210, 100%, 35%)', '210 100% 35%'],
    ['hsl(-150deg 100% 35%)', '210 100% 35%'],
  ])('normalizes supported color %s into HSL channels', (value, expected) => {
    expect(normalizeColorHsl(value)).toBe(expected);
  });

  it.each([null, {}, '', '#abcd', '#zzzzzz', 'hsl(0 101% 0%)', 'hsl(0 0% 101%)', 'var(--host-color)', 'red', '0 0% 0%;color:red'])('rejects unsupported or malformed color %#', value => {
    expect(normalizeColorHsl(value)).toBeNull();
  });

  it('does not emit NaN from a malformed legacy hex color', () => {
    expect(hexToHsl('#zzzzzz')).not.toContain('NaN');
  });

  it.each([
    ['#000000', undefined, '0 0% 100%'], ['#ffffff', undefined, '0 0% 0%'],
    ['#777777', undefined, '0 0% 0%'], ['#000000', '#ffffff', '0 0% 100%'],
    ['#ffffff', '#005bb5', '210 100% 35%'], ['#ffffff', '#eeeeee', '0 0% 0%'],
  ])('chooses readable text for %s with preferred %s', (background, preferred, expected) => {
    expect(accessibleForegroundHsl(background, preferred)).toBe(expected);
  });

  it('normalizes the actual raw-color shape without inheriting dark host text or surfaces', () => {
    const variables = widgetThemeVariables({primary:'#000000',secondary:'#FFFFFF',background:'#ffffff',text:'#000000',foreground:'#005bb5'});
    expect(variables).toMatchObject({'--primary':'0 0% 0%','--primary-foreground':'0 0% 100%',
      '--secondary':'0 0% 100%','--secondary-foreground':'0 0% 0%',
      '--background':'0 0% 100%','--foreground':'0 0% 0%', '--card':'0 0% 100%', '--card-foreground':'0 0% 0%',
      '--popover':'0 0% 100%', '--popover-foreground':'0 0% 0%', '--input':'0 0% 100%', '--muted':'0 0% 94%', '--muted-foreground':'0 0% 0%'});
    for (const value of Object.values(variables)) expect(normalizeColorHsl(value)).not.toBeNull();
  });

  it('keeps existing HSL colors and lets valid explicit props take priority', () => {
    expect(widgetThemeVariables({primary:'221 83% 53%',secondary:'#fff'}, {primary:'#000',secondary:'invalid'}))
      .toMatchObject({'--primary':'0 0% 0%', '--primary-foreground':'0 0% 100%', '--secondary':'0 0% 100%'});
    expect(widgetThemeVariables({primary:'221 83% 53%'}, {primary:'invalid'})['--primary']).toBe('221 83% 53%');
    expect(widgetThemeVariables({primary:'invalid'})).toEqual({});
  });

  it.each([['#fff', '#000', '0 0% 100%', '0 0% 0%'], ['#000', '#fff', '0 0% 0%', '0 0% 100%']])(
    'keeps input and textarea text readable on published background %s', (background, text, input, foreground) => {
      expect(widgetThemeVariables({background, text})).toMatchObject({'--input':input,'--foreground':foreground});
      expect(accessibleForegroundHsl(input,foreground)).toBe(foreground);
    },
  );

  it('gives high contrast text priority over readable but lower-contrast configured text without changing the brand', () => {
    expect(widgetThemeVariables({background:'#fff',text:'#005bb5',primary:'#005bb5'},{highContrast:true}))
      .toMatchObject({'--input':'0 0% 100%','--foreground':'0 0% 0%','--primary':'210 100% 35%'});
  });

  it('restores only the target variables on replacement or unmount, keeping host styling intact', () => {
    const host = document.createElement('div'), widget = document.createElement('div');host.append(widget);
    host.style.setProperty('--primary','221 83% 53%');
    widget.style.setProperty('--secondary','210 10% 30%','important');
    const previousPriority = widget.style.getPropertyPriority('--secondary');
    widget.style.setProperty('--unrelated','preserved');
    const restore = applyWidgetThemeVariables(widget,widgetThemeVariables({primary:'#000',secondary:'#fff'}));
    expect(host.style.getPropertyValue('--primary')).toBe('221 83% 53%');
    expect(widget.style.getPropertyValue('--primary-foreground')).toBe('0 0% 100%');
    restore();
    expect(widget.style.getPropertyValue('--primary')).toBe('');
    expect(widget.style.getPropertyValue('--secondary')).toBe('210 10% 30%');
    expect(widget.style.getPropertyPriority('--secondary')).toBe(previousPriority);
    expect(widget.style.getPropertyValue('--unrelated')).toBe('preserved');
  });
});
