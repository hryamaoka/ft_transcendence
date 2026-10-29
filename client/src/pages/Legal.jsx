import { useI18n } from '../i18n.jsx';
import LEGAL from '../legal.js';

export default function Legal({ page }) {
  const { lang } = useI18n();
  const doc = LEGAL[lang] ?? LEGAL.en;
  const { title, sections } = doc[page];
  return (
    <article className="mt-6 space-y-5">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-sm text-slate-400">{doc.updated}</p>
      {sections.map(([heading, ...paragraphs]) => (
        <section key={heading} className="space-y-2">
          <h2 className="text-lg font-semibold">{heading}</h2>
          {paragraphs.map((p) => <p key={p} className="text-slate-300">{p}</p>)}
        </section>
      ))}
    </article>
  );
}
