import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from './db.js';
import { invalidEmail, NAME_PATTERN } from './validate.js';

const COOKIE = 'token';
const cookieOpts = { path: '/', httpOnly: true, secure: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 7 };

export { invalidEmail, NAME_PATTERN } from './validate.js';

const credentials = {
  type: 'object',
  required: ['email', 'password'],
  additionalProperties: false,
  properties: {
    email: { type: 'string', format: 'email', maxLength: 254 },
    password: { type: 'string', minLength: 8, maxLength: 128 },
    name: { type: 'string', pattern: NAME_PATTERN },
  },
};

// Login attempts per account. After LOGIN_MAX_FAILS within LOGIN_WINDOW_MS the account is
// refused until the window passes, so a password can't be guessed by brute force. Not keyed by
// IP: behind the Cloudflare tunnel every player arrives from the same IP.
// A browser that has logged in to the account before carries a device cookie and has its own
// counter, so strangers failing on purpose can lock new browsers out, never the owner's own.
const LOGIN_MAX_FAILS = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const failures = new Map();
const lockedOut = (key) => {
  const f = failures.get(key);
  if (f && Date.now() - f.since > LOGIN_WINDOW_MS) failures.delete(key);
  return (failures.get(key)?.count ?? 0) >= LOGIN_MAX_FAILS;
};
const noteFailure = (key) => {
  const f = failures.get(key) ?? { count: 0, since: Date.now() };
  f.count++;
  failures.set(key, f);
};
// forget old entries so the map can't grow without bound
setInterval(() => {
  for (const [key, f] of failures) if (Date.now() - f.since > LOGIN_WINDOW_MS) failures.delete(key);
}, LOGIN_WINDOW_MS).unref();

// "<user id>.<random>.<HMAC>": proof that this browser logged in to that account. The random part
// is per browser, so each browser counts its own failures: a cookie left on a friend's phone can
// lock out that phone only. Not a session: it opens nothing, and it is signed with its own
// label, so it can never pass as the JWT. One entry per account, joined by "~", so logging in to
// another account in the same browser keeps the first one's.
const DEVICE = 'device';
const DEVICES_KEPT = 5;
const deviceOpts = { path: '/api/auth', httpOnly: true, secure: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 };
const deviceMac = (id, nonce) => createHmac('sha256', process.env.JWT_SECRET).update(`device:${id}.${nonce}`).digest('base64url');
// the browser's random part if it carries a valid cookie for this account, else null
const deviceEntries = (req) => String(req.cookies?.[DEVICE] ?? '').split('~').filter(Boolean);
const knownDevice = (req, id) => {
  for (const entry of deviceEntries(req)) {
    const [owner, nonce, mac] = entry.split('.');
    if (owner !== String(id) || !nonce || !mac) continue;
    const want = Buffer.from(deviceMac(id, nonce));
    const got = Buffer.from(mac);
    if (got.length === want.length && timingSafeEqual(got, want)) return nonce;
  }
  return null;
};
const rememberDevice = (req, reply, id) => {
  const nonce = knownDevice(req, id) ?? randomBytes(12).toString('base64url');
  const others = deviceEntries(req).filter((e) => e.split('.')[0] !== String(id)).slice(-(DEVICES_KEPT - 1));
  reply.setCookie(DEVICE, [...others, `${id}.${nonce}.${deviceMac(id, nonce)}`].join('~'), deviceOpts);
};

export const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, bio: u.bio, avatar: u.avatar });

// Issues the session cookie; call again whenever the name in the token changes.
// `since` ties the token to this account: `make fclean` keeps JWT_SECRET but starts ids at 1
// again, so an old token's id may belong to someone who signed up later.
export function setSession(app, reply, user) {
  const token = app.jwt.sign({ id: user.id, name: user.name, since: user.createdAt.getTime() }, { expiresIn: '7d' });
  reply.setCookie(COOKIE, token, cookieOpts);
  return publicUser(user);
}

// The account a verified token belongs to, or null if it is gone or is not the same account.
export async function sessionUser(payload) {
  const user = await prisma.user.findUnique({ where: { id: payload.id } });
  return user && user.createdAt.getTime() === payload.since ? user : null;
}

// A refusal the forms expect (bad password, lockout, name taken...) answers 200 with { error }:
// Chrome logs every 4xx response as a console error. Misuse of the API (a body that breaks the
// schema, no session) still gets a 4xx.
export async function authRoutes(app) {
  app.post('/api/auth/register', { schema: { body: { ...credentials, required: ['email', 'password', 'name'] } } },
    async (req, reply) => {
      const { email, password, name } = req.body;
      if (invalidEmail(email)) return reply.send({ error: 'invalid_input' });
      // bcrypt ignores everything after 72 bytes, so a longer password would not all count
      if (Buffer.byteLength(password, 'utf8') > 72) return reply.send({ error: 'password_length' });
      const taken = await prisma.user.findFirst({ where: { OR: [{ email }, { name }] } });
      if (taken) return reply.send({ error: 'taken' });
      // bcrypt generates and embeds a per-password salt
      const passwordHash = await bcrypt.hash(password, 12);
      try {
        const user = await prisma.user.create({ data: { email, name, passwordHash } });
        rememberDevice(req, reply, user.id);
        return setSession(app, reply, user);
      } catch (err) {
        // two sign-ups can pass the check above together; the database unique key decides
        if (err.code === 'P2002') return reply.send({ error: 'taken' });
        throw err;
      }
    });

  app.post('/api/auth/login', { schema: { body: credentials } }, async (req, reply) => {
    const { email, password } = req.body;
    if (invalidEmail(email)) return reply.send({ error: 'invalid_input' });
    const user = await prisma.user.findUnique({ where: { email } });
    // the exact address the account is looked up by: another spelling reaches another account
    const device = user && knownDevice(req, user.id);
    const key = device ? `device:${user.id}:${device}` : `email:${email}`;
    if (lockedOut(key)) return reply.send({ error: 'too_many_attempts' });
    // counted before the slow bcrypt check, so parallel guesses can't all slip under the limit
    noteFailure(key);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) return reply.send({ error: 'bad_credentials' });
    failures.delete(key);
    rememberDevice(req, reply, user.id);
    return setSession(app, reply, user);
  });

  app.post('/api/auth/logout', async (req, reply) => {
    reply.clearCookie(COOKIE, { path: '/' });
    return { ok: true };
  });

  // Session check: answers 200 with user null when logged out, so the page
  // doesn't log a failed request on every visit.
  app.get('/api/session', async (req, reply) => {
    try {
      await req.jwtVerify();
    } catch {
      return { user: null };
    }
    const user = await sessionUser(req.user);
    if (!user) reply.clearCookie(COOKIE, { path: '/' });
    return { user: user && publicUser(user) };
  });
}
