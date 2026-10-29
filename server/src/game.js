import { randomInt } from 'node:crypto';
import { assignRoles } from './roles.js';

const env = (name, fallback) => Number(process.env[name]) || fallback;

// Room settings the host can change in the lobby, with their allowed ranges.
export const SETTINGS = {
  werewolves: { min: 1, max: 4, default: 1 },
  seer: { min: 0, max: 1, default: 1 },
  knight: { min: 0, max: 1, default: 1 },
  medium: { min: 0, max: 1, default: 0 },
  revealVotes: { min: 0, max: 1, default: 1 },
  // Visual only. Indexes THEME_NAMES. Bots are told the name; the rules stay the same.
  theme: { min: 0, max: 2, default: 0 },
  night: { min: 10, max: 120, default: env('NIGHT_SECONDS', 45) },
  day: { min: 10, max: 300, default: env('DAY_SECONDS', 90) },
  vote: { min: 10, max: 120, default: env('VOTE_SECONDS', 30) },
};
export const defaultSettings = () => Object.fromEntries(Object.entries(SETTINGS).map(([k, v]) => [k, v.default]));

const QUIET_FIRST_NIGHT_SECONDS = 10;
export const WILL_MAX_LEN = 140;

export const THEME_NAMES = ['classic village', 'blood moon', 'snow village'];

export const pick = (list) => list[randomInt(list.length)];

// Values with the most occurrences (several on a tie).
function topVoted(list) {
  const counts = new Map();
  for (const v of list) counts.set(v, (counts.get(v) || 0) + 1);
  const max = Math.max(...counts.values());
  return [...counts].filter(([, c]) => c === max).map(([v]) => v);
}

// Most frequent value; ties are broken at random (used for the werewolves' target).
const pickMost = (list) => pick(topVoted(list));

const isWolf = (room, id) => room.roles.get(id) === 'werewolf';
const nameOf = (room, id) => room.players.get(id)?.name;

// No attack on the first night, so only the seer acts then.
const firstNight = (g) => g.phase === 'night' && g.day === 1;

// Roles that choose someone at night. The medium learns by itself after each execution.
const NIGHT_ROLES = ['werewolf', 'seer', 'knight'];

// A player marked away (offline past the reconnect grace) can't click, so the day and the vote
// stop waiting for them. Who is online is public, so this tells nobody anything.
const present = (room, id) => !room.players.get(id)?.away;

// Players who must act before the current phase can end early.
export function actors(room) {
  const g = room.game;
  const alive = [...g.alive];
  if (firstNight(g)) return alive.filter((id) => room.roles.get(id) === 'seer');
  // a seer who has inspected everyone left has no one to choose and is not waited for
  if (g.phase === 'night') return alive.filter((id) => NIGHT_ROLES.includes(room.roles.get(id)) && validTargets(room, id).length > 0);
  // only humans can cut the discussion short; bots never end the day
  if (g.phase === 'day') return alive.filter((id) => !room.players.get(id).bot && present(room, id));
  if (g.phase === 'vote' || g.phase === 'runoff') return alive.filter((id) => present(room, id));
  return [];
}

// Legal targets for a player in the current phase.
export function validTargets(room, id) {
  const g = room.game;
  if (!g.alive.has(id)) return [];
  const others = [...g.alive].filter((t) => t !== id);
  if (g.phase === 'vote') return others;
  // runoff: only the tied candidates can be chosen
  if (g.phase === 'runoff') return others.filter((t) => g.runoff.includes(t));
  if (g.phase !== 'night') return [];
  if (firstNight(g) && room.roles.get(id) !== 'seer') return [];
  switch (room.roles.get(id)) {
    case 'werewolf': return others.filter((t) => !isWolf(room, t));
    case 'seer': return others.filter((t) => !g.seen.get(id)?.has(t));
    // not the same player two nights in a row
    case 'knight': return others.filter((t) => t !== g.lastGuard?.get(id));
    default: return [];
  }
}

// hooks: changed(room) after any update, phase(room) when a phase begins, ended(room) once.
export function startGame(room, hooks) {
  // roles may already be dealt, so the database row matches the cards in play
  room.roles ??= assignRoles([...room.players.keys()], room.settings);
  room.status = 'playing';
  room.game = {
    day: 1, phaseId: 0, alive: new Set(room.players.keys()), seen: new Map(), log: [], winner: null,
    // public "I am the seer, X is (not) a werewolf" statements; may be lies
    claims: [],
    // public "I am the medium, X was (not) a werewolf" statements; may be lies
    mediumClaims: [],
    // who voted for whom, public when settings.revealVotes is on
    votes: [],
    // "X is suspicious" (+1) / "not X" (-1) read from public chat
    suspicions: [],
    // medium id -> Map(executed id -> was a werewolf); only that medium sees it
    mediumSeen: new Map(),
    // knight id -> who they protected last night
    lastGuard: new Map(),
    // last words, read out when the player dies
    wills: new Map(),
    // secret until the end, then shown as the recap: every night's actions and every ballot
    nights: [],
    ballots: [],
  };
  setPhase(room, 'night', hooks);
}

