import { useI18n, LANGUAGES } from '../i18n.jsx';

const FIELDS = ['werewolves', 'seer', 'knight', 'medium', 'revealVotes', 'night', 'day', 'vote'];

export default function RoomSettings({ state, isHost, onChange }) {
  const { t } = useI18n();
  const { settings, limits } = state;
  const num = (key) => (e) => {
    const { min, max } = limits.settings[key];
    const v = Number(e.target.value);
    if (!Number.isInteger(v) || v < min || v > max) {
      e.target.value = String(settings[key]);
      return;
    }
    if (v === settings[key]) return;
    // not sent (offline) or refused: show the room's value again
    const input = e.target;
    const prev = settings[key];
    Promise.resolve(onChange({ [key]: v })).then((ok) => { if (!ok) input.value = String(prev); });
  };

  return (
    <section className="rounded-xl bg-slate-900 p-3">
      <h2 className="mb-2 font-semibold">{t('room.settings')}</h2>
      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
        {FIELDS.map((key) => {
          const { min, max } = limits.settings[key];
          const toggle = max === 1;
          return (
            <label key={key} className="flex items-center justify-between gap-2 rounded bg-slate-800 px-2 py-1">
              <span>{t(`settings.${key}`)}</span>
              {toggle ? (
                <input type="checkbox" name={key} checked={settings[key] === 1} disabled={!isHost}
                  onChange={(e) => onChange({ [key]: e.target.checked ? 1 : 0 })} className="h-4 w-4" />
              ) : (
                // committed on blur so half-typed numbers aren't sent
                <input type="number" name={key} min={min} max={max} defaultValue={settings[key]} key={settings[key]} disabled={!isHost}
                  onBlur={num(key)} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} className="w-16 rounded bg-slate-700 px-1 text-right disabled:opacity-60" />
              )}
            </label>
          );
        })}
        <label className="col-span-2 flex items-center justify-between gap-2 rounded bg-slate-800 px-2 py-1 sm:col-span-3">
          <span>{t('settings.theme')}</span>
          <select name="theme" value={String(settings.theme ?? 0)} disabled={!isHost}
            onChange={(e) => onChange({ theme: Number(e.target.value) })}
            className="rounded bg-slate-700 px-1 disabled:opacity-60">
            {['themeClassic', 'themeMoon', 'themeSnow'].map((key, i) => (
              <option key={key} value={i}>{t(`settings.${key}`)}</option>
            ))}
          </select>
        </label>
        <label className="col-span-2 flex items-center justify-between gap-2 rounded bg-slate-800 px-2 py-1 sm:col-span-3">
          <span>{t('settings.botLang')}</span>
          <select name="lang" value={state.lang} disabled={!isHost} onChange={(e) => onChange({ lang: e.target.value })}
            className="rounded bg-slate-700 px-1 disabled:opacity-60">
            {Object.entries(LANGUAGES).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select>
        </label>
      </div>
    </section>
  );
}
