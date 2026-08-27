/** Operator-controlled vault palette + type. CSS vars on html. */

export type VaultTheme = {
  bg: string;
  surface: string;
  raised: string;
  fg: string;
  muted: string;
  subtle: string;
  blood: string;
  bloodDeep: string;
  accent: string;
  accentSoft: string;
  plum: string;
  border: string;
  displayFont: string;
  bodyFont: string;
};

export const DEFAULT_THEME: VaultTheme = {
  bg: "#0a0a0a",
  surface: "#121212",
  raised: "#1a1516",
  fg: "#f3efe6",
  muted: "#a39e94",
  subtle: "#6e6a64",
  blood: "#9b1b30",
  bloodDeep: "#6b1222",
  accent: "#c9a227",
  accentSoft: "#e0c56a",
  plum: "#5c3d5e",
  border: "#2a2422",
  displayFont: "Cormorant Garamond",
  bodyFont: "Outfit",
};

export const DISPLAY_FONTS = [
  { id: "Cormorant Garamond", stack: '"Cormorant Garamond", ui-serif, Georgia, serif' },
  { id: "Playfair Display", stack: '"Playfair Display", ui-serif, Georgia, serif' },
  { id: "Fraunces", stack: '"Fraunces", ui-serif, Georgia, serif' },
  { id: "Cinzel", stack: '"Cinzel", ui-serif, Georgia, serif' },
  { id: "DM Serif Display", stack: '"DM Serif Display", ui-serif, Georgia, serif' },
  { id: "Libre Baskerville", stack: '"Libre Baskerville", ui-serif, Georgia, serif' },
  { id: "Bodoni Moda", stack: '"Bodoni Moda", ui-serif, Georgia, serif' },
] as const;

export const BODY_FONTS = [
  { id: "Outfit", stack: '"Outfit", ui-sans-serif, system-ui, sans-serif' },
  { id: "Figtree", stack: '"Figtree", ui-sans-serif, system-ui, sans-serif' },
  { id: "Manrope", stack: '"Manrope", ui-sans-serif, system-ui, sans-serif' },
  { id: "Source Sans 3", stack: '"Source Sans 3", ui-sans-serif, system-ui, sans-serif' },
  { id: "Karla", stack: '"Karla", ui-sans-serif, system-ui, sans-serif' },
  { id: "IBM Plex Sans", stack: '"IBM Plex Sans", ui-sans-serif, system-ui, sans-serif' },
] as const;

export const THEME_PRESETS: { id: string; label: string; theme: VaultTheme }[] = [
  { id: "gold", label: "Gold / blood", theme: DEFAULT_THEME },
  {
    id: "ivory",
    label: "Ivory editorial",
    theme: completeTheme({
      bg: "#f4efe6",
      surface: "#ebe4d6",
      fg: "#1c1814",
      accent: "#8a6a14",
      blood: "#8e1c2c",
      displayFont: "Playfair Display",
      bodyFont: "Source Sans 3",
    }),
  },
  {
    id: "noir",
    label: "Cool noir",
    theme: completeTheme({
      bg: "#0b0c10",
      surface: "#14161c",
      fg: "#e8eaef",
      accent: "#c5c9d4",
      blood: "#7a2436",
      displayFont: "Cinzel",
      bodyFont: "IBM Plex Sans",
    }),
  },
  {
    id: "wine",
    label: "Wine silk",
    theme: completeTheme({
      bg: "#12090c",
      surface: "#1c1014",
      fg: "#f2e6e4",
      accent: "#d4a574",
      blood: "#8b1e36",
      displayFont: "Bodoni Moda",
      bodyFont: "Figtree",
    }),
  },
  {
    id: "forest",
    label: "Forest gold",
    theme: completeTheme({
      bg: "#0b100e",
      surface: "#141c18",
      fg: "#e8efe6",
      accent: "#c4a35a",
      blood: "#7a2a28",
      displayFont: "Fraunces",
      bodyFont: "Manrope",
    }),
  },
];

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.trim().replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return {
    r: Number.parseInt(h.slice(0, 2), 16),
    g: Number.parseInt(h.slice(2, 4), 16),
    b: Number.parseInt(h.slice(4, 6), 16),
  };
}

export function mixHex(a: string, b: string, t: number): string {
  const pa = parseHex(a);
  const pb = parseHex(b);
  if (!pa || !pb) return a;
  const m = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `#${[m(pa.r, pb.r), m(pa.g, pb.g), m(pa.b, pb.b)]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("")}`;
}

export function isHex(v: unknown): v is string {
  return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v.trim());
}

