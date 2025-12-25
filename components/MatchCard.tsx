
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Match } from '../types';
import LiveBadge from './LiveBadge';
import { Globe, Zap, Play, Youtube } from 'lucide-react';

interface MatchCardProps {
  match: Match;
  onClick: (match: Match) => void;
  onHighlightsClick?: (match: Match) => void;
}

const MatchCard: React.FC<MatchCardProps> = ({ match, onClick, onHighlightsClick }) => {
  const [logoError, setLogoError] = useState(false);
  const isLive = match.status === 'LIVE';
  const isScheduled = match.status === 'SCHEDULED';
  const isFinished = match.status === 'FINISHED';

  const TeamLogo = ({ team }: { team: { name: string; logo: string } }) => (
    <div className="flex flex-col items-center gap-2 w-[35%] relative z-10">
      <div className="w-14 h-14 md:w-20 md:h-20 rounded-full bg-slate-900/80 backdrop-blur-md border border-white/10 flex items-center justify-center p-2.5 shadow-2xl group-hover:border-pink-500/40 transition-all duration-300">
        {team.logo ? (
          <img src={team.logo} alt="" className="w-full h-full object-contain" />
        ) : (
          <Globe size={20} className="text-slate-700" />
        )}
      </div>
      <span className="text-[10px] md:text-xs font-black text-white uppercase tracking-tight text-center line-clamp-1 w-full drop-shadow-md">
        {team.name}
      </span>
    </div>
  );

  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={() => onClick(match)}
      className="group relative bg-white/[0.03] hover:bg-white/[0.06] rounded-[2.5rem] border border-white/10 hover:border-pink-500/30 p-6 md:p-8 transition-all duration-300 cursor-pointer overflow-hidden shadow-2xl"
    >
      {/* COLORFUL LEAGUE WATERMARK */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden opacity-[0.12] group-hover:opacity-[0.18] transition-all duration-500">
        {!logoError && match.leagueLogo ? (
          <img 
            src={match.leagueLogo} 
            alt="" 
            className="w-full h-full object-contain scale-110 group-hover:scale-100 transition-transform duration-700 brightness-110 saturate-150" 
            onError={() => setLogoError(true)}
          />
        ) : (
          <Zap size={140} className="text-white/5" />
        )}
      </div>

      {/* Glossy Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-pink-500/10 blur-[60px] pointer-events-none group-hover:bg-pink-500/20 transition-colors" />
      
      <div className="flex items-center justify-between mb-6 relative z-10">
        <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-7 h-7 rounded-lg bg-white p-1.5 shrink-0 shadow-lg flex items-center justify-center">
                {match.leagueLogo ? (
                   <img src={match.leagueLogo} alt="" className="w-full h-full object-contain" />
                ) : (
                   <Globe size={14} className="text-slate-400" />
                )}
            </div>
            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest truncate max-w-[140px] drop-shadow-sm">
                {match.league}
            </span>
        </div>
        {isLive ? <LiveBadge /> : (
            <div className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[8px] font-black text-slate-400 uppercase tracking-widest backdrop-blur-md">
                {isFinished ? 'Final' : match.time}
            </div>
        )}
      </div>

      <div className="flex items-center justify-between relative z-10 gap-2">
        <TeamLogo team={match.homeTeam} />

        <div className="flex flex-col items-center justify-center flex-1">
            {isScheduled ? (
                <div className="bg-white/5 px-5 py-2 rounded-2xl border border-white/10 backdrop-blur-xl shadow-xl">
                    <span className="text-xl md:text-3xl font-black text-white tracking-widest">{match.time}</span>
                </div>
            ) : (
                <div className="flex items-center gap-3 md:gap-5">
                    <span className={`text-3xl md:text-6xl font-black drop-shadow-2xl ${isLive ? 'text-pink-500' : 'text-white'}`}>{match.homeTeam.score}</span>
                    <span className="text-white/20 font-black text-2xl md:text-3xl">:</span>
                    <span className={`text-3xl md:text-6xl font-black drop-shadow-2xl ${isLive ? 'text-purple-500' : 'text-white'}`}>{match.awayTeam.score}</span>
                </div>
            )}
        </div>

        <TeamLogo team={match.awayTeam} />
      </div>

      {/* FOOTER ACTION BUTTONS */}
      <div className="mt-6 flex justify-center relative z-10">
        {isFinished ? (
          <motion.button
            whileHover={{ scale: 1.05, boxShadow: '0 0 25px rgba(236, 72, 153, 0.5)' }}
            whileTap={{ scale: 0.95 }}
            onClick={(e) => {
              e.stopPropagation();
              if (onHighlightsClick) onHighlightsClick(match);
              else onClick(match);
            }}
            className="flex items-center gap-2.5 px-8 py-3.5 bg-gradient-to-r from-pink-600 via-pink-500 to-purple-600 rounded-2xl text-[10px] font-black text-white uppercase tracking-[0.2em] shadow-2xl border border-white/20 transition-all duration-300 group/btn"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-white rounded-full blur-md opacity-0 group-hover/btn:opacity-40 transition-opacity" />
              <Play size={14} fill="currentColor" className="relative z-10" />
            </div>
            Watch Highlights
          </motion.button>
        ) : (
          <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 text-center">
            <span className="text-[9px] font-black text-pink-500 uppercase tracking-[0.4em] flex items-center justify-center gap-2">
                Broadcasting Signal <Zap size={10} fill="currentColor" />
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default MatchCard;
