import assert from 'node:assert/strict';
import test from 'node:test';
import { invalidEmail } from './validate.js';
import { botChoice, botClaim, currentSuspect } from './bots.js';
import { act, actors, addClaim, addMediumClaim, defaultSettings, endPhase, setWill, settle, startGame, stopGame, validTargets } from './game.js';
import { checkRoles } from './roles.js';
import { mentioned, parseClaim, parseSuspicions } from './lines.js';

test('rejects an email without a domain', () => {
  assert.equal(invalidEmail('foo'), true);
  assert.equal(invalidEmail('a@b'), true);
  assert.equal(invalidEmail('player@example.com'), false);
});

test('French "pas" alone does not clear a suspect', () => {
  const players = [{ id: 2, name: 'Bot' }];
  const accused = parseSuspicions('Bot est un loup, pas vrai', players, 1);
  assert.deepEqual(accused, [{ target: 2, weight: 1 }]);
  const cleared = parseSuspicions("Bot n'est pas un loup", players, 1);
  assert.deepEqual(cleared, [{ target: 2, weight: -1 }]);
});

const hooks = { changed() {}, phase() {}, ended() {} };

// A room in the middle of a game. `seats` is [id, role, bot?]; every field startGame sets is here.
function table(seats, { phase = 'day', day = 1, settings = {}, game = {} } = {}) {
  const room = {
    status: 'playing',
    players: new Map(seats.map(([id, , bot = true]) => [id, { id, name: `P${id}`, bot }])),
    roles: new Map(seats.map(([id, role]) => [id, role])),
    settings: { ...defaultSettings(), ...settings },
  };
  room.game = {
    day, phase, phaseId: 1, alive: new Set(seats.map(([id]) => id)), actions: new Map(), log: [], winner: null,
    seen: new Map(), claims: [], mediumClaims: [], votes: [], suspicions: [],
    mediumSeen: new Map(), lastGuard: new Map(), wills: new Map(), nights: [], ballots: [],
    deadline: Date.now() + 30000, talkLock: 0, ...game,
  };
  return room;
}

test('Ready does not end the day before talkLock', async () => {
  const room = table([[1, 'villager', false], [2, 'werewolf'], [3, 'villager']], {
    settings: { day: 90, vote: 30 }, game: { deadline: Date.now() + 90000, talkLock: Date.now() + 80 },
  });
  assert.equal(act(room, 1, undefined, 'day', hooks), null);
  assert.equal(room.game.phase, 'day');
  await new Promise((resolve) => setTimeout(resolve, 120));
  assert.equal(room.game.phase, 'vote');
  stopGame(room);
});

test('Ready never makes the day longer than its deadline', () => {
  const deadline = Date.now() + 5000;
  // 14 bots' morning lines would run far past this short day
  const room = table([[1, 'villager', false], [2, 'werewolf']], { settings: { day: 10 }, game: { deadline, talkLock: Date.now() + 28000 } });
  assert.equal(act(room, 1, undefined, 'day', hooks), null);
  assert.equal(room.game.phase, 'day');
  assert.ok(room.game.deadline <= deadline, 'the day was extended past its deadline');
  stopGame(room);
});

test('without a seer the first night lasts 10 seconds', () => {
  for (const [seer, expected] of [[0, 10], [1, 45]]) {
    const players = new Map([1, 2, 3, 4].map((id) => [id, { id, name: `P${id}`, bot: true }]));
    const room = { players, settings: { ...defaultSettings(), seer, knight: 0, night: 45 } };
    startGame(room, hooks);
    const seconds = Math.round((room.game.deadline - Date.now()) / 1000);
    stopGame(room);
    assert.equal(seconds, expected, `seer ${seer}`);
  }
});

test('a night with a living human runs its full time', () => {
  // a lone werewolf with the seer and knight: everyone who can act acts at once
  const room = table([[1, 'werewolf', false], [2, 'seer'], [3, 'knight']], { phase: 'night', day: 2 });
  act(room, 1, 2, 'night', hooks);
  act(room, 2, 1, 'night', hooks);
  act(room, 3, 2, 'night', hooks);
  assert.equal(room.game.phase, 'night');
  // the same night with only bots alive ends as soon as everyone has chosen
  room.players.get(1).bot = true;
  act(room, 1, 2, 'night', hooks);
  // the knight guarded the target, so nobody dies and the day begins
  assert.equal(room.game.phase, 'day');
  stopGame(room);
});