function fontId(v: unknown, allowed: readonly { id: string }[], fallback: string) {
  if (typeof v !== "string") return fallback;
  return allowed.some((f) => f.id === v) ? v : fallback;
}

export function completeTheme(partial: Partial<VaultTheme> & { bg?: string; surface?: string; fg?: string; accent?: string; blood?: string }): VaultTheme {
  const bg = isHex(partial.bg) ? partial.bg : DEFAULT_THEME.bg;
  const fg = isHex(partial.fg) ? partial.fg : DEFAULT_THEME.fg;
  const surface = isHex(partial.surface) ? partial.surface : mixHex(bg, fg, 0.06);
  const accent = isHex(partial.accent) ? partial.accent : DEFAULT_THEME.accent;
  const blood = isHex(partial.blood) ? partial.blood : DEFAULT_THEME.blood;
  return {
    bg,
    surface,
    raised: isHex(partial.raised) ? partial.raised : mixHex(surface, fg, 0.08),
    fg,
    muted: isHex(partial.muted) ? partial.muted : mixHex(fg, bg, 0.38),
    subtle: isHex(partial.subtle) ? partial.subtle : mixHex(fg, bg, 0.58),
    blood,
    bloodDeep: isHex(partial.bloodDeep) ? partial.bloodDeep : mixHex(blood, bg, 0.35),
    accent,
    accentSoft: isHex(partial.accentSoft) ? partial.accentSoft : mixHex(accent, fg, 0.38),
    plum: isHex(partial.plum) ? partial.plum : mixHex(blood, accent, 0.42),
    border: isHex(partial.border) ? partial.border : mixHex(fg, bg, 0.82),
    displayFont: fontId(partial.displayFont, DISPLAY_FONTS, DEFAULT_THEME.displayFont),
    bodyFont: fontId(partial.bodyFont, BODY_FONTS, DEFAULT_THEME.bodyFont),
  };
}

export function parseTheme(raw: string | null | undefined): VaultTheme {
  if (!raw?.trim()) return DEFAULT_THEME;
  try {
    return completeTheme(JSON.parse(raw) as Partial<VaultTheme>);
  } catch {
    return DEFAULT_THEME;
  }
}

function stackFor(id: string, list: readonly { id: string; stack: string }[]) {
  return list.find((f) => f.id === id)?.stack ?? `"${id}", system-ui, sans-serif`;
}

export function themeCssVars(theme: VaultTheme): Record<string, string> {
  return {
    "--color-bg": theme.bg,
    "--color-surface": theme.surface,
    "--color-raised": theme.raised,
    "--color-fg": theme.fg,
    "--color-muted": theme.muted,
    "--color-subtle": theme.subtle,
    "--color-blood": theme.blood,
    "--color-blood-deep": theme.bloodDeep,
    "--color-gold": theme.accent,
    "--color-gold-soft": theme.accentSoft,
    "--color-plum": theme.plum,
    "--color-border": theme.border,
    "--font-display": stackFor(theme.displayFont, DISPLAY_FONTS),
    "--font-sans": stackFor(theme.bodyFont, BODY_FONTS),
  };
}

export function googleFontsHref(displayFont: string, bodyFont: string) {
  const enc = (n: string) => n.replace(/ /g, "+");
  return `https://fonts.googleapis.com/css2?family=${enc(displayFont)}:ital,wght@0,400;0,500;0,600;0,700;1,500&family=${enc(bodyFont)}:wght@300;400;500;600;700&display=swap`;
}

export function applyThemeToDocument(theme: VaultTheme) {
  if (typeof document === "undefined") return;
  const vars = themeCssVars(theme);
  const root = document.documentElement;
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  const href = googleFontsHref(theme.displayFont, theme.bodyFont);
  let link = document.getElementById("vault-fonts") as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.id = "vault-fonts";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }
  if (link.href !== href) link.href = href;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme.bg);
  try {
    localStorage.setItem("vault-theme", JSON.stringify(theme));
  } catch {
    /* ignore */
  }
}

export type AestheticSuggestion = {
  name: string;
  promptStyle: string;
  rationale: string;
  palette: {
    bg: string;
    surface: string;
    fg: string;
    accent: string;
    blood: string;
  };
  displayFont: string;
  bodyFont: string;
};

export function themeFromAesthetic(a: AestheticSuggestion): VaultTheme {
  return completeTheme({
    bg: a.palette.bg,
    surface: a.palette.surface,
    fg: a.palette.fg,
    accent: a.palette.accent,
    blood: a.palette.blood,
    displayFont: a.displayFont,
    bodyFont: a.bodyFont,
  });
}
