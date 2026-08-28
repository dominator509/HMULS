/** SEO + GEO + AEO authoring. Deterministic from muse/ladder fields so every
 * onboarded model is indexed the moment she is saved — no operator extra step. */

export const BRAND = "SHE UNDRESSES";

/** Public apex. Point www at this host and 301 it here. */
export const CANONICAL_HOST = "sheundresses.com";
export const CANONICAL_ORIGIN = "https://sheundresses.com";

export const DEFAULT_DESC =
  "Sequential adult photosets. She undresses for you, one paid yes at a time. Not a nudify app. 18+.";

export const RTA = "RTA-5042-1996-1400-1577-RTA";

/** Crawlers and answer-engine fetchers skip the age overlay so unique HTML ships. */
export const BOT_UA =
  /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|quora|pinterest|vkshare|whatsapp|telegram|discordbot|gptbot|chatgpt|claude|anthropic|perplexity|ccbot|bytespider|applebot|ia_archiver|semrush|ahrefs|dotbot|petalbot|youbot|cohere|google-extended|oai-search|amazonbot|yandex|baiduspider|duckduckbot|twitterbot|linkedinbot|slackbot|preview/i;

export type FaqItem = { q: string; a: string };

export function originOf(websiteUrl?: string | null) {
  const raw =
    (websiteUrl || "").trim() ||
    (typeof process !== "undefined" ? process.env.PUBLIC_SITE_URL?.trim() || "" : "");
  const source = raw || CANONICAL_ORIGIN;
  try {
    const u = new URL(source.includes("://") ? source : `https://${source}`);
    return `${u.protocol}//${u.host}`.replace(/\/$/, "");
  } catch {
    return CANONICAL_ORIGIN;
  }
}

export function absUrl(origin: string, path: string) {
  if (!path) return origin || "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const p = path.startsWith("/") ? path : `/${path}`;
  return origin ? `${origin}${p}` : p;
}

export function clipMeta(s: string, max = 158) {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const sp = cut.lastIndexOf(" ");
  return `${(sp > 80 ? cut.slice(0, sp) : cut).trim()}…`;
}