test('the knight cannot protect the same player two nights in a row', () => {
  const room = table([[1, 'werewolf'], [2, 'knight'], [3, 'villager'], [4, 'villager'], [5, 'villager']], { phase: 'night', day: 2 });
  act(room, 2, 3, 'night', hooks);
  act(room, 1, 4, 'night', hooks);
  assert.equal(room.game.phase, 'day');
  // two days later, on night 3
  room.game.phase = 'night';
  room.game.day = 3;
  room.game.actions = new Map();
  assert.ok(!validTargets(room, 2).includes(3), 'protected 3 again');
  assert.ok(validTargets(room, 2).includes(5));
  assert.equal(act(room, 2, 3, 'night', hooks), 'invalid_target');
  stopGame(room);
});

test('the medium learns whether the executed player was a werewolf', () => {
  const room = table([[1, 'werewolf'], [2, 'medium'], [3, 'villager'], [4, 'villager'], [5, 'villager'], [6, 'werewolf'], [7, 'villager']], {
    phase: 'vote', settings: { revealVotes: 0 },
  });
  for (const id of [1, 2, 3, 4, 5, 7]) act(room, id, 6, 'vote', hooks);
  act(room, 6, 3, 'vote', hooks);
  assert.ok(!room.game.alive.has(6));
  assert.deepEqual([...room.game.mediumSeen.get(2)], [[6, true]]);
  // every ballot is kept for the recap, even with hidden votes
  assert.equal(room.game.votes.length, 0);
  assert.equal(room.game.ballots.length, 7);
  stopGame(room);
});

test('last words are read out when the player dies', () => {
  const room = table([[1, 'werewolf'], [2, 'seer'], [3, 'villager'], [4, 'villager'], [5, 'villager']], { phase: 'night', day: 2 });
  assert.equal(setWill(room, 2, '  I checked P1: werewolf!  '), null);
  assert.equal(setWill(room, 3, 'x'.repeat(141)), 'invalid_message');
  act(room, 2, 1, 'night', hooks);
  act(room, 1, 2, 'night', hooks);
  endPhase(room, hooks);
  const killed = room.game.log.find((e) => e.type === 'killed');
  assert.deepEqual([killed.id, killed.will], [2, 'I checked P1: werewolf!']);
  // the recap knows who attacked, who was saved and what the seer saw
  assert.deepEqual(room.game.nights.at(-1), { day: 2, attack: 2, guard: null, inspect: [{ by: 2, target: 1, werewolf: true }], killed: 2 });
  assert.equal(setWill(room, 2, 'too late'), 'cannot_act');
  stopGame(room);
});

test('a player who stays away no longer holds up the day', () => {
  const room = table([[1, 'villager', false], [2, 'villager', false], [3, 'werewolf'], [4, 'villager']]);
  act(room, 1, undefined, 'day', hooks);
  assert.equal(room.game.phase, 'day');
  room.players.get(2).away = true;
  settle(room, hooks);
  assert.equal(room.game.phase, 'vote');
  assert.ok(!actors(room).includes(2));
  stopGame(room);
});

test('the medium counts as a special role', () => {
  assert.equal(checkRoles(4, { werewolves: 1, seer: 1, knight: 1, medium: 1 }), null);
  assert.equal(checkRoles(3, { werewolves: 1, seer: 1, knight: 1, medium: 1 }), 'too_many_roles');
  assert.equal(checkRoles(4, { werewolves: 1, seer: 1, knight: 1, medium: 0 }), null);
});

test('a seer claim needs the speaker to claim the role', () => {
  const players = [{ id: 1, name: 'Ada' }, { id: 2, name: 'Bot 2' }];
  const seer = (target, werewolf) => ({ kind: 'seer', target, werewolf });
  assert.deepEqual(parseClaim("I'm the seer. Bot 2 is a werewolf!", players, 1), seer(2, true));
  assert.deepEqual(parseClaim('I’m the seer, Bot 2 isn’t a wolf', players, 1), seer(2, false));
  assert.deepEqual(parseClaim('占い師です。Bot 2さんは人狼ではありませんでした。', players, 1), seer(2, false));
  assert.deepEqual(parseClaim('占いCO、Bot2は黒', players, 1), seer(2, true));
  // a villager result is a "not a werewolf" claim, whatever word the player uses for it
  for (const text of ['占い師です。Bot 2は市民です', '占い師です。Bot 2は村人です', '占い師です。Bot2は人間です', '占い師です。Bot 2はシロです',
    'I am the seer. Bot 2 is a villager', 'I am the seer. Bot 2 is human', 'Je suis la voyante. Bot 2 est un villageois'])
    assert.deepEqual(parseClaim(text, players, 1), seer(2, false), text);
  assert.deepEqual(parseClaim('Je suis la voyante. Bot 2 est un loup-garou !', players, 1), seer(2, true));
  // questions and denials only mention the seer
  assert.equal(parseClaim('Bot 2, are you the seer?', players, 1), null);
  assert.equal(parseClaim('Bot 2は占い師ですか？', players, 1), null);
  assert.equal(parseClaim("I'm not the seer, but Bot 2 is a wolf", players, 1), null);
});

