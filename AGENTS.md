# unai-game-day — canonical handoff

**Root:** `/Users/jorge/Desktop/United Network AI/unai-game-day`
**Repo:** `unitednetworkai/unai-game-day`, **PUBLIC** by Jorge's decision 2026-10-17, so Netlify builds can install it with no credential. Holds only public sports schedules and date logic. **Never add client data, prices or business facts here.**
**Stack:** plain ESM + JSDoc, zero dependencies, no build step. npm, no lockfile needed (no deps).
**Consumers pin an exact commit:** `"unai-game-day": "github:unitednetworkai/unai-game-day#<sha>"`. A schedule refresh reaches a site only when that site bumps the pin.

## Commands
```bash
npm test               # node --test; 15 tests, 7 NEGATIVE
npm run refresh        # rewrite data/schedule.json from ESPN; refuses to write if any team lost games
npm run refresh:check  # fetch + validate, write nothing
```

## Data
- Teams: Cowboys (`dal`), Texans (`hou`) — NFL 2026 regular + postseason; Spurs (`sa`) — NBA 2026-27.
- Source: `site.api.espn.com/apis/site/v2/sports/<sport>/<league>/teams/<team>/schedule?season=&seasontype=2|3`. Public, unofficial, free.
- `timeSet: false` means the league has not fixed the kickoff (NFL Week 18, flex games). It renders as TBD.
- ⚠️ NFL flexes late-season kickoffs about 12 days out. Refresh and bump consumers weekly from Week 10 on.
- 2026-10-17 first fetch: dal 17, hou 17, sa 80 (the NBA Cup knockout dates are not listed until set).

## Gates
- Every guard has a NEGATIVE test, and 8 mutants were killed on 2026-10-17 (dedupe, in-progress window, time zone, TBD, switch-off, venue validation, ordering, shrink guard). Re-run mutations when adding a guard.

## Rules carried from the studio
- Wording on client pages: no NFL/NBA or team logos; "the Big Game", never "Super Bowl". Team names in plain text are fine.
