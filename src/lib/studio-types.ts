import type { AestheticSuggestion } from "./theme";

export type StudioShotPlan = {
  step: number;
  title: string;
  visualBeat: string;
  imaginePrompt: string;
  priceCents: number;
  isClimax: boolean;
};

export type StudioMusePlan = {
  id?: string;
  stageName: string;
  slug: string;
  looks: string;
  voice: string;
  teaseStyle: string;
  bio: string;
  portrayedAgeMin: number;
  aliases: string;
};

export type StudioLadderPlan = {
  title: string;
  slug: string;
  theme: string;
  tagline: string;
  description: string;
};

export type StudioPlan = {
  mode: "new" | "likeness";
  muse: StudioMusePlan;
  ladder: StudioLadderPlan;
  shots: StudioShotPlan[];
  aesthetic: AestheticSuggestion;
  refUrls: string[];
};

export const STUDIO_PRICES = [499, 699, 899, 1199, 1499, 1799, 2299, 2799, 3699];
