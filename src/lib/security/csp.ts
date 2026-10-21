/** Shared by Next configuration and Proxy. Keep this module free of server imports. */
export function securityCsp({ production, builder = false, calSources = "", nonce }: { production: boolean; builder?: boolean; calSources?: string; nonce?: string }) {
  return [
    "default-src 'self'", "object-src 'none'",
    `script-src 'self' ${nonce ? `'nonce-${nonce}'` : "'unsafe-inline'"}${production ? "" : " 'unsafe-eval'"}${calSources}`,
    `frame-src 'self'${builder ? " https:" : calSources}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${builder ? " https:" : ""}`,
    ...(builder ? ["media-src 'self' https:"] : []),
    "font-src 'self'", `connect-src 'self'${calSources}`,
    "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'",
  ].join("; ");
}
