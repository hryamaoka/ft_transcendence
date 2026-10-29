import { pick } from './game.js';

// Canned bot lines, used when no LLM is configured or it fails.
const LINES = {
  en: {
    claimWolf: (t) => `I'm the seer. ${t} is a werewolf!`,
    claimClear: (t) => `I'm the seer. ${t} is not a werewolf.`,
    mediumWolf: (t) => `I'm the medium. ${t} was a werewolf.`,
    mediumClear: (t) => `I'm the medium. ${t} was not a werewolf.`,
    chatter: ['Hmm, who could it be…', 'I am just a humble villager.', 'Someone is being too quiet.', 'Let\'s think carefully before voting.', 'I have a bad feeling about this.'],
    reply: ['Interesting…', 'I\'m not so sure about that.', 'Why do you say that?', 'That sounds suspicious to me.', 'I agree, let\'s keep an eye on them.'],
    lobby: ['Hello!', 'Ready when you are.', 'Good luck, everyone!'],
    replyVote: ['Agreed, let\'s do that.', 'Fine by me, but let\'s be careful.', 'Hmm, I\'m not sure that\'s the right vote.'],
    replyQuestion: ['Hard to say yet…', 'I don\'t know, what do you think?', 'I have a hunch, but no proof.'],
    declareVote: [(t) => `I'm voting for ${t}.`, (t) => `My vote goes to ${t}.`, (t) => `${t} seems the most suspicious. I vote ${t}.`],
    wolfPlan: [(t) => `Let's attack ${t} tonight.`, (t) => `I pick ${t}.`],
    wolfAgree: [(t) => `OK, ${t} it is.`, (t) => `Agreed, let's go for ${t}.`],
    defend: ['What? I am not a werewolf!', 'That is a lie. The real werewolf is trying to frame me.', 'Wrong. I am just a villager, I swear.'],
    counter: ['Two seers? One of them is lying.', 'Now we have two seers… one must be a werewolf.', 'Interesting, a counter-claim. Who do we believe?'],
    reactClaim: ['Thanks for the info, seer.', 'Can we trust that claim?', 'OK, let\'s keep that in mind.'],
    idle: ['It\'s too quiet. Anyone have a suspect?', 'Let\'s talk: who seems suspicious?', 'Nobody is saying anything… that is suspicious.'],
  },
  ja: {
    claimWolf: (t) => `占い師です。${t}さんは人狼でした！`,
    claimClear: (t) => `占い師です。${t}さんは人狼ではありませんでした。`,
    mediumWolf: (t) => `霊媒師です。${t}さんは人狼でした。`,
    mediumClear: (t) => `霊媒師です。${t}さんは人狼ではありませんでした。`,
    chatter: ['うーん、誰が怪しいかな…', '私はただの村人です。', '静かすぎる人がいますね。', '投票の前によく考えましょう。', '嫌な予感がします。'],
    reply: ['なるほど…', 'それはどうでしょう。', 'どうしてそう思うんですか？', 'それは怪しいですね。', '同感です、注目しておきましょう。'],
    lobby: ['よろしくお願いします！', 'いつでもどうぞ。', 'みなさん頑張りましょう！'],
    replyVote: ['賛成です、そうしましょう。', 'いいと思いますが、慎重にいきましょう。', 'うーん、その投票で本当にいいのかな。'],
    replyQuestion: ['まだ何とも言えませんね…', '分からないです。あなたはどう思いますか？', '気になる人はいますが、証拠がないです。'],
    declareVote: [(t) => `私は${t}さんに投票します。`, (t) => `${t}さんが一番怪しいので、${t}さんに入れます。`, (t) => `今回は${t}さんに投票します。`],
    wolfPlan: [(t) => `今夜は${t}さんを襲いましょう。`, (t) => `${t}さんを狙います。`],
    wolfAgree: [(t) => `了解、${t}さんにしましょう。`, (t) => `賛成です。${t}さんでいきましょう。`],
    defend: ['えっ、私は人狼じゃありません！', 'それは嘘です。本物の人狼が私をはめようとしています。', '違います、私はただの村人です。'],
    counter: ['占い師が2人…？どちらかが嘘をついていますね。', '占い師が2人出ました。片方は人狼かもしれません。', '対抗COですか。どっちを信じればいいんだろう。'],
    reactClaim: ['占い師さん、情報ありがとうございます。', 'そのCO、信じていいんでしょうか。', 'なるほど、覚えておきます。'],
    idle: ['静かですね。誰か怪しい人はいますか？', '話し合いましょう。誰が怪しいと思いますか？', 'みんな黙っていますね…それも怪しい。'],
  },
  fr: {
    claimWolf: (t) => `Je suis la voyante. ${t} est un loup-garou !`,
    claimClear: (t) => `Je suis la voyante. ${t} n'est pas un loup-garou.`,
    mediumWolf: (t) => `Je suis le médium. ${t} était un loup-garou.`,
    mediumClear: (t) => `Je suis le médium. ${t} n'était pas un loup-garou.`,
    chatter: ['Hmm, qui cela peut-il être…', 'Je ne suis qu\'un simple villageois.', 'Quelqu\'un est bien silencieux.', 'Réfléchissons avant de voter.', 'J\'ai un mauvais pressentiment.'],
    reply: ['Intéressant…', 'Je n\'en suis pas si sûr.', 'Pourquoi dis-tu ça ?', 'Ça me paraît suspect.', 'D\'accord, surveillons-le.'],
    lobby: ['Bonjour !', 'Prêt quand vous voulez.', 'Bonne chance à tous !'],
    replyVote: ['D\'accord, faisons ça.', 'Ça me va, mais prudence.', 'Hmm, je ne suis pas sûr que ce soit le bon vote.'],
    replyQuestion: ['Difficile à dire pour l\'instant…', 'Je ne sais pas, et toi ?', 'J\'ai une intuition, mais pas de preuve.'],
    declareVote: [(t) => `Je vote contre ${t}.`, (t) => `Mon vote va à ${t}.`, (t) => `${t} est le plus suspect. Je vote ${t}.`],
    wolfPlan: [(t) => `Attaquons ${t} cette nuit.`, (t) => `Je choisis ${t}.`],
    wolfAgree: [(t) => `D'accord, va pour ${t}.`, (t) => `Entendu, on attaque ${t}.`],
    defend: ['Quoi ? Je ne suis pas un loup-garou !', 'C\'est un mensonge, le vrai loup veut me piéger.', 'Faux, je ne suis qu\'un villageois.'],
    counter: ['Deux voyantes ? L\'une des deux ment.', 'Deux voyantes… l\'une est sûrement un loup.', 'Une contre-annonce ! Qui croire ?'],
    reactClaim: ['Merci pour l\'info, voyante.', 'Peut-on croire cette annonce ?', 'D\'accord, gardons ça en tête.'],
    idle: ['C\'est bien calme. Un suspect ?', 'Parlons : qui vous semble suspect ?', 'Personne ne dit rien… c\'est suspect.'],
  },
};

