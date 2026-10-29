import { pick } from './game.js';

// Bot AI. A bot decides using only what a human in its seat could see:
// its own private view (role, fellow werewolves, seer and medium results) plus public
// information (who is alive, public seer and medium claims). Never the full role table.
//
// Strategy, in short:
// - Seer: inspects unknown players, then publicly claims its results by day.
// - Medium: publicly claims whether the last executed player was a werewolf.
// - Werewolf: attacks claimed seers and mediums first, sometimes fakes a seer claim to
//   frame a villager, and votes against whoever accuses a fellow werewolf.
// - Knight: protects a claimed seer or medium (never the same player two nights running).
// - Village: votes for seer claimers the medium proved wrong, then for players claimed to
//   be werewolves, then for whoever the chat suspects most, avoids those cleared or
//   defended, and (when votes are public) suspects players who voted against a claimed
//   seer or a cleared player.
// - Werewolves follow the chat's favourite suspect to blend in.
// - In the vote, each bot first announces its choice, then votes that way.
// - Everyone makes a random choice MISTAKE of the time, so bots are beatable.

const MISTAKE = 0.2;

const chance = (p) => Math.random() < p;

// Picks from the preferred list if possible, otherwise from all options.
function prefer(preferred, options) {
  const ok = preferred.filter((id) => options.includes(id));
  const pool = ok.length ? ok : options;
  return pool.length ? pick(pool) : undefined;
}

// Players whose past votes look like a werewolf's: against a claimed seer or someone cleared.
function suspiciousVoters(view) {
  const seers = new Set(view.claims.map((c) => c.by));
  const cleared = new Set(view.claims.filter((c) => !c.werewolf).map((c) => c.target));
  return view.votes.filter((v) => seers.has(v.to) || cleared.has(v.to)).map((v) => v.from);
}

const living = (view, ids) => [...new Set(ids)].filter((id) => view.alive.includes(id));
const seerClaimers = (view) => living(view, view.claims.map((c) => c.by));
// everyone with an information role on the table, as far as the public knows
const claimers = (view) => living(view, [...view.claims, ...view.mediumClaims].map((c) => c.by));

// What this bot believes about dead players: its own medium results first, then public
// medium claims (another medium claim about someone this medium checked is a lie).
function mediumFacts(view) {
  const facts = new Map(view.mediumClaims.filter((c) => c.by !== view.me).map((c) => [c.target, c.werewolf]));
  for (const s of view.mediumSeen) facts.set(s.id, s.werewolf);
  return facts;
}

// Seer claimers whose result the medium contradicted: they lied, so they are werewolves.
function caughtLying(view) {
  const facts = mediumFacts(view);
  return view.claims.filter((c) => facts.has(c.target) && facts.get(c.target) !== c.werewolf).map((c) => c.by);
}

function nightTarget(view) {
  const { role, targets } = view;
  // follow a fellow werewolf's pick so the pack agrees, else hunt claimed seers and mediums
  if (role === 'werewolf') {
    const allyPicks = view.allyChoices.map((c) => c.target);
    return prefer(allyPicks.length ? allyPicks : claimers(view), targets);
  }
  if (role === 'knight') return prefer(claimers(view), targets);
  // seer: targets already exclude players inspected before
  return pick(targets);
}

// Net public suspicion per player: +1 per "X is suspicious", -1 per "not X".
function suspicionScores(view) {
  const scores = new Map();
  for (const s of view.suspicions) if (s.by !== view.me) scores.set(s.target, (scores.get(s.target) || 0) + s.weight);
  return scores;
}

// The most suspected players, if anyone has a positive score.
function mostSuspected(view, options) {
  const scores = suspicionScores(view);
  const best = Math.max(0, ...options.map((id) => scores.get(id) || 0));
  return best > 0 ? options.filter((id) => (scores.get(id) || 0) === best) : [];
}

const trusted = (view) => [...suspicionScores(view)].filter(([, n]) => n < 0).map(([id]) => id);

