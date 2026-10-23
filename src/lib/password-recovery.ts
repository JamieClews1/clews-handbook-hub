export const recoveryRedirectUrl = (origin: string) => `${origin}/reset-password`;

export function isRecoveryHash(hash: string) {
  return new URLSearchParams(hash.replace(/^#/, "")).get("type") === "recovery";
}

export function validateRecoveryPassword(password: string, confirmation: string): string | null {
  if (password.length < 6) return "Password must be at least 6 characters.";
  if (password !== confirmation) return "Passwords don't match.";
  return null;
}