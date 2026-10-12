export const MIN_PASSWORD_LENGTH = 10;

export function validateEmail(email: string): string | null {
  const v = email.trim();
  if (!v) return 'Enter your email.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Enter an email like name@ibjjf.com.';
  return null;
}

export function validateNewPassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  return null;
}

export function validateConfirm(password: string, confirm: string): string | null {
  if (!confirm) return 'Type the new password again.';
  if (password !== confirm) return 'The two passwords don’t match.';
  return null;
}
