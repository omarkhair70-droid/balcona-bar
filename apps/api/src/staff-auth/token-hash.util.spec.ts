import {
  generateOpaqueToken,
  hashToken,
  verifyTokenHash,
} from './token-hash.util';

describe('token hash utilities', () => {
  it('verifies matching opaque token hashes only', () => {
    const token = generateOpaqueToken('test');
    const hash = hashToken(token);

    expect(verifyTokenHash(token, hash)).toBe(true);
    expect(verifyTokenHash(`${token}-other`, hash)).toBe(false);
  });
});

