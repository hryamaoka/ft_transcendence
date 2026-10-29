// End-to-end checks against the running app: `make e2e`.
// Each test signs up fresh accounts, so they can run against a database that is in use.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { call, connect, http, join, newRoom, serverAlive, signup, sleep, until } from './lib.js';

const open = [];
const seatOf = async (user) => {
  const seat = await connect(user);
  open.push(seat);
  return seat;
};
after(() => open.forEach((s) => s.socket.disconnect()));
// make e2e starts right after the container does; the app listens a few seconds later
before(async () => {
  const end = Date.now() + 60000;
  while (!(await serverAlive())) {
    if (Date.now() > end) throw new Error('the app did not start');
    await sleep(500);
  }
});

test('malformed socket messages are refused, and the server stays up', async () => {
  const user = await signup('bad');
  const seat = await seatOf(user);
  assert.ok((await join(seat, await newRoom(user))).ok);
  const events = ['room:join', 'room:settings', 'room:addBot', 'room:removeBot', 'room:kick', 'room:invite', 'room:start', 'room:reset', 'game:action', 'game:will', 'chat:send'];
  for (const event of events) {
    for (const payload of [null, 5, 'text', true]) {
      assert.deepEqual(await call(seat, event, payload), { error: 'invalid_input' }, `${event} ${payload}`);
      // no callback, and a value where the callback should be
      seat.socket.emit(event, payload);
      seat.socket.emit(event, payload, 'not a function');
    }
  }
  await sleep(500);
  assert.ok(await serverAlive());
});

test('a settings change is all or nothing', async () => {
  const user = await signup('set');
  const seat = await seatOf(user);
  await join(seat, await newRoom(user));
  assert.equal((await call(seat, 'room:settings', { lang: 'ja', werewolves: 99 })).error, 'invalid_settings');
  await call(seat, 'room:settings', { theme: 1 });
  await until(() => seat.state.settings.theme === 1, 'theme change');
  assert.equal(seat.state.lang, 'en');
  assert.equal(seat.state.settings.werewolves, 1);
});

test('the chat limit is per seat, not per tab', async () => {
  const user = await signup('rate');
  const code = await newRoom(user);
  const [tab1, tab2] = [await seatOf(user), await seatOf(user)];
  await join(tab1, code);
  await join(tab2, code);
  const results = [];
  for (const tab of [tab1, tab1, tab1, tab2, tab2, tab2]) results.push((await call(tab, 'chat:send', { text: 'hi' })).error ?? 'ok');
  assert.deepEqual(results, ['ok', 'ok', 'ok', 'ok', 'ok', 'rate_limited']);
});

