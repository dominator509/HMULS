import { LIORA } from "./muses";

export type ContentKind = "synthetic" | "human" | "hybrid";

export type LegalEntity = {
  siteName: string;
  entityName: string;
  jurisdiction: string;
  custodianName: string;
  custodianTitle: string;
  address1: string;
  address2: string;
  city: string;
  region: string;
  postal: string;
  country: string;
  contactEmail: string;
  dmcaEmail: string;
  websiteUrl: string;
};

export type MuseModel = {
  id: string;
  slug: string;
  stageName: string;
  contentKind: ContentKind;
  portrayedAgeMin: number;
  aliases: string;
  bio: string;
  isFictional: boolean;
  likenessOk: boolean;
  recordsOnFile: boolean;
  idTypeOnFile: string;
  firstProduced: string;
  ladderSlugs: string;
  cardPortrayal: string;
  voice: string;
  looks: string;
  teaseStyle: string;
};

export type LegalDoc = {
  id: string;
  scope: "site" | "model";
  modelId: string | null;
  kind: string;
  slug: string;
  title: string;
  body: string;
  version: number;
  generatedAt: string;
};

export const DEFAULT_ENTITY: LegalEntity = {
  siteName: "SHE UNDRESSES",
  entityName: "",
  jurisdiction: "Washington, United States",
  custodianName: "",
  custodianTitle: "Custodian of Records",
  address1: "",
  address2: "",
  city: "",
  region: "WA",
  postal: "",
  country: "United States",
  contactEmail: "",
  dmcaEmail: "",
  websiteUrl: "https://sheundresses.com",
};

export const LIORA_SEED: MuseModel = {
  id: LIORA.id,
  slug: LIORA.slug,
  stageName: LIORA.stageName,
  contentKind: "synthetic",
  portrayedAgeMin: 24,
  aliases: "The woman in the robe",
  bio: "Fictional adult character. Sequential ladders: The Reveal, The Curve, The Pedestal. Each photoset is its own night — frontal, back, floor.",
  isFictional: true,
  likenessOk: true,
  recordsOnFile: false,
  idTypeOnFile: "",
  firstProduced: "2026-08-01",
  ladderSlugs: "the-reveal,the-curve,the-pedestal",
  cardPortrayal: "",
  voice: LIORA.voice,
  looks: LIORA.looks,
  teaseStyle: LIORA.teaseStyle,
};

export function entityComplete(e: LegalEntity) {
  return Boolean(
    e.entityName.trim() &&
      e.custodianName.trim() &&
      e.address1.trim() &&
      e.city.trim() &&
      e.region.trim() &&
      e.country.trim() &&
      e.contactEmail.trim(),
  );
}

export function formatAddress(e: LegalEntity) {
  const lines = [
    e.entityName,
    e.custodianTitle ? `${e.custodianName}, ${e.custodianTitle}` : e.custodianName,
    e.address1,
    e.address2,
    [e.city, e.region, e.postal].filter(Boolean).join(", "),
    e.country,
  ].filter((x) => x && x.trim());
  return lines.join("\n") || "[Physical inspection address not yet on file]";
}

export function oneLineAddress(e: LegalEntity) {
  return (
    [e.address1, e.address2, e.city, e.region, e.postal, e.country]
      .filter((x) => x && x.trim())
      .join(", ") || "[address not yet on file]"
  );
}
