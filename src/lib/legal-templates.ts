import {
  type ContentKind,
  type LegalEntity,
  type MuseModel,
  entityComplete,
  formatAddress,
  oneLineAddress,
} from "./legal-types";

/** Locked legal language. Grok may fill portrayal copy, not statutes. */

export type BuiltDoc = {
  id: string;
  scope: "site" | "model";
  modelId: string | null;
  kind: string;
  slug: string;
  title: string;
  body: string;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function contact(e: LegalEntity) {
  return e.contactEmail.trim() || "[operator contact email not yet on file]";
}

function dmca(e: LegalEntity) {
  return e.dmcaEmail.trim() || contact(e);
}

function site(e: LegalEntity) {
  return e.siteName.trim() || "SHE UNDRESSES";
}

function entityLabel(e: LegalEntity) {
  return e.entityName.trim() || `[Operating entity for ${site(e)} — complete in Ops → Legal]`;
}

function kindLabel(k: ContentKind) {
  if (k === "human") return "actual human performer";
  if (k === "hybrid") return "human performer with synthetic / AI-assisted depictions";
  return "synthetic / AI-generated fictional performer";
}

export function attorneyBanner() {
  return `NOTICE. These documents are operational templates modeled on industry practice (Fanvue, OnlyFans/Fenix, Fansly, and synthetic-content vaults). They are not legal advice and are not a substitute for a licensed attorney in your jurisdiction. 18 U.S.C. §§ 2257 and 2257A, 28 C.F.R. Part 75, state deepfake / synthetic-performer rules, and payment-processor policies change. Have counsel review before you take this vault live with paying collectors.`;
}

export function buildSiteDocs(e: LegalEntity, models: MuseModel[]): BuiltDoc[] {
  const name = site(e);
  const anyHuman = models.some((m) => m.contentKind !== "synthetic");
  const allSynthetic = models.length > 0 && models.every((m) => m.contentKind === "synthetic");
  const ready = entityComplete(e);
  const addr = formatAddress(e);
  const modelsList =
    models.length === 0
      ? "(No models loaded.)"
      : models
          .map(
            (m) =>
              `- ${m.stageName} (${m.slug}) — ${kindLabel(m.contentKind)}; portrayed age ${m.portrayedAgeMin}+; ${m.isFictional ? "fictional" : "not fictional"}; ladders: ${m.ladderSlugs || "none"}`,
          )
          .join("\n");

  const terms: BuiltDoc = {
    id: "doc_terms",
    scope: "site",
    modelId: null,
    kind: "terms",
    slug: "terms",
    title: "Terms of Service",
    body: `${attorneyBanner()}

Last updated: ${today()}
Operator: ${entityLabel(e)}
Governing law: ${e.jurisdiction || "Washington, United States"}

## 1. What this vault is
${name} is an adults-only sequential unlock vault. Collectors pay (typically in cryptocurrency) to be granted the next shot on a ladder. This is not a clothes-remover, not a "nudify" tool, and not a service that undresses photographs you upload. She undresses FOR the collector, in order.

## 2. Eligibility
You must be at least 18 years old (or the age of majority where you live, if higher) to enter, create an account, or pay. By entering you represent that you are not accessing from a jurisdiction where adult material is illegal. We may refuse or close any account.

## 3. Accounts
Email and password (and, where enabled, wallet or social sign-in) identify your vault. You are responsible for credentials. Grants are tied to your account. Do not share logins.

## 4. The product
Each shot is a paid permission. Shots unlock in sequence. Bundles and "next 3" upsells are optional. Prices, scarcity windows, and climax caps may change. Preferred rates can expire if you leave a ladder mid-undress.

## 5. License, not ownership
Payment grants you a personal, non-transferable, non-exclusive, revocable license to view the unlocked media in your signed-in vault and to keep a copy solely for your private, personal viewing. You do not buy the copyright, trademark, or any other right in ${name}, the muse, or the media.

You may not, and you agree you will not:
- duplicate, copy, screenshot-for-distribution, or reproduce the media except as a private personal archive;
- edit, crop-for-republish, remix, deepfake, face-swap, or otherwise alter the media for anyone but yourself;
- share, forward, gift-outside-this-vault, post, torrent, or otherwise make the media available to any other person;
- distribute, resell, sublicense, or commercially exploit the media in any form;
- scrape, bulk-download, or use the media to train, fine-tune, or prompt any AI / ML system;
- claim the muse is a real partner, or that you own or produced the set.

A personal save in your vault is allowed. Putting her on Telegram, Reddit, a tube site, another paywall, or a model file is a material breach. We may close the account, revoke future grants, and pursue DMCA / copyright claims. Already-paid frames may be removed when required by law or by a repeat leak.

By creating an account, checking the license box at checkout, or sending payment, you accept this license.

## 6. Crypto and no refunds
Payments are typically Bitcoin, Ethereum, USDT, or Solana. On-chain transfers are irreversible. Digital grants are delivered when the invoice confirms. Except where law requires otherwise, all sales are final. Chargebacks on any rail are a material breach and may close the vault to you.

## 7. Acceptable use
Forbidden: anyone 17 or under (depicted, implied, or requested); non-consensual imagery; real-person deepfakes or likenesses without written authorization; doxxing; scraping; payment fraud; attempting to skip sequential locks; duplicating, editing for republication, sharing, or distributing granted media.

## 8. Models and synthetic performers
Some or all models may be fictional synthetic performers. See the AI Disclosure and each model's card. You will not treat a fictional character as a real person, and you will not request that we depict a real identifiable person.

## 9. Termination
We may suspend access for breach, fraud, legal risk, or at our discretion. Unlocks already granted remain in your vault unless required by law to be removed.

## 10. Disclaimers
The vault is provided "as is." Media is adult fantasy. We do not warrant uninterrupted service. To the maximum extent permitted by ${e.jurisdiction || "applicable law"}, our liability is limited to the amount you paid us in the 90 days before the claim.

## 11. Disputes
Except where prohibited, disputes are resolved in the state courts of Washington, venue in Spokane County, under Washington law, without regard to conflict-of-law rules. Consumers in the EU/UK keep mandatory local rights.

## 12. Contact
${contact(e)}
${addr}

By creating an account or sending payment you accept these Terms.`,
  };

  const privacy: BuiltDoc = {
    id: "doc_privacy",
    scope: "site",
    modelId: null,
    kind: "privacy",
    slug: "privacy",
    title: "Privacy Policy",
    body: `${attorneyBanner()}

Last updated: ${today()}
Controller: ${entityLabel(e)} (${e.jurisdiction || "Washington, United States"})
Contact: ${contact(e)}

## 1. What we collect
- Account: email, display name, password hash, role.
- Vault: which shots you unlocked, invoices, crypto asset and pay-to address we generated, gift codes.
- Device: IP, browser, age-gate acknowledgment (stored locally and, if signed in, server-side events).
- Operator analytics: views, conversion, ladder paths (aggregated plus your user id if signed in).

We do not ask for card numbers in the demo crypto flow. On-chain payments are public on their respective ledgers — we do not control those ledgers.

## 2. What we do not collect in this app
Government ID images, biometric scans, and 2257 performer files are NOT stored in this application database. If a human performer appears, those records are held by the Custodian of Records at the inspection address in the 2257 statement — not in your collector account.

## 3. Why we process
- Contract: create your account, take payment, grant shots, show your vault.
- Legal obligation: 18+ access, tax/accounting if applicable, 2257 if actual persons are depicted, respond to lawful process.
- Legitimate interests: fraud prevention, security, sequential-unlock integrity, analytics.

## 4. Sharing
Processors that may see data: hosting, database, authentication, crypto invoice/IPN (e.g. NOWPayments in production), email. We do not sell personal information. We may disclose to law enforcement with a valid demand.

## 5. Retention
Account and unlock history: life of the account. Financial/invoice records: at least 7 years. 2257 performer records (custodian file, not this app): as required by 18 U.S.C. § 2257 (generally 7 years from production, 5 after dissolution). Age-gate flag: until you clear site data.

## 6. Your rights
Depending on Washington, California (CCPA/CPRA), and other laws you may request access, correction, deletion, or a copy of your data, and opt out of "sale"/"sharing" (we do not sell). Email ${contact(e)}. We will verify you control the account. We cannot delete records we must keep by law.

## 7. Children
This vault is not for anyone under 18. We do not knowingly collect data from children. If you believe a minor created an account, write ${contact(e)} and we will delete it.

## 8. International
If you access from outside the United States, you transfer data to the U.S. (and any host region we use). Do not use the vault if that is unlawful for you.

## 9. Intimate / adult data
Unlock history is sensitive. We treat it as confidential, limit staff access, and do not use it for advertising networks.

## 10. Changes
Material changes will be dated at the top of this page. Continued use after the date is acceptance.`,
  };

  const cookies: BuiltDoc = {
    id: "doc_cookies",
    scope: "site",
    modelId: null,
    kind: "cookies",
    slug: "cookies",
    title: "Cookie & Local Storage Notice",
    body: `${attorneyBanner()}

Last updated: ${today()}

${name} uses strictly necessary storage:
- Age-gate acknowledgment in local storage so you are not asked on every visit.
- Session / authentication cookies or tokens so you stay signed in.
- No third-party advertising cookies in the default vault.

You can clear site data in your browser. Doing so will show the age gate again and may sign you out. Analytics events (views, unlocks) are first-party server logs, not ad-tech pixels.`,
  };

  const refund: BuiltDoc = {
    id: "doc_refund",
    scope: "site",
    modelId: null,
    kind: "refund",
    slug: "refund",
    title: "Refund & Digital Delivery Policy",
    body: `${attorneyBanner()}

Last updated: ${today()}

Grants are digital goods delivered to your vault when the invoice confirms. Crypto payments cannot be reversed by us.

Because delivery is immediate and the media is viewable, all sales are final except where a statute gives you a mandatory cooling-off right (uncommon for completed digital adult content). If an invoice paid and a shot failed to unlock, write ${contact(e)} with the invoice id — we will repair the grant, not refund the chain.

Gifts: the payer is not the viewer. Refunds are not issued because the recipient did not like the ladder.`,
  };

  const dmcaDoc: BuiltDoc = {
    id: "doc_dmca",
    scope: "site",
    modelId: null,
    kind: "dmca",
    slug: "dmca",
    title: "DMCA / Copyright",
    body: `${attorneyBanner()}

Last updated: ${today()}
Designated agent: ${dmca(e)}
${addr}

If you are a copyright owner and believe material on ${name} infringes, send a notice including: your signature, the work claimed, the URL of the allegedly infringing material, your contact, a good-faith statement, and a statement under penalty of perjury that you are authorized. We will process notices under 17 U.S.C. § 512.

Counter-notices: if your grant was removed and you believe it was a mistake, send the statutory counter-notification to the same agent.

Repeat infringers lose their vault.

Synthetic characters and original ladders on this vault are original works of the operator. Scraping or training models on them is prohibited by the Terms.`,
  };

  const ai: BuiltDoc = {
    id: "doc_ai",
    scope: "site",
    modelId: null,
    kind: "ai",
    slug: "ai-disclosure",
    title: "Synthetic Performer / AI Disclosure",
    body: `${attorneyBanner()}

Last updated: ${today()}

## What you are looking at
${name} may depict synthetic (AI-generated) adult performers. A synthetic performer is a fictional character. She is not a real woman. She does not have a private life. She does not receive your payment personally.

## Age
Every synthetic character is configured and portrayed as 21 years of age or older. We do not generate or sell "teen," school, or age-play depictions. If a prompt, title, or ladder would imply a minor, it is refused.

## Not a nudify tool
You cannot upload a photo of a real person to undress them. That class of product (non-consensual "undress" apps) is banned here. Sequential unlocks are original sets produced for this vault.

## Likeness
Operators attest that synthetic models are not intended to depict a specific living identifiable person. Loading a model that clones a real person without written authorization is a Terms breach and may be a crime under state deepfake / intimate-image laws.

## Labeling
Where a model is synthetic, her model card and the 2257 exemption page say so. EU-style AI labeling: this media is artificially generated.

## Human performers
If a model is marked human or hybrid, 18 U.S.C. § 2257 records apply. See the 2257 statement.

Loaded models:
${modelsList}`,
  };

  const s2257: BuiltDoc = {
    id: "doc_2257",
    scope: "site",
    modelId: null,
    kind: "2257",
    slug: "2257",
    title: anyHuman
      ? "18 U.S.C. §§ 2257 / 2257A Records Statement"
      : "18 U.S.C. §§ 2257 / 2257A Exemption Statement",
    body: build2257Body(e, models, { anyHuman, allSynthetic, ready, addr, modelsList, name }),
  };

  return [terms, privacy, cookies, refund, dmcaDoc, ai, s2257];
}

function build2257Body(
  e: LegalEntity,
  models: MuseModel[],
  ctx: {
    anyHuman: boolean;
    allSynthetic: boolean;
    ready: boolean;
    addr: string;
    modelsList: string;
    name: string;
  },
) {
  const custodianBlock = ctx.ready
    ? `Custodian of Records: ${e.custodianName}, ${e.custodianTitle}
Records location (inspection address):
${ctx.addr}

Records required to be maintained by 18 U.S.C. §§ 2257, 2257A and 28 C.F.R. Part 75 will be made available to authorized inspectors at that address during normal business hours.`
    : `Custodian and inspection address: NOT COMPLETE.
The operator must enter a real legal name and a physical street address in Ops → Legal before publishing depictions of actual persons. A P.O. box is not sufficient under 28 C.F.R. Part 75. A stage name is not sufficient.`;

  const exemption = `## Exemption — synthetic / fictional depictions
The following visual depictions are exempt from 18 U.S.C. § 2257 record-keeping because they are not visual depictions of actual human beings engaged in actual sexually explicit conduct (see 18 U.S.C. § 2257(h) — "actual human being"; 18 U.S.C. § 2256). They are computer-generated fictional characters.

All such characters are portrayed as adults 21 years of age or older.

This exemption does not apply to any depiction of an actual person, including AI-edited imagery of an actual person (hybrid / deepfake). Those require full records.`;

  const records = `## Records — actual persons
All models, actors, and other persons that appear in any visual portrayal of actual sexually explicit conduct on this website were 18 years of age or older at the time of production. The records required by Title 18 U.S.C. §§ 2257, 2257A and 28 C.F.R. § 75 are on file with the Custodian of Records.

Date of production (first publication of this vault): see each model card.
Title of this work: ${ctx.name}.

${custodianBlock}

Other depictions are exempt because they: (1) do not portray conduct listed in 18 U.S.C. § 2256(2)(A)(i)–(iv); (2) do not portray conduct listed in 18 U.S.C. § 2257A produced after March 19, 2009; (3) do not portray lascivious exhibition listed in 18 U.S.C. § 2256(2)(A)(v) produced after March 19, 2009; (4) were created prior to July 3, 1995; or (5) this operator does not act as a "producer" as defined in 28 C.F.R. § 75.1(c) with respect to those images.`;

  return `${attorneyBanner()}

Last updated: ${today()}
Operator: ${entityLabel(e)}

18 U.S.C. § 2257 and 28 C.F.R. Part 75 require producers of visual depictions of actual human beings engaged in actual sexually explicit conduct to keep identifiable records (legal name, date of birth, government ID, aliases, date of production, URL) and to label every page of a website on which such matter appears with the name and street address of the Custodian of Records.

${ctx.allSynthetic || !ctx.anyHuman ? exemption : records}

${ctx.anyHuman && !ctx.allSynthetic ? `\n${exemption}\n` : ""}

## Models currently loaded
${ctx.modelsList}

## Secondary producer note
Platforms such as OnlyFans (Fenix International Ltd) and Fanvue (Shift Holdings Ltd) publish a site-wide 2257 and hold creator ID as secondary producers. If you redistribute these sets off this vault, you are a producer for that copy and need your own statement. This page covers ${ctx.name} only.

## Inspection
Authorized inspections are by the U.S. Attorney General as provided in 18 U.S.C. § 2257(c). This is not a public browsing address. Collectors: do not mail fan mail to the records address.`;
}

export function buildModelDocs(e: LegalEntity, m: MuseModel): BuiltDoc[] {
  const synthetic = m.contentKind === "synthetic";
  const title = synthetic
    ? `${m.stageName} — 2257 Exemption & Model Card`
    : `${m.stageName} — 2257 Records & Model Card`;

  const portrayal =
    m.cardPortrayal.trim() ||
    `${m.stageName} is an adult character on ${site(e)}. Portrayed age: ${m.portrayedAgeMin}+. ${m.bio}`.trim();

  const body = `${attorneyBanner()}

Last updated: ${today()}
Stage name: ${m.stageName}
Aliases: ${m.aliases || "none listed"}
Content kind: ${kindLabel(m.contentKind)}
Fictional: ${m.isFictional ? "yes" : "no"}
Portrayed age: ${m.portrayedAgeMin} years or older
First produced / loaded: ${m.firstProduced || today()}
Ladders: ${m.ladderSlugs || "none"}
Likeness attestation (not a real identifiable person, or authorized): ${m.likenessOk ? "yes" : "NO — do not publish"}

## Portrayal
${portrayal}

${
  synthetic
    ? `## 18 U.S.C. § 2257 status — EXEMPT (synthetic)
${m.stageName} is a computer-generated fictional adult. No actual human being is depicted. No performer identification records exist for this character because there is no performer. This card is the labeling required by our vault policy and by synthetic-performer disclosure rules.

If this model is later switched to "human" or "hybrid," a Custodian of Records, a physical inspection address, government ID, date of birth, and a signed release must be on file BEFORE any sexually explicit frame is published.`
    : `## 18 U.S.C. § 2257 status — RECORDS REQUIRED
This model is marked as an ${kindLabel(m.contentKind)}. Individually identifiable records (legal name, date of birth, copy of government photo ID, aliases, date of original production, URL of each depiction) must be cross-indexed and kept by the Custodian of Records for the statutory period.

Records on file in the custodian's cabinet (not in this app): ${m.recordsOnFile ? "YES — operator attested" : "NO — DO NOT PUBLISH EXPLICIT FRAMES"}
ID type attested: ${m.idTypeOnFile || "not stated"}

Custodian:
${formatAddress(e)}

The performer's legal name is not published here. It is in the records. Stage name only is shown to collectors.`
}

## What collectors are granted
A personal, non-transferable license to view sequential shots on the listed ladders inside this vault, and to keep a private copy for personal viewing only. No copyright. No right to duplicate, edit, share, or distribute. No right to train models. No right to claim ${m.stageName} is a real partner.

## Operator checklist (auto)
- Portrayed / actual age 18+ (this vault requires 21+ portrayal): ${m.portrayedAgeMin >= 21 ? "pass" : "FAIL"}
- Fictional or likeness attested: ${m.likenessOk ? "pass" : "FAIL"}
- Human records on file: ${synthetic ? "n/a (synthetic)" : m.recordsOnFile ? "pass" : "FAIL"}
- Entity / custodian complete: ${entityComplete(e) || synthetic ? "pass or n/a" : "FAIL for human publish"}
`;

  return [
    {
      id: `doc_model_${m.id}`,
      scope: "model",
      modelId: m.id,
      kind: "model-card",
      slug: m.slug,
      title,
      body,
    },
  ];
}

export function footer2257Label(models: MuseModel[]) {
  const anyHuman = models.some((m) => m.contentKind !== "synthetic");
  return anyHuman
    ? "18 U.S.C. §§ 2257 / 2257A Records"
    : "18 U.S.C. § 2257 Exemption";
}

export function modelCardPrompt(m: MuseModel, e: LegalEntity) {
  return {
    system: `You write a short Model Card portrayal for an adults-only sequential vault called ${site(e)}.
Rules:
- The legal clauses are written elsewhere. You only write 1-2 paragraphs of portrayal.
- Second person is allowed. No emoji. No hashtags.
- The character is 21+ (portrayed age ${m.portrayedAgeMin}+). Never imply younger.
- If content_kind is synthetic: she is fictional, AI-generated, not a real woman. Say so plainly once.
- If human: do not invent a legal name, address, or ID.
- Not a nudify tool. She undresses FOR the collector, in order.
- Do not invent statutes.
Return ONLY JSON: {"portrayal":"..."}`,
    user: `Stage name: ${m.stageName}
Kind: ${m.contentKind}
Fictional: ${m.isFictional}
Aliases: ${m.aliases}
Bio: ${m.bio}
Ladders: ${m.ladderSlugs}
Portrayed age min: ${m.portrayedAgeMin}
Write portrayal.`,
  };
}
