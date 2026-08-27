const controlOrWhitespace = /[\u0000-\u0020\u007f]/;

export function isSafePromotionUrl(value: string): boolean {
  if (!value || value !== value.trim() || value.length > 2048) return false;
  if (controlOrWhitespace.test(value)) return false;

  if (value.startsWith("/")) {
    return !value.startsWith("//");
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname);
  } catch {
    return false;
  }
}
