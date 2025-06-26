import DOMPurify from 'dompurify';

const ALLOWED_TAGS = [
  'b', 'strong', 'i', 'em', 'u', 'br',
  'p', 'ul', 'ol', 'li', 'a', 'span'
];

export function sanitizeMessageHtml(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS });
}

export default sanitizeMessageHtml;
