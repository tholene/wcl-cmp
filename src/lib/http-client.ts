import type { ApiErrorResponse } from './api-error'

export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  const text = await response.text()
  const trimmed = text.trim()

  if (!trimmed) {
    const hint =
      response.status === 502 || response.status === 503
        ? 'The API server may not be running.'
        : 'Check the backend terminal for errors.'
    throw new Error(`Server returned ${response.status} with no body. ${hint}`)
  }

  const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
  const looksLikeHtml = trimmed.startsWith('<!doctype html') || trimmed.startsWith('<html')

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    if (looksLikeHtml || contentType.includes('text/html')) {
      throw new Error(
        `Server returned HTML instead of JSON (status ${response.status}). The backend route may be down or misrouted.`
      )
    }
    if (!response.ok) {
      throw new Error(
        `Server returned non-JSON error (status ${response.status}). Check backend logs.`
      )
    }
    throw new Error(
      `Server returned invalid JSON (status ${response.status}). Check backend logs.`
    )
  }

  if (!response.ok) {
    const err = parsed as ApiErrorResponse
    const baseMessage = err.error ?? `Request failed with status ${response.status}.`
    const withCode = err.code ? `[${err.code}] ${baseMessage}` : baseMessage
    throw new Error(err.hint ? `${withCode} ${err.hint}` : withCode)
  }

  return parsed as T
}
