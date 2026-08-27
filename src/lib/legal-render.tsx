export function LegalBody({ body }: { body: string }) {
  const blocks = body.trim().split(/\n{2,}/);
  return (
    <div className="space-y-5 text-sm leading-relaxed text-muted">
      {blocks.map((block, i) => {
        const line = block.trim();
        if (!line) return null;
        if (line.startsWith("## ")) {
          return (
            <h2 key={i} className="pt-4 font-display text-2xl text-fg">
              {line.slice(3)}
            </h2>
          );
        }
        if (line.startsWith("- ")) {
          const items = line.split("\n").filter((x) => x.trim().startsWith("- "));
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {items.map((it) => (
                <li key={it}>{it.replace(/^- /, "")}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="whitespace-pre-wrap">
            {line}
          </p>
        );
      })}
    </div>
  );
}