test('a medium claim is recognised in three languages', () => {
  const players = [{ id: 1, name: 'Ada' }, { id: 2, name: 'Bot 2' }];
  const medium = (target, werewolf) => ({ kind: 'medium', target, werewolf });
  assert.deepEqual(parseClaim("I'm the medium. Bot 2 was a werewolf.", players, 1), medium(2, true));
  assert.deepEqual(parseClaim('霊媒師です。Bot 2さんは人狼ではありませんでした。', players, 1), medium(2, false));
  assert.deepEqual(parseClaim('霊能CO、Bot2は黒', players, 1), medium(2, true));
  assert.deepEqual(parseClaim("Je suis le médium. Bot 2 n'était pas un loup-garou.", players, 1), medium(2, false));
  assert.equal(parseClaim('Bot 2は霊媒師ですか？', players, 1), null);
});

test('a medium claim names the dead player, and the role claimed first decides the kind', () => {
  const players = [{ id: 1, name: 'Ada' }, { id: 2, name: 'Bot 1' }, { id: 3, name: 'Bot 3' }];
  const alive = new Set([1, 2]);
  assert.deepEqual(parseClaim("I'm the medium. Bot 3 was not a werewolf, so Bot 1 lied.", players, 1, alive), { kind: 'medium', target: 3, werewolf: false });
  assert.deepEqual(parseClaim('霊媒師です。Bot 3さんは人狼ではありませんでした。占い師COのBot 1さんは偽物です。', players, 1, alive), { kind: 'medium', target: 3, werewolf: false });
  // the result comes from the clause naming the target: a later "innocent" does not flip it
  assert.deepEqual(parseClaim("I'm the seer: Bot 1 is a werewolf. Bot 3 was innocent.", players, 1, alive), { kind: 'seer', target: 2, werewolf: true });
  // the target is the first player named, not the longest name
  const long = [...players, { id: 4, name: 'Christopher' }];
  assert.deepEqual(parseClaim("I'm the seer: Bot 1 is a werewolf, Christopher is innocent.", long, 1), { kind: 'seer', target: 2, werewolf: true });
});

test('talking about somebody else\'s claim, or denying a role, is not a claim', () => {
  const players = [{ id: 1, name: 'Ada' }, { id: 2, name: 'Bot 1' }, { id: 3, name: 'Bot 3' }];
  const alive = new Set([1, 2]);
  assert.deepEqual(parseClaim("Bot 1's seer claim is fake. I'm the medium: Bot 3 was not a werewolf.", players, 1, alive), { kind: 'medium', target: 3, werewolf: false });
  assert.equal(parseClaim('Do we trust the seer claim? Bot 1 seems honest.', players, 1, alive), null);
  assert.deepEqual(parseClaim('Bot 1さんの占い結果は信じられない。霊媒師です。Bot 3さんは人狼でした。', players, 1, alive), { kind: 'medium', target: 3, werewolf: true });
  assert.equal(parseClaim('私は占い師じゃないけど、Bot 1は人狼だと思う', players, 1, alive), null);
  assert.equal(parseClaim('私が占い師なら、Bot 1を占います', players, 1, alive), null);
  assert.deepEqual(parseClaim('私は霊媒師ではありません。占い師です。Bot 1は人狼でした。', players, 1, alive), { kind: 'seer', target: 2, werewolf: true });
  // a claim whose kind fits nobody falls back to the other role named
  assert.deepEqual(parseClaim("I'm the medium, well, as the seer I say Bot 1 is a werewolf.", players, 1, alive), { kind: 'seer', target: 2, werewolf: true });
});

