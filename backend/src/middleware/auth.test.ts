import assert from 'node:assert/strict';
import test from 'node:test';
import jwt from 'jsonwebtoken';
import { createToken } from './auth.js';

test('createToken creates a seven-day bearer token for a user', () => {
  const token = createToken('user-123');
  const payload = jwt.verify(token, process.env.JWT_SECRET ?? 'development-secret-change-me') as jwt.JwtPayload;
  assert.equal(payload.sub, 'user-123');
  assert.equal(payload.exp! - payload.iat!, 7 * 24 * 60 * 60);
});
