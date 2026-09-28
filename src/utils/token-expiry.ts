import jwt from 'jsonwebtoken';

/** ISO time when a signed JWT expires (read from its `exp` claim). */
export const tokenExpiresAt = (token: string): string | null => {
  const decoded = jwt.decode(token) as { exp?: number } | null;
  return decoded?.exp ? new Date(decoded.exp * 1000).toISOString() : null;
};

/**
 * Expiry metadata returned with tokens so apps can refresh silently before the access token
 * expires and warn the user before the session (refresh token) ends.
 */
export const buildTokenExpiry = (accessToken: string, refreshToken: string) => ({
  accessTokenExpiresAt: tokenExpiresAt(accessToken),
  refreshTokenExpiresAt: tokenExpiresAt(refreshToken),
});
