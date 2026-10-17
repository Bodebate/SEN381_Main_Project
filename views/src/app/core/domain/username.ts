// Letters, numbers, ".", "_", and "-" only; no spaces or other special characters
export const USERNAME_PATTERN = /^[A-Za-z0-9._-]+$/;
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 15;
export const USERNAME_HINT = 'You are only allowed to use letters, numbers, ".", "_" and "-".';
export const USERNAME_LENGTH_HINT = `Use ${USERNAME_MIN} to ${USERNAME_MAX} characters.`

export function isValidUsername(value: string): boolean {
  return value.length >= USERNAME_MIN && value.length <= USERNAME_MAX && USERNAME_PATTERN.test(value);
}