function voteTarget(view, targets) {
  const { role, allies } = view;
  const known = new Map(view.seen.map((s) => [s.id, s.werewolf]));
  if (role === 'werewolf') {
    // strike back at claimers who accused one of us, else follow the crowd to blend in
    const accusers = living(view, view.claims.filter((c) => c.werewolf && allies.includes(c.target)).map((c) => c.by));
    const nonAllies = targets.filter((id) => !allies.includes(id));
    const options = nonAllies.length ? nonAllies : targets;
    return prefer(accusers.length ? accusers : mostSuspected(view, options), options);
  }
  // Only the living, and never myself: either would push the vote to a random pick.
  // Not being a werewolf, I know that whoever claimed I am one lied.
  const framers = view.claims.filter((c) => c.werewolf && c.target === view.me).map((c) => c.by);
  const liars = living(view, [...caughtLying(view), ...framers]).filter((id) => id !== view.me);
  if (role === 'seer') {
    const wolves = living(view, [...known].filter(([, w]) => w).map(([id]) => id));
    // anyone else claiming seer is lying, so they are suspicious too
    const fakes = seerClaimers(view).filter((id) => id !== view.me);
    const cleared = [...known].filter(([, w]) => !w).map(([id]) => id);
    const options = targets.filter((id) => !cleared.includes(id));
    const pool = options.length ? options : targets;
    const suspects = wolves.length ? wolves : fakes.length ? fakes : liars.length ? liars : mostSuspected(view, pool);
    return prefer(suspects.length ? suspects : suspiciousVoters(view), pool);
  }
  const accused = living(view, view.claims.filter((c) => c.werewolf).map((c) => c.target)).filter((id) => id !== view.me);
  const cleared = view.claims.filter((c) => !c.werewolf).map((c) => c.target);
  const avoid = new Set([...cleared, ...trusted(view)].filter((id) => !liars.includes(id)));
  const options = targets.filter((id) => !avoid.has(id));
  const pool = options.length ? options : targets;
  const suspects = liars.length ? liars : accused.length ? accused : mostSuspected(view, pool);
  return prefer(suspects.length ? suspects : suspiciousVoters(view), pool);
}

// Who this bot currently suspects most, for its chat (no random mistakes).
export function currentSuspect(view) {
  const others = view.alive.filter((id) => id !== view.me);
  return others.length ? voteTarget(view, others) : null;
}

export function botChoice(view) {
  if (!view.canAct) return undefined;
  if (!view.targets.length) return undefined;
  if (chance(MISTAKE)) return pick(view.targets);
  return view.phase === 'night' ? nightTarget(view) : voteTarget(view, view.targets);
}

// What a bot announces at the start of the day, or null.
// Returns { kind: 'seer' | 'medium', target, werewolf } for a public claim.
export function botClaim(view) {
  if (!view.alive.includes(view.me)) return null;
  if (view.role === 'seer') {
    const latest = view.seen.at(-1);
    return latest && view.alive.includes(latest.id) ? { kind: 'seer', target: latest.id, werewolf: latest.werewolf } : null;
  }
  if (view.role === 'medium') {
    // the latest execution, once: there is nothing new to say after a day without one
    const latest = view.mediumSeen.at(-1);
    const said = view.mediumClaims.some((c) => c.by === view.me && c.target === latest?.id);
    return latest && !said ? { kind: 'medium', target: latest.id, werewolf: latest.werewolf } : null;
  }
  // a werewolf sometimes fakes a seer claim, framing a villager
  if (view.role === 'werewolf' && chance(0.25)) {
    const victims = view.alive.filter((id) => id !== view.me && !view.allies.includes(id));
    return victims.length ? { kind: 'seer', target: pick(victims), werewolf: true } : null;
  }
  return null;
}

// Human-like delay before acting. Votes come later in the phase, so humans
// get to vote first instead of the round ending in a few seconds.
export const botDelay = (phase, phaseMs) =>
  phase === 'vote' ? phaseMs * (0.35 + Math.random() * 0.35) : 1500 + Math.random() * 3500;
