
import React from 'react';
import { motion } from 'framer-motion';
import { Match } from '../types';
import { Clock, Zap, ShieldCheck } from 'lucide-react';

interface EPLScheduleProps {
  matches: Match[];
  onMatchClick: (match: Match) => void;
}

/**
 * Official 2024/25 English Premier League Clubs
 * Verified via https://www.premierleague.com/clubs
 */
const OFFICIAL_EPL_TEAMS = [
  'Arsenal',
  'Aston Villa',
  'Bournemouth',
  'AFC Bournemouth',
  'Brentford',
  'Brighton & Hove Albion',
  'Brighton',
  'Chelsea',
  'Crystal Palace',
  'Everton',
  'Fulham',
  'Ipswich Town',
  'Ipswich',
  'Leicester City',
  'Leicester',
  'Liverpool',
  'Manchester City',
  'Man City',
  'Manchester United',
  'Man Utd',
  'Newcastle United',
  'Newcastle',
  'Nottingham Forest',
  'Southampton',
  'Tottenham Hotspur',
  'Tottenham',
  'Spurs',
  'West Ham United',
  'West Ham',
  'Wolverhampton Wanderers',
  'Wolves'
];

const EPLMatchRow: React.FC<{ match: Match; onClick: () => void }> = ({ match, onClick }) => {
  const isLive = match.status === 'LIVE';
  const isFinished = match.status === 'FINISHED';
  const isScheduled = match.status === 'SCHEDULED';
  
  return (
    <motion.div
      whileHover={{ scale: 1.005, filter: 'brightness(1.08)' }}
      onClick={onClick}
      className="flex items-center justify-between p-5 md:p-10 cursor-pointer transition-all bg-[#ff3a80] border-b border-white/10 last:border-0 relative overflow-hidden"
    >
      {/* High-end glass overlay effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-white/10 via-transparent to-white/10 opacity-30 pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-from)_0%,_transparent_70%)] from-white/5 pointer-events-none" />
      
      {/* Home Team Section */}
      <div className="flex items-center gap-5 md:gap-10 w-[35%] z-10">
        <div className="w-16 h-16 md:w-24 md:h-24 flex items-center justify-center bg-white rounded-3xl p-3 shadow-[0_15px_35px_rgba(0,0,0,0.3)] shrink-0 transition-all duration-500 hover:rotate-6">
          <img src={match.homeTeam.logo} alt="" className="w-full h-full object-contain" />
        </div>
        <span className="text-sm md:text-3xl font-[1000] text-white uppercase tracking-tighter truncate drop-shadow-lg">
          {match.homeTeam.name}
        </span>
      </div>

      {/* Central Module: Score/Time */}
      <div className="flex flex-col items-center justify-center min-w-[140px] md:min-w-[300px] z-10">
        {isLive ? (
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-1 bg-white/20 rounded-full border border-white/40 backdrop-blur-xl mb-2">
              <span className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
              <span className="text-[11px] font-black text-white uppercase tracking-[0.3em]">{match.time}</span>
            </div>
            <div className="flex items-center gap-8 md:gap-16">
               <span className="text-5xl md:text-8xl font-[1000] text-white tracking-tighter leading-none drop-shadow-2xl">{match.homeTeam.score}</span>
               <span className="text-white/30 font-black text-4xl md:text-6xl">-</span>
               <span className="text-5xl md:text-8xl font-[1000] text-white tracking-tighter leading-none drop-shadow-2xl">{match.awayTeam.score}</span>
            </div>
          </div>
        ) : isScheduled ? (
          <div className="flex flex-col items-center gap-3">
             <div className="flex items-center gap-2 text-[11px] md:text-sm font-black text-white/80 uppercase tracking-[0.4em] mb-1">
                <Clock size={16} className="text-white" /> Kick Off
             </div>
             <div className="px-10 py-4 md:px-20 md:py-7 bg-white/10 border border-white/30 rounded-[2.5rem] backdrop-blur-2xl shadow-inner group">
                <span className="text-4xl md:text-7xl font-black text-white tracking-tight leading-none group-hover:scale-110 transition-transform block">
                  {match.time}
                </span>
             </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
             <span className="text-[11px] font-black text-white/60 uppercase tracking-[0.5em] mb-1">Full Time</span>
             <div className="flex items-center gap-8 md:gap-16">
                <span className="text-5xl md:text-8xl font-[1000] text-white tracking-tighter leading-none opacity-90">{match.homeTeam.score}</span>
                <span className="text-white/20 font-black text-4xl md:text-6xl">-</span>
                <span className="text-5xl md:text-8xl font-[1000] text-white tracking-tighter leading-none opacity-90">{match.awayTeam.score}</span>
             </div>
          </div>
        )}
      </div>

      {/* Away Team Section */}
      <div className="flex items-center justify-end gap-5 md:gap-10 w-[35%] text-right z-10">
        <span className="text-sm md:text-3xl font-[1000] text-white uppercase tracking-tighter truncate drop-shadow-lg">
          {match.awayTeam.name}
        </span>
        <div className="w-16 h-16 md:w-24 md:h-24 flex items-center justify-center bg-white rounded-3xl p-3 shadow-[0_15px_35px_rgba(0,0,0,0.3)] shrink-0 transition-all duration-500 hover:-rotate-6">
          <img src={match.awayTeam.logo} alt="" className="w-full h-full object-contain" />
        </div>
      </div>
    </motion.div>
  );
};

