import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useI18n } from '../i18n.jsx';
import Avatar from '../components/Avatar.jsx';

function Row({ user, action }) {
  return (
    <li className="flex items-center justify-between gap-2 px-3 py-2">
      <Link to={`/u/${user.name}`} className="flex min-w-0 items-center gap-2 hover:underline">
        <Avatar src={user.avatar} online={user.online} />
        <span className="truncate">{user.name}</span>
      </Link>
      {action}
    </li>
  );
}

export default function Friends() {
  const { t, tError } = useI18n();
  const [friends, setFriends] = useState([]);
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');

  // a later success clears an earlier error
  const load = () => api('/api/friends').then((rows) => { setFriends(rows); setError(''); }).catch((e) => setError(e.message));
  useEffect(() => {
    load();
    // refresh online status
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const query = q.trim();
    if (!query) return setResults(null);
    let cancelled = false;
    const id = setTimeout(() => {
      api(`/api/users?q=${encodeURIComponent(query)}`)
        .then((rows) => { if (!cancelled) { setResults(rows); setError(''); } })
        .catch((e) => { if (!cancelled) setError(e.message); });
    }, 250);
    return () => { cancelled = true; clearTimeout(id); };
  }, [q]);

  const change = async (id, method) => {
    setError('');
    try {
      await api(`/api/friends/${id}`, { method });
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  const friendIds = new Set(friends.map((f) => f.id));
  const btn = 'rounded px-3 py-1 text-sm';

  return (
    <div className="mt-6 space-y-6">
      <h1 className="text-2xl font-bold">{t('friends.title')}</h1>
      <input className="w-full rounded bg-slate-800 px-3 py-2" name="q" placeholder={t('friends.search')} aria-label={t('friends.search')}
        value={q} onChange={(e) => setQ(e.target.value)} maxLength={20} />
      {results && (
        results.length === 0 ? <p className="text-slate-400">{t('friends.noResults')}</p> : (
          <ul className="divide-y divide-slate-800 rounded-xl bg-slate-900">
            {results.map((u) => (
              <Row key={u.id} user={u} action={!friendIds.has(u.id) && (
                <button onClick={() => change(u.id, 'POST')} className={`${btn} bg-indigo-600 hover:bg-indigo-500`}>{t('friends.add')}</button>
              )} />
            ))}
          </ul>
        )
      )}
      {error && <p className="text-sm text-red-400" role="alert">{tError(error)}</p>}
      {friends.length === 0 ? <p className="text-slate-400">{t('friends.none')}</p> : (
        <ul className="divide-y divide-slate-800 rounded-xl bg-slate-900">
          {friends.map((f) => (
            <Row key={f.id} user={f} action={
              <button onClick={() => change(f.id, 'DELETE')} className={`${btn} bg-slate-700 hover:bg-slate-600`}>{t('profile.removeFriend')}</button>
            } />
          ))}
        </ul>
      )}
    </div>
  );
}
