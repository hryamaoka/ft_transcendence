import { useEffect } from 'react';
import { useI18n } from '../i18n.jsx';
import { playSfx } from '../music.js';
import Avatar from './Avatar.jsx';

const STEP = 0.5; // seconds between revealed votes

// The dead player's last words, shown under the news of their death.
function Will({ text, delay }) {
  const { t } = useI18n();
  return (
    <p className="pop-in whitespace-pre-wrap break-words rounded-lg bg-slate-950/60 px-4 py-3 text-base italic text-slate-200" style={{ animationDelay: `${delay}s` }}>
      {t('overlay.will', { will: text })}
    </p>
  );
}

// Full-screen scene for a game event: vote result + execution, morning, or game over.
export default function Announcement({ event, nameOf, playerOf, onClose }) {
  const { t } = useI18n();
  const votes = event.votes ?? [];
  const reveal = votes.length * STEP + 0.6; // when the verdict appears
  const tie = event.type === 'tie';
  const duration = (event.kind === 'vote' ? reveal * 1000 + (tie ? 6000 : 3500) : 4000) + (event.will ? 3000 : 0);

  useEffect(() => {
    // the tie sting plays when the face-off appears
    const sting = tie && setTimeout(() => playSfx('tie'), reveal * 1000);
    if (!tie) playSfx({ vote: 'execute', morning: event.type === 'killed' ? 'death' : 'morning', ended: 'win' }[event.kind]);
    const id = setTimeout(onClose, duration);
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(id);
      clearTimeout(sting);
      window.removeEventListener('keydown', onKey);
    };
  }, [event]); // eslint-disable-line react-hooks/exhaustive-deps

  const tally = [...votes.reduce((m, v) => m.set(v.to, (m.get(v.to) || 0) + 1), new Map())].sort((a, b) => b[1] - a[1]);
  const max = tally[0]?.[1] ?? 1;

  const bg = {
    vote: tie ? 'bg-gradient-to-b from-amber-950 via-slate-950 to-amber-950' : 'bg-gradient-to-b from-red-950 to-slate-950',
    morning: event.type === 'killed' ? 'bg-gradient-to-b from-rose-900 to-slate-950' : 'bg-gradient-to-b from-amber-700 to-sky-950',
    ended: 'bg-gradient-to-b from-indigo-900 to-slate-950',
  }[event.kind];

  return (
    <div role="dialog" aria-modal="true" aria-live="assertive" onClick={onClose}
      className={`fade-in fixed inset-0 z-50 flex cursor-pointer items-center justify-center p-4 ${bg}`}>
      <div className="w-full max-w-md space-y-5 text-center">
        {event.kind === 'vote' && (
          <>
            <h2 className="pop-in text-3xl font-bold tracking-widest">
              ⚖️ {t(event.round === 'runoff' ? 'overlay.runoffResult' : 'overlay.voteResult')}
            </h2>
            {votes.length > 0 && (
              <ul className="space-y-1 text-lg">
                {votes.map((v, i) => (
                  <li key={v.from} className="pop-in" style={{ animationDelay: `${0.4 + i * STEP}s` }}>
                    {nameOf(v.from)} <span className="text-red-400">→</span> <b>{nameOf(v.to)}</b>
                  </li>
                ))}
              </ul>
            )}
            {tally.length > 0 && (
              <div className="space-y-1 text-left text-sm">
                {tally.map(([id, n]) => (
                  <div key={id} className="pop-in flex items-center gap-2" style={{ animationDelay: `${reveal - 0.4}s` }}>
                    <span className="w-24 truncate">{nameOf(id)}</span>
                    <span className="h-3 flex-1 rounded bg-slate-800">
                      <span className="grow block h-3 rounded bg-red-500" style={{ width: `${(n / max) * 100}%`, animationDelay: `${reveal - 0.4}s` }} />
                    </span>
                    <span className="w-10 text-right">{t('overlay.votes', { n })}</span>
                  </div>
                ))}
              </div>
            )}
            <p className={`slam text-2xl font-bold ${event.type === 'tie' ? 'text-amber-300' : 'text-red-300'}`} style={{ animationDelay: `${reveal}s` }}>
              {{
                executed: `⚰️ ${t('overlay.executed', { name: event.name })}`,
                tie: `⚡ ${t('overlay.tie')} ⚡`,
                runoffTie: t('overlay.runoffTie'),
              }[event.type] ?? t('overlay.noVote')}
            </p>
            {event.will && <Will text={event.will} delay={reveal + 0.8} />}
            {tie && event.candidates && (
              // face-off between the tied players
              <div className="flex items-center justify-center gap-3">
                {event.candidates.map((id, i) => (
                  <div key={id} className="contents">
                    {i > 0 && (
                      <span className="slam text-4xl font-black text-amber-400" style={{ animationDelay: `${reveal + 0.9}s` }}>VS</span>
                    )}
                    <div className="pop-in flex w-32 flex-col items-center gap-2 rounded-xl border-2 border-amber-400 bg-slate-900/80 p-3 shadow-[0_0_24px_rgba(251,191,36,0.45)]"
                      style={{ animationDelay: `${reveal + 0.5 + i * 0.3}s` }}>
                      <Avatar src={playerOf(id)?.avatar} bot={playerOf(id)?.bot} size={24} />
                      <span className="w-full truncate text-sm font-semibold">{nameOf(id)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {tie && (
              <p className="pop-in text-sm text-amber-200" style={{ animationDelay: `${reveal + 1.6}s` }}>{t('phase.runoff.hint')}</p>
            )}
          </>
        )}
        {event.kind === 'morning' && (
          <>
            <p className="pop-in text-6xl">{event.type === 'killed' ? '🩸' : '🌅'}</p>
            <h2 className="pop-in text-3xl font-bold" style={{ animationDelay: '0.3s' }}>{t('overlay.morning')}</h2>
            <p className="slam text-xl" style={{ animationDelay: '1s' }}>
              {event.type === 'killed' ? t('overlay.killed', { name: event.name })
                : event.type === 'firstNight' ? t('overlay.firstNight') : t('overlay.peaceful')}
            </p>
            {event.will && <Will text={event.will} delay={1.8} />}
          </>
        )}
        {event.kind === 'ended' && (
          <>
            <p className="pop-in text-7xl">{event.winner === 'village' ? '🧑‍🌾' : '🐺'}</p>
            <h2 className="slam text-3xl font-bold" style={{ animationDelay: '0.4s' }}>
              {event.winner === 'village' ? t('room.villageWins') : t('room.wolvesWins')}
            </h2>
          </>
        )}
        <p className="pop-in text-xs text-slate-400" style={{ animationDelay: '1.5s' }}>{t('overlay.tapToClose')}</p>
      </div>
    </div>
  );
}
