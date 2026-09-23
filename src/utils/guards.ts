const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function assertUuid(value: string, label: string): void {
  if (!isUuid(value)) {
    throw new Error(`${label} inválido.`);
  }
}

export function readString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function readNullableString(value: unknown): string | null {
  if (value === null) {
    return null;
  }

  return readString(value);
}
