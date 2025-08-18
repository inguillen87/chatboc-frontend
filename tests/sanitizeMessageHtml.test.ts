import { describe, it, expect } from 'vitest';
import sanitizeMessageHtml from '../src/utils/sanitizeMessageHtml';

describe('sanitizeMessageHtml', () => {
  it('should not change a string without a URL', () => {
    const input = 'This is a simple text.';
    expect(sanitizeMessageHtml(input)).toBe(input);
  });

  it('should linkify a URL at the beginning of a string', () => {
    const input = 'http://example.com is a link.';
    const expected = '<a href="http://example.com" target="_blank" rel="noopener noreferrer">http://example.com</a> is a link.';
    expect(sanitizeMessageHtml(input)).toBe(expected);
  });

  it('should linkify an http URL', () => {
    const input = 'Check out http://example.com';
    const expected = 'Check out <a href="http://example.com" target="_blank" rel="noopener noreferrer">http://example.com</a>';
    expect(sanitizeMessageHtml(input)).toBe(expected);
  });

  it('should linkify an https URL', () => {
    const input = 'Here is a secure link: https://example.com';
    const expected = 'Here is a secure link: <a href="https://example.com" target="_blank" rel="noopener noreferrer">https://example.com</a>';
    expect(sanitizeMessageHtml(input)).toBe(expected);
  });

  it('should linkify a www URL', () => {
    const input = 'Go to www.example.com for more info.';
    const expected = 'Go to <a href="https://www.example.com" target="_blank" rel="noopener noreferrer">www.example.com</a> for more info.';
    expect(sanitizeMessageHtml(input)).toBe(expected);
  });

  it('should not linkify a URL that is already in an anchor tag', () => {
    const input = 'Here is a link: <a href="http://example.com">Example</a>';
    expect(sanitizeMessageHtml(input)).toBe(input);
  });

  it('should correctly handle a URL with query parameters', () => {
    const input = 'Visit https://example.com?q=test&page=1';
    const expected = 'Visit <a href="https://example.com?q=test&amp;page=1" target="_blank" rel="noopener noreferrer">https://example.com?q=test&amp;page=1</a>';
    expect(sanitizeMessageHtml(input)).toBe(expected);
  });

  it('should not double-link an already linked URL', () => {
    const input = 'A link: <a href="https://example.com">https://example.com</a>';
    expect(sanitizeMessageHtml(input)).toBe(input);
  });

  it('should linkify a URL and a phone number in the same string', () => {
    const input = 'Visit www.example.com or call +541133334444';
    const expected = 'Visit <a href="https://www.example.com" target="_blank" rel="noopener noreferrer">www.example.com</a> or call <a href="https://wa.me/541133334444" target="_blank" rel="noopener noreferrer" style="color: #25D366; text-decoration: none; font-weight: bold;">+541133334444</a>';
    const result = sanitizeMessageHtml(input);
    // Remove svg from result for comparison, using a regex that handles multiline content
    const resultWithoutSvg = result.replace(/<svg[\s\S]*?<\/svg>/, '');
    expect(resultWithoutSvg).toBe(expected);
  });

});
