export default function Avatar({ src, bot, size = 8, online }) {
  const px = { 6: 'h-6 w-6', 8: 'h-8 w-8', 24: 'h-24 w-24' }[size];
  return (
    <span className="relative inline-block shrink-0">
      {bot ? (
        <span className={`${px} flex items-center justify-center rounded-full bg-slate-700`} aria-hidden>🤖</span>
      ) : (
        <img src={src || '/default-avatar.svg'} alt="" className={`${px} rounded-full object-cover`} />
      )}
      {online !== undefined && (
        <span className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-slate-950 ${online ? 'bg-emerald-400' : 'bg-slate-500'}`} />
      )}
    </span>
  );
}
