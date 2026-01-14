
// Regex to find potential phone numbers, avoiding numbers that are already part of a link
// We use a simplified version tailored for markdown text preprocessing
const phoneRegex = /(?<!https:\/\/wa\.me\/)(?<!\d)(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?){2,}\d{3,4}(?!\d)/g;

export function preprocessMarkdown(text: string): string {
  if (!text) return "";

  // Replace phone numbers with Markdown links
  // [phone](https://wa.me/number)
  // We add a specific class or style if possible, but standard markdown links are [text](url)

  return text.replace(phoneRegex, (match) => {
    // If it looks like it's already inside a markdown link [xxx](...match...), skip?
    // Regex lookbehind (?<!...) handles some cases but not all.
    // For simplicity, we assume the text is plain or basic markdown.

    const hadPlus = match.includes('+');
    const sanitizedNumber = match.replace(/[^\d]/g, '');

    if (sanitizedNumber.length < 9) {
        return match;
    }

    let fullNumber = sanitizedNumber;
    if (!hadPlus) {
      fullNumber = `54${sanitizedNumber}`;
    }

    // Return markdown link
    return `[${match}](https://wa.me/${fullNumber})`;
  });
}
