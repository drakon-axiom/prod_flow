export function safeJsonParse(input: string): { data: unknown; error?: string } {
  try {
    return { data: JSON.parse(input) }
  } catch {
    return { data: undefined, error: 'Invalid JSON format' }
  }
}
