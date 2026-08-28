import type { Sql } from "@/lib/db";

/** Live climax occupancy: granted climax unlocks + unredeemed reserved gifts. */
export async function climaxOccupied(sql: Sql, ladderId: string) {
  const rows = await sql<{ occupied: number }>`
    select (
      (
        select count(distinct u.user_id)::int
        from unlocks u
        join shots s on s.id = u.shot_id
        where u.ladder_id = ${ladderId} and s.is_climax
      )
      +
      (
        select count(*)::int
        from gifts g
        where g.ladder_id = ${ladderId}
          and g.reserved_climax = true
          and g.redeemed_by is null
      )
    )::int as occupied
  `;
  return rows[0]?.occupied ?? 0;
}

export async function writeClimaxOccupancy(sql: Sql, ladderId: string) {
  const occupied = await climaxOccupied(sql, ladderId);
  await sql`
    update ladders set climax_collectors = ${occupied} where id = ${ladderId}
  `;
  return occupied;
}
