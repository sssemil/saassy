/**
 * Server-side API fetch that forwards the user's cookies and rate-limit
 * headers to user-gateway. Use this from Server Components and Route Handlers.
 */
import { headers, cookies } from 'next/headers'

export async function serverApiFetch(
  path: string,
  options?: RequestInit
): Promise<Response> {
  const base = process.env.USER_GATEWAY_URL || 'http://localhost:3001'

  const url = new URL(path, base).toString()

  const h = await headers()
  const c = await cookies()

  const fetchHeaders: Record<string, string> = {}

  if (options?.headers) {
    new Headers(options.headers).forEach((value, key) => {
      fetchHeaders[key] = value
    })
  }

  const xff = h.get('x-forwarded-for')
  const xri = h.get('x-real-ip')
  if (xff) fetchHeaders['x-forwarded-for'] = xff
  if (xri) fetchHeaders['x-real-ip'] = xri

  // Forward cookies so user-gateway can read the access_token.
  const cookieHeader = c
    .getAll()
    .map((ck) => `${ck.name}=${ck.value}`)
    .join('; ')
  if (cookieHeader) fetchHeaders['cookie'] = cookieHeader

  return fetch(url, {
    ...options,
    headers: fetchHeaders,
    cache: 'no-store',
  })
}