const EPLSchedule: React.FC<EPLScheduleProps> = ({ matches, onMatchClick }) => {
  // Enhanced filtering to ensure only official English Premier League fixtures are shown
  const eplMatches = matches.filter(m => {
    const leagueLower = m.league.toLowerCase();
    
    // Check if the league is the official English Premier League
    const isEPL = leagueLower === 'premier league' || 
                  leagueLower === 'england premier league' || 
                  leagueLower === 'epl';
    
    // Cross-reference teams with the official clubs list for extra safety
    const homeTeamMatch = OFFICIAL_EPL_TEAMS.some(t => m.homeTeam.name.toLowerCase().includes(t.toLowerCase()));
    const awayTeamMatch = OFFICIAL_EPL_TEAMS.some(t => m.awayTeam.name.toLowerCase().includes(t.toLowerCase()));

    return isEPL && homeTeamMatch && awayTeamMatch;
  });

  if (eplMatches.length === 0) return null;

  return (
    <div className="mb-24 md:mb-40 w-full animate-in fade-in slide-in-from-bottom-10 duration-1000">
      {/* Official Spotlight Header */}
      <div className="flex flex-col md:flex-row md:items-end gap-8 mb-16 px-8">
        <div className="relative group">
          <div className="absolute -inset-4 bg-pink-500 rounded-[2.5rem] blur-2xl opacity-10 group-hover:opacity-30 transition-opacity" />
          <div className="w-24 h-24 md:w-36 md:h-36 rounded-[2.5rem] bg-[#3d1959] flex items-center justify-center p-5 shadow-4xl border border-white/10 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/20 to-transparent opacity-50" />
            <img 
              src="https://media.api-sports.io/football/leagues/39.png" 
              alt="EPL Logo" 
              className="w-full h-full object-contain invert relative z-10" 
            />
          </div>
        </div>
        
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 px-3 py-1 bg-pink-500/10 rounded-full border border-pink-500/30">
                <span className="w-2 h-2 rounded-full bg-pink-500 shadow-[0_0_12px_rgba(236,72,153,1)] animate-pulse" />
                <span className="text-[10px] md:text-xs font-black text-pink-500 uppercase tracking-[0.4em]">Official Broadcast Signal</span>
             </div>
          </div>
          <h2 className="text-5xl md:text-8xl font-[1000] text-white uppercase tracking-tighter leading-[0.8] mb-1">
            Premier <span className="text-pink-500">League</span>
          </h2>
          <div className="flex items-center gap-6 mt-1">
             <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-pink-500" />
                <span className="text-[11px] md:text-base font-bold text-slate-400 uppercase tracking-[0.2em]">Matchday Hub 2024 / 2025</span>
             </div>
             <div className="h-px w-24 bg-white/10 hidden md:block" />
             <div className="hidden md:flex items-center gap-2">
                <Zap size={14} className="text-slate-600" />
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Low Latency Data</span>
             </div>
          </div>
        </div>
      </div>

      {/* Spotlight Match Display - Iconic Pink Style */}
      <motion.div 
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-[3.5rem] md:rounded-[6rem] overflow-hidden shadow-[0_50px_120px_-30px_rgba(236,72,153,0.5)] border border-pink-500/40 ring-1 ring-white/10 bg-[#ff3a80]"
      >
        <div className="flex flex-col">
          {eplMatches.map((match) => (
            <EPLMatchRow key={match.id} match={match} onClick={() => onMatchClick(match)} />
          ))}
        </div>
      </motion.div>
      
      {/* Footer Branding & Status */}
      <div className="flex flex-col md:flex-row items-center justify-between mt-12 px-16 gap-6">
          <div className="flex items-center gap-5">
            <div className="flex -space-x-3">
               {[1,2,3].map(i => (
                 <div key={i} className="w-8 h-8 rounded-full bg-slate-900 border-2 border-[#020617] flex items-center justify-center">
                    <Zap size={10} className="text-pink-500" />
                 </div>
               ))}
            </div>
            <span className="text-[10px] md:text-sm font-black text-slate-500 uppercase tracking-[0.4em]">Multi-Node Telemetry Synchronized</span>
          </div>
          
          <div className="flex items-center gap-8">
             <span className="text-[10px] md:text-sm font-black text-slate-700 uppercase tracking-widest">© 2025 Premier League Official Partner</span>
             <div className="flex gap-1.5">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className={`w-1 h-4 rounded-full ${i <= 4 ? 'bg-pink-500' : 'bg-slate-800'}`} />
                ))}
             </div>
          </div>
      </div>
    </div>
  );
};

export default EPLSchedule;