test('a full game: secrets stay secret, the dead talk among themselves, the recap comes at the end', { timeout: 90000 }, async () => {
  const users = await Promise.all([0, 1, 2, 3].map((i) => signup(`g${i}`)));
  const code = await newRoom(users[0]);
  const seats = [];
  for (const user of users) {
    const seat = await seatOf(user);
    assert.ok((await join(seat, code)).ok);
    seats.push(seat);
  }
  const [host] = seats;
  assert.ok((await call(host, 'room:settings', { werewolves: 1, seer: 0, knight: 0, medium: 1, revealVotes: 0, night: 10, day: 10, vote: 10 })).ok);
  assert.ok((await call(host, 'room:start')).ok);
  await until(() => seats.every((s) => s.me?.role), 'roles');

  // each phone gets only its own role; nobody sees the table
  for (const s of seats) {
    assert.equal(s.me.me, s.user.id);
    assert.equal(s.state.game.roles, null);
  }
  const wolf = seats.find((s) => s.me.role === 'werewolf');
  const medium = seats.find((s) => s.me.role === 'medium');
  const [victim, other] = seats.filter((s) => s.me.role === 'villager');
  assert.ok(wolf && medium && victim && other, 'one werewolf, one medium, two villagers');

  // night 1: the werewolf chat reaches the werewolf only, the village can't talk
  assert.ok((await call(wolf, 'chat:send', { text: 'wolf secret' })).ok);
  assert.equal((await call(victim, 'chat:send', { text: 'hello?' })).error, 'cannot_chat');
  await sleep(300);
  for (const s of seats) assert.equal(s.chat.some((m) => m.text === 'wolf secret'), s === wolf);
  assert.deepEqual(host.state.game.acted, []);

  // without a seer the first night lasts 10 seconds
  await until(() => host.state.game.phase === 'day', 'day 1', 15000);
  assert.ok((await call(victim, 'game:will', { text: 'Avenge me!' })).ok);
  await until(() => victim.me.will === 'Avenge me!', 'last words saved');
  for (const s of seats) await call(s, 'game:action', { phase: 'day' });
  await until(() => host.state.game.phase === 'vote', 'vote 1');
  for (const s of seats) await call(s, 'game:action', { phase: 'vote', target: (s === victim ? other : victim).user.id });
  await until(() => host.state.game.phase === 'night', 'night 2');

  // the execution reads out the last words; hidden votes stay hidden
  const executed = host.state.game.log.find((e) => e.type === 'executed');
  assert.equal(executed.id, victim.user.id);
  assert.equal(executed.will, 'Avenge me!');
  assert.deepEqual(host.state.game.votes, []);
  // only the medium learns what the executed player was
  await until(() => medium.me.mediumSeen.length, 'medium result');
  assert.deepEqual(medium.me.mediumSeen, [{ id: victim.user.id, werewolf: false }]);
  for (const s of seats) if (s !== medium) assert.deepEqual(s.me.mediumSeen, []);

  // the dead talk in the dead chat, which the living never receive
  assert.ok((await call(victim, 'chat:send', { text: 'ghost talk' })).ok);
  await sleep(300);
  for (const s of seats) assert.equal(s.chat.some((m) => m.text === 'ghost talk'), s === victim);
  // a dead werewolf-chat reader can't read on; the dead villager never could
  assert.ok(!victim.chat.some((m) => m.channel === 'wolves'));

  // a night with living humans runs its full time even once everyone has chosen,
  // and the pick sends nothing to the others: not even a frame that says "someone acted"
  const quiet = seats.filter((s) => s !== wolf).map((s) => [s, s.frames]);
  assert.ok((await call(wolf, 'game:action', { phase: 'night', target: other.user.id })).ok);
  await sleep(1500);
  assert.equal(host.state.game.phase, 'night');
  for (const [s, frames] of quiet) assert.equal(s.frames, frames, 'a night pick reached another phone');
  await until(() => host.state.game.phase === 'ended', 'the end', 15000);

  // the end: roles, the recap with every secret action and ballot, and all chats for everyone
  const { game } = host.state;
  assert.equal(game.winner, 'werewolves');
  assert.equal(game.roles[wolf.user.id], 'werewolf');
  assert.deepEqual(game.recap.nights.map((n) => [n.day, n.attack, n.killed]), [[1, null, null], [2, other.user.id, other.user.id]]);
  assert.equal(game.recap.ballots.length, 4);
  for (const s of seats) {
    await until(() => s.chat.some((m) => m.text === 'wolf secret') && s.chat.some((m) => m.text === 'ghost talk'), 'full history after the end');
    // chat ids are opaque and the order key stays on the server, so gaps can't count hidden chats
    for (const m of s.chat) {
      assert.match(m.id, /^[0-9a-f-]{36}$/);
      assert.equal(m.seq, undefined);
    }
  }

  // the result is saved for the profile
  await sleep(500);
  const profile = await http(`/api/users/${users[0].name}`, { cookie: users[0].cookie });
  assert.equal(profile.data.stats.games, 1);
});

