import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { upcomingGames, isActive, isLive, kickoff, matchup, eventJsonLd, endOf } from '../src/index.js';
import { toGame, merge, assertNoShrink } from '../scripts/refresh.js';

const g = (id, teams, start, extra = {}) => ({ id, league: teams.includes('sa') ? 'nba' : 'nfl', teams, home: 'Home', away: 'Away', start, timeSet: true, ...extra });
const S = {
  games: [
    g('1', ['dal'], '2026-10-19T00:20:00Z', { home: 'Packers', away: 'Cowboys' }),
    g('2', ['hou'], '2026-10-18T13:30:00Z'),
    g('3', ['sa'], '2026-10-21T01:30:00Z'),
    g('4', ['dal'], '2026-10-27T00:15:00Z'),
    g('5', ['dal', 'hou'], '2026-10-04T17:00:00Z'),
  ],
};
const at = (iso) => new Date(iso);

test('upcomingGames: window, order and team filter', () => {
  const ids = upcomingGames(S, { now: at('2026-10-17T12:00:00Z') }).map((x) => x.id);
  assert.deepEqual(ids, ['2', '1', '3']); // 4 is 9+ days out, 5 is over
  assert.deepEqual(upcomingGames(S, { now: at('2026-10-17T12:00:00Z'), teams: ['sa'] }).map((x) => x.id), ['3']);
});

test('NEGATIVE upcomingGames: a finished game is dropped, one in progress is kept', () => {
  const live = upcomingGames(S, { now: at('2026-10-19T02:00:00Z'), teams: ['dal'] });
  assert.deepEqual(live.map((x) => x.id), ['1']);
  assert.ok(isLive(live[0], at('2026-10-19T02:00:00Z')));
  const over = upcomingGames(S, { now: at('2026-10-19T04:00:00Z'), teams: ['dal'], days: 3 });
  assert.deepEqual(over.map((x) => x.id), []);
});

test('NEGATIVE upcomingGames: a game between two tracked teams appears once', () => {
  const dup = { games: [g('9', ['dal'], '2026-11-01T18:00:00Z'), g('9', ['hou'], '2026-11-01T18:00:00Z')] };
  assert.equal(upcomingGames(dup, { now: at('2026-10-31T00:00:00Z') }).length, 1);
});

test('NEGATIVE isActive turns off when the schedule runs out', () => {
  assert.equal(isActive(S, { now: at('2026-10-17T00:00:00Z') }), true);
  assert.equal(isActive(S, { now: at('2026-12-01T00:00:00Z') }), false);
});

test('kickoff is Central time across the DST change', () => {
  assert.deepEqual(kickoff(g('a', ['dal'], '2026-10-19T00:20:00Z')), { weekday: 'SUN', date: 'Oct 18', time: '7:20 PM', timeSet: true });
  assert.equal(kickoff(g('b', ['dal'], '2026-11-08T18:00:00Z')).time, '12:00 PM'); // CST, after Nov 1
  assert.equal(kickoff(g('c', ['dal'], '2026-10-04T17:00:00Z')).time, '12:00 PM'); // CDT
});

test('kickoff in Spanish', () => {
  const k = kickoff(g('a', ['dal'], '2026-10-19T00:20:00Z'), 'es');
  assert.equal(k.weekday, 'DOM');
  assert.equal(k.date, '18 oct');
  assert.equal(k.time, '7:20 PM');
});

test('NEGATIVE kickoff never invents a time the league has not set', () => {
  const tbd = g('t', ['dal'], '2027-01-10T05:00:00Z', { timeSet: false });
  assert.equal(kickoff(tbd).time, 'Time TBD');
  assert.equal(kickoff(tbd, 'es').time, 'Hora por confirmar');
});

test('matchup uses away @ home', () => {
  assert.equal(matchup(S.games[0]), 'Cowboys @ Packers');
});

const venue = { name: 'El Canelo #6', url: 'https://elcanelo6.com/', streetAddress: '1003 Culebra Rd', addressLocality: 'San Antonio', addressRegion: 'TX', postalCode: '78201' };

test('eventJsonLd describes a real, free, in-person event at the venue', () => {
  const ld = eventJsonLd(S.games[0], venue);
  assert.equal(ld['@type'], 'Event');
  assert.equal(ld.startDate, '2026-10-19T00:20:00Z');
  assert.equal(ld.endDate, endOf(S.games[0]).toISOString());
  assert.equal(ld.location.address.streetAddress, '1003 Culebra Rd');
  assert.equal(ld.eventAttendanceMode, 'https://schema.org/OfflineEventAttendanceMode');
  assert.match(ld.name, /watch at El Canelo #6$/);
});

test('NEGATIVE eventJsonLd refuses a venue with no address', () => {
  assert.throws(() => eventJsonLd(S.games[0], { ...venue, streetAddress: '' }), /streetAddress/);
  assert.throws(() => eventJsonLd(S.games[0], undefined), /name/);
});

const espn = (id, date, home, away, timeValid = true) => ({ id, date, timeValid, competitions: [{ competitors: [{ homeAway: 'home', team: { shortDisplayName: home } }, { homeAway: 'away', team: { shortDisplayName: away } }] }] });

test('toGame maps ESPN and keeps TBD times flagged', () => {
  assert.deepEqual(toGame(espn('7', '2027-01-10T05:00Z', 'Commanders', 'Cowboys', false), 'dal'),
    { id: '7', league: 'nfl', teams: ['dal'], home: 'Commanders', away: 'Cowboys', start: '2027-01-10T05:00:00.000Z', timeSet: false });
});

test('NEGATIVE toGame throws on a malformed event', () => {
  assert.throws(() => toGame({ id: '8', date: 'nope', competitions: [] }, 'dal'), /malformed/);
});

test('merge keeps both teams on a shared game', () => {
  const m = merge([[toGame(espn('5', '2026-10-04T17:00Z', 'Texans', 'Cowboys'), 'dal')], [toGame(espn('5', '2026-10-04T17:00Z', 'Texans', 'Cowboys'), 'hou')]]);
  assert.equal(m.length, 1);
  assert.deepEqual(m[0].teams, ['dal', 'hou']);
});

test('NEGATIVE assertNoShrink refuses a refresh that lost games', () => {
  const prev = { games: [g('1', ['dal'], 'x'), g('2', ['hou'], 'x'), g('3', ['sa'], 'x')] };
  assert.doesNotThrow(() => assertNoShrink(prev, prev));
  assert.throws(() => assertNoShrink(prev, { games: [g('1', ['dal'], 'x'), g('3', ['sa'], 'x')] }), /hou would drop/);
});

test('the committed schedule is whole and well-formed', () => {
  const data = JSON.parse(readFileSync(new URL('../data/schedule.json', import.meta.url), 'utf8'));
  const n = (t) => data.games.filter((x) => x.teams.includes(t)).length;
  assert.ok(n('dal') >= 17, `dal ${n('dal')}`);
  assert.ok(n('hou') >= 17, `hou ${n('hou')}`);
  assert.ok(n('sa') >= 80, `sa ${n('sa')}`);
  assert.equal(new Set(data.games.map((x) => x.id)).size, data.games.length, 'duplicate ids');
  for (const x of data.games) assert.ok(!Number.isNaN(Date.parse(x.start)), `bad start ${x.id}`);
});
