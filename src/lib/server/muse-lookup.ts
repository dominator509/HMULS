import type { Sql } from "@/lib/db";
import { LIORA, type MuseBible } from "@/lib/muses";

export function bibleFromRow(row: {
  id: string;
  slug: string;
  stage_name: string;
  voice: string | null;
  looks: string | null;
  tease_style: string | null;
}): MuseBible {
  return {
    id: row.id,
    slug: row.slug,
    stageName: row.stage_name,
    voice: row.voice?.trim() || LIORA.voice,
    looks: row.looks?.trim() || "",
    teaseStyle: row.tease_style?.trim() || LIORA.teaseStyle,
  };
}

export async function loadMuseBibles(sql: Sql): Promise<Map<string, MuseBible>> {
  const map = new Map<string, MuseBible>();
  map.set(LIORA.id, LIORA);
  map.set(LIORA.slug, LIORA);
  try {
    const rows = await sql<{
      id: string;
      slug: string;
      stage_name: string;
      voice: string | null;
      looks: string | null;
      tease_style: string | null;
    }>`select id, slug, stage_name, voice, looks, tease_style from models`;
    for (const r of rows) {
      const b = bibleFromRow(r);
      map.set(b.id, b);
      map.set(b.slug, b);
    }
  } catch {
    /* models table not ready yet */
  }
  return map;
}

export async function bibleFor(sql: Sql, modelId: string | null | undefined): Promise<MuseBible> {
  const map = await loadMuseBibles(sql);
  if (modelId && map.has(modelId)) return map.get(modelId)!;
  return LIORA;
}

export function slugify(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
