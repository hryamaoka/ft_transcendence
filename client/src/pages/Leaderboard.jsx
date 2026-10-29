import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useI18n } from '../i18n.jsx';
import Avatar from '../components/Avatar.jsx';

export default function Leaderboard({ user }) {
  const { t, tError } = useI18n();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/api/leaderboard').then(setRows).catch((e) => setError(e.message));
  }, []);

  if (!rows) return <p className="mt-10 text-center text-slate-400">{error ? tError(error) : '…'}</p>;

  return (
    <div className="mt-6 space-y-4">
      <h1 className="text-2xl font-bold">{t('leaderboard.title')}</h1>
      {rows.length === 0 ? <p className="text-slate-400">{t('leaderboard.empty')}</p> : (
        <div className="overflow-x-auto rounded-xl bg-slate-900">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-400">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">{t('leaderboard.player')}</th>
                <th className="px-3 py-2 text-right">{t('profile.wins')}</th>
                <th className="px-3 py-2 text-right">{t('profile.games')}</th>
                <th className="px-3 py-2 text-right">{t('profile.winRate')}</th>
                <th className="px-3 py-2 text-right">{t('profile.level')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {rows.map((r) => (
                <tr key={r.id} className={r.id === user.id ? 'bg-indigo-950' : ''}>
                  <td className="px-3 py-2">{r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : r.rank}</td>
                  <td className="px-3 py-2">
                    <Link to={`/u/${r.name}`} className="flex items-center gap-2 hover:underline">
                      <Avatar src={r.avatar} size={6} /> {r.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right">{r.wins}</td>
                  <td className="px-3 py-2 text-right">{r.games}</td>
                  <td className="px-3 py-2 text-right">{r.winRate}%</td>
                  <td className="px-3 py-2 text-right">{r.level}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
