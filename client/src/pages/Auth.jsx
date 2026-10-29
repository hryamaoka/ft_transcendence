import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useI18n } from '../i18n.jsx';

const input = 'w-full rounded bg-slate-800 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500';

export default function Auth({ onLogin }) {
  const { t, tError } = useI18n();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', name: '' });
  const [error, setError] = useState('');

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    // the server counts characters (not UTF-16 units, as minLength does), and bcrypt uses only 72 bytes
    if (mode === 'signup' && ([...form.password].length < 8 || new TextEncoder().encode(form.password).length > 72)) {
      return setError('password_length');
    }
    const body = mode === 'login' ? { email: form.email, password: form.password } : form;
    try {
      onLogin(await api(`/api/auth/${mode === 'login' ? 'login' : 'register'}`, { method: 'POST', body }));
    } catch (err) {
      setError(err.message);
    }
  };

  // keep the placeholders, so the links can go where they are
  const [before, after] = t('auth.agree', { terms: '{terms}', privacy: '{privacy}' }).split('{terms}');
  const [middle, end] = (after ?? '').split('{privacy}');

  return (
    <form onSubmit={submit} className="mx-auto mt-10 max-w-sm space-y-4" noValidate={false}>
      <p className="text-slate-400">{t('app.tagline')}</p>
      <h1 className="text-2xl font-bold">{mode === 'login' ? t('auth.login') : t('auth.signup')}</h1>
      {mode === 'signup' && (
        <label className="block space-y-1">
          <span className="text-sm">{t('auth.name')}</span>
          <input className={input} name="name" value={form.name} onChange={set('name')} autoComplete="off"
            required pattern="[A-Za-z0-9_]{3,20}" title={t('auth.nameHint')} />
          <span className="text-xs text-slate-500">{t('auth.nameHint')}</span>
        </label>
      )}
      <label className="block space-y-1">
        <span className="text-sm">{t('auth.email')}</span>
        <input className={input} name="email" type="email" value={form.email} onChange={set('email')} required maxLength={254}
          pattern="[^@\s]+@[^@\s]+\.[^@\s]+" autoComplete="username" />
      </label>
      <label className="block space-y-1">
        <span className="text-sm">{t('auth.password')}</span>
        <input className={input} name="password" type="password" value={form.password} onChange={set('password')}
          required minLength={8} maxLength={128} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
        {mode === 'signup' && <span className="text-xs text-slate-500">{t('auth.passwordHint')}</span>}
      </label>
      {mode === 'signup' && (
        <p className="text-xs text-slate-400">
          {before}<Link to="/terms" className="underline">{t('nav.terms')}</Link>{middle}
          <Link to="/privacy" className="underline">{t('nav.privacy')}</Link>{end}
        </p>
      )}
      {error && <p className="text-sm text-red-400" role="alert">{tError(error)}</p>}
      <button className="w-full rounded bg-indigo-600 py-2 font-semibold hover:bg-indigo-500">
        {mode === 'login' ? t('auth.login') : t('auth.create')}
      </button>
      <button type="button" className="w-full text-sm text-slate-400"
        onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}>
        {mode === 'login' ? t('auth.toSignup') : t('auth.toLogin')}
      </button>
    </form>
  );
}
