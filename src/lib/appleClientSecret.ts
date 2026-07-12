import { SignJWT, importPKCS8 } from "jose";

/**
 * Sign-in-with-Apple web client_secret (JWT) for POST /auth/token.
 * PEM from Apple “.p8” key; multiline PEM in env typically uses `\n`.
 */
export async function createAppleClientSecret(opts: {
  teamId: string;
  clientId: string;
  keyId: string;
  /** PKCS#8 PEM */
  privateKeyPem: string;
}) {
  const pem = opts.privateKeyPem.replace(/\\n/g, "\n");
  const pk = await importPKCS8(pem, "ES256");
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: opts.keyId })
    .setIssuer(opts.teamId)
    .setSubject(opts.clientId)
    .setAudience("https://appleid.apple.com")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(pk);
}
