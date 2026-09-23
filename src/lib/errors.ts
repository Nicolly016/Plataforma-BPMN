export type ErrorCode = "unauthorized" | "forbidden" | "validation" | "not_found" | "conflict" | "unavailable";

export class AppError extends Error {
  readonly code: ErrorCode;

  constructor(message: string, code: ErrorCode) {
    super(message);
    this.name = "AppError";
    this.code = code;
  }
}

export function isRedirectError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("digest" in error)) {
    return false;
  }

  const digest = error.digest;
  return typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND"));
}

export function toUserMessage(error: unknown, fallback = "Não foi possível concluir a operação."): string {
  if (error instanceof AppError) {
    return error.message;
  }

  return fallback;
}
