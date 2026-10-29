import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useI18n } from '../i18n.jsx';
import RoleArt from '../components/RoleArt.jsx';

export default function Home() {
  const { t, tError, lang } = useI18n();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const create = async () => {
    try {
      const room = await api('/api/rooms', { method: 'POST', body: { lang } });
      navigate(`/room/${room.code}`);
    } catch (err) {
      setError(err.message);
    }
  };

  const join = (e) => {
    e.preventDefault();
    navigate(`/room/${code.trim().toLowerCase()}`);
  };

  return (
    <div className="mx-auto mt-8 max-w-md space-y-8">
      <button onClick={create} className="w-full rounded bg-indigo-600 py-3 text-lg font-semibold hover:bg-indigo-500">
        {t('home.create')}
      </button>
      <form onSubmit={join} className="space-y-2">
        <p className="text-center text-sm text-slate-400">{t('home.or')}</p>
        <div className="flex gap-2">
          <input className="min-w-0 flex-1 rounded bg-slate-800 px-3 py-2 font-mono lowercase" name="code" placeholder={t('home.code')} value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^A-Za-z0-9]/g, '').toLowerCase())}
            required minLength={6} maxLength={6} pattern="[a-z0-9]{6}" title={t('home.codeHint')}
            aria-label={t('home.code')} aria-describedby="code-hint" autoComplete="off" autoCapitalize="none" spellCheck={false} />
          <button className="rounded bg-slate-700 px-4 hover:bg-slate-600">{t('home.join')}</button>
        </div>
        <p id="code-hint" className="text-xs text-slate-500">{t('home.codeHint')}</p>
      </form>
      {error && <p className="text-sm text-red-400" role="alert">{tError(error)}</p>}

      <section className="space-y-3 rounded-xl bg-slate-900 p-4">
        <h2 className="font-semibold">{t('home.rules')}</h2>
        <div className="grid grid-cols-5 gap-2">
          {['werewolf', 'villager', 'seer', 'knight', 'medium'].map((r) => (
            <figure key={r} className="text-center text-xs">
              <RoleArt role={r} className="w-full rounded" />
              <figcaption className="mt-1">{t(`roles.${r}.name`)}</figcaption>
            </figure>
          ))}
        </div>
        {['intro', 'night', 'medium', 'day', 'win', 'dead'].map((k) => <p key={k} className="text-sm text-slate-300">{t(`rules.${k}`)}</p>)}
      </section>
    </div>
  );
}