test('a dead werewolf keeps the pack\'s chat from before their death, and nothing after', { timeout: 90000 }, async () => {
  const users = await Promise.all([0, 1, 2, 3, 4].map((i) => signup(`w${i}`)));
  const code = await newRoom(users[0]);
  const seats = [];
  for (const user of users) {
    const seat = await seatOf(user);
    assert.ok((await join(seat, code)).ok);
    seats.push(seat);
  }
  const [host] = seats;
  assert.ok((await call(host, 'room:settings', { werewolves: 2, seer: 0, knight: 0, medium: 0, night: 10, day: 10, vote: 10 })).ok);
  assert.ok((await call(host, 'room:start')).ok);
  await until(() => seats.every((s) => s.me?.role), 'roles');
  const [doomed, survivor] = seats.filter((s) => s.me.role === 'werewolf');
  assert.ok((await call(doomed, 'chat:send', { text: 'before' })).ok);
  await until(() => survivor.chat.some((m) => m.text === 'before'), 'the pack chat');
  await until(() => host.state.game.phase === 'day', 'day 1', 15000);
  for (const s of seats) await call(s, 'game:action', { phase: 'day' });
  await until(() => host.state.game.phase === 'vote', 'vote 1');
  for (const s of seats) await call(s, 'game:action', { phase: 'vote', target: (s === doomed ? survivor : doomed).user.id });
  await until(() => host.state.game.phase === 'night', 'night 2');
  assert.ok(!host.state.players.find((p) => p.id === doomed.user.id).alive);
  assert.ok((await call(survivor, 'chat:send', { text: 'after' })).ok);
  await sleep(500);
  assert.ok(doomed.chat.some((m) => m.text === 'before'), 'lost the chat from before death');
  assert.ok(!doomed.chat.some((m) => m.text === 'after'), 'read the pack after death');
  // the same after a reconnect, which rebuilds the history on the server
  const back = await seatOf(doomed.user);
  const res = await join(back, code);
  assert.ok(res.chat.some((m) => m.text === 'before'));
  assert.ok(!res.chat.some((m) => m.text === 'after'));
});

test('a dropped phone gets the same role back, and a join that drops at once leaves no ghost', async () => {
  const [a, b] = await Promise.all([signup('ra'), signup('rb')]);
  const code = await newRoom(a);
  const sa = await seatOf(a);
  await join(sa, code);
  for (let i = 0; i < 10; i++) {
    const s = await connect(b);
    s.socket.emit('room:join', { code }, () => {});
    s.socket.disconnect();
  }
  await sleep(1000);
  const ghost = sa.state.players.find((p) => p.id === b.id);
  assert.ok(!ghost || !ghost.connected, 'a seat with no socket shows as connected');

  // one socket, two rooms at once: one join is refused, so no seat is left behind
  const twice = await seatOf(b);
  const [one, two] = [await newRoom(b), await newRoom(b)];
  const joins = await Promise.all([call(twice, 'room:join', { code: one }), call(twice, 'room:join', { code: two })]);
  assert.deepEqual(joins.map((r) => r.ok ? 'ok' : r.error).sort(), ['in_other_room', 'ok']);
  twice.socket.disconnect();

  const sb = await seatOf(b);
  await join(sb, code);
  await call(sa, 'room:addBot');
  await call(sa, 'room:addBot');
  assert.ok((await call(sa, 'room:start')).ok);
  await until(() => sb.me?.role, 'role');
  const { role } = sb.me;
  sb.socket.disconnect();
  await until(() => sa.state.players.find((p) => p.id === b.id)?.connected === false, 'offline');
  const back = await seatOf(b);
  const res = await join(back, code);
  assert.ok(res.ok);
  assert.equal(res.me.role, role);
});

test('the host can remove a player from the lobby, and invite friends', async () => {
  const [a, b, c, d] = await Promise.all([signup('ka'), signup('kb'), signup('kc'), signup('kd')]);
  const code = await newRoom(a);
  const sa = await seatOf(a);
  const sb = await seatOf(b);
  await join(sa, code);
  await join(sb, code);
  assert.equal((await call(sb, 'room:kick', { id: a.id })).error, 'host_only');
  assert.equal((await call(sa, 'room:kick', { id: a.id })).error, 'cannot_kick');
  assert.ok((await call(sa, 'room:kick', { id: b.id })).ok);
  await until(() => sb.kicked, 'the kicked event');
  assert.ok(!sa.state.players.some((p) => p.id === b.id));
  assert.equal((await join(await seatOf(b), code)).error, 'kicked');

  // only friends who added each other can invite; the invite reaches all their pages
  const sc = await seatOf(c);
  assert.equal((await call(sa, 'room:invite', { userId: c.id })).error, 'not_friend');
  // one invite per user every 3 seconds, whatever the socket
  const sa2 = await seatOf(a);
  await join(sa2, code);
  assert.equal((await call(sa2, 'room:invite', { userId: c.id })).error, 'rate_limited');
  await http(`/api/friends/${c.id}`, { method: 'POST', cookie: a.cookie });
  await sleep(3100);
  // a one-way add is not enough: c never agreed
  assert.equal((await call(sa, 'room:invite', { userId: c.id })).error, 'not_friend');
  await http(`/api/friends/${a.id}`, { method: 'POST', cookie: c.cookie });
  const friends = await http('/api/friends', { cookie: a.cookie });
  assert.equal(friends.data.find((f) => f.id === c.id).mutual, true);
  await sleep(3100);
  assert.ok((await call(sa, 'room:invite', { userId: c.id })).ok);
  await until(() => sc.invites.length, 'the invite');
  assert.deepEqual(sc.invites[0], { code, from: a.name });
  // a mutual friend with no page open can't be invited
  await http(`/api/friends/${d.id}`, { method: 'POST', cookie: a.cookie });
  await http(`/api/friends/${a.id}`, { method: 'POST', cookie: d.cookie });
  await sleep(3100);
  assert.equal((await call(sa, 'room:invite', { userId: d.id })).error, 'not_online');
});

