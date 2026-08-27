import { createServerFn } from "@tanstack/react-start";
import { getSql, type Sql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { DEFAULT_THEME, parseTheme, completeTheme, type VaultTheme } from "@/lib/theme";
import { ensureStampTables } from "./stamps";

let themeColReady = false;

export async function ensureThemeColumn(sql: Sql) {
  await ensureStampTables(sql);
  if (themeColReady) return;
  await sql`alter table vault_settings add column if not exists theme_json text not null default ''`;
  themeColReady = true;
}

export async function loadTheme(sql: Sql): Promise<VaultTheme> {
  await ensureThemeColumn(sql);
  const rows = await sql<{ theme_json: string | null }>`
    select theme_json from vault_settings where id = 1
  `;
  return parseTheme(rows[0]?.theme_json);
}

export const getTheme = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  try {
    return await loadTheme(sql);
  } catch {
    return DEFAULT_THEME;
  }
});

export const saveTheme = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: VaultTheme) => completeTheme(d))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const { ensureProfile } = await import("./catalog");
    const role = await ensureProfile(sql, context.userId);
    if (role !== "admin") throw new Error("Operator access only.");
    await ensureThemeColumn(sql);
    const json = JSON.stringify(data);
    await sql`
      insert into vault_settings (id, theme_json, updated_at)
      values (1, ${json}, now())
      on conflict (id) do update set
        theme_json = excluded.theme_json,
        updated_at = now()
    `;
    return data;
  });
