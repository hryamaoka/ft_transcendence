// Hand-made SVG artwork for each role card (no image files).
const ART = {
  werewolf: (
    <>
      <circle cx="70" cy="30" r="16" fill="#fde68a" />
      <circle cx="76" cy="26" r="14" fill="#450a0a" />
      <path d="M22 92 L30 50 L40 62 L50 42 L60 62 L70 50 L78 92 Z" fill="#7f1d1d" />
      <path d="M35 72 l6 4 M65 72 l-6 4" stroke="#fca5a5" strokeWidth="3" strokeLinecap="round" />
      <path d="M42 84 l4 -5 l4 5 l4 -5 l4 5" stroke="#fecaca" strokeWidth="2" fill="none" />
    </>
  ),
  villager: (
    <>
      <circle cx="75" cy="25" r="10" fill="#fde047" />
      <path d="M20 58 L50 32 L80 58 Z" fill="#b45309" />
      <rect x="27" y="58" width="46" height="34" fill="#fcd34d" />
      <rect x="44" y="70" width="12" height="22" fill="#78350f" />
      <rect x="31" y="64" width="9" height="9" fill="#bae6fd" />
      <rect x="60" y="64" width="9" height="9" fill="#bae6fd" />
    </>
  ),
  seer: (
    <>
      <circle cx="50" cy="52" r="26" fill="#a78bfa" opacity="0.35" />
      <circle cx="50" cy="52" r="20" fill="#7c3aed" />
      <ellipse cx="42" cy="44" rx="6" ry="4" fill="#ede9fe" opacity="0.8" />
      <path d="M32 84 h36 l-6 -10 h-24 z" fill="#4c1d95" />
      <path d="M50 20 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2 z" fill="#fde68a" />
    </>
  ),
  medium: (
    <>
      <path d="M30 26 C30 14 44 10 50 18 C56 10 70 14 70 26 C70 36 60 40 58 48 H42 C40 40 30 36 30 26 Z" fill="#e2e8f0" opacity="0.85" />
      <circle cx="44" cy="27" r="3" fill="#1e293b" />
      <circle cx="56" cy="27" r="3" fill="#1e293b" />
      <path d="M50 52 C46 58 47 63 50 66 C53 63 54 58 50 52 Z" fill="#fbbf24" />
      <rect x="44" y="66" width="12" height="20" rx="2" fill="#f5f5f4" />
      <path d="M34 86 H66 L62 92 H38 Z" fill="#57534e" />
    </>
  ),
  knight: (
    <>
      <path d="M50 18 L78 28 V52 C78 72 64 84 50 90 C36 84 22 72 22 52 V28 Z" fill="#1d4ed8" />
      <path d="M50 26 L70 33 V52 C70 67 60 76 50 81 C40 76 30 67 30 52 V33 Z" fill="#60a5fa" />
      <path d="M50 34 V74 M36 50 H64" stroke="#eff6ff" strokeWidth="6" strokeLinecap="round" />
    </>
  ),
};

const BG = { werewolf: '#1c0a0a', villager: '#1c1407', seer: '#150a26', knight: '#071433', medium: '#0f172a' };

export default function RoleArt({ role, className = '' }) {
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-hidden>
      <rect width="100" height="100" rx="8" fill={BG[role]} />
      {ART[role]}
    </svg>
  );
}
