
import React from 'react';
import { motion } from 'framer-motion';
import { Match } from '../types';
import { Zap, Clock, Tv } from 'lucide-react';

interface PLSpotlightProps {
  matches: Match[];
  onMatchClick: (match: Match) => void;
}

const PLMatchRow: React.FC<{ match: Match; onClick: () => void }> = ({ match, onClick }) => {
  const isLive = match.status === 'LIVE';
  const isFinished = match.status === 'FINISHED';
  const isScheduled = match.status === 'SCHEDULED';
  
  return (
    <motion.div
      whileHover={{ scale: 1.005, backgroundColor: '#f8fafc' }}
      onClick={onClick}
      className="flex items-center justify-between bg-white border-b border-slate-100 last:border-0 p-4 md:p-6 cursor-pointer transition-all relative overflow-hidden"
    >
      {/* EPL Official Deep Purple Side-stripe */}
      <div className="absolute top-0 left-0 w-2 h-full bg-[#3d1959]" />
      
      {/* Home Team */}
      <div className="flex items-center gap-4 w-[38%]">
        <div className="w-12 h-12 md:w-16 md:h-16 flex items-center justify-center bg-white rounded-full border border-slate-100 p-2 shadow-sm shrink-0">
          <img src={match.homeTeam.logo} alt="" className="w-full h-full object-contain" />
        </div>
        <span className="text-sm md:text-xl font-[800] text-[#3d1959] uppercase tracking-tight truncate">
          {match.homeTeam.name}
        </span>
      </div>

      {/* Central Information Node */}
      <div className="flex flex-col items-center justify-center gap-1.5 min-w-[120px] md:min-w-[200px] z-10">
        <div className="flex items-center gap-1.5 text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
           {isLive ? (
              <span className="text-[#ff3a80] flex items-center gap-1 animate-pulse">
                <span className="w-1.5 h-1.5 bg-[#ff3a80] rounded-full" /> {match.time}
              </span>
           ) : isFinished ? (
              <span className="text-slate-500">Full Time</span>
           ) : (
              <div className="flex items-center gap-1">
                <Clock size={10} />
                <span>Kick Off</span>
              </div>
           )}
        </div>
        
        {/* The Iconic EPL Pink Box */}
        <div className="flex items-center justify-center bg-[#ff3a80] px-5 py-2 md:px-10 md:py-3 rounded-xl shadow-2xl shadow-pink-500/30 border border-pink-400/20">
          {isScheduled ? (
             <span className="text-xl md:text-4xl font-[900] text-white tracking-widest leading-none">
               {match.time}
             </span>
          ) : (
            <div className="flex items-center">
              <span className="text-2xl md:text-5xl font-[900] text-white tracking-tighter leading-none">
                {match.homeTeam.score}
              </span>
              <span className="mx-3 md:mx-6 text-white/30 font-[900] text-xl md:text-3xl">-</span>
              <span className="text-2xl md:text-5xl font-[900] text-white tracking-tighter leading-none">
                {match.awayTeam.score}
              </span>
            </div>
          )}
        </div>
        
        <div className="text-[7px] md:text-[8px] font-black text-slate-300 uppercase tracking-widest mt-1">
            Official Data Node
        </div>
      </div>

      {/* Away Team */}
      <div className="flex items-center justify-end gap-4 w-[38%] text-right">
        <span className="text-sm md:text-xl font-[800] text-[#3d1959] uppercase tracking-tight truncate">
          {match.awayTeam.name}
        </span>
        <div className="w-12 h-12 md:w-16 md:h-16 flex items-center justify-center bg-white rounded-full border border-slate-100 p-2 shadow-sm shrink-0">
          <img src={match.awayTeam.logo} alt="" className="w-full h-full object-contain" />
        </div>
      </div>
    </motion.div>
  );
};

const PremierLeagueSpotlight: React.FC<PLSpotlightProps> = ({ matches, onMatchClick }) => {
  const plMatches = matches
    .filter(m => 
      m.league.toLowerCase().includes('premier league') || 
      m.league.toLowerCase().includes('england premier league')
    );

  if (plMatches.length === 0) return null;

  return (
    <div className="mb-16 w-full relative">
      {/* Decorative Branding Header */}
      <div className="flex items-center justify-between mb-8 px-4">
        <div className="flex items-center gap-5">
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-[#3d1959] flex items-center justify-center p-2.5 shadow-2xl border border-white/10 group overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <img 
                src="https://media.api-sports.io/football/leagues/39.png" 
                alt="EPL Logo" 
                className="w-full h-full object-contain invert relative z-10" 
              />
            </div>
            <div className="flex flex-col">
                <h3 className="text-lg md:text-2xl font-[900] text-white uppercase tracking-tight leading-none">
                  Premier League <span className="text-[#ff3a80]">Spotlight</span>
                </h3>
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.4em] mt-1.5 flex items-center gap-2">
                   <Tv size={10} className="text-[#ff3a80]" /> Verified HD Broadcast Stream
                </span>
            </div>
        </div>
        
        <div className="hidden md:flex flex-col items-end gap-1">
            <div className="flex items-center gap-1.5 px-3 py-1 bg-[#3d1959] rounded-full border border-white/5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[8px] font-black text-white uppercase tracking-widest">Signal Stable</span>
            </div>
        </div>
      </div>

      {/* Main Scoreboard Container */}
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-[2.5rem] md:rounded-[3rem] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/5 bg-white ring-1 ring-white/10"
      >
        <div className="flex flex-col">
          {plMatches.map((match) => (
            <PLMatchRow key={match.id} match={match} onClick={() => onMatchClick(match)} />
          ))}
        </div>
      </motion.div>
      
      {/* Footnote */}
      <div className="flex justify-between items-center mt-6 px-8">
        <span className="text-[7px] md:text-[9px] font-black text-slate-600 uppercase tracking-[0.3em]">
            © 2024 Premier League
        </span>
        <div className="flex items-center gap-2">
            <span className="text-[7px] md:text-[9px] font-black text-[#ff3a80] uppercase tracking-[0.2em] animate-pulse">
                Live updates active
            </span>
            <div className="w-1.5 h-1.5 rounded-full bg-[#ff3a80]" />
        </div>
      </div>
    </div>
  );
};

export default PremierLeagueSpotlight;
