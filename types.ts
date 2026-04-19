
import React from 'react';

export interface Source {
  name: string;
  url: string;
  logo?: string;
  group?: string;
  type?: 'm3u' | 'xtream' | 'direct';
  epgId?: string;
  epgUrl?: string;
  playlistName?: string;
  playlistId?: string;
}

export interface EPGProgram {
  start: number;
  stop: number;
  title: string;
  description?: string;
  channelId: string;
}

export interface EPGData {
  [channelId: string]: EPGProgram[];
}

export interface Team {
  name: string;
  logo: string; 
  score?: number;
}

export interface Match {
  id: string;
  league: string;
  leagueLogo?: string;
  homeTeam: Team;
  awayTeam: Team;
  status: 'LIVE' | 'FINISHED' | 'SCHEDULED';
  time: string; 
  date: string;
  timestamp: number;
  sources?: Source[];
}

export interface IptvConfig {
  id: string;
  name: string;
  type: 'xtream' | 'm3u';
  host?: string;
  port?: string;
  username?: string;
  password?: string;
  m3uUrl?: string;
  epgUrl?: string;
}

export interface Player {
  name: string;
  number: number;
  position: string;
}

export interface MatchStats {
  possession: [number, number];
  shots: [number, number];
  shotsOnTarget: [number, number];
  corners: [number, number];
  fouls: [number, number];
}

export interface Incident {
  type: string;
  playerIn?: Player;
  playerOut?: Player;
  player?: Player;
  time: number;
  isHome: boolean;
}

export interface OfficialBroadcaster {
  source: string;
  channels: string[];
  competition?: string;
}

export interface MatchDetail extends Match {
  venue: string;
  referee: string;
  homeLineup: Player[];
  awayLineup: Player[];
  homeSubstitutes: Player[];
  awaySubstitutes: Player[];
  homeFormation?: string;
  awayFormation?: string;
  stats: MatchStats;
  incidents: Incident[];
  summary: string;
  officialBroadcasters?: OfficialBroadcaster[];
}

export interface Standing {
  rank: number;
  team: string;
  logo?: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  form: string[]; 
}

export interface GroupStanding {
  name: string;
  rows: Standing[];
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  timestamp: string;
  imageUrl: string;
  videoUrl?: string;
  sources?: Source[];
}

export interface Fixture {
  id?: number;
  home_team: string;
  away_team: string;
  match_time: string;
  competition: string;
  source: string;
  broadcasters?: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  sources?: Source[];
}
