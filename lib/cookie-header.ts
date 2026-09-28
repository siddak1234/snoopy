/**
 * The request's cookies as a `Cookie` header — `name=value` pairs and nothing
 * else (register F51).
 *
 * Not `cookies().toString()`: inside a server action or a route handler Next
 * hands back a RESPONSE cookie store, whose `toString()` serialises each cookie
 * as a `Set-Cookie` value — `name=value; Path=/` — and those attributes went to
 * the Edge as if they were cookies. A page render gets a request store that
 * serialises correctly, which is why only actions and route handlers did it.
 * Values are re-encoded the way the request store encodes them, since Next
 * decoded them when it parsed the browser's header.
 */
export function requestCookieHeader(store: {
  getAll(): { name: string; value: string }[];
}): string {
  return store
    .getAll()
    .map(({ name, value }) => `${name}=${encodeURIComponent(value)}`)
    .join("; ");
}
