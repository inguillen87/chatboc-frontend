/**
 * Formats a given phone number string into a format suitable for WhatsApp's wa.me links,
 * with a focus on Argentinian numbers.
 *
 * - Removes non-digit characters.
 * - Attempts to normalize to E.164 like format without the leading '+' (e.g., "5492611234567" -> "542611234567").
 * - Adds "54" if it seems to be an Argentinian number without a country code.
 *
 * @param phoneNumber The raw phone number string.
 * @returns The formatted phone number string (digits only, with country code) or null if invalid.
 */
export function formatPhoneNumberForWhatsApp(phoneNumber: string | null | undefined): string | null {
  if (!phoneNumber) {
    return null;
  }

  // Remove all non-digit characters
  let cleaned = phoneNumber.replace(/\D/g, '');

  // Argentinian Mobile: Often includes a '9' after '54' (country code) for mobiles.
  // wa.me typically works better without this '9'.
  if (cleaned.startsWith('549') && cleaned.length === 12 + 1) { // 54 + 9 + 10 (area + number) = 13 digits
    cleaned = `54${cleaned.substring(3)}`; // Remove the '9' -> 54 + 10 digits = 12 digits
  }
  // Argentinian Mobile or Landline without the extra '9' but with '54'
  else if (cleaned.startsWith('54') && cleaned.length === 12) { // 54 + 10 digits
    // Already in a good format (e.g., 542611234567)
  }
  // Local number (10 digits, e.g., 2611234567 for Mendoza)
  else if (cleaned.length === 10) {
    cleaned = `54${cleaned}`; // Prepend 54
  }
  // Local number with leading 0 (e.g., 02611234567 or 01112345678)
  else if (cleaned.startsWith('0') && (cleaned.length === 11 || cleaned.length === 12)) {
    cleaned = `54${cleaned.substring(1)}`; // Remove leading 0, prepend 54
  }
  // If it doesn't match common Argentinian patterns or already includes 54 correctly.
  // Check final length. A common length for 54 + area + number is 12 digits.
  // Some Buenos Aires numbers might have 13 with the '9'.
  // We are a bit lenient here.
  else if (cleaned.startsWith('54') && (cleaned.length >= 11 && cleaned.length <=13) ) {
    // It might be okay, e.g. 5411... (8 digits after 5411)
  }
  else {
    // Not a recognized Argentinian pattern or already internationalized but not matching above
    // If it already starts with a country code other than 54, or is too short/long
    // For simplicity, if it doesn't fit the above, we'll consider it invalid for this formatter.
    // A more robust library would be needed for true international phone parsing.
    console.warn(`[formatPhoneNumberForWhatsApp] Phone number "${phoneNumber}" (cleaned: "${cleaned}") doesn't match expected Argentinian patterns or standard E.164-like format for wa.me. Attempting to use cleaned version if it seems plausible.`);
    if (cleaned.length >= 10 && cleaned.length <= 15) { // General plausibility check
        // Keep as is, hoping wa.me can handle it if it has a different country code.
    } else {
        return null;
    }
  }

  // Final check for a plausible length (e.g., 10 to 15 digits usually covers most international numbers with country code)
  if (cleaned.length >= 10 && cleaned.length <= 15) {
    return cleaned;
  }

  return null;
}
