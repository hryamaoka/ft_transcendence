import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { prisma } from './db.js';
import { NAME_PATTERN, publicUser, setSession } from './auth.js';
import { isOnline } from './presence.js';
import { refreshPlayer } from './rooms.js';
import { leaderboard, userStats } from './stats.js';

export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.resolve('uploads');
const MAX_AVATAR = 2 * 1024 * 1024;

// Detect the real image type from the file's first bytes instead of trusting the client.
function imageType(buf) {
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') return 'webp';
  return null;
}

const card = (u) => ({ id: u.id, name: u.name, avatar: u.avatar, online: isOnline(u.id) });

// ids are Postgres INT4: a larger number would fail in the database instead of here
const idParam = { type: 'object', required: ['id'], properties: { id: { type: 'integer', minimum: 1, maximum: 2147483647 } } };
// Postgres text can't hold U+0000
const NO_NUL = '^[^\\u0000]*$';

// Refusals the pages expect answer 200 with { error }, like in authRoutes.
export async function userRoutes(app) {
  const auth = { onRequest: [app.authenticate] };

  app.get('/api/users', {
    ...auth,
    schema: { querystring: { type: 'object', required: ['q'], properties: { q: { type: 'string', minLength: 1, maxLength: 20, pattern: NO_NUL } } } },
  }, async (req) => {
    const users = await prisma.user.findMany({
      // _ and % are LIKE wildcards; escaped, "a_b" finds only names with "a_b" in them
      where: { name: { contains: req.query.q.replace(/[\\%_]/g, '\\$&'), mode: 'insensitive' }, id: { not: req.user.id } },
      take: 10,
      orderBy: { name: 'asc' },
    });
    return users.map(card);
  });

  app.get('/api/users/:name', {
    ...auth,
    schema: { params: { type: 'object', properties: { name: { type: 'string', pattern: NAME_PATTERN } } } },
  }, async (req, reply) => {
    const user = await prisma.user.findUnique({ where: { name: req.params.name } });
    if (!user) return reply.send({ error: 'user_not_found' });
    const friend = await prisma.friendship.findUnique({
      where: { userId_friendId: { userId: req.user.id, friendId: user.id } },
    });
    return {
      id: user.id,
      name: user.name,
      bio: user.bio,
      avatar: user.avatar,
      createdAt: user.createdAt,
      online: isOnline(user.id),
      isFriend: Boolean(friend),
      isMe: user.id === req.user.id,
      stats: await userStats(user.id),
    };
  });

  app.patch('/api/me', {
    ...auth,
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        minProperties: 1,
        properties: { name: { type: 'string', pattern: NAME_PATTERN }, bio: { type: 'string', maxLength: 200, pattern: NO_NUL } },
      },
    },
  }, async (req, reply) => {
    const { name, bio } = req.body;
    if (name && (await prisma.user.findFirst({ where: { name, id: { not: req.user.id } } })))
      return reply.send({ error: 'taken' });
    let user;
    try {
      user = await prisma.user.update({
        where: { id: req.user.id },
        data: { name, bio: bio?.trim() },
      });
    } catch (err) {
      if (err.code === 'P2002') return reply.send({ error: 'taken' });
      throw err;
    }
    refreshPlayer(user.id, { name: user.name });
    return setSession(app, reply, user);
  });

  app.post('/api/me/avatar', auth, async (req, reply) => {
    const file = await req.file({ limits: { fileSize: MAX_AVATAR, files: 1 } });
    if (!file) return reply.send({ error: 'no_file' });
    const buf = await file.toBuffer().catch(() => null);
    if (!buf || file.file.truncated) return reply.send({ error: 'file_too_large' });
    const ext = imageType(buf);
    if (!ext) return reply.send({ error: 'bad_image' });

    const name = `${req.user.id}-${randomBytes(6).toString('hex')}.${ext}`;
    await fs.mkdir(path.join(UPLOAD_DIR, 'avatars'), { recursive: true });
    await fs.writeFile(path.join(UPLOAD_DIR, 'avatars', name), buf);

    const old = await prisma.user.findUnique({ where: { id: req.user.id } });
    const user = await prisma.user.update({ where: { id: req.user.id }, data: { avatar: `/uploads/avatars/${name}` } });
    if (old.avatar) await fs.rm(path.join(UPLOAD_DIR, 'avatars', path.basename(old.avatar)), { force: true });
    refreshPlayer(user.id, { avatar: user.avatar });
    return publicUser(user);
  });

  app.delete('/api/me/avatar', auth, async (req) => {
    const old = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (old.avatar) await fs.rm(path.join(UPLOAD_DIR, 'avatars', path.basename(old.avatar)), { force: true });
    const user = await prisma.user.update({ where: { id: req.user.id }, data: { avatar: null } });
    refreshPlayer(user.id, { avatar: null });
    return publicUser(user);
  });

  app.get('/api/friends', auth, async (req) => {
    const rows = await prisma.friendship.findMany({
      where: { userId: req.user.id },
      include: { friend: true },
      orderBy: { friend: { name: 'asc' } },
    });
    // who added me back: only those can be invited to a lobby
    const back = await prisma.friendship.findMany({
      where: { friendId: req.user.id, userId: { in: rows.map((r) => r.friendId) } },
      select: { userId: true },
    });
    const mutual = new Set(back.map((r) => r.userId));
    return rows.map((r) => ({ ...card(r.friend), mutual: mutual.has(r.friendId) }));
  });

  app.post('/api/friends/:id', { ...auth, schema: { params: idParam } }, async (req, reply) => {
    const friendId = req.params.id;
    if (friendId === req.user.id) return reply.send({ error: 'cannot_friend_self' });
    if (!(await prisma.user.findUnique({ where: { id: friendId } }))) return reply.send({ error: 'user_not_found' });
    await prisma.friendship.upsert({
      where: { userId_friendId: { userId: req.user.id, friendId } },
      create: { userId: req.user.id, friendId },
      update: {},
    });
    return { ok: true };
  });

  app.delete('/api/friends/:id', { ...auth, schema: { params: idParam } }, async (req) => {
    await prisma.friendship.deleteMany({ where: { userId: req.user.id, friendId: req.params.id } });
    return { ok: true };
  });

  app.get('/api/leaderboard', auth, async () => (await leaderboard()).slice(0, 50));
}