test('a night pick tells only the actor and their pack', () => {
  const room = table([[1, 'werewolf', false], [2, 'werewolf'], [3, 'seer'], [4, 'villager', false], [5, 'villager']], { phase: 'night', day: 2 });
  const calls = [];
  const spy = { changed: () => calls.push('changed'), acted: (r, id) => calls.push(`acted:${id}`), phase() {}, ended() {} };
  act(room, 3, 1, 'night', spy);
  act(room, 1, 4, 'night', spy);
  assert.deepEqual(calls, ['acted:3', 'acted:1']);
  stopGame(room);
});

test('bots never vote for the dead', () => {
  const room = table([[1, 'werewolf'], [2, 'villager'], [3, 'villager'], [4, 'medium'], [5, 'villager'], [6, 'werewolf']], { day: 3 });
  // P1 lied about P3, P3 was executed, then P1 was executed; P5 claims P6 is a werewolf
  room.game.claims.push({ day: 1, by: 1, target: 3, werewolf: true }, { day: 3, by: 5, target: 6, werewolf: true });
  room.game.mediumClaims.push({ day: 2, by: 4, target: 3, werewolf: false });
  room.game.alive.delete(3);
  room.game.alive.delete(1);
  for (let i = 0; i < 20; i++) assert.equal(currentSuspect(viewOf(room, 2)), 6);
});

test('a dead accused, a dead known wolf or a dead accuser does not make a bot vote at random', () => {
  // the only player claimed to be a werewolf is dead: the villager follows the chat instead
  const village = table([[1, 'werewolf'], [2, 'villager'], [3, 'villager'], [4, 'seer'], [5, 'villager']], { day: 3 });
  village.game.claims.push({ day: 1, by: 4, target: 3, werewolf: true });
  village.game.alive.delete(3);
  village.game.suspicions.push({ day: 3, by: 4, target: 5, weight: 1 }, { day: 3, by: 1, target: 5, weight: 1 });
  for (let i = 0; i < 20; i++) assert.equal(currentSuspect(viewOf(village, 2)), 5);
  // the seer's only known werewolf is dead: the seer turns to the fake seer
  const seer = table([[1, 'werewolf'], [2, 'seer'], [3, 'werewolf'], [4, 'villager'], [5, 'villager']], { day: 3 });
  seer.game.seen.set(2, new Map([[3, true]]));
  seer.game.alive.delete(3);
  seer.game.claims.push({ day: 2, by: 1, target: 4, werewolf: true });
  for (let i = 0; i < 20; i++) assert.equal(currentSuspect(viewOf(seer, 2)), 1);
  // the seer who exposed a werewolf is dead: the pack blends in with the chat
  const pack = table([[1, 'werewolf'], [2, 'werewolf'], [3, 'seer'], [4, 'villager'], [5, 'villager']], { day: 3 });
  pack.game.claims.push({ day: 2, by: 3, target: 2, werewolf: true });
  pack.game.alive.delete(3);
  pack.game.suspicions.push({ day: 3, by: 4, target: 5, weight: 1 });
  for (let i = 0; i < 20; i++) assert.equal(currentSuspect(viewOf(pack, 1)), 5);
});

test('a villager bot accused of being a werewolf knows the accuser lied', () => {
  const room = table([[1, 'werewolf'], [2, 'villager'], [3, 'villager'], [4, 'villager'], [5, 'villager']], { day: 2 });
  room.game.claims.push({ day: 2, by: 1, target: 2, werewolf: true });
  for (let i = 0; i < 20; i++) assert.equal(currentSuspect(viewOf(room, 2)), 1);
});

test('"Bot 10" is not also "Bot 1"', () => {
  const players = [{ id: -1, name: 'Bot 1' }, { id: -10, name: 'Bot 10' }];
  assert.deepEqual(mentioned('bot10, what do you think?', players).map((p) => p.id), [-10]);
  assert.deepEqual(parseSuspicions('Bot 10 is suspicious', players, 1), [{ target: -10, weight: 1 }]);
});

test('English negations clear a suspect', () => {
  const players = [{ id: 2, name: 'Bot' }];
  assert.deepEqual(parseSuspicions("Bot isn't a wolf", players, 1), [{ target: 2, weight: -1 }]);
  assert.deepEqual(parseSuspicions("I don't think Bot is suspicious", players, 1), [{ target: 2, weight: -1 }]);
  assert.deepEqual(parseSuspicions("I can't trust Bot", players, 1), [{ target: 2, weight: 1 }]);
});

