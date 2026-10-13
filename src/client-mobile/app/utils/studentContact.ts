const DEFAULT_COUNTRY_CALLING_CODE = "1";

export function normalizeEmail(rawEmail: string): string {
  return rawEmail.trim().replace(/^mailto:/i, "").toLowerCase();
}

// Returns an E.164 number, or undefined when the text can't be read as one. Ten digits (or eleven starting
// with 1) are assumed to be a North American number.
export function normalizePhoneNumber(rawPhone: string): string | undefined {
  const text = rawPhone.trim()
    .replace(/^tel:/i, "")
    .replace(/\s*(?:ext\.?|extension|x)\s*\d+$/i, "");
  const digitText = text.replace(/\D/g, "");
  if (!digitText) return undefined;

  let internationalDigitText: string;
  if (text.startsWith("+")) internationalDigitText = digitText;
  else if (digitText.startsWith("00")) internationalDigitText = digitText.slice(2);
  else if (digitText.length === 10) internationalDigitText = DEFAULT_COUNTRY_CALLING_CODE + digitText;
  else if (digitText.length === 11 && digitText.startsWith("1")) internationalDigitText = digitText;
  else return undefined;

  const phoneNumber = `+${internationalDigitText}`;
  return /^\+[1-9]\d{6,14}$/.test(phoneNumber) ? phoneNumber : undefined;
}

export function formatPhoneNumber(phoneNumber: string | undefined): string {
  if (!phoneNumber) return "";
  const northAmericanMatch = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(phoneNumber);
  return northAmericanMatch ? `(${northAmericanMatch[1]}) ${northAmericanMatch[2]}-${northAmericanMatch[3]}` : phoneNumber;
}
