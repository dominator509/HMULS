export function JsonLd({ data }: { data: unknown }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />
  );
}

export function FaqList({
  items,
  title = "How this vault works",
}: {
  items: { q: string; a: string }[];
  title?: string;
}) {
  if (!items.length) return null;
  return (
    <section className="mx-auto max-w-6xl px-5 py-16" aria-labelledby="faq-title">
      <p className="kicker">Answers</p>
      <h2 id="faq-title" className="mt-2 font-display text-4xl text-fg">
        How this vault works
      </h2>
      <dl className="mt-8 grid gap-6 md:grid-cols-2">
        {items.map((f) => (
          <div key={f.q} className="rounded-xl border border-border bg-surface p-5">
            <dt className="font-display text-xl text-fg">{f.q}</dt>
            <dd className="mt-2 text-sm leading-relaxed text-muted">{f.a}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function Crumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-xs text-subtle">
      <ol className="flex flex-wrap items-center gap-x-2">
        {items.map((c, i) => (
          <li key={`${c.label}-${i}`} className="flex items-center gap-2">
            {i > 0 ? <span aria-hidden>/</span> : null}
            {c.href ? (
              <a href={c.href} className="inline-flex min-h-9 items-center hover:text-fg">
                {c.label}
              </a>
            ) : (
              <span className="text-muted">{c.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