function setPhase(room, phase, hooks) {
  const g = room.game;
  clearTimeout(g.timer);
  g.phase = phase;
  g.phaseId++;
  g.actions = new Map();
  g.talkLock = 0;
  let seconds = room.settings[phase === 'runoff' ? 'vote' : phase];
  // without a seer nobody acts on the first night: just time to look at your card
  if (firstNight(g) && !room.settings.seer) seconds = Math.min(seconds, QUIET_FIRST_NIGHT_SECONDS);
  const ms = seconds * 1000;
  g.deadline = Date.now() + ms;
  g.timer = setTimeout(() => endPhase(room, hooks), ms);
  hooks.phase(room);
  hooks.changed(room);
}

// Returns an error code, or null on success. A player may change their choice until the phase ends.
// `phase` is the phase the player acted in, so a late night click can't count as "ready" by day.
export function act(room, id, target, phase, hooks) {
  const g = room.game;
  if (!g || g.phase === 'ended') return 'not_running';
  if (phase !== g.phase) return 'phase_over';
  if (!actors(room).includes(id)) return 'cannot_act';
  if (g.phase !== 'day' && !validTargets(room, id).includes(target)) return 'invalid_target';
  g.actions.set(id, g.phase === 'day' ? true : target);
  settle(room, hooks, id);
  return null;
}

// Ends the phase once everyone who still has to act has acted. Called after each action (with
// the actor), and when a player is marked away (they may have been the last one waited for).
export function settle(room, hooks, actor) {
  const g = room.game;
  if (!g || g.phase === 'ended') return;
  const waiting = actors(room);
  // nobody to wait for is not "everyone is done": the clock decides
  if (!waiting.length || !canEndEarly(room) || !waiting.every((a) => g.actions.has(a))) {
    // A night pick changes only the actor's (and their pack's) private view. A room-wide update
    // would tell every phone that someone with a night role just chose, and how many did.
    if (actor !== undefined && g.phase === 'night' && hooks.acted) hooks.acted(room, actor);
    else hooks.changed(room);
    return;
  }
  // Bots open the day on a short delay. Ending the moment every human clicks Ready
  // used to cancel those lines, including the seer claim the LLM demo needs.
  // The wait never runs past the day's own deadline: Ready can shorten the day, not lengthen it.
  const talkWait = g.phase === 'day' ? Math.max(0, Math.min(g.talkLock || 0, g.deadline) - Date.now()) : 0;
  if (talkWait === 0) {
    endPhase(room, hooks);
    return;
  }
  clearTimeout(g.timer);
  g.deadline = Date.now() + talkWait;
  g.timer = setTimeout(() => endPhase(room, hooks), talkWait);
  hooks.changed(room);
}

// Last words. Only a living player in a running game can write or change them.
export function setWill(room, id, text) {
  const g = room.game;
  if (!g || g.phase === 'ended' || !g.alive.has(id)) return 'cannot_act';
  if (typeof text !== 'string' || text.length > WILL_MAX_LEN) return 'invalid_message';
  const will = text.trim();
  if (will) g.wills.set(id, will);
  else g.wills.delete(id);
  return null;
}

// A public seer claim during the day. Anyone may claim, truthfully or not.
export function addClaim(room, by, target, werewolf) {
  const g = room.game;
  if (g?.phase !== 'day' || !g.alive.has(by) || !g.alive.has(target) || by === target) return false;
  g.claims.push({ day: g.day, by, target, werewolf });
  return true;
}

// A public medium claim during the day: about someone who is already dead.
export function addMediumClaim(room, by, target, werewolf) {
  const g = room.game;
  if (g?.phase !== 'day' || !g.alive.has(by) || g.alive.has(target) || !room.players.has(target)) return false;
  g.mediumClaims.push({ day: g.day, by, target, werewolf });
  return true;
}

// A suspicion voiced in public chat. Self-defence doesn't count.
export function addSuspicion(room, by, target, weight) {
  const g = room.game;
  if (!['day', 'vote', 'runoff'].includes(g?.phase) || !g.alive.has(by) || !g.alive.has(target) || by === target) return;
  g.suspicions.push({ day: g.day, by, target, weight });
}

// While any human is alive, a night always runs its full time. Its length then depends only on
// public facts, so it can't tell the table that the pack lost a wolf or that a wolf is a bot.
// The pack also gets the whole night to talk in the werewolf chat and change its pick.
function canEndEarly(room) {
  const g = room.game;
  if (g.phase !== 'night') return true;
  return [...g.alive].every((id) => room.players.get(id).bot);
}

