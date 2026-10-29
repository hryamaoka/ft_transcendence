import { useEffect, useState } from 'react';
import { useI18n } from '../i18n.jsx';

const MAX = 140;

// Last words, folded away by default so a neighbour doesn't read them off the screen.
export default function WillEditor({ will, onSave }) {
  const { t } = useI18n();
  const [text, setText] = useState(will);
  const [saved, setSaved] = useState(false);
  // a reconnect brings back what the server has
  useEffect(() => setText(will), [will]);

  const save = async (e) => {
    e.preventDefault();
    // the server trims, so show what it kept
    if (await onSave(text)) {
      setText(text.trim());
      setSaved(true);
    }
  };

  return (
    <details className="mx-auto w-full max-w-sm rounded-xl bg-slate-900 px-3 py-2 text-sm">
      <summary className="cursor-pointer select-none font-semibold">📝 {t('room.will')}</summary>
      <form onSubmit={save} className="mt-2 space-y-2">
        <textarea name="will" className="w-full rounded bg-slate-800 px-2 py-1" rows={3} maxLength={MAX} value={text} aria-label={t('room.will')}
          onChange={(e) => { setText(e.target.value); setSaved(false); }} />
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-slate-500">{t('room.willHint')}</span>
          <button className="shrink-0 rounded bg-indigo-600 px-3 py-1 hover:bg-indigo-500 disabled:opacity-40" disabled={text === will}>
            {saved && text === will ? t('room.willSaved') : t('room.willSave')}
          </button>
        </div>
      </form>
    </details>
  );
}
