import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useI18n } from '../i18n.jsx';

// only this machine can open these; other phones need the public URL from `make`
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

// The room's link as a QR code, so players at the same table join by scanning the host's screen.
export default function RoomQr() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [src, setSrc] = useState('');
  const url = window.location.href;
  const local = LOCAL_HOSTS.includes(window.location.hostname);

  useEffect(() => {
    if (!open) return;
    let live = true;
    // drawn here in the browser: the link is never sent to a QR service
    if (!local) QRCode.toDataURL(url, { margin: 2, width: 320 }).then((s) => live && setSrc(s), () => {});
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => {
      live = false;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, url, local]);

  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded bg-slate-700 px-3 py-1 text-sm hover:bg-slate-600">
        {t('room.qr')}
      </button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label={t('room.qrTitle')} onClick={() => setOpen(false)}
          className="fade-in fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xs space-y-3 rounded-2xl bg-slate-900 p-5 text-center">
            <h2 className="text-lg font-bold">{t('room.qrTitle')}</h2>
            {local
              ? <p className="text-sm text-amber-300">{t('room.qrLocal')}</p>
              : src && <img src={src} alt={t('room.qrTitle')} className="mx-auto w-full rounded-lg" />}
            <p className="break-all font-mono text-xs text-slate-400">{url}</p>
            <button onClick={() => setOpen(false)} className="rounded bg-slate-700 px-4 py-1 text-sm hover:bg-slate-600">
              {t('overlay.close')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
