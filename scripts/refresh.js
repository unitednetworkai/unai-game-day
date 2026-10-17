#!/usr/bin/env node
// Regenerates data/schedule.json from ESPN's public team schedules.
// Usage: node scripts/refresh.js            (writes the file)
//        node scripts/refresh.js --check    (fetches and validates, writes nothing)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TEAMS } from '../src/index.js';

const OUT = fileURLToPath(new URL('../data/schedule.json', import.meta.url));
const SOURCES = [
  { team: 'dal', path: 'football/nfl/teams/dal/schedule', season: 2026 },
  { team: 'hou', path: 'football/nfl/teams/hou/schedule', season: 2026 },
  { team: 'sa', path: 'basketball/nba/teams/sa/schedule', season: 2027 },
];
const SEASON_TYPES = [2, 3]; // regular season, postseason

/** Map one ESPN event to our Game shape. Exported for tests. */
export function toGame(ev, team) {
  const c = ev.competitions?.[0];
  const side = (h) => c?.competitors?.find((x) => x.homeAway === h)?.team?.shortDisplayName;
  const home = side('home'), away = side('away');
  if (!ev.id || !home || !away || Number.isNaN(Date.parse(ev.date))) {
    throw new Error(`refresh: malformed event ${ev.id ?? '(no id)'} for ${team}`);
  }
  return {
    id: String(ev.id),
    league: TEAMS[team].league,
    teams: [team],
    home,
    away,
    start: new Date(ev.date).toISOString(),
    timeSet: (ev.timeValid ?? c?.timeValid) !== false,
  };
}

/** Merge per-team lists; a game between two tracked teams keeps both keys. */
export function merge(lists) {
  const byId = new Map();
  for (const g of lists.flat()) {
    const prev = byId.get(g.id);
    if (prev) prev.teams = [...new Set([...prev.teams, ...g.teams])].sort();
    else byId.set(g.id, { ...g, teams: [...g.teams] });
  }
  return [...byId.values()].sort((a, b) => Date.parse(a.start) - Date.parse(b.start) || a.id.localeCompare(b.id));
}

/**
 * Refuse to replace a schedule with one that lost games for any team. An API
 * hiccup that returns an empty or partial list must fail loudly, not quietly
 * blank every restaurant's Game Day page.
 */
export function assertNoShrink(prev, next) {
  for (const team of Object.keys(TEAMS)) {
    const count = (s) => s.games.filter((g) => g.teams.includes(team)).length;
    const before = count(prev), after = count(next);
    if (after < before) throw new Error(`refresh: ${team} would drop from ${before} to ${after} games — refusing to write`);
    if (after === 0) throw new Error(`refresh: ${team} has no games — refusing to write`);
  }
}

async function fetchTeam({ team, path, season }) {
  const out = [];
  for (const st of SEASON_TYPES) {
    const url = `https://site.api.espn.com/apis/site/v2/sports/${path}?season=${season}&seasontype=${st}`;
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`refresh: ${url} → HTTP ${res.status}`);
    const body = await res.json();
    out.push(...(body.events ?? []).map((ev) => toGame(ev, team)));
  }
  return out;
}

async function main() {
  const check = process.argv.includes('--check');
  const lists = await Promise.all(SOURCES.map(fetchTeam));
  const next = { source: 'ESPN public team schedules', generatedAt: new Date().toISOString(), timeZone: 'America/Chicago', games: merge(lists) };
  if (existsSync(OUT)) assertNoShrink(JSON.parse(readFileSync(OUT, 'utf8')), next);
  const summary = Object.keys(TEAMS).map((t) => `${t}=${next.games.filter((g) => g.teams.includes(t)).length}`).join(' ');
  if (check) { console.log(`ok (not written): ${summary}`); return; }
  writeFileSync(OUT, JSON.stringify(next, null, 2) + '\n');
  console.log(`wrote ${OUT}: ${summary}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
