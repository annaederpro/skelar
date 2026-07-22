// 8 chars, uppercase letters + digits, excluding 0/O/1/I to avoid visual
// ambiguity when a code is typed by hand via the /link fallback.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateLinkCode(): string {
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}

export const LINK_CODE_TTL_MINUTES = 15;
