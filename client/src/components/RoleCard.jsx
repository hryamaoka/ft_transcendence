import { useEffect, useState } from 'react';
import { useI18n } from '../i18n.jsx';
import RoleArt from './RoleArt.jsx';

// Face-down until the player holds it, so the role is not left face up on their phone.
export default function RoleCard({ role, allies, dead, onPeek }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const show = (e) => {
    // Capture the finger so a 3D flip cannot fire pointerleave and close the card early.
    if (e?.currentTarget?.setPointerCapture && e.pointerId != null) {
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* already gone */ }
    }
    setOpen(true);
    onPeek?.(true);
  };
  const hide = () => { setOpen(false); onPeek?.(false); };
  useEffect(() => () => onPeek?.(false), [onPeek]);
  const holdKey = (e) => {
    if (e.repeat) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (e.type === 'keydown') show();
      else hide();
    }
  };

  return (
    <div className="card-3d card-deal mx-auto w-56 select-none">
      <button
        type="button"
        className={`card-inner relative block h-80 w-full touch-none ${open ? 'flipped' : ''}`}
        onPointerDown={show} onPointerUp={hide} onPointerCancel={hide} onLostPointerCapture={hide}
        onKeyDown={holdKey} onKeyUp={holdKey} onBlur={hide}
        onContextMenu={(e) => e.preventDefault()}
        aria-label={open ? `${t('card.yourRole')}: ${t(`roles.${role}.name`)}` : t('card.hold')}
      >
        <div className="card-face absolute inset-0 flex flex-col items-center justify-center rounded-2xl border-4 border-indigo-400 bg-[repeating-linear-gradient(45deg,#312e81_0_10px,#3730a3_10px_20px)] p-4">
          <span className="text-6xl" aria-hidden>🌕</span>
          <span className="mt-4 rounded bg-slate-950/70 px-2 py-1 text-sm">{t('card.hold')}</span>
        </div>
        <div className="card-face card-front absolute inset-0 flex flex-col items-center rounded-2xl border-4 border-amber-300 bg-slate-900 p-3">
          <RoleArt role={role} className="w-full rounded-lg" />
          <p className="mt-2 text-2xl font-bold">{t(`roles.${role}.name`)}{dead && ` (${t('room.dead')})`}</p>
          <p className="mt-1 text-center text-sm text-slate-300">{t(`roles.${role}.text`)}</p>
          {allies.length > 0 && <p className="mt-2 text-center text-sm text-red-300">{t('card.allies', { names: allies.join(', ') })}</p>}
        </div>
      </button>
    </div>
  );
}