export const LANGS = Object.keys(LINES);

// A canned line; `recent` lines are avoided so bots don't repeat each other.
export const line = (lang, key, ...args) => {
  const l = (LINES[lang] ?? LINES.en)[key];
  const chosen = typeof l === 'function' ? l : pick(l);
  return typeof chosen === 'function' ? chosen(...args) : chosen;
};

export function freshLine(lang, key, recent) {
  const l = (LINES[lang] ?? LINES.en)[key];
  const options = l.filter((text) => !recent.includes(text));
  return pick(options.length ? options : l);
}

// Rough intent of a chat message, to choose a fitting canned reply.
// Latin words are whole words, so "quiet" is not "qui" and "whole" is not "who".
export function replyKey(text) {
  if (/投票|吊|\bvot(?!re\b)|exécut/i.test(text)) return 'replyVote';
  if (/[?？]|どう|誰|なぜ|\b(?:why|who|pourquoi|qui)\b/i.test(text)) return 'replyQuestion';
  return 'reply';
}

// NFKC, so the full-width "Ｂｏｔ２" a Japanese keyboard types is "bot2" too.
const norm = (s) => s.normalize('NFKC').toLowerCase();
const squash = (s) => norm(s).replace(/\s+/g, '');
const escapeRe = (c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// A name as a whole word: spaces inside it are optional ("Bot 2" or "Bot2"), and it can't be
// part of a longer word, so "Eve" is not in "believe" and "Bot 1" is not in "Bot 10".
const nameRe = (name) => new RegExp(`(?<![a-z0-9_])${[...squash(name)].map(escapeRe).join('\\s*')}(?![a-z0-9_])`, 'g');

// Players named in a text, ignoring spaces and case. Longest names go first and are cut out of
// the text. Between two names that are the same without spaces ("Bot 1" and a human "Bot1"),
// the one written exactly as it is goes first.
export function mentioned(text, players) {
  let flat = norm(text);
  const literal = (p) => (flat.includes(norm(p.name)) ? 1 : 0);
  const found = [];
  for (const p of [...players].sort((a, b) => squash(b.name).length - squash(a.name).length || literal(b) - literal(a))) {
    const re = nameRe(p.name);
    if (!re.test(flat)) continue;
    found.push(p);
    flat = flat.replace(re, ' ');
  }
  return found;
}

// Recognises a seer or medium claim in a chat message, e.g. "I'm the seer, Bot 2 is a werewolf"
// or "霊媒師です。Bot2は人狼ではありませんでした". Returns { kind, target, werewolf } or null.
// The speaker must claim the role ("I'm the seer", "占いCO", "je suis le médium"):
// "Bot 2, are you the seer?", "Bot 2は占い師ですか" or "私は占い師じゃない" only mention it, and
// "Bot 1's seer claim" or "Bot 1さんの占い結果" talk about somebody else's.
// "not" is a whole word so "nothing" and "another" do not flip the result.
// Both apostrophes, because phone keyboards type ’.
const NOT_THE_ROLE = '(?:では|じゃ|ですか|でしたか|でしょうか|なら|だったら)';
const SEER_CLAIM = new RegExp([
  "\\bI(?:['’]m| am)\\s+(?:(?:the|a|really|actually|real)\\s+)*seer\\b",
  '\\bseer\\s+(?:here|co)\\b',
  '\\bas\\s+(?:the\\s+)?seer\\b',
  '占い(?:師)?(?:です(?!か)|でした(?!か)|(?:CO|ＣＯ)(?!の|お願い|して|どうぞ|ください))',
  `(?:私|僕|俺|わたし|ぼく|おれ|自分)(?:が|は)(?:本物の|真の)?占い(?!師?${NOT_THE_ROLE})`,
  '(?<!の)占い結果|占った(?:結果|ら(?!どう)|ところ)',
  '\\bje\\s+suis\\s+(?:(?:la|le|vraiment|vraie|vrai)\\s+)*voyante?\\b',
  '\\ben\\s+tant\\s+que\\s+voyante?\\b',
].join('|'), 'i');
const MEDIUM_CLAIM = new RegExp([
  "\\bI(?:['’]m| am)\\s+(?:(?:the|a|really|actually|real)\\s+)*medium\\b",
  '\\bmedium\\s+(?:here|co)\\b',
  '\\bas\\s+(?:the\\s+)?medium\\b',
  '霊(?:媒|能)(?:師|者)?(?:です(?!か)|でした(?!か)|(?:CO|ＣＯ)(?!の|お願い|して|どうぞ|ください))',
  `(?:私|僕|俺|わたし|ぼく|おれ|自分)(?:が|は)(?:本物の|真の)?霊(?:媒|能)(?![師者]?${NOT_THE_ROLE})`,
  '(?<!の)霊(?:媒|能)結果',
  '\\bje\\s+suis\\s+(?:(?:la|le|vraiment|vraie|vrai)\\s+)*m[ée]dium\\b',
  '\\ben\\s+tant\\s+que\\s+m[ée]dium\\b',
].join('|'), 'i');
const NOT_WOLF = /ではありません|ではない|じゃありません|じゃない|ではな|じゃな|白|シロ|市民|村人|人間|\bnot\b|\b(?:villagers?|humans?|good)\b|villageois|humain|\b(?:is|are|was)n['’]t\b|n['’](?:est|était) pas|innocent/i;
const CLAUSE = /[。.!！?？\n、,;]+/;
// a clause with the punctuation that ends it
const CHUNK = /[^。.!！?？\n、,;]+[。.!！?？\n、,;]*/g;

// The first player named in the text, and the clause that names them.
function firstNamed(text, players) {
  for (const clause of text.split(CLAUSE)) {
    const flat = norm(clause);
    const [first] = mentioned(clause, players)
      .map((p) => ({ p, at: flat.search(nameRe(p.name)) }))
      .sort((a, b) => a.at - b.at);
    if (first) return { player: first.p, clause };
  }
  return null;
}

// Where in the text the speaker claims a role, or -1. A question ("Who is the seer here?",
// "占い師ですよね？") or another player as the subject ("Bot 2 is the seer here",
// "Bot 2さんが占い師です") is not the speaker's claim.
function claimAt(text, role, others) {
  for (const m of text.matchAll(CHUNK)) {
    const hit = m[0].search(role);
    if (hit < 0 || /[?？]/.test(m[0].slice(hit))) continue;
    const before = norm(m[0].slice(0, hit));
    const subject = others.some((p) => {
      const n = nameRe(p.name).source;
      return new RegExp(`${n}\\s*(?:さん|くん|ちゃん)?\\s*(?:が|は|も)`).test(before) || new RegExp(`${n}\\s+(?:is|est|was)\\b`).test(before);
    });
    if (!subject) return m.index + hit;
  }
  return -1;
}

// `alive` (a Set of ids), when given, narrows the target: a seer names a living player, a
// medium a dead one. So "I'm the medium: Bot 3 was not a werewolf, Bot 1 lied" is about Bot 3.
// The result is read from the clause that names the target only, so "Bot 1 is a werewolf.
// Bot 3 was innocent." still says Bot 1 is a werewolf.
// The target is the first player named after the claim ("Thanks Bot 1. I'm the seer: Bot 3 is
// a werewolf" is about Bot 3), or anywhere in the text when nobody is named after it.
export function parseClaim(text, players, selfId, alive) {
  const others = players.filter((p) => p.id !== selfId);
  const at = { seer: claimAt(text, SEER_CLAIM, others), medium: claimAt(text, MEDIUM_CLAIM, others) };
  // the role the speaker claims first, then the other one if the first names nobody who fits
  const kinds = ['seer', 'medium'].filter((k) => at[k] >= 0).sort((a, b) => at[a] - at[b]);
  for (const kind of kinds) {
    const fits = (p) => p.id !== selfId && (!alive || alive.has(p.id) === (kind === 'seer'));
    const named = firstNamed(text.slice(at[kind]), players.filter(fits)) ?? firstNamed(text, players.filter(fits));
    if (named) return { kind, target: named.player.id, werewolf: !NOT_WOLF.test(named.clause) };
  }
  return null;
}

// Suspicions in a chat message, per clause: "Bot 3 is suspicious" gives +1 to Bot 3,
// "Bot 2 is not a werewolf" or "vote anyone except Bot 2" gives -1 to Bot 2.
const ACCUSE = /怪し|人狼|狼|黒|投票|吊|入れ|suspicious|suspect|wolf|vot(?:e|ing)\b|lying|liar|loup|voter|menteur|méfi/i;
// Bare "pas" is too common in French to mean "this player is innocent".
const DEFEND = /以外|ではありません|ではない|じゃありません|じゃない|ではな|じゃな|違う|白|信じ|except|\bnot\b|\b(?:is|are|was)n['’]t\b|\bdon['’]?t think\b|innocent|\btrust|sauf|n['’]est pas|pas un|pas une|confiance/i;
// Checked before DEFEND, which would read "trust" / "confiance" as a defence.
const DENY_TRUST = /\b(?:don['’]?t|do not|can['’]?t|cannot|can not|never|not|wouldn['’]?t|won['’]?t|shouldn['’]?t)\s+(?:really\s+)?trust|\b(?:un|dis|mis)trust|信じ(?:られ)?(?:ない|ません)|信用(?:でき)?(?:ない|ません)|pas confiance/i;

export function parseSuspicions(text, players, selfId) {
  const scores = new Map();
  const others = players.filter((p) => p.id !== selfId);
  for (const clause of text.split(CLAUSE)) {
    const named = mentioned(clause, others).map((p) => p.id);
    if (!named.length) continue;
    const weight = DENY_TRUST.test(clause) ? 1 : DEFEND.test(clause) ? -1 : ACCUSE.test(clause) ? 1 : 0;
    if (!weight) continue;
    for (const id of named) scores.set(id, (scores.get(id) || 0) + weight);
  }
  // one mention of a player counts once, even if their name is in two clauses
  return [...scores].flatMap(([target, weight]) => (Math.sign(weight) ? [{ target, weight: Math.sign(weight) }] : []));
}
