export type ApiErrorResponse = {
  error: string
  hint?: string
  code?: string
  details?: Record<string, unknown>
}
