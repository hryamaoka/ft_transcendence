import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n.jsx';

// Werewolf and dead chat are coloured and marked, so they never pass for public messages.
const CHANNEL = {
  wolves: { icon: '🐺', color: 'text-red-400', title: 'chat.wolves' },
  dead: { icon: '👻', color: 'text-violet-300', title: 'chat.dead' },
};

export default function Chat({ messages, canTalk, channel, notice, onSend }) {
  const { t } = useI18n();
  const [text, setText] = useState('');
  const listRef = useRef(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    if (await onSend(text)) setText('');
  };

  return (
    <section className="flex h-96 flex-col rounded-xl bg-slate-900 md:h-[32rem]" aria-label={t('chat.title')}>
      <h2 className={`border-b border-slate-800 px-3 py-2 font-semibold ${CHANNEL[channel]?.color ?? ''}`}>
        {CHANNEL[channel] ? `${CHANNEL[channel].icon} ${t(CHANNEL[channel].title)}` : t('chat.title')}
      </h2>
      <ul ref={listRef} className="flex-1 space-y-1 overflow-y-auto px-3 py-2 text-sm" aria-live="polite">
        {messages.map((m) => (
          <li key={m.id} className={CHANNEL[m.channel]?.color ?? ''}>
            {CHANNEL[m.channel] && `${CHANNEL[m.channel].icon} `}
            <span className="font-semibold">{m.bot && '🤖 '}{m.name}:</span>{' '}
            {/* rendered as text, so HTML in messages is never interpreted */}
            <span className="break-words">{m.text}</span>
            {m.streaming && <span className="text-slate-500"> {m.text ? '▍' : t('chat.typing')}</span>}
          </li>
        ))}
      </ul>
      {notice && <p className="border-t border-slate-800 px-3 py-2 text-xs text-amber-300">{t('chat.llmNotice')}</p>}
      <form onSubmit={submit} className="flex gap-2 border-t border-slate-800 p-2">
        <input
          className="min-w-0 flex-1 rounded bg-slate-800 px-3 py-2 text-sm disabled:opacity-50"
          name="message" value={text} onChange={(e) => setText(e.target.value)} maxLength={300}
          placeholder={canTalk ? t('chat.placeholder') : t('chat.silent')} disabled={!canTalk}
          aria-label={t('chat.placeholder')}
        />
        <button className="rounded bg-indigo-600 px-3 text-sm hover:bg-indigo-500 disabled:opacity-40" disabled={!canTalk || !text.trim()}>
          {t('chat.send')}
        </button>
      </form>
    </section>
  );
}
