export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isValidUrl(value: string): boolean {
  try {
    const u = new URL(value.startsWith('http') ? value : `https://${value}`);
    return Boolean(u.hostname);
  } catch {
    return false;
  }
}
