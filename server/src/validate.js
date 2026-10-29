export const NAME_PATTERN = '^[A-Za-z0-9_]{3,20}$';

// The same rule as the routes' format: 'email', which Fastify 5's Ajv already checks: a second
// check, and the one the unit tests use.
export const invalidEmail = (email) =>
  typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
