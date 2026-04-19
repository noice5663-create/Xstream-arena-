
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { Match, Source } from '../types';
import LiveBadge from './LiveBadge';
import { Globe, Zap, Play, Youtube } from 'lucide-react';
import { findIptvSourcesForMatch } from '../services/geminiService';

interface MatchCardProps {
  match: Match;
  onClick: (match: Match) => void;
  onHighlightsClick?: (match: Match) => void;
  liveOnSatData?: any[];
  preProcessedIptv?: any[];
}

const MatchCard: React.FC<MatchCardProps> = React.memo(({ 
  match, 
  onClick, 
  onHighlightsClick,
  liveOnSatData = [],
  preProcessedIptv = []
}) => {
  const [logoError, setLogoError] = useState(false);
  const [matchedSources, setMatchedSources] = useState<Source[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  
  const isLive = match.status === 'LIVE';
  const isScheduled = match.status === 'SCHEDULED';
  const isFinished = match.status === 'FINISHED';

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (isVisible && liveOnSatData.length > 0 && preProcessedIptv.length > 0) {
      // Perform matching on-demand for this specific match
      const sources = findIptvSourcesForMatch(
        match.homeTeam.name,
        match.awayTeam.name,
        match.league,
        match.leagueLogo,
        liveOnSatData,
        preProcessedIptv
      );
      setMatchedSources(sources);
    }
  }, [isVisible, match.id, liveOnSatData.length, preProcessedIptv.length]);

  const sourcesToDisplay = matchedSources.length > 0 ? matchedSources : match.sources;

  const TeamLogo = ({ team }: { team: { name: string; logo: string } }) => {
    const [imgError, setImgError] = useState(false);
    return (
      <div className="flex flex-col items-center gap-2 w-[35%] relative z-10">
        <div className="w-14 h-14 md:w-20 md:h-20 rounded-full bg-slate-900/80 backdrop-blur-md border border-white/10 flex items-center justify-center p-2.5 shadow-2xl group-hover:border-indigo-500/40 transition-all duration-300">
          {team.logo && !imgError ? (
            <img 
              src={team.logo} 
              alt="" 
              className="w-full h-full object-contain" 
              onError={() => setImgError(true)} 
              loading="lazy"
            />
          ) : (
            <Globe size={20} className="text-slate-700" />
          )}
        </div>
        <span className="text-[10px] md:text-xs font-black text-white uppercase tracking-tight text-center line-clamp-1 w-full drop-shadow-md">
          {team.name}
        </span>
      </div>
    );
  };

  return (
    <motion.div
      ref={cardRef}
      onClick={() => onClick(match)}
      className="group relative bg-white/[0.03] hover:bg-white/[0.06] rounded-[2.5rem] border border-white/10 hover:border-indigo-500/30 p-6 md:p-8 transition-all duration-300 cursor-pointer overflow-hidden shadow-2xl"
    >
      {/* COLORFUL LEAGUE WATERMARK */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden opacity-[0.12] group-hover:opacity-[0.18] transition-all duration-500">
        {!logoError && match.leagueLogo ? (
          <img 
            src={match.leagueLogo} 
            alt="" 
            className="w-full h-full object-contain scale-110 group-hover:scale-100 transition-transform duration-700 brightness-110 saturate-150" 
            onError={() => setLogoError(true)}
            loading="lazy"
          />
        ) : (
          <Zap size={140} className="text-white/5" />
        )}
      </div>

      {/* Glossy Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/10 blur-[60px] pointer-events-none group-hover:bg-indigo-500/20 transition-colors" />
      
      <div className="flex items-center justify-between mb-6 relative z-10">
        <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-7 h-7 rounded-lg bg-white p-1.5 shrink-0 shadow-lg flex items-center justify-center">
                {match.leagueLogo ? (
                   <img src={match.leagueLogo} alt="" className="w-full h-full object-contain" loading="lazy" />
                ) : (
                   <Globe size={14} className="text-slate-400" />
                )}
            </div>
            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest truncate max-w-[140px] drop-shadow-sm">
                {match.league}
            </span>
        </div>
        {isLive ? <LiveBadge /> : (
            <div className="flex items-center gap-2">
                <div className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[8px] font-black text-slate-400 uppercase tracking-widest backdrop-blur-md">
                    {isFinished ? 'Ended' : match.time}
                </div>
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
      <div className="mt-6 flex flex-col gap-4 relative z-10">
        {/* CHANNELS LIST */}
        {sourcesToDisplay && sourcesToDisplay.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1.5 px-2">
            {sourcesToDisplay.slice(0, 4).map((source, idx) => (
              <div 
                key={idx}
                className="flex flex-col items-center px-2 py-0.5 rounded-md bg-white/5 border border-white/10 min-w-[60px]"
              >
                <span className="text-[7px] font-black text-slate-300 uppercase tracking-tight whitespace-nowrap">
                  {source.name}
                </span>
                {source.playlistName && (
                  <span className="text-[5px] font-bold text-indigo-500 uppercase tracking-widest leading-none">
                    {source.playlistName}
                  </span>
                )}
              </div>
            ))}
            {sourcesToDisplay.length > 4 && (
              <div className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[7px] font-black text-slate-500 uppercase tracking-widest">
                +{sourcesToDisplay.length - 4} More
              </div>
            )}
          </div>
        )}

        <div className="flex justify-center">
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
                  {sourcesToDisplay && sourcesToDisplay.length > 0 ? 'Signal Detected' : 'Broadcasting Signal'} <Zap size={10} fill="currentColor" />
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
});

export default MatchCard;
