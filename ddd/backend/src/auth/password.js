import argon2 from 'argon2';

export async function hashPassword(rawPassword) {
  return argon2.hash(rawPassword, {
    type: argon2.argon2id,
  });
}

export async function verifyPassword(hash, rawPassword) {
  return argon2.verify(hash, rawPassword);
}
