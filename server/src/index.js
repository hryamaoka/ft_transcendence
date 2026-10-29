import fs from 'node:fs';
import path from 'node:path';
import Fastify, { errorCodes } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyJwt from '@fastify/jwt';
import fastifyStatic from '@fastify/static';
import fastifyMultipart from '@fastify/multipart';
import { Server } from 'socket.io';
import { authRoutes, sessionUser } from './auth.js';
import { roomRoutes, roomSockets } from './rooms.js';
import { UPLOAD_DIR, userRoutes } from './users.js';
import { trackPresence } from './presence.js';

const certDir = process.env.CERT_DIR || './certs';
const clientDir = process.env.CLIENT_DIR || path.resolve('../client/dist');

const app = Fastify({
  logger: true,
  https: {
    key: fs.readFileSync(path.join(certDir, 'key.pem')),
    cert: fs.readFileSync(path.join(certDir, 'cert.pem')),
  },
});

// The Cloudflare tunnel also accepts plain http:// and forwards it here over TLS;
// its edge tells us the visitor's scheme in these headers.
const viaPlainHttp = (headers) =>
  headers['x-forwarded-proto'] === 'http' || /"scheme":"http"/.test(headers['cf-visitor'] || '');

app.addHook('onRequest', async (req, reply) => {
  if (viaPlainHttp(req.headers)) {
    // 308 keeps the method and body of a POST; a GET gets the usual 301
    const code = req.method === 'GET' || req.method === 'HEAD' ? 301 : 308;
    return reply.redirect(`https://${req.headers.host}${req.url}`, code);
  }
  if (req.headers['cf-visitor']) reply.header('Strict-Transport-Security', 'max-age=31536000');
});

// Over http2 the tunnel forwards a body-less POST or DELETE (add friend, logout...) as chunked
// with no Content-Type, which Fastify refuses with 415. Let it through when it is really empty;
// a real body of an unknown type is still refused.
app.addContentTypeParser('*', { parseAs: 'string' }, (req, body, done) => {
  if (req.headers['content-type'] === undefined && body === '') return done(null);
  done(new errorCodes.FST_ERR_CTP_INVALID_MEDIA_TYPE(req.headers['content-type'] ?? ''));
});

if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not set');
await app.register(fastifyCookie);
await app.register(fastifyJwt, { secret: process.env.JWT_SECRET, cookie: { cookieName: 'token', signed: false } });

app.decorate('authenticate', async (req, reply) => {
  try {
    await req.jwtVerify();
  } catch {
    return reply.code(401).send({ error: 'unauthorized' });
  }
  if (!(await sessionUser(req.user))) return reply.code(401).send({ error: 'unauthorized' });
});

await app.register(authRoutes);
await app.register(fastifyMultipart);
await app.register(roomRoutes);
await app.register(userRoutes);

// Serve the SPA; unknown page paths fall back to index.html (e.g. /room/abc123).
// A missing API route or avatar file is a real 404, not the app's HTML.
await app.register(fastifyStatic, { root: clientDir });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
await app.register(fastifyStatic, { root: UPLOAD_DIR, prefix: '/uploads/', decorateReply: false });
app.setNotFoundHandler((req, reply) =>
  /^\/(api|uploads)\//.test(req.url) ? reply.code(404).send({ error: 'not_found' }) : reply.sendFile('index.html'));

// Socket.IO answers before Fastify's hooks run, so plain-HTTP handshakes are refused here
const io = new Server(app.server, {
  allowRequest: (req, callback) => callback(null, !viaPlainHttp(req.headers)),
});
io.use(async (socket, next) => {
  const token = app.parseCookie(socket.handshake.headers.cookie || '').token;
  try {
    const payload = app.jwt.verify(token);
    if (!(await sessionUser(payload))) return next(new Error('unauthorized'));
    socket.data.user = payload;
    next();
  } catch {
    next(new Error('unauthorized'));
  }
});
trackPresence(io);
roomSockets(io, app.log);

await app.listen({ port: 8443, host: '0.0.0.0' });
