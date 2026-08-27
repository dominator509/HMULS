export type CryptoAsset = "BTC" | "ETH" | "USDT" | "SOL";

export type InvoiceKind = "shot" | "bundle" | "upsell" | "gift";

export type ShotPublic = {
  id: string;
  ladderId: string;
  stepIndex: number;
  title: string;
  tease: string;
  grantCopy: string;
  story: string;
  dropLine: string;
  mediaType: "photo" | "video";
  teaserUrl: string;
  objectPosition: string;
  priceCents: number;
  isClimax: boolean;
  unlocked: boolean;
  mediaUrl: string | null;
};

export type LadderPublic = {
  id: string;
  slug: string;
  title: string;
  theme: string;
  tagline: string;
  description: string;
  coverUrl: string;
  sortOrder: number;
  bundleDiscount: number;
  collectorsCount: number;
  climaxCollectors: number;
  climaxCap: number;
  scarcityEndsAt: string | null;
  modelId: string;
  modelName: string;
  modelSlug: string;
  photosetHook: string;
  photosetTease: string;
  shots: ShotPublic[];
};

export type ProgressState = {
  unlockedCount: number;
  total: number;
  spentCents: number;
  nextShotId: string | null;
  hasClimax: boolean;
  remainingCents: number;
  bundleCents: number;
};

export type InvoiceView = {
  id: string;
  ladderId: string;
  ladderTitle: string;
  kind: InvoiceKind;
  shotIds: string[];
  shotTitles: string[];
  amountCents: number;
  asset: CryptoAsset;
  payAddress: string;
  cryptoAmount: string;
  status: "pending" | "confirming" | "paid" | "expired";
  isGift: boolean;
  giftCode: string | null;
  createdAt: string;
  expiresAt: string | null;
  payMethod?: string | null;
  walletAddress?: string | null;
  txHash?: string | null;
};

export type VaultItem = {
  shotId: string;
  ladderId: string;
  ladderTitle: string;
  ladderSlug: string;
  title: string;
  stepIndex: number;
  mediaType: "photo" | "video";
  mediaUrl: string;
  objectPosition: string;
  grantCopy: string;
  unlockedAt: string;
};

export type AnalyticsSnapshot = {
  revenueCents: number;
  unlockCount: number;
  invoiceCount: number;
  conversionPct: number;
  byLadder: {
    ladderId: string;
    title: string;
    revenueCents: number;
    unlocks: number;
    views: number;
    climaxUnlocks: number;
  }[];
  recent: {
    id: number;
    kind: string;
    ladderId: string | null;
    createdAt: string;
    amountCents: number | null;
  }[];
};