// Same fields as rooms.js botView (privateState plus public facts).
function viewOf(room, id) {
  const g = room.game;
  const role = room.roles.get(id);
  const results = (map) => [...(map ?? [])].map(([pid, werewolf]) => ({ id: pid, werewolf }));
  return {
    me: id,
    role,
    allies: role === 'werewolf'
      ? [...room.roles].filter(([i, r]) => r === 'werewolf' && i !== id).map(([i]) => i)
      : [],
    phase: g.phase,
    canAct: actors(room).includes(id),
    targets: validTargets(room, id),
    choice: g.actions.get(id) ?? null,
    allyChoices: role === 'werewolf' && g.phase === 'night'
      ? [...g.actions].filter(([i]) => i !== id && room.roles.get(i) === 'werewolf').map(([i, target]) => ({ id: i, target }))
      : [],
    seen: results(g.seen.get(id)),
    mediumSeen: results(g.mediumSeen.get(id)),
    lastGuard: role === 'knight' && g.phase === 'night' ? g.lastGuard.get(id) ?? null : null,
    will: g.wills.get(id) ?? '',
    alive: [...g.alive],
    claims: g.claims,
    mediumClaims: g.mediumClaims,
    votes: g.votes,
    suspicions: g.suspicions,
  };
}

test('a villager bot votes for a seer the medium caught lying', () => {
  const room = table([[1, 'werewolf'], [2, 'villager'], [3, 'villager'], [4, 'medium'], [5, 'villager']], { day: 2 });
  // P1 (a werewolf) claimed P3 was a werewolf; P3 was executed and the medium says otherwise
  room.game.claims.push({ day: 1, by: 1, target: 3, werewolf: true });
  room.game.alive.delete(3);
  room.game.mediumSeen.set(4, new Map([[3, false]]));
  assert.equal(currentSuspect(viewOf(room, 4)), 1);
  assert.ok(addMediumClaim(room, 4, 3, false));
  assert.equal(currentSuspect(viewOf(room, 2)), 1);
  // the medium bot says it once, not every morning
  assert.equal(botClaim(viewOf(room, 4)), null);
});

// All seats are bots. Drives night, day and vote with the same choices the server uses.
function playGame(playerCount, settings) {
  const players = new Map();
  for (let id = 1; id <= playerCount; id++) players.set(id, { id, name: `P${id}`, bot: true });
  const room = { players, settings: { ...defaultSettings(), ...settings }, status: 'lobby' };
  const play = {
    changed() {},
    ended() {},
    phase(current) {
      const g = current.game;
      if (!g || g.phase === 'ended' || g.day > 40) return;
      const phase = g.phase;
      if (phase === 'day') {
        for (const id of [...g.alive]) {
          const claim = botClaim(viewOf(current, id));
          if (claim?.kind === 'medium') addMediumClaim(current, id, claim.target, claim.werewolf);
          else if (claim) addClaim(current, id, claim.target, claim.werewolf);
        }
        endPhase(current, play);
        return;
      }
      for (const id of [...g.alive]) {
        if (current.game.phase !== phase) break;
        const choice = botChoice(viewOf(current, id));
        if (choice !== undefined) act(current, id, choice, phase, play);
      }
      // A role with nobody left to choose would otherwise wait for the clock.
      if (current.game.phase === phase) endPhase(current, play);
    },
  };
  startGame(room, play);
  const winner = room.game.winner;
  stopGame(room);
  return winner;
}

for (const [players, settings] of [
  [5, { werewolves: 1, seer: 1, knight: 1, revealVotes: 1 }],
  [8, { werewolves: 2, seer: 1, knight: 1, medium: 1, revealVotes: 1 }],
]) {
  test(`werewolves and the village both win some bot games (${players} players)`, () => {
    const totals = { village: 0, werewolves: 0, other: 0 };
    for (let i = 0; i < 200; i++) {
      const winner = playGame(players, settings);
      if (winner === 'village' || winner === 'werewolves') totals[winner]++;
      else totals.other++;
    }
    assert.equal(totals.other, 0);
    assert.ok(totals.village > 0, `village wins ${totals.village}`);
    assert.ok(totals.werewolves > 0, `werewolf wins ${totals.werewolves}, village ${totals.village}`);
  });
}
