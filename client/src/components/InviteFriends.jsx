import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useI18n } from '../i18n.jsx';
import Avatar from './Avatar.jsx';

// Online friends (who added you back) not in the lobby yet, each with an Invite button.
export default function InviteFriends({ inRoom, onInvite }) {
  const { t } = useI18n();
  const [friends, setFriends] = useState([]);
  const [invited, setInvited] = useState(() => new Set());

  useEffect(() => {
    let cancelled = false;
    const load = () => api('/api/friends').then((rows) => { if (!cancelled) setFriends(rows); }).catch(() => {});
    load();
    // online status changes while the lobby fills up
    const id = setInterval(load, 10000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const online = friends.filter((f) => f.online && f.mutual && !inRoom.includes(f.id));
  const invite = async (id) => {
    if (!(await onInvite(id))) return;
    setInvited((s) => new Set(s).add(id));
    // the invite shows on their screen for 20 seconds; after that it can be sent again
    setTimeout(() => setInvited((s) => {
      const next = new Set(s);
      next.delete(id);
      return next;
    }), 20000);
  };

  return (
    <section className="rounded-xl bg-slate-900 p-3">
      <h2 className="mb-2 font-semibold">{t('room.invite')}</h2>
      {online.length === 0 ? <p className="text-sm text-slate-400">{t('room.noFriendsOnline')}</p> : (
        <ul className="space-y-1">
          {online.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex min-w-0 items-center gap-2"><Avatar src={f.avatar} size={6} online /> <span className="truncate">{f.name}</span></span>
              <button onClick={() => invite(f.id)} disabled={invited.has(f.id)}
                className="shrink-0 rounded bg-indigo-600 px-3 py-1 hover:bg-indigo-500 disabled:opacity-50">
                {invited.has(f.id) ? t('room.invited') : t('room.inviteBtn')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
