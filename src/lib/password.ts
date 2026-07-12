import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

/** Format: scrypt$N$r$p$saltB64$hashB64 */
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 32;

export const PIN_PASSWORD_REGEX = /^\d{4}$/;

export function isValidPinPassword(password: string): boolean {
  return PIN_PASSWORD_REGEX.test(password);
}

export async function hashPassword(password: string): Promise<string> {
  if (!isValidPinPassword(password)) {
    throw new Error("Password must be exactly 4 digits");
  }
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return [
    "scrypt",
    String(SCRYPT_N),
    String(SCRYPT_R),
    String(SCRYPT_P),
    salt.toString("base64url"),
    derived.toString("base64url"),
  ].join("$");
}

export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  if (!storedHash || !password) return false;
  const parts = storedHash.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) {
    return false;
  }
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[4]!, "base64url");
    expected = Buffer.from(parts[5]!, "base64url");
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;

  const derived = scryptSync(password, salt, expected.length, {
    N,
    r,
    p,
  });
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}
