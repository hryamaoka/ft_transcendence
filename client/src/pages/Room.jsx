import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useI18n } from '../i18n.jsx';
import { playSfx, playTheme, stopMusic, toggleMusic } from '../music.js';
import Announcement from '../components/Announcement.jsx';
import Avatar from '../components/Avatar.jsx';
import Chat from '../components/Chat.jsx';
import InviteFriends from '../components/InviteFriends.jsx';
import Recap from '../components/Recap.jsx';
import RoleCard from '../components/RoleCard.jsx';
import RoomQr from '../components/RoomQr.jsx';
import RoomSettings from '../components/RoomSettings.jsx';
import WillEditor from '../components/WillEditor.jsx';

const PHASE_ICON = { night: '🌙', day: '☀️', vote: '🗳️', runoff: '⚖️', ended: '🏁' };
const ROLE_ICON = { werewolf: '🐺', villager: '🧑‍🌾', seer: '🔮', knight: '🛡️', medium: '🕯️' };
// the countdown turns red, and ticks for whoever still has to choose
const URGENT_SECONDS = 5;
// names are listed under the progress count only when this few are left
const LIST_WAITING = 5;

function useCountdown(state) {
  const [endAt, setEndAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  // the server sends time remaining, so client clock skew doesn't matter
  useEffect(() => setEndAt(Date.now() + (state?.game?.remaining ?? 0)), [state]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);
  return Math.max(0, Math.ceil((endAt - now) / 1000));
}

// Which chat channel I can write to; mirrors the server's rule.
function myChannel(state, me, userId) {
  const phase = state.game?.phase;
  if (!phase || phase === 'ended') return 'all';
  if (!state.players.find((p) => p.id === userId)?.alive) return 'dead';
  if (phase === 'night') return me?.role === 'werewolf' ? 'wolves' : null;
  return 'all';
}

// A badge with a secret result about a player: seer (is) or medium (was).
function ResultBadge({ icon, werewolf, label }) {
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold text-white ${werewolf ? 'bg-red-600' : 'bg-emerald-600'}`}>
      {icon} {label}
    </span>
  );
}

// A fresh page per visit: an invite to another room doesn't carry this one's state over, and
// following an invite to the room already on screen (say, after "already started") joins again.
export default function RoomPage(props) {
  const { code } = useParams();
  const { key } = useLocation();
  return <Room key={`${code}:${key}`} code={code} {...props} />;
}

function Room({ user, code }) {
  const { t, tError } = useI18n();
  const socketRef = useRef(null);
  const [state, setState] = useState(null);
  const [me, setMe] = useState(null);
  const [chat, setChat] = useState([]);
  const [error, setError] = useState('');
  const [fatal, setFatal] = useState('');
  const [copied, setCopied] = useState(false);
  const [muted, setMuted] = useState(true);
  const [peek, setPeek] = useState(false);
  const left = useCountdown(state);
  // announcements for new events; the first state after joining doesn't replay old ones
  const [scenes, setScenes] = useState([]);
  const seenLog = useRef(null);
  const lastTurn = useRef(null);

  useEffect(() => {
    const socket = io();
    socketRef.current = socket;
    // (re)join on every connect so a dropped phone gets its seat, role and chat back
    socket.on('connect', () => {
      socket.emit('room:join', { code }, (res) => {
        if (res.error) return setFatal(res.error);
        setError('');
        setState(res.state);
        setMe(res.me);
        setChat(res.chat);
      });
    });
    // a rejected login (expired session) is not retried by the client, so don't promise a reconnect
    socket.on('connect_error', (err) => (socket.active ? setError('reconnecting') : setFatal(err.message === 'unauthorized' ? 'unauthorized' : 'generic')));
    socket.on('disconnect', () => setError('reconnecting'));
    socket.on('room:state', setState);
    socket.on('room:me', setMe);
    socket.on('room:kicked', () => setFatal('kicked'));
    socket.on('chat:clear', () => setChat([]));
    socket.on('chat:history', setChat);
    socket.on('chat:message', (m) => setChat((c) => [...c.slice(-199), m]));
    socket.on('chat:delta', ({ id, delta }) =>
      setChat((c) => c.map((m) => (m.id === id ? { ...m, text: m.text + delta } : m))));
    socket.on('chat:done', ({ id, text }) =>
      setChat((c) => c.map((m) => (m.id === id ? { ...m, text, streaming: false } : m))));
    return () => {
      socket.disconnect();
      stopMusic();
    };
  }, [code]);

  const phase = state?.game?.phase ?? 'lobby';
  const alive = state?.players.find((p) => p.id === user.id)?.alive;
  const showSecrets = peek || phase === 'ended';
  const mustChoose = Boolean(me?.canAct && me.choice === null);
  const urgent = phase !== 'lobby' && phase !== 'ended' && left > 0 && left <= URGENT_SECONDS;
  useEffect(() => playTheme(phase), [phase]);

  // A buzz when a new phase begins (silent where vibration isn't supported). By day and in the
  // vote, for those who have to act, which is public. At night only some roles act, so a buzz on
  // their phones alone would tell the table who they are: every living player buzzes instead.
  useEffect(() => {
    if (!me) {
      lastTurn.current = null;
      return;
    }
    // no two phases in a row are the same, so the phase alone marks a new one
    const turn = me.phase;
    const buzz = me.phase === 'night' ? Boolean(alive) : me.canAct;
    // Chrome refuses (and logs an error) until the page has been tapped; that says nothing about roles
    if (lastTurn.current !== null && lastTurn.current !== turn && buzz && navigator.userActivation?.hasBeenActive !== false) navigator.vibrate?.(200);
    lastTurn.current = turn;
  }, [me, alive]);

  // Last seconds: a tick each second for whoever has not chosen yet, or at night for everyone
  // alive. At night a choice must not change it either: an extra tick off the beat would give
  // the chooser away.
  const ticking = urgent && (phase === 'night' ? Boolean(alive) : mustChoose);
  useEffect(() => {
    if (ticking) playSfx('tick');
  }, [left, ticking]);

  useEffect(() => {
    const g = state?.game;
    if (!g) {
      // before the join answers (no state yet) it stays null, so a game already under way isn't replayed
      if (state) seenLog.current = 0;
      return;
    }
    // a shorter log than before means a new game began while this phone was away
    const from = seenLog.current > g.log.length ? 0 : seenLog.current;
    seenLog.current = g.log.length;
    if (from === null) return;
    const fresh = g.log.slice(from).map((e) => (e.round
      ? { kind: 'vote', ...e, votes: g.votes.filter((v) => v.day === e.day && v.round === e.round), candidates: e.type === 'tie' ? g.runoff : undefined }
      : { kind: 'morning', ...e }));
    if (g.phase === 'ended' && from < g.log.length) fresh.push({ kind: 'ended', winner: g.winner });
    if (fresh.length) setScenes((q) => [...q, ...fresh]);
  }, [state]);

  const emit = (event, payload = {}) => new Promise((resolve) => {
    // while offline, socket.io would buffer this and send it before the rejoin, as "not in room"
    if (!socketRef.current.connected) {
      setError('reconnecting');
      return resolve(false);
    }
    socketRef.current.emit(event, payload, (res) => {
      setError(res.error || '');
      resolve(!res.error);
    });
  });

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked: the URL is still in the address bar */ }
  };

  if (fatal) return (
    <div className="mt-10 space-y-4 text-center">
      <p className="text-red-400">{tError(fatal)}</p>
      <Link to="/" className="text-indigo-300 underline">{t('nav.play')}</Link>
    </div>
  );
  if (!state) return <p className="mt-10 text-center text-slate-400">{t('room.joining')}</p>;

  const { game } = state;
  const isHost = state.hostId === user.id;
  const playerOf = (id) => state.players.find((p) => p.id === id);
  const nameOf = (id) => playerOf(id)?.name ?? '?';
  const seen = new Map(me?.seen.map((s) => [s.id, s.werewolf]));
  const mediumSeen = new Map(me?.mediumSeen?.map((s) => [s.id, s.werewolf]));
  const iAmAlive = playerOf(user.id)?.alive;
  const pickable = (id) => me?.canAct && phase !== 'day' && me.targets.includes(id);
  const channel = myChannel(state, me, user.id);
  const hasBots = state.players.some((p) => p.bot);
  const verb = me && t(`roles.${me.role}.verb`);
  // who the day or the vote is still waiting for; the same rule as the server's, all public
  const waitable = phase === 'day' || phase === 'vote' || phase === 'runoff'
    ? state.players.filter((p) => p.alive && !p.away && (phase !== 'day' || !p.bot)) : [];
  const waiting = waitable.filter((p) => !game.acted.includes(p.id));

  return (
    <div className={`theme-shell ${['theme-classic', 'theme-moon', 'theme-snow'][state.settings.theme ?? 0]} mt-4 grid gap-6 rounded-2xl p-2 md:grid-cols-[1fr_20rem]`}>
      {scenes[0] && <Announcement key={JSON.stringify(scenes[0])} event={scenes[0]} nameOf={nameOf} playerOf={playerOf} onClose={() => setScenes((q) => q.slice(1))} />}
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-bold">{t('room.title', { code: '' })}<span className="font-mono">{state.code}</span></h1>
          <div className="flex gap-2">
            <button onClick={() => setMuted(toggleMusic(phase))} aria-label={t('room.music')} aria-pressed={!muted}
              className="rounded bg-slate-700 px-3 py-1 text-sm hover:bg-slate-600">{muted ? '🔇' : '🔊'}</button>
            {state.status === 'lobby' && (
              <>
                <RoomQr />
                <button onClick={copyLink} className="rounded bg-slate-700 px-3 py-1 text-sm hover:bg-slate-600">
                  {copied ? t('room.copied') : t('room.copy')}
                </button>
              </>
            )}
          </div>
        </div>

        {game && (
          <div className="rounded-xl bg-slate-900 p-4 text-center" aria-live="polite">
            <p className="text-2xl font-bold">{PHASE_ICON[phase]} {t(`phase.${phase}.title`, { day: game.day })}</p>
            {phase !== 'ended' && (
              <p className="text-slate-400">
                {t(`phase.${phase}.hint`)} · <span aria-live="off" className={urgent ? 'animate-pulse font-bold text-red-400' : ''}>{t('phase.seconds', { n: left })}</span>
              </p>
            )}
            {game.winner && <p className="mt-2 text-xl">{game.winner === 'village' ? `🧑‍🌾 ${t('room.villageWins')}` : `🐺 ${t('room.wolvesWins')}`}</p>}
            {me?.canAct && phase === 'night' && <p className="mt-2 text-amber-300">{t('room.chooseNight', { verb })}</p>}
            {me?.canAct && phase === 'night' && me.choice !== null && <p className="mt-1 text-sm text-slate-300">{t('room.dawn')}</p>}
            {me?.canAct && phase === 'night' && me.lastGuard !== null && me.lastGuard !== undefined && (
              <p className="mt-1 text-sm text-slate-400">{t('room.noRepeatGuard', { name: nameOf(me.lastGuard) })}</p>
            )}
            {me?.canAct && phase === 'vote' && <p className="mt-2 text-amber-300">{t('room.chooseVote')}</p>}
            {phase === 'runoff' && game.runoff && (
              <p className="mt-2 text-amber-300">
                {me?.canAct && `${t('room.chooseRunoff')} `}{t('overlay.candidates', { names: game.runoff.map(nameOf).join(', ') })}
              </p>
            )}
            {waitable.length > 0 && (
              <p className="mt-2 text-sm text-slate-400">
                {t(phase === 'day' ? 'room.progressDay' : 'room.progressVote', { n: waitable.length - waiting.length, total: waitable.length })}
                {waiting.length > 0 && waiting.length <= LIST_WAITING && ` · ${t('room.waitingFor', { names: waiting.map((p) => p.name).join(', ') })}`}
              </p>
            )}
          </div>
        )}

        {me && phase !== 'ended' && <RoleCard role={me.role} allies={me.allies.map(nameOf)} dead={!iAmAlive} onPeek={setPeek} />}
        {me && iAmAlive && phase !== 'ended' && <WillEditor will={me.will ?? ''} onSave={(text) => emit('game:will', { text })} />}

        <section>
          <h2 className="mb-2 font-semibold">{t('room.players', { n: state.players.length })}</h2>
          <ul className="divide-y divide-slate-800 rounded-xl bg-slate-900">
            {state.players.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <span className={`flex min-w-0 flex-wrap items-center gap-2 ${p.connected ? '' : 'opacity-50'}`}>
                  <Avatar src={p.avatar} bot={p.bot} />
                  <span className={`truncate ${p.alive ? '' : 'text-slate-500 line-through'}`}>
                    {p.bot ? p.name : <Link to={`/u/${p.name}`} className="hover:underline">{p.name}</Link>}
                    {p.id === state.hostId && ' 👑'}{p.id === user.id && ` (${t('room.you')})`}
                    {showSecrets && me?.allies.includes(p.id) && ' 🐺'}
                  </span>
                  {/* fellow werewolves' picks, hidden like the other secrets until the card is held */}
                  {showSecrets && me?.allyChoices?.some((c) => c.target === p.id) && (
                    <span className="shrink-0 rounded-full bg-red-900 px-2 py-0.5 text-xs text-red-200">
                      {t('room.allyPick', { names: me.allyChoices.filter((c) => c.target === p.id).map((c) => nameOf(c.id)).join(', ') })}
                    </span>
                  )}
                  {/* seer and medium results stay hidden unless the role card is held, so a neighbour cannot read them */}
                  {showSecrets && seen.has(p.id) && (
                    <ResultBadge icon="🔮" werewolf={seen.get(p.id)} label={t(seen.get(p.id) ? 'room.isWolf' : 'room.notWolf')} />
                  )}
                  {showSecrets && mediumSeen.has(p.id) && (
                    <ResultBadge icon="🕯️" werewolf={mediumSeen.get(p.id)} label={t(mediumSeen.get(p.id) ? 'room.wasWolf' : 'room.wasNotWolf')} />
                  )}
                  {game?.roles && (
                    <span className="shrink-0 text-sm text-slate-400">{ROLE_ICON[game.roles[p.id]]} {t(`roles.${game.roles[p.id]}.name`)}</span>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {game?.acted.includes(p.id) && <span className="text-xs text-emerald-400" aria-label={t('room.ready')}>✓</span>}
                  {!p.connected && <span className="text-xs text-slate-500">{t(p.away ? 'room.away' : 'room.offline')}</span>}
                  {pickable(p.id) && (
                    <button onClick={() => emit('game:action', { target: p.id, phase })} aria-pressed={me.choice === p.id}
                      className={`rounded px-3 py-1 text-sm capitalize ${me.choice === p.id ? 'bg-amber-500 text-black' : 'bg-slate-700 hover:bg-slate-600'}`}>
                      {phase === 'vote' || phase === 'runoff' ? t('room.vote') : verb}
                    </button>
                  )}
                  {isHost && state.status === 'lobby' && p.id !== user.id && (
                    <button onClick={() => emit(p.bot ? 'room:removeBot' : 'room:kick', { id: p.id })} className="text-xs text-slate-400 hover:text-white">
                      {t('room.remove')}
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {phase === 'day' && me?.canAct && (
          <button onClick={() => emit('game:action', { phase: 'day' })} disabled={Boolean(me.choice)}
            className="w-full rounded bg-amber-600 py-3 font-semibold hover:bg-amber-500 disabled:opacity-40">
            {me.choice ? t('room.waitOthers') : t('room.ready')}
          </button>
        )}

        {state.status === 'lobby' && (
          <>
            <RoomSettings state={state} isHost={isHost} onChange={(patch) => emit('room:settings', patch)} />
            <InviteFriends inRoom={state.players.map((p) => p.id)} onInvite={(userId) => emit('room:invite', { userId })} />
            {isHost ? (
              <div className="space-y-2">
                <button onClick={() => emit('room:addBot')} disabled={state.players.length >= state.limits.maxPlayers}
                  className="w-full rounded bg-slate-700 py-2 hover:bg-slate-600 disabled:opacity-40">{t('room.addBot')}</button>
                <button onClick={() => emit('room:start')} disabled={state.players.length < state.limits.minPlayers}
                  className="w-full rounded bg-emerald-600 py-3 font-semibold hover:bg-emerald-500 disabled:opacity-40">
                  {t('room.start', { n: state.players.length, min: state.limits.minPlayers })}
                </button>
              </div>
            ) : (
              <p className="text-center text-slate-400">{t('room.waiting')}</p>
            )}
          </>
        )}

        {phase === 'ended' && isHost && (
          <button onClick={() => emit('room:reset')} className="w-full rounded bg-indigo-600 py-3 font-semibold hover:bg-indigo-500">
            {t('room.back')}
          </button>
        )}

        {error && <p className="text-center text-sm text-red-400" role="alert">{error === 'reconnecting' ? t('room.reconnecting') : tError(error)}</p>}

        {game?.recap && <Recap recap={game.recap} nameOf={nameOf} />}

        {game?.claims.length > 0 && (
          <section>
            <h2 className="mb-2 font-semibold">🔮 {t('room.claimed')}</h2>
            <ul className="space-y-1 text-sm text-slate-300">
              {game.claims.map((c, i) => (
                <li key={i}>{t('room.claim', { by: nameOf(c.by), target: nameOf(c.target), result: t(c.werewolf ? 'room.isWolf' : 'room.notWolf') })}</li>
              ))}
            </ul>
          </section>
        )}

        {game?.mediumClaims?.length > 0 && (
          <section>
            <h2 className="mb-2 font-semibold">🕯️ {t('room.mediumClaimed')}</h2>
            <ul className="space-y-1 text-sm text-slate-300">
              {game.mediumClaims.map((c, i) => (
                <li key={i}>{t('room.mediumClaim', { by: nameOf(c.by), target: nameOf(c.target), result: t(c.werewolf ? 'room.wasWolf' : 'room.wasNotWolf') })}</li>
              ))}
            </ul>
          </section>
        )}

        {game?.log.length > 0 && (
          <section>
            <h2 className="mb-2 font-semibold">{t('room.history')}</h2>
            <ul className="space-y-1 text-sm text-slate-300">
              {game.log.map((e, i) => {
                const votes = e.round ? game.votes.filter((v) => v.day === e.day && v.round === e.round) : [];
                return (
                  <li key={i}>
                    {t(`log.${e.type}`, e)}
                    {e.will && <p className="ml-4 whitespace-pre-wrap break-words text-xs italic text-slate-400">{t('log.will', { name: e.name, will: e.will })}</p>}
                    {votes.length > 0 && (
                      <ul className="ml-4 mt-1 text-xs text-slate-400" aria-label={t('room.votes')}>
                        {votes.map((v) => <li key={`${v.round}-${v.from}`}>{nameOf(v.from)} → {nameOf(v.to)}</li>)}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>

      <Chat
        messages={chat}
        channel={channel}
        canTalk={Boolean(channel)}
        notice={state.llm && hasBots}
        onSend={(text) => emit('chat:send', { text })}
      />
    </div>
  );
}