test('a player who stays offline stops holding up the day', { timeout: 90000 }, async () => {
  const [a, b] = await Promise.all([signup('aa'), signup('ab')]);
  const code = await newRoom(a);
  const sa = await seatOf(a);
  const sb = await seatOf(b);
  await join(sa, code);
  await join(sb, code);
  await call(sa, 'room:addBot');
  await call(sa, 'room:addBot');
  await call(sa, 'room:settings', { seer: 0, knight: 0, night: 10, day: 120, vote: 10 });
  assert.ok((await call(sa, 'room:start')).ok);
  await until(() => sa.state.game?.phase === 'day', 'day 1', 15000);
  sb.socket.disconnect();
  await call(sa, 'game:action', { phase: 'day' });
  await sleep(1000);
  // within the reconnect grace the day still waits for them
  assert.equal(sa.state.game.phase, 'day');
  await until(() => sa.state.players.find((p) => p.id === b.id)?.away, 'marked away', 30000);
  await until(() => sa.state.game.phase !== 'day', 'the vote', 5000);
});

test('a missing avatar is a 404, a page path is the app', async () => {
  const missing = await http('/uploads/avatars/missing.png');
  assert.equal(missing.status, 404);
  const page = await fetch(`${process.env.BASE || 'https://localhost:8443'}/room/abcdef`);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type'), /text\/html/);
});

test('logins are locked after 10 failures, but not on the owner\'s own browser', async () => {
  const user = await signup('lock');
  const login = (password, cookie) => http('/api/auth/login', { method: 'POST', body: { email: user.email, password }, cookie });
  // a refusal is a 200 with { error } (so Chrome doesn't log it): 'ok' means logged in
  const outcome = (r) => (r.status === 200 ? r.data.error ?? 'ok' : r.status);
  // a second browser of the owner's, logged in before any trouble
  const second = (await login('password123')).res.headers.getSetCookie().map((c) => c.split(';')[0]).find((c) => c.startsWith('device='));
  assert.ok(second && second !== user.device, 'each browser gets its own device cookie');
  // ten parallel guesses at once still count as ten
  const guesses = await Promise.all(Array.from({ length: 12 }, () => login('wrong-password')));
  assert.equal(guesses.filter((g) => outcome(g) === 'bad_credentials').length, 10);
  assert.equal(guesses.filter((g) => outcome(g) === 'too_many_attempts').length, 2);
  assert.equal(outcome(await login('password123')), 'too_many_attempts');
  // the browser that signed up has a device cookie and its own count
  assert.equal(outcome(await login('password123', user.device)), 'ok');
  // a browser that locks itself out locks out only itself
  for (let i = 0; i < 10; i++) await login('wrong-password', user.device);
  assert.equal(outcome(await login('password123', user.device)), 'too_many_attempts');
  assert.equal(outcome(await login('password123', second)), 'ok');
  // another spelling of the address is another account: it neither resets nor shares the count
  assert.equal(outcome(await http('/api/auth/login', { method: 'POST', body: { email: user.email.toUpperCase(), password: 'password123' } })), 'bad_credentials');
  assert.equal(outcome(await login('password123')), 'too_many_attempts');
});
