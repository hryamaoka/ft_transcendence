import { useI18n } from '../i18n.jsx';

// After the game: what happened in secret each night, and every ballot (even with hidden votes).
export default function Recap({ recap, nameOf }) {
  const { t } = useI18n();
  const days = [...new Set([...recap.nights.map((n) => n.day), ...recap.ballots.map((b) => b.day)])].sort((a, b) => a - b);
  const result = (werewolf) => t(werewolf ? 'room.isWolf' : 'room.notWolf');

  return (
    <section>
      <h2 className="mb-2 font-semibold">📜 {t('room.recap')}</h2>
      <ol className="space-y-3 rounded-xl bg-slate-900 p-3 text-sm text-slate-300">
        {days.map((day) => {
          const night = recap.nights.find((n) => n.day === day);
          const rounds = ['vote', 'runoff'].map((round) => recap.ballots.filter((b) => b.day === day && b.round === round)).filter((r) => r.length);
          return (
            <li key={day} className="space-y-2">
              {night && (
                <div>
                  <h3 className="font-semibold text-indigo-300">🌙 {t('room.recapNight', { day })}</h3>
                  <ul className="ml-4 space-y-0.5">
                    {night.attack === null
                      ? <li>{t('room.recapQuiet')}</li>
                      : <li>{t('room.recapAttack', { target: nameOf(night.attack) })}</li>}
                    {night.guard && (
                      <li>{t(night.killed === null ? 'room.recapSaved' : 'room.recapGuard', { by: nameOf(night.guard.by), target: nameOf(night.guard.target) })}</li>
                    )}
                    {night.inspect.map((i) => (
                      <li key={i.by}>{t('room.recapInspect', { by: nameOf(i.by), target: nameOf(i.target), result: result(i.werewolf) })}</li>
                    ))}
                  </ul>
                </div>
              )}
              {rounds.map((ballots) => (
                <div key={ballots[0].round}>
                  <h3 className="font-semibold text-amber-300">
                    {ballots[0].round === 'runoff' ? '⚖️' : '🗳️'} {t('room.recapDay', { day })}
                  </h3>
                  <ul className="ml-4 space-y-0.5 text-xs text-slate-400">
                    {ballots.map((b) => <li key={b.from}>{nameOf(b.from)} → {nameOf(b.to)}</li>)}
                  </ul>
                </div>
              ))}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
