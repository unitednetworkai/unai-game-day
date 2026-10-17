# unai-game-day

Which Cowboys, Texans and Spurs games are on this week, in San Antonio (Central) time.
Shared by the United Network AI restaurant sites' Game Day pages.

```js
import schedule from 'unai-game-day/schedule.json';
import { upcomingGames, isActive, kickoff, matchup, eventJsonLd } from 'unai-game-day';

const games = upcomingGames(schedule, { teams: ['dal', 'hou', 'sa'], days: 7 });
games.map((g) => `${kickoff(g, 'es').weekday} ${kickoff(g).time} ${matchup(g)}`);
```

- Plain ESM with JSDoc types, zero dependencies, no build step.
- Times render in `America/Chicago`, correct across the November DST change.
- A kickoff the league has not set yet renders as **Time TBD / Hora por confirmar**, never a guess.
- `isActive()` goes false when the schedule runs out, so a page built on it switches itself off.

Schedule data comes from ESPN's public team schedules: `npm run refresh`.
