import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useI18n } from '../i18n.jsx';
import Avatar from '../components/Avatar.jsx';

const ACHIEVEMENTS = ['first_game', 'first_win', 'veteran', 'wolf_win', 'seer_win', 'knight_win', 'medium_win', 'survivor'];
const ROLE_ICON = { werewolf: '🐺', villager: '🧑‍🌾', seer: '🔮', knight: '🛡️', medium: '🕯️' };

function Stat({ label, value }) {
  return (
    <div className="rounded bg-slate-800 p-2 text-center">
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  );
}

export default function Profile({ onUserChange }) {
  const { t, tError, lang } = useI18n();
  const { name } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', bio: '' });

  // a name that breaks the name rules can't exist: not asked, since the server would answer 400
  const load = () => (/^[A-Za-z0-9_]{3,20}$/.test(name)
    ? api(`/api/users/${encodeURIComponent(name)}`).then(setProfile).catch((e) => setError(e.message))
    : setError('user_not_found'));
  useEffect(() => {
    setProfile(null);
    setError('');
    setEditing(false);
    load();
  }, [name]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (fn) => {
    setError('');
    setNotice('');
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    }
  };

  const save = (e) => {
    e.preventDefault();
    run(async () => {
      const user = await api('/api/me', { method: 'PATCH', body: form });
      onUserChange(user);
      setEditing(false);
      setNotice(t('profile.saved'));
      setProfile((p) => ({ ...p, name: user.name, bio: user.bio }));
      // the URL contains the name, so follow a rename
      if (user.name !== name) navigate(`/u/${user.name}`, { replace: true });
    });
  };

  const upload = (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return setError('file_too_large');
    if (file.type && !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return setError('bad_image');
    const form = new FormData();
    form.append('file', file);
    run(async () => {
      const user = await api('/api/me/avatar', { method: 'POST', form });
      onUserChange(user);
      setProfile((p) => ({ ...p, avatar: user.avatar }));
    });
  };

  const removeAvatar = () => run(async () => {
    const user = await api('/api/me/avatar', { method: 'DELETE' });
    onUserChange(user);
    setProfile((p) => ({ ...p, avatar: null }));
  });

  const toggleFriend = () => run(async () => {
    await api(`/api/friends/${profile.id}`, { method: profile.isFriend ? 'DELETE' : 'POST' });
    setProfile((p) => ({ ...p, isFriend: !p.isFriend }));
  });

  if (!profile) return <p className="mt-10 text-center text-slate-400">{error ? tError(error) : '…'}</p>;

  const { stats } = profile;
  const date = (d) => new Date(d).toLocaleDateString(lang);

  return (
    <div className="mt-6 space-y-6">
      <section className="flex flex-col items-center gap-4 rounded-xl bg-slate-900 p-4 sm:flex-row sm:items-start">
        <Avatar src={profile.avatar} size={24} online={profile.online} />
        {/* a long name or a bio without spaces wraps instead of widening the page */}
        <div className="w-full min-w-0 flex-1 space-y-2 text-center wrap-anywhere sm:text-left">
          {editing ? (
            <form onSubmit={save} className="space-y-2">
              <input className="w-full rounded bg-slate-800 px-3 py-2" name="name" value={form.name} aria-label={t('auth.name')}
                onChange={(e) => setForm({ ...form, name: e.target.value })} required pattern="[A-Za-z0-9_]{3,20}" title={t('auth.nameHint')} />
              <textarea className="w-full rounded bg-slate-800 px-3 py-2" name="bio" rows={3} maxLength={200} value={form.bio}
                aria-label={t('profile.bio')} placeholder={t('profile.bio')} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
              <div className="flex gap-2">
                <button className="rounded bg-indigo-600 px-3 py-1 hover:bg-indigo-500">{t('profile.save')}</button>
                <button type="button" onClick={() => setEditing(false)} className="rounded bg-slate-700 px-3 py-1">{t('profile.cancel')}</button>
              </div>
            </form>
          ) : (
            <>
              <h1 className="text-2xl font-bold">{profile.name}</h1>
              <p className="text-sm text-slate-400">
                {profile.online ? `🟢 ${t('profile.online')}` : `⚪ ${t('profile.offlineStatus')}`} · {t('profile.joined', { date: date(profile.createdAt) })}
              </p>
              {profile.bio && <p className="whitespace-pre-wrap text-slate-300">{profile.bio}</p>}
            </>
          )}
          {!editing && (
            <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
              {profile.isMe ? (
                <>
                  <button onClick={() => { setForm({ name: profile.name, bio: profile.bio }); setEditing(true); }}
                    className="rounded bg-slate-700 px-3 py-1 text-sm hover:bg-slate-600">{t('profile.edit')}</button>
                  <label className="cursor-pointer rounded bg-slate-700 px-3 py-1 text-sm hover:bg-slate-600">
                    {t('profile.avatar')}
                    <input type="file" name="avatar" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={upload} />
                  </label>
                  {profile.avatar && (
                    <button onClick={removeAvatar} className="rounded bg-slate-700 px-3 py-1 text-sm hover:bg-slate-600">{t('profile.removeAvatar')}</button>
                  )}
                </>
              ) : (
                <button onClick={toggleFriend} className="rounded bg-indigo-600 px-3 py-1 text-sm hover:bg-indigo-500">
                  {profile.isFriend ? t('profile.removeFriend') : t('profile.addFriend')}
                </button>
              )}
            </div>
          )}
          {profile.isMe && !editing && <p className="text-xs text-slate-500">{t('profile.avatarHint')}</p>}
          {error && <p className="text-sm text-red-400" role="alert">{tError(error)}</p>}
          {notice && <p className="text-sm text-emerald-400" role="status">{notice}</p>}
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">{t('profile.stats')}</h2>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          <Stat label={t('profile.level')} value={stats.level} />
          <Stat label={t('profile.rank')} value={stats.rank ? `#${stats.rank}` : '-'} />
          <Stat label={t('profile.games')} value={stats.games} />
          <Stat label={t('profile.wins')} value={stats.wins} />
          <Stat label={t('profile.losses')} value={stats.losses} />
          <Stat label={t('profile.winRate')} value={`${stats.winRate}%`} />
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded bg-slate-800" title={t('profile.xp', { xp: stats.xp })}>
          <div className="h-full bg-indigo-500" style={{ width: `${stats.xp % 100}%` }} />
        </div>
        <p className="mt-1 text-xs text-slate-400">{t('profile.xp', { xp: stats.xp })}</p>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">{t('profile.achievements')}</h2>
        <ul className="flex flex-wrap gap-2">
          {ACHIEVEMENTS.map((a) => {
            const got = stats.achievements.includes(a);
            return (
              <li key={a} className={`rounded-full px-3 py-1 text-sm ${got ? 'bg-amber-500 text-black' : 'bg-slate-800 text-slate-500'}`}>
                {got ? '🏆' : '🔒'} {t(`achievements.${a}`)}
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">{t('profile.history')}</h2>
        {stats.history.length === 0 ? <p className="text-slate-400">{t('profile.none')}</p> : (
          <ul className="divide-y divide-slate-800 rounded-xl bg-slate-900 text-sm">
            {stats.history.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span className={`font-semibold ${g.won ? 'text-emerald-400' : 'text-red-400'}`}>{g.won ? t('profile.won') : t('profile.lost')}</span>
                <span>{ROLE_ICON[g.role]} {t(`roles.${g.role}.name`)} · {g.survived ? t('profile.survived') : t('profile.died')}</span>
                <span className="text-slate-400">
                  {g.others.length > 0 && t('profile.with', { names: g.others.join(', ') })}
                  {g.bots > 0 && ` ${t('profile.bots', { n: g.bots })}`}
                </span>
                <span className="text-slate-500">{date(g.date)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
