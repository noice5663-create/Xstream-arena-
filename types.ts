
import React from 'react';

export interface Source {
  title?: string;
  uri: string;
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
  timestamp: number; // Seconds since epoch
  sources?: Source[];
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

export interface LeagueStandings {
  leagueName: string;
  standings: Standing[];
  sources?: Source[];
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

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  sources?: Source[];
}
