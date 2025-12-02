/**
 * Normalizes a phone number to be used in WhatsApp links (wa.me/).
 * This typically means removing all non-digit characters.
 * For example, "+1 (123) 456-7890" becomes "11234567890".
 * Numbers starting with "00" (e.g., "0049...") will have "00" replaced by the country code directly.
 *
 * @param phoneNumber The phone number string to normalize.
 * @returns A string containing only the digits of the phone number.
 */
export function normalizePhoneNumberForWhatsApp(phoneNumber: string): string {
  if (!phoneNumber) {
    return "";
  }

  // Remove all non-digit characters
  let normalized = phoneNumber.replace(/\D/g, "");

  // Some numbers might be prefixed with '00' for international calls instead of '+'
  // If the original number started with '00' and the cleaned version starts with it,
  // it's usually an international prefix that wa.me doesn't need.
  // However, wa.me expects the country code directly.
  // Example: "0049123..." should become "49123..."
  // This logic is implicitly handled by `replace(/\D/g, "")` if `+` was already removed.
  // If `+` was kept and then `00` was at the start, it would be more complex.
  // But since all non-digits are removed, "0049..." becomes "0049..."
  // And "+49..." becomes "49...".
  // The simplest approach for wa.me links is to ensure no leading '00' if it was an explicit prefix.
  // However, most modern libraries/usages just strip all non-digits and it works.
  // Let's stick to the simplest: just remove all non-digits.
  // If a country code like '1' for USA is part of 'phoneNumber' as in '+1...', it will be preserved as '1...'.
  // If it's '001...', it will be '001...'. This might be an issue.

  // Let's refine: If it starts with "00", remove the "00".
  // This is because "00" is an international dialing prefix, not part of the number for wa.me.
  if (normalized.startsWith("00")) {
    normalized = normalized.substring(2);
  }

  // If the original number had a '+', it's already removed.
  // The result should be just digits. E.g. "12223334444" for +1 (222) 333-4444

  return normalized;
}