export function stopGame(room) {
  if (room.game) clearTimeout(room.game.timer);
}

export function endPhase(room, hooks) {
  const g = room.game;
  clearTimeout(g.timer);
  if (firstNight(g)) resolveFirstNight(room);
  else if (g.phase === 'night') resolveNight(room);
  // a tied vote goes to a runoff between the tied players; nobody has died yet
  if (g.phase === 'vote' && resolveVote(room) === 'tie') return setPhase(room, 'runoff', hooks);
  if (g.phase === 'runoff') resolveVote(room);

  const winner = checkWinner(room);
  if (winner) return endGame(room, winner, hooks);

  if (g.phase === 'night') setPhase(room, 'day', hooks);
  else if (g.phase === 'day') setPhase(room, 'vote', hooks);
  else {
    g.day++;
    setPhase(room, 'night', hooks);
  }
}

// The seers' picks tonight, recorded in their own results. Returned for the recap.
function recordInspections(room) {
  const g = room.game;
  const inspect = [];
  for (const [id, t] of g.actions) {
    if (room.roles.get(id) !== 'seer') continue;
    if (!g.seen.has(id)) g.seen.set(id, new Map());
    g.seen.get(id).set(t, isWolf(room, t));
    inspect.push({ by: id, target: t, werewolf: isWolf(room, t) });
  }
  return inspect;
}

// Removes a player and logs it, with their last words if they left any.
function kill(room, id, entry) {
  const g = room.game;
  g.alive.delete(id);
  const will = g.wills.get(id);
  g.log.push({ ...entry, id, name: nameOf(room, id), ...(will && { will }) });
}

function resolveFirstNight(room) {
  const g = room.game;
  const inspect = recordInspections(room);
  g.nights.push({ day: 1, attack: null, guard: null, inspect, killed: null });
  g.log.push({ day: 1, type: 'firstNight' });
}

function resolveNight(room) {
  const g = room.game;
  const chosen = (role) => [...g.actions].filter(([id]) => room.roles.get(id) === role);
  const inspect = recordInspections(room);

  // wolves that did not choose still attack someone
  const picks = chosen('werewolf').map(([, t]) => t);
  let attack = picks.length ? pickMost(picks) : null;
  if (attack === null) {
    const wolf = [...g.alive].find((id) => isWolf(room, id));
    attack = pick(validTargets(room, wolf));
  }
  const [guardPick] = chosen('knight');
  const guard = guardPick ? { by: guardPick[0], target: guardPick[1] } : null;
  // a knight who protected nobody tonight may protect anyone tomorrow
  g.lastGuard = new Map(chosen('knight'));
  const saved = guard?.target === attack;
  if (saved) g.log.push({ day: g.day, type: 'peaceful' });
  else kill(room, attack, { day: g.day, type: 'killed' });
  g.nights.push({ day: g.day, attack, guard, inspect, killed: saved ? null : attack });
}

// Returns 'tie' when the first vote needs a runoff.
function resolveVote(room) {
  const g = room.game;
  const round = g.phase; // 'vote' or 'runoff'
  const votes = [...g.actions.values()];
  for (const [from, to] of g.actions) {
    g.ballots.push({ day: g.day, round, from, to });
    if (room.settings.revealVotes) g.votes.push({ day: g.day, round, from, to });
  }
  if (votes.length === 0) return g.log.push({ day: g.day, round, type: 'noVote' });
  const top = topVoted(votes);
  const count = votes.filter((v) => v === top[0]).length;
  if (top.length > 1) {
    const names = top.map((id) => nameOf(room, id)).join(', ');
    if (round === 'runoff') return g.log.push({ day: g.day, round, type: 'runoffTie', names, votes: count });
    g.runoff = top;
    g.log.push({ day: g.day, round, type: 'tie', names, votes: count });
    return 'tie';
  }
  const executed = top[0];
  kill(room, executed, { day: g.day, round, type: 'executed', votes: count });
  // a living medium learns whether the executed player was a werewolf
  for (const id of g.alive) {
    if (room.roles.get(id) !== 'medium') continue;
    if (!g.mediumSeen.has(id)) g.mediumSeen.set(id, new Map());
    g.mediumSeen.get(id).set(executed, isWolf(room, executed));
  }
}

function checkWinner(room) {
  const alive = [...room.game.alive];
  const wolves = alive.filter((id) => isWolf(room, id)).length;
  if (wolves === 0) return 'village';
  if (wolves >= alive.length - wolves) return 'werewolves';
  return null;
}

function endGame(room, winner, hooks) {
  const g = room.game;
  clearTimeout(g.timer);
  g.phase = 'ended';
  g.phaseId++;
  g.winner = winner;
  room.status = 'ended';
  hooks.ended(room);
  hooks.changed(room);
}
