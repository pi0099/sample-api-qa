export interface Auth0Config {
  domain: string;
  issuer: string;
  audience: string;
  allowedClientIds: string[];
}

function normalizeAuth0Domain(rawDomain: string): string {
  return rawDomain
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');
}

function buildAuth0Issuer(domain: string): string {
  return `https://${domain}/`;
}

export function getAuth0Config(): Auth0Config | null {
  const rawDomain = process.env.AUTH0_DOMAIN?.trim();
  const audience = process.env.AUTH0_AUDIENCE?.trim();
  const allowedClientIds = process.env.AUTH0_ALLOWED_CLIENT_IDS?.trim();

  if (!rawDomain || !audience || !allowedClientIds) {
    return null;
  }

  const domain = normalizeAuth0Domain(rawDomain);
  const issuer =
    process.env.AUTH0_ISSUER?.trim() || buildAuth0Issuer(domain);
  const clientIds = allowedClientIds
    .split(',')
    .map((clientId) => clientId.trim())
    .filter((clientId) => clientId.length > 0);

  if (clientIds.length === 0) {
    return null;
  }

  return {
    domain,
    issuer,
    audience,
    allowedClientIds: clientIds,
  };
}

export function isAuth0Issuer(issuer: string, config: Auth0Config): boolean {
  const normalizedIssuer = issuer.trim();
  const normalizedExpected = config.issuer.trim();

  if (normalizedIssuer === normalizedExpected) {
    return true;
  }

  return (
    normalizedIssuer.replace(/\/$/, '') ===
    normalizedExpected.replace(/\/$/, '')
  );
}
