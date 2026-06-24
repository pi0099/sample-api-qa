import { createSign, createVerify, randomUUID } from 'crypto';
import {
  EXPECTED_ACCESS_TOKEN_MAX_LENGTH,
  EXPECTED_ACCESS_TOKEN_MIN_LENGTH,
  SAMPLE_JWT_KID,
  SAMPLE_RSA_PRIVATE_KEY,
  SAMPLE_RSA_PUBLIC_KEY,
} from '@/lib/rsa-keys';

export interface JwtHeader {
  alg: 'RS256';
  typ: 'JWT';
  kid: string;
}

export interface AccessTokenPayload {
  iss: string;
  sub: string;
  aud: string | string[];
  iat: number;
  exp: number;
  gty?: string;
  azp?: string;
  scope?: string;
  sid?: string;
}

export interface JwtHeaderDecoded {
  alg: string;
  typ?: string;
  kid?: string;
}

export interface SampleJwtPayload extends AccessTokenPayload {
  aud: string;
  gty: 'client-credentials';
  azp: string;
  scope: string;
  sid: string;
}

export type JwtPayload = SampleJwtPayload;

function encodeBase64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

export function isExpectedAccessTokenLength(token: string): boolean {
  const length = token.trim().length;
  return (
    length >= EXPECTED_ACCESS_TOKEN_MIN_LENGTH &&
    length <= EXPECTED_ACCESS_TOKEN_MAX_LENGTH
  );
}

export function signJwt(payload: SampleJwtPayload, privateKey: string): string {
  const header: JwtHeader = {
    alg: 'RS256',
    typ: 'JWT',
    kid: SAMPLE_JWT_KID,
  };
  const encodedHeader = encodeBase64Url(JSON.stringify(header));
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = createSign('RSA-SHA256')
    .update(signingInput)
    .sign(privateKey)
    .toString('base64url');

  return `${signingInput}.${signature}`;
}

export function decodeJwtHeader(token: string): JwtHeaderDecoded | null {
  const parts = token.trim().split('.');

  if (parts.length !== 3) {
    return null;
  }

  try {
    return JSON.parse(decodeBase64Url(parts[0])) as JwtHeaderDecoded;
  } catch {
    return null;
  }
}

export function decodeJwtPayload(token: string): AccessTokenPayload | null {
  const parts = token.trim().split('.');

  if (parts.length !== 3) {
    return null;
  }

  try {
    return JSON.parse(decodeBase64Url(parts[1])) as AccessTokenPayload;
  } catch {
    return null;
  }
}

export function verifyJwt(token: string, publicKey: string): SampleJwtPayload | null {
  const parts = token.trim().split('.');

  if (parts.length !== 3) {
    return null;
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signatureBuffer = Buffer.from(signature, 'base64url');
  const isValid = createVerify('RSA-SHA256')
    .update(signingInput)
    .verify(publicKey, signatureBuffer);

  if (!isValid) {
    return null;
  }

  const payload = decodeJwtPayload(token);

  if (!payload) {
    return null;
  }

  if (payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  if (payload.gty !== 'client-credentials') {
    return null;
  }

  return payload as SampleJwtPayload;
}

export function createJwtSid(): string {
  return randomUUID();
}

export function getSigningKeys(): { privateKey: string; publicKey: string } {
  return {
    privateKey: process.env.OAUTH_RSA_PRIVATE_KEY ?? SAMPLE_RSA_PRIVATE_KEY,
    publicKey: process.env.OAUTH_RSA_PUBLIC_KEY ?? SAMPLE_RSA_PUBLIC_KEY,
  };
}
