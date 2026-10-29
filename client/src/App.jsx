import { useEffect, useState } from 'react';
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { api } from './api.js';
import { LANGUAGES, useI18n } from './i18n.jsx';
import Avatar from './components/Avatar.jsx';
import Auth from './pages/Auth.jsx';
import Friends from './pages/Friends.jsx';
import Home from './pages/Home.jsx';
import Leaderboard from './pages/Leaderboard.jsx';
import Legal from './pages/Legal.jsx';
import Profile from './pages/Profile.jsx';
import Room from './pages/Room.jsx';

// how long a friend's invite stays on screen
const INVITE_MS = 20000;

const navClass = ({ isActive }) => `rounded px-2 py-1 ${isActive ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`;

export default function App() {
  const { t, lang, setLang } = useI18n();
  const [user, setUser] = useState(undefined);
  const [invites, setInvites] = useState([]);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    api('/api/session').then((s) => setUser(s.user)).catch(() => setUser(null));
  }, []);

  // Online status follows any open page, not only the room. Friends' invites arrive here too.
  useEffect(() => {
    if (!user) return undefined;
    const socket = io();
    const timers = new Map();
    socket.on('room:invite', ({ code, from }) => {
      if (typeof code !== 'string' || typeof from !== 'string') return;
      // one card per room: a second invite to the same room replaces the first and restarts its clock
      setInvites((list) => [...list.filter((i) => i.code !== code), { code, from }]);
      clearTimeout(timers.get(code));
      timers.set(code, setTimeout(() => {
        timers.delete(code);
        setInvites((list) => list.filter((i) => i.code !== code));
      }, INVITE_MS));
    });
    return () => {
      socket.disconnect();
      timers.forEach(clearTimeout);
      setInvites([]);
    };
  }, [user?.id]);

  if (user === undefined) return null;

  const logout = async () => {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setUser(null);
  };

  // after login, return to the invite link that was opened
  const guard = (el) => (user ? el : <Navigate to="/login" state={{ from: location.pathname }} replace />);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-800">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <Link to="/" className="text-lg font-bold">🐺 {t('app.name')}</Link>
          {user && (
            <nav className="flex flex-wrap items-center gap-1 text-sm">
              <NavLink to="/" end className={navClass}>{t('nav.play')}</NavLink>
              <NavLink to="/friends" className={navClass}>{t('nav.friends')}</NavLink>
              <NavLink to="/leaderboard" className={navClass}>{t('nav.leaderboard')}</NavLink>
              <NavLink to={`/u/${user.name}`} className={navClass} aria-label={t('nav.profile')}>
                <span className="flex items-center gap-1"><Avatar src={user.avatar} size={6} /> {user.name}</span>
              </NavLink>
              <button onClick={logout} className="rounded px-2 py-1 text-slate-400 hover:text-white">{t('nav.logout')}</button>
            </nav>
          )}
        </div>
      </header>
      {invites.length > 0 && (
        <div className="fixed bottom-4 right-4 z-40 w-80 max-w-[calc(100vw-2rem)] space-y-2" role="status" aria-live="polite">
          {invites.map((i) => (
            <div key={i.code} className="rounded-xl border border-indigo-500 bg-slate-900 p-3 shadow-lg">
              <p className="text-sm">{t('invite.title', { from: i.from, code: i.code })}</p>
              <div className="mt-2 flex gap-2">
                <button onClick={() => { setInvites((list) => list.filter((x) => x !== i)); navigate(`/room/${i.code}`); }}
                  className="rounded bg-indigo-600 px-3 py-1 text-sm hover:bg-indigo-500">{t('invite.join')}</button>
                <button onClick={() => setInvites((list) => list.filter((x) => x !== i))}
                  className="rounded bg-slate-700 px-3 py-1 text-sm hover:bg-slate-600">{t('invite.dismiss')}</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-10">
        <Routes>
          <Route path="/login" element={user ? <Navigate to={location.state?.from || '/'} replace /> : <Auth onLogin={setUser} />} />
          <Route path="/" element={guard(<Home />)} />
          <Route path="/room/:code" element={guard(<Room user={user} />)} />
          <Route path="/u/:name" element={guard(<Profile onUserChange={setUser} />)} />
          <Route path="/friends" element={guard(<Friends />)} />
          <Route path="/leaderboard" element={guard(<Leaderboard user={user} />)} />
          <Route path="/privacy" element={<Legal page="privacy" />} />
          <Route path="/terms" element={<Legal page="terms" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="border-t border-slate-800">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm text-slate-400">
          <div className="flex gap-4">
            <Link to="/privacy" className="hover:text-white">{t('nav.privacy')}</Link>
            <Link to="/terms" className="hover:text-white">{t('nav.terms')}</Link>
          </div>
          <label className="flex items-center gap-2">
            {t('nav.language')}
            <select name="lang" value={lang} onChange={(e) => setLang(e.target.value)} className="rounded bg-slate-800 px-2 py-1 text-slate-200">
              {Object.entries(LANGUAGES).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
            </select>
          </label>
        </div>
      </footer>
    </div>
  );
}
