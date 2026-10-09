export function calEndpoints(local: boolean, bookingUrl?: string, apiUrl?: string) {
  if (local && process.env.NODE_ENV === 'production') throw new Error('Local Cal is restricted to development');
  const web = new URL(bookingUrl || 'https://cal.com');
  const api = new URL(apiUrl || (local ? 'http://localhost:5555/v2/' : 'https://api.cal.com/v2/'));
  const loopback = (u: URL) => ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname) && u.protocol === 'http:' && !u.username && !u.password;
  if (local ? !loopback(web) || !loopback(api) : web.origin !== 'https://cal.com' || api.href !== 'https://api.cal.com/v2/') {
    throw new Error('CAL_BOOKING_URL and CAL_API_BASE_URL must use the approved provider or development loopback URLs');
  }
  if (api.search || api.hash || !api.pathname.endsWith('/v2/')) throw new Error('CAL_API_BASE_URL must end in /v2/');
  return { webOrigin: web.origin, apiBase: api.href, embedUrl: `${local ? web.origin : 'https://app.cal.com'}/embed/embed.js`, local };
}
