export type League = 'nfl' | 'nba';
export type TeamKey = 'dal' | 'hou' | 'sa';
export interface Game { id: string; league: League; teams: TeamKey[]; home: string; away: string; start: string; timeSet: boolean }
export interface Schedule { source?: string; generatedAt?: string; timeZone?: string; games: Game[] }
export interface Venue { name: string; url: string; streetAddress: string; addressLocality: string; addressRegion: string; postalCode?: string }
export declare const TIME_ZONE: 'America/Chicago';
export declare const TEAMS: Record<TeamKey, { league: League; name: string; full: string }>;
export declare const DURATION_MIN: Record<League, number>;
export declare function endOf(g: Game): Date;
export declare function isLive(g: Game, now?: Date): boolean;
export declare function upcomingGames(schedule: Schedule, opts?: { now?: Date; teams?: TeamKey[]; days?: number; limit?: number }): Game[];
export declare function isActive(schedule: Schedule, opts?: { now?: Date; teams?: TeamKey[]; days?: number }): boolean;
export declare function kickoff(g: Game, locale?: 'en' | 'es'): { weekday: string; date: string; time: string; timeSet: boolean };
export declare function matchup(g: Game): string;
export declare function eventJsonLd(g: Game, venue: Venue, locale?: 'en' | 'es'): Record<string, unknown>;
