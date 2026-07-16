import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { JWTPayload } from 'jose';

const FIREBASE_PROJECT_ID = 'cobranzas-kc';

const JWKS = createRemoteJWKSet(
  new URL(`https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com`)
);

export interface VerifiedUser {
  uid: string;
  email: string;
}

export async function verifyFirebaseToken(token: string): Promise<VerifiedUser> {
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
      audience: FIREBASE_PROJECT_ID,
    });

    const uid = payload.sub;
    const email = (payload as any).email || '';

    if (!uid) throw new Error('Token inválido: sin uid');

    return { uid, email };
  } catch (err: any) {
    if (err.code === 'ERR_JWT_EXPIRED') throw new Error('Token expirado');
    if (err.code === 'ERR_JWS_INVALID') throw new Error('Token inválido');
    throw new Error(`Error de autenticación: ${err.message}`);
  }
}
