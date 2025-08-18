import DOMPurify from 'dompurify';

const ALLOWED_TAGS = [
  'b',
  'strong',
  'i',
  'em',
  'u',
  'br',
  'p',
  'ul',
  'ol',
  'li',
  'a',
  'span',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'svg', // Allow SVG for icons
  'path', // Allow path for SVG
];

// Regex to find potential URLs, ensuring they are not part of an attribute.
// It looks for a URL at the start of the string or preceded by a space.
const urlRegex = /(^|\s)(https?:\/\/[^\s<>"'`]+|www\.[^\s<>"'`]+)/g;

// Regex to find potential phone numbers, avoiding numbers that are part of URLs
const phoneRegex = /(?<!https:\/\/wa\.me\/)(?<!\d)(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?){2,}\d{3,4}(?!\d)/g;


export function sanitizeMessageHtml(html: string): string {
  // First, linkify URLs.
  let linkifiedHtml = html.replace(urlRegex, (match, p1) => { // p1 is the captured space or start-of-string
    const url = match.trim(); // Get the URL without the leading space
    // Ensure www links get a protocol for the href attribute.
    const properUrl = url.startsWith('www.') ? `https://${url}` : url;
    // The displayed text remains the original URL.
    return `${p1}<a href="${properUrl}" target="_blank" rel="noopener noreferrer">${url}</a>`;
  });

  // Then, linkify phone numbers that are not already linked
  linkifiedHtml = linkifiedHtml.replace(phoneRegex, (match) => {
    const hadPlus = match.includes('+');
    // Clean the matched number to create a valid wa.me link
    const sanitizedNumber = match.replace(/[^\d]/g, '');

    // Basic check to avoid linking very short numbers
    if (sanitizedNumber.length < 9) {
        return match;
    }

    // Add country code if missing (assuming Argentina '54' for now)
    let fullNumber = sanitizedNumber;
    if (!hadPlus) {
      fullNumber = `54${sanitizedNumber}`;
    }

    return `<a href="https://wa.me/${fullNumber}" target="_blank" rel="noopener noreferrer" style="color: #25D366; text-decoration: none; font-weight: bold;">${match}<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: middle; margin-left: 4px;"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg></a>`;
  });

  // Then, sanitize the result. DOMPurify will handle any nested tags gracefully.
  return DOMPurify.sanitize(linkifiedHtml, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ['href', 'target', 'rel', 'style', 'xmlns', 'width', 'height', 'viewBox', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin'],
  });
}

export default sanitizeMessageHtml;