export function seoStem(parts: Array<string | undefined | null>) {
  return parts
    .map((p) =>
      (p || "")
        .toLowerCase()
        .replace(/['’]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, ""),
    )
    .filter(Boolean)
    .join("-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

export function modelAlt(modelName: string, beat: string) {
  const bit = (beat || "photoset").replace(/\s+/g, " ").trim();
  return `${modelName} — ${bit} sequential unlock photoset on ${BRAND}`;
}

type ModelSeoIn = {
  stageName: string;
  slug: string;
  bio?: string | null;
  looks?: string | null;
  contentKind?: string | null;
  portrayedAgeMin?: number | null;
};

export function authorModelSeo(m: ModelSeoIn) {
  const name = m.stageName.trim() || "Muse";
  const kind = m.contentKind === "human" ? "human" : m.contentKind === "hybrid" ? "hybrid" : "synthetic";
  const age = Math.max(21, m.portrayedAgeMin ?? 21);
  const looks = (m.looks || "").replace(/\s+/g, " ").trim();
  const bio = (m.bio || "").replace(/\s+/g, " ").trim();
  const kindLine =
    kind === "synthetic"
      ? `${name} is a fictional adult character, portrayed ${age}+.`
      : `${name} is portrayed ${age}+.`;
  const hook = bio || looks || `${name} undresses in order on ${BRAND}.`;
  const description = clipMeta(
    `${name} sequential unlock photosets on ${BRAND}. ${kindLine} ${hook} She undresses for the collector, one paid permission at a time. Not a clothes-remover. 18+.`,
  );
  const title = clipMeta(`${name} sequential unlock photosets | ${BRAND}`, 60);
  const keywords = [
    name,
    BRAND,
    "sequential unlock",
    "adult photoset",
    "paid permission",
    "Nine-Yes",
    kind === "synthetic" ? "AI muse" : "adult model",
    "18+",
  ].join(", ");
  const faqs: FaqItem[] = [
    {
      q: `Who is ${name} on ${BRAND}?`,
      a: clipMeta(
        `${kindLine} ${hook} Collectors climb her photosets in order — Shot 1, then Shot 2, never a skip. ${BRAND} is not a nudify tool.`,
        280,
      ),
    },
    {
      q: `How do ${name}'s photosets work?`,
      a: `Pick a set. Pay for Shot 1. The next still or clip opens only after that yes. Progress saves to the account. Grants are a personal license — no sharing, editing, or redistribution.`,
    },
    {
      q: `Is ${name} 18 or older?`,
      a: `Yes. ${name} is portrayed ${age} or older. ${BRAND} does not host anyone under 18, and portrayed age on this vault is 21+.`,
    },
    {
      q: `Can I download and share ${name}'s unlocked frames?`,
      a: `A grant is a personal viewing license. Duplicating, editing, sharing, or distributing unlocked media is prohibited by the Terms. Forensic stamps may identify a leak.`,
    },
  ];
  return { title, description, keywords, faqs, kindLine };
}

type LadderSeoIn = {
  title: string;
  modelName: string;
  theme: string;
  tagline?: string | null;
  description?: string | null;
  photosetHook?: string | null;
  photosetTease?: string | null;
};

export function authorLadderSeo(l: LadderSeoIn) {
  const name = l.modelName.trim() || "Muse";
  const titleName = l.title.trim() || "Photoset";
  const theme = (l.theme || "sequential").trim();
  const hook = (l.photosetHook || l.tagline || "").trim();
  const tease = (l.photosetTease || l.description || "").trim();
  const title = clipMeta(`${name} — ${titleName} | ${BRAND}`, 60);
  const description = clipMeta(
    `${name}'s ${titleName} (${theme}) sequential unlock photoset on ${BRAND}. ${hook} ${tease} Paid permissions in order. 18+.`,
  );
  const keywords = [
    name,
    titleName,
    theme,
    BRAND,
    "sequential unlock",
    "adult photoset",
    "Nine-Yes",
    "paid permission",
    "18+",
  ].join(", ");
  const faqs: FaqItem[] = [
    {
      q: `What is ${titleName} by ${name}?`,
      a: clipMeta(
        `${titleName} is ${name}'s ${theme} sequential photoset on ${BRAND}. ${hook || tease || "She undresses in order. Each paid yes opens the next frame."} You cannot skip shots.`,
        280,
      ),
    },
    {
      q: `Can I skip shots in ${titleName}?`,
      a: `No. ${name} opens ${titleName} in order. Pay for the next yes. Bundle and keep-the-pose offers still climb sequentially — they never jump the climax.`,
    },
    {
      q: `Is ${titleName} a nudify or clothes-remover tool?`,
      a: `No. ${BRAND} never undresses an uploaded photograph. ${name} undresses FOR the collector, in this photoset, one permission at a time.`,
    },
  ];
  return { title, description, keywords, faqs };
}

export function homeFaqs(models: { stageName: string }[]): FaqItem[] {
  const names = models.map((m) => m.stageName).filter(Boolean);
  const who =
    names.length === 0
      ? "Muses are onboarded by the operator. Each woman has her own looks, voice, and photosets."
      : names.length === 1
        ? `${names[0]} is the muse on this vault. More women can be onboarded; each keeps her own night.`
        : `Current muses: ${names.join(", ")}. Each woman is her own night — looks, voice, and photosets do not recycle.`;
  return [
    {
      q: `What is ${BRAND}?`,
      a: `${BRAND} is an adults-only sequential unlock vault. Collectors pay (typically crypto) to be granted the next still or clip. She undresses FOR you, in order. This is not a nudify app, not a clothes-remover, and not a service that undresses uploaded photographs.`,
    },
    {
      q: "How does sequential unlock work?",
      a: "Pick a muse, pick a photoset, pay for Shot 1. Shot 2 opens. Nine yeses. No skipping. Progress is saved to the account. A grant is a personal license.",
    },
    {
      q: "Who are the muses?",
      a: who,
    },
    {
      q: "Are all models 18+?",
      a: "Yes. Every muse is portrayed 21 or older. Human performers require 2257 records before explicit frames publish. Synthetic muses are fictional adults.",
    },
    {
      q: "Can I share unlocked photos or videos?",
      a: "No. Terms prohibit duplicating, editing, sharing, or distributing grants. Forensic watermarks may identify a leak back to the collector account.",
    },
    {
      q: "Is this a nudify or undress-AI tool?",
      a: "No. Nothing you upload is undressed. The product is permission — she undresses for the man who stays, one paid shot at a time.",
    },
  ];
}

export function groupLadders<
  T extends { modelId: string; modelName: string; modelSlug: string },
>(ladders: T[]) {
  const map = new Map<
    string,
    { modelId: string; modelName: string; modelSlug: string; items: T[] }
  >();
  for (const l of ladders) {
    const key = l.modelSlug || l.modelId;
    const g =
      map.get(key) ??
      { modelId: l.modelId, modelName: l.modelName, modelSlug: l.modelSlug, items: [] as T[] };
    g.items.push(l);
    map.set(key, g);
  }
  return [...map.values()];
}

export function jsonLdGraph(input: {
  origin: string;
  path: string;
  title: string;
  description: string;
  image?: string;
  faqs?: FaqItem[];
  type?: "person" | "product" | "webpage";
  name?: string;
  offers?: { price: number; priceCurrency?: string };
  crumbs?: { name: string; path: string }[];
}) {
  const origin = input.origin || "";
  const page = absUrl(origin, input.path);
  const img = absUrl(origin, input.image || "/og.jpg");
  const brandId = origin ? `${origin}/#brand` : "#brand";
  const siteId = origin ? `${origin}/#website` : "#website";
  const pageId = `${page}#webpage`;

  const graph: Record<string, unknown>[] = [
    {
      "@type": "Organization",
      "@id": brandId,
      name: BRAND,
      url: origin || "/",
      logo: absUrl(origin, "/favicon.svg"),
      description: DEFAULT_DESC,
      publishingPrinciples: absUrl(origin, "/legal/terms"),
    },
    {
      "@type": "WebSite",
      "@id": siteId,
      url: origin || "/",
      name: BRAND,
      description: DEFAULT_DESC,
      publisher: { "@id": brandId },
      inLanguage: "en",
      isFamilyFriendly: false,
      isAccessibleForFree: true,
    },
    {
      "@type": "WebPage",
      "@id": pageId,
      url: page,
      name: input.title,
      description: input.description,
      isPartOf: { "@id": siteId },
      primaryImageOfPage: img,
      inLanguage: "en",
      isFamilyFriendly: false,
      contentRating: "adult",
      isAccessibleForFree: input.type === "product" ? false : true,
      about: { "@id": brandId },
    },
  ];

  const crumbs = input.crumbs ?? [{ name: "Home", path: "/" }];
  if (crumbs.length) {
    graph.push({
      "@type": "BreadcrumbList",
      itemListElement: crumbs.map((c, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: c.name,
        item: absUrl(origin, c.path),
      })),
    });
  }

  if (input.path === "/") {
    graph.push({
      "@type": "HowTo",
      name: `How sequential unlock works on ${BRAND}`,
      description: "Pay for the next yes. She undresses in order. No skipping.",
      step: [
        {
          "@type": "HowToStep",
          position: 1,
          name: "Pick a muse",
          text: "Open the muses roster and choose the woman whose night you want.",
        },
        {
          "@type": "HowToStep",
          position: 2,
          name: "Pick a photoset",
          text: "Each photoset is a ladder — frontal, curve, pedestal, or a hunger she wrote herself.",
        },
        {
          "@type": "HowToStep",
          position: 3,
          name: "Pay for Shot 1",
          text: "Crypto checkout grants a personal license for that still or clip. Shot 2 then opens.",
        },
        {
          "@type": "HowToStep",
          position: 4,
          name: "Climb in order",
          text: "Nine yeses. No skip. The last frame is only for collectors who stayed.",
        },
      ],
    });
  }

  if (input.type === "person" && input.name) {
    graph.push({
      "@type": "Person",
      name: input.name,
      url: page,
      image: img,
      description: input.description,
      jobTitle: "Sequential photoset muse",
      affiliation: { "@id": brandId },
    });
  }

  if (input.type === "product" && input.name) {
    const product: Record<string, unknown> = {
      "@type": "Product",
      name: input.name,
      description: input.description,
      image: img,
      brand: { "@id": brandId },
      url: page,
      isFamilyFriendly: false,
      category: "Adult sequential photoset",
      isAccessibleForFree: false,
    };
    if (input.offers && input.offers.price > 0) {
      product.offers = {
        "@type": "Offer",
        price: input.offers.price.toFixed(2),
        priceCurrency: input.offers.priceCurrency || "USD",
        availability: "https://schema.org/InStock",
        url: page,
      };
    }
    graph.push(product);
  }

  if (input.faqs && input.faqs.length) {
    graph.push({
      "@type": "FAQPage",
      mainEntity: input.faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    });
  }

  return {
    "@context": "https://schema.org",
    "@graph": graph,
  };
}

export function headTags(opts: {
  title: string;
  description: string;
  path: string;
  origin: string;
  image?: string;
  keywords?: string;
  noindex?: boolean;
}) {
  const url = absUrl(opts.origin, opts.path);
  const img = absUrl(opts.origin, opts.image || "/og.jpg");
  const robots = opts.noindex
    ? "noindex, nofollow"
    : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";
  const meta: Record<string, string>[] = [
    { title: opts.title },
    { name: "description", content: opts.description },
    { name: "robots", content: robots },
    { name: "googlebot", content: robots },
    { name: "bingbot", content: robots },
    { name: "author", content: BRAND },
    { name: "rating", content: "adult" },
    { name: "RATING", content: RTA },
    { name: "referrer", content: "no-referrer-when-downgrade" },
    { property: "og:title", content: opts.title },
    { property: "og:description", content: opts.description },
    { property: "og:url", content: url },
    { property: "og:image", content: img },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: BRAND },
    { name: "twitter:title", content: opts.title },
    { name: "twitter:description", content: opts.description },
    { name: "twitter:image", content: img },
  ];
  if (opts.keywords) meta.push({ name: "keywords", content: opts.keywords });
  return {
    meta,
    links: [
      { rel: "canonical", href: url },
      { rel: "alternate", type: "text/plain", href: absUrl(opts.origin, "/llms.txt"), title: "llms.txt" },
    ],
  };
}

export function privateHead(path: string, title: string) {
  return headTags({
    title,
    description: "Private surface. Not for search.",
    path,
    origin: "",
    noindex: true,
  });
}

export function legalHead(opts: {
  title: string;
  description: string;
  path: string;
  origin: string;
}) {
  return headTags({
    title: `${opts.title} | ${BRAND}`,
    description: clipMeta(opts.description),
    path: opts.path,
    origin: opts.origin,
    keywords: `${BRAND}, legal, 2257, terms, privacy, adult`,
  });
}
