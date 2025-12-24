
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, BarChart2, Users, MonitorPlay, Globe, ArrowDownRight, ArrowUpRight, Zap, History, UserMinus, UserPlus, Play, Clock, Radio, Share2, Check, Youtube } from 'lucide-react';
import { Match, MatchDetail, Player, Incident } from '../types';
import { fetchMatchDetails, fetchHighlights } from '../services/geminiService';
import SmartPlayer from './SmartPlayer';

interface MatchDetailViewProps {
  match: Match;
  onClose: () => void;
  onGoToSummary: (match: Match) => void;
  initialShowHighlights?: boolean;
}

const tabs = [
  { id: 'stream', label: 'Feed', icon: MonitorPlay },
  { id: 'stats', label: 'Analysis', icon: BarChart2 },
  { id: 'lineups', label: 'Lineups', icon: Users },
];

const extractVideoId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
};

const StatRow: React.FC<{ label: string, home: number, away: number, isPercent?: boolean }> = ({ label, home, away, isPercent = false }) => {
  const total = home + away;
  const homePercent = total === 0 ? 50 : (home / total) * 100;
  
  return (
    <div className="mb-3 md:mb-4">
      <div className="flex justify-between items-center text-[9px] md:text-[10px] font-bold mb-1.5">
        <span className="text-white w-10 text-left">{home}{isPercent ? '%' : ''}</span>
        <span className="text-slate-500 uppercase tracking-[0.15em] text-center">{label}</span>
        <span className="text-white w-10 text-right">{away}{isPercent ? '%' : ''}</span>
      </div>
      <div className="h-1 w-full bg-slate-800/50 rounded-full overflow-hidden flex border border-white/5">
        <motion.div initial={{ width: 0 }} animate={{ width: `${homePercent}%` }} className="h-full bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.4)]" />
        <div className="w-px h-full bg-[#0b0f1a]" />
        <motion.div initial={{ width: 0 }} animate={{ width: `${100 - homePercent}%` }} className="h-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.4)]" />
      </div>
    </div>
  );
};

const PlayerMarker: React.FC<{ player: Player | undefined, x: number, y: number, colorClass: string }> = ({ player, x, y, colorClass }) => {
  if (!player) return null;
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', damping: 15, stiffness: 200, delay: Math.random() * 0.2 }}
      style={{ left: `${x}%`, top: `${y}%` }}
      className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group z-30"
    >
      <div className={`w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center text-white text-[7px] md:text-[9px] font-black border border-white/20 shadow-xl transition-transform group-hover:scale-125 ${colorClass}`}>
        {player.number}
      </div>
      <span className="mt-0.5 text-[4px] sm:text-[6px] md:text-[8px] font-black text-white whitespace-nowrap bg-black/80 px-1 py-0.5 rounded border border-white/10 uppercase tracking-tighter backdrop-blur-md">
        {player.name ? player.name.split(' ').pop() : '...'}
      </span>
    </motion.div>
  );
};

const PitchView: React.FC<{ homeLineup: Player[], awayLineup: Player[], homeFormation?: string, awayFormation?: string }> = ({ homeLineup, awayLineup, homeFormation, awayFormation }) => {
  const getTacticalPositions = (players: Player[], isAway: boolean, formation?: string) => {
    if (!players || players.length === 0) return [];
    const coords: { player: Player, x: number, y: number }[] = [];
    const parseFormation = (formStr: string) => formStr.split('-').map(Number);
    const formationParts = (formation && formation.includes('-')) ? parseFormation(formation) : [4, 3, 3];
    const gk = players.find(p => p.position?.toUpperCase().startsWith('G')) || players[0];
    
    if (gk) coords.push({ player: gk, x: 50 - 3, y: isAway ? 8 : 92 });

    const fieldPlayers = players.filter(p => p !== gk);
    let currentPlayerIdx = 0;
    const startY = isAway ? 22 : 78;
    const endY = isAway ? 46 : 54;
    const stepY = formationParts.length > 1 ? (endY - startY) / (formationParts.length - 1) : 0;

    formationParts.forEach((count, lineIdx) => {
      const y = startY + (stepY * lineIdx);
      for (let i = 0; i < count; i++) {
        if (currentPlayerIdx < fieldPlayers.length) {
          const x = ((100 / (count + 1)) * (i + 1)) - 3;
          coords.push({ player: fieldPlayers[currentPlayerIdx], x, y });
          currentPlayerIdx++;
        }
      }
    });
    return coords;
  };

  const homeMarkers = getTacticalPositions(homeLineup, false, homeFormation);
  const awayMarkers = getTacticalPositions(awayLineup, true, awayFormation);

  return (
    <div className="flex items-center justify-center w-full py-2 relative z-10">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-[280px] aspect-[2/3] bg-black/40 backdrop-blur-md rounded-[1.5rem] border border-white/20 shadow-2xl overflow-hidden"
      >
        <div className="absolute inset-2 border border-white/20 rounded-xl pointer-events-none">
          <div className="absolute top-1/2 left-0 right-0 h-px bg-white/20 -translate-y-1/2" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 border border-white/20 rounded-full" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-10 border border-white/20 rounded-b-xl" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-20 h-10 border border-white/20 rounded-t-xl" />
        </div>
        <div className="relative w-full h-full z-20">
          {homeMarkers.map((m, i) => <PlayerMarker key={`h-${i}`} player={m.player} x={m.x} y={m.y} colorClass="bg-pink-600" />)}
          {awayMarkers.map((m, i) => <PlayerMarker key={`a-${i}`} player={m.player} x={m.x} y={m.y} colorClass="bg-purple-600" />)}
        </div>
      </motion.div>
    </div>
  );
};

const LineupList: React.FC<{ 
  teamName: string, 
  startXI: Player[], 
  substitutes: Player[], 
  colorClass: string,
  incidents: Incident[],
  isHome: boolean
}> = ({ teamName, startXI, substitutes, colorClass, incidents, isHome }) => {
  
  const getSubInfo = (player: Player) => {
    return incidents.find(inc => 
      inc.type === 'substitution' && 
      inc.isHome === isHome && 
      (inc.playerOut?.name === player.name || inc.playerIn?.name === player.name)
    );
  };

  return (
    <div className="bg-slate-950/60 rounded-2xl p-4 border border-white/10 backdrop-blur-2xl h-full flex flex-col gap-4 relative z-10">
        <div className="flex items-center justify-between">
            <h3 className={`text-[10px] md:text-xs font-black uppercase tracking-[0.15em] ${colorClass}`}>{teamName}</h3>
            <span className="px-1.5 py-0.5 rounded bg-white/5 text-[7px] font-black text-slate-500 uppercase">Squad</span>
        </div>
        <div className="space-y-4 overflow-y-auto custom-scrollbar pr-1 flex-1 text-[9px] md:text-[11px]">
            <div>
              <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <div className="w-1 h-1 rounded-full bg-green-500" /> XI
              </div>
              <div className="space-y-1">
                  {startXI.map((p, i) => {
                      const sub = getSubInfo(p);
                      return (
                        <div key={i} className="flex items-center gap-3 p-1.5 rounded-lg hover:bg-white/10 transition-all group border border-transparent">
                            <span className="w-4 text-center font-mono font-black text-slate-500 group-hover:text-white">{p.number}</span>
                            <div className="flex-1 truncate font-black text-slate-200 group-hover:text-white uppercase flex items-center gap-2">
                              {p.name}
                              {sub && sub.playerOut?.name === p.name && (
                                <div className="flex items-center gap-1 text-red-500 text-[8px] font-black bg-red-500/10 px-1 rounded">
                                  <UserMinus size={8} /> {sub.time}'
                                </div>
                              )}
                            </div>
                        </div>
                      );
                  })}
              </div>
            </div>
            <div>
              <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <div className="w-1 h-1 rounded-full bg-slate-700" /> Bench
              </div>
              <div className="space-y-1">
                  {substitutes.map((p, i) => {
                      const sub = getSubInfo(p);
                      return (
                        <div key={i} className={`flex items-center gap-3 p-1.5 rounded-lg hover:bg-white/10 transition-all group border border-transparent ${sub && sub.playerIn?.name === p.name ? 'opacity-100 bg-white/5' : 'opacity-70'}`}>
                            <span className="w-4 text-center font-mono font-black text-slate-500">{p.number}</span>
                            <div className="flex-1 truncate font-black text-slate-400 group-hover:text-white uppercase flex items-center gap-2">
                              {p.name}
                              {sub && sub.playerIn?.name === p.name && (
                                <div className="flex items-center gap-1 text-green-500 text-[8px] font-black bg-green-500/10 px-1 rounded">
                                  <UserPlus size={8} /> {sub.time}'
                                </div>
                              )}
                            </div>
                        </div>
                      );
                  })}
              </div>
            </div>
        </div>
    </div>
  );
};

const MatchEvents: React.FC<{ incidents: Incident[], homeName: string, awayName: string }> = ({ incidents, homeName, awayName }) => {
    const subs = incidents.filter(i => i.type === 'substitution');
    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 bg-pink-500/20 rounded-lg"><History size={14} className="text-pink-500" /></div>
                <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Tactical Logs</h3>
            </div>
            <div className="space-y-2 relative">
                <div className="absolute left-3 top-0 bottom-0 w-px bg-white/10 z-0" />
                {subs.length > 0 ? subs.map((s, i) => (
                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} key={i} className="relative z-10 flex items-start gap-3 p-3 bg-black/40 border border-white/10 rounded-xl backdrop-blur-md">
                        <div className="w-6 h-6 rounded-full bg-slate-900 border border-white/20 flex items-center justify-center shrink-0 text-[8px] font-black text-white">{s.time}'</div>
                        <div className="flex-1 text-[9px]">
                            <div className={`font-black uppercase tracking-widest mb-1 ${s.isHome ? 'text-pink-500' : 'text-purple-500'}`}>{s.isHome ? homeName : awayName}</div>
                            <div className="flex flex-col gap-0.5 text-slate-300">
                                <div className="flex items-center gap-1.5 opacity-60"><UserMinus size={10} /> {s.playerOut?.name}</div>
                                <div className="flex items-center gap-1.5"><UserPlus size={10} className="text-green-500" /> {s.playerIn?.name}</div>
                            </div>
                        </div>
                    </motion.div>
                )) : (
                    <div className="py-6 text-center text-[9px] font-black text-slate-700 uppercase tracking-widest">No Tactical Events</div>
                )}
            </div>
        </div>
    );
};

const MatchDetailView: React.FC<MatchDetailViewProps> = ({ match, onClose, onGoToSummary, initialShowHighlights = false }) => {
  const [activeTab, setActiveTab] = useState('stream');
  const [details, setDetails] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSourceIndex, setActiveSourceIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'pitch' | 'list'>('pitch');
  const [logoError, setLogoError] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now() / 1000);
  const [highlightUrl, setHighlightUrl] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [showResume, setShowResume] = useState(initialShowHighlights);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const data = await fetchMatchDetails(match);
      setDetails(data);
      
      if (match.status === 'FINISHED') {
        const h = await fetchHighlights(match.homeTeam.name, match.awayTeam.name);
        if (h.length > 0) setHighlightUrl(h[0].videoUrl || null);
      }
      
      setLoading(false);
    };
    load();
    
    const interval = setInterval(() => setCurrentTime(Date.now() / 1000), 30000);
    return () => clearInterval(interval);
  }, [match]);

  const isFinished = match.status === 'FINISHED';
  const isScheduled = match.status === 'SCHEDULED';
  const isSignalAvailable = !isScheduled || (match.timestamp - currentTime <= 3600);
  const videoId = highlightUrl ? extractVideoId(highlightUrl) : null;

  const handleShareHighlight = () => {
    if (highlightUrl) {
      navigator.clipboard.writeText(highlightUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4 bg-black/95 backdrop-blur-xl">
      <motion.div 
        layoutId={`match-${match.id}`} 
        className="w-full max-w-5xl h-[90vh] bg-[#050810] rounded-[2rem] border border-white/10 shadow-3xl overflow-hidden flex flex-col relative"
      >
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-10">
             {!logoError && match.leagueLogo && <img src={match.leagueLogo} alt="" className="w-full h-full object-contain blur-[80px] scale-125" onError={() => setLogoError(true)} />}
        </div>

        {/* Header */}
        <div className="shrink-0 p-4 md:p-6 bg-black/40 backdrop-blur-2xl border-b border-white/10 relative z-10">
          <button onClick={onClose} className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-pink-600 text-slate-400 hover:text-white border border-white/10 z-[210] transition-all active:scale-90">
            <X size={20} />
          </button>
          
          <div className="flex items-center justify-between gap-4 relative z-10 max-w-3xl mx-auto">
             <div className="flex flex-col items-center gap-2 w-[35%]">
                 <div className="w-16 h-16 md:w-24 md:h-24 rounded-full bg-black/60 flex items-center justify-center border border-pink-500/30 p-1.5 shadow-xl">
                    {match.homeTeam.logo && <img src={match.homeTeam.logo} alt="" className="w-full h-full object-contain" />}
                 </div>
                 <h2 className="text-[10px] md:text-sm font-black text-white uppercase text-center truncate w-full">{match.homeTeam.name}</h2>
                 <div className="text-2xl md:text-4xl font-black text-pink-500 tracking-tight">{match.homeTeam.score}</div>
             </div>
             
             <div className="flex flex-col items-center w-[30%] text-center gap-3">
                <div className="flex flex-col items-center gap-1.5">
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-white p-1.5 shadow-xl border border-white/20">
                        {!logoError && match.leagueLogo ? <img src={match.leagueLogo} alt="" className="w-full h-full object-contain" onError={() => setLogoError(true)} /> : <Globe size={16} className="text-slate-400" />}
                    </div>
                </div>
                <div className="flex flex-col items-center">
                    <div className="text-white font-black text-xl md:text-2xl uppercase tracking-tighter">{isFinished ? 'FT' : match.time}</div>
                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white/10 rounded-full border border-white/20 mt-1">
                       <Zap size={8} className="text-pink-500 animate-pulse" />
                       <span className="text-[7px] font-black text-slate-300 uppercase tracking-widest">
                          {isFinished ? 'CONCLUDED' : isScheduled ? 'SCHEDULED' : 'LIVE'}
                       </span>
                    </div>
                </div>
             </div>

             <div className="flex flex-col items-center gap-2 w-[35%]">
                 <div className="w-16 h-16 md:w-24 md:h-24 rounded-full bg-black/60 flex items-center justify-center border border-purple-500/30 p-1.5 shadow-xl">
                    {match.awayTeam.logo && <img src={match.awayTeam.logo} alt="" className="w-full h-full object-contain" />}
                 </div>
                 <h2 className="text-[10px] md:text-sm font-black text-white uppercase text-center truncate w-full">{match.awayTeam.name}</h2>
                 <div className="text-2xl md:text-4xl font-black text-purple-500 tracking-tight">{match.awayTeam.score}</div>
             </div>
          </div>

          <div className="flex justify-center mt-6 md:mt-8 gap-2 relative z-10">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setShowResume(false); }}
                className={`flex items-center gap-2 px-4 md:px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${
                  activeTab === tab.id 
                  ? 'bg-white text-black border-white' 
                  : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
                }`}
              >
                <tab.icon size={12} /> {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content Section */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar relative z-10">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
               <div className="w-10 h-10 border-2 border-pink-500/10 border-t-pink-500 rounded-full animate-spin" />
               <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 animate-pulse">Syncing Arena</span>
            </div>
          ) : details ? (
            <AnimatePresence mode="wait">
              {activeTab === 'stream' && (
                <motion.div key="stream" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="h-full flex flex-col lg:grid lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 space-y-4">
                    <div className="aspect-video bg-black rounded-2xl border border-white/10 overflow-hidden shadow-2xl relative flex items-center justify-center">
                      {isFinished ? (
                        showResume && videoId ? (
                           <iframe
                                src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
                                className="w-full h-full"
                                allow="autoplay; encrypted-media"
                                allowFullScreen
                            />
                        ) : (
                          <div className="flex flex-col items-center text-center p-8">
                             <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/10">
                               <Youtube size={40} className={`${highlightUrl ? 'text-red-500' : 'text-slate-600'}`} />
                             </div>
                             <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-2">Match Concluded</h3>
                             <p className="text-slate-500 text-[11px] font-black uppercase tracking-widest mb-8 max-w-[280px]">Official Match Resume and Highlights are synchronized.</p>
                             <div className="flex flex-wrap justify-center gap-4">
                                {highlightUrl && (
                                  <button 
                                    onClick={() => setShowResume(true)}
                                    className="flex items-center gap-3 px-8 py-4 bg-pink-600 hover:bg-pink-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-pink-600/20 transition-all active:scale-95"
                                  >
                                    <Play size={14} fill="currentColor" className="ml-1" /> Watch Match Resume
                                  </button>
                                )}
                                {highlightUrl && (
                                  <button 
                                    onClick={handleShareHighlight}
                                    className={`flex items-center gap-3 px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all active:scale-95 ${shareCopied ? 'bg-green-600 border-green-500 text-white' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'}`}
                                  >
                                    {shareCopied ? <Check size={14} /> : <Share2 size={14} />}
                                    {shareCopied ? 'Link Copied' : 'Share Official Resume'}
                                  </button>
                                )}
                             </div>
                          </div>
                        )
                      ) : !isSignalAvailable ? (
                        <div className="flex flex-col items-center text-center p-8">
                           <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/10 relative overflow-hidden group">
                             <motion.div 
                                animate={{ rotate: 360 }}
                                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                                className="absolute inset-0 border-2 border-dashed border-pink-500/30 rounded-full"
                             />
                             <Clock size={40} className="text-pink-500/50" />
                           </div>
                           <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-2">Signal Awaiting</h3>
                           <p className="text-slate-500 text-[11px] font-black uppercase tracking-widest mb-4 max-w-[320px]">
                              Broadcasting channels for scheduled matches activate 60 minutes prior to kickoff.
                           </p>
                           <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl border border-white/10 text-slate-400">
                              <Radio size={14} className="text-slate-600" />
                              <span className="text-[10px] font-black uppercase tracking-widest">Kickoff scheduled for {match.time}</span>
                           </div>
                        </div>
                      ) : (
                        <SmartPlayer src={details.sources?.[activeSourceIndex]?.uri || ''} autoPlay />
                      )}
                    </div>
                    
                    {showResume && (
                       <div className="flex justify-end">
                          <button 
                            onClick={() => setShowResume(false)}
                            className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors"
                          >
                             Back to Match Portal
                          </button>
                       </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-4">
                      <div className="bg-black/40 backdrop-blur-3xl rounded-2xl border border-white/10 overflow-hidden flex flex-col h-full p-5">
                          <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4 flex items-center gap-2">
                             <div className="w-1.5 h-1.5 rounded-full bg-pink-500 shadow-[0_0_6px_rgba(236,72,153,1)]" /> Transmission
                          </div>
                          <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-2">
                            {isFinished ? (
                                <div className="h-full flex flex-col items-center justify-center text-center gap-4 py-4">
                                   <div className="p-3 bg-red-500/10 rounded-full border border-red-500/20">
                                      <Youtube size={24} className="text-red-500" />
                                   </div>
                                   <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 max-w-[120px]">Match Resume Available on External Signal</span>
                                   {highlightUrl && !showResume && (
                                     <button 
                                      onClick={() => setShowResume(true)}
                                      className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl text-[8px] font-black uppercase tracking-widest"
                                     >
                                        Watch Match Resume
                                     </button>
                                   )}
                                </div>
                            ) : !isSignalAvailable ? (
                                <div className="h-full flex flex-col items-center justify-center text-center py-10">
                                   <Radio size={24} className="text-slate-800 mb-2" />
                                   <span className="text-[9px] font-black uppercase tracking-widest text-slate-700 max-w-[120px]">Awaiting Signal Sync</span>
                                </div>
                            ) : (
                                details.sources?.map((s, i) => (
                                   <button key={i} onClick={() => setActiveSourceIndex(i)} className={`w-full p-3.5 rounded-xl flex items-center gap-3 transition-all border ${activeSourceIndex === i ? 'bg-pink-600 border-pink-400 shadow-lg' : 'bg-white/5 border-transparent hover:bg-white/10'}`}>
                                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-[10px] ${activeSourceIndex === i ? 'bg-white text-black' : 'bg-slate-800 text-slate-500'}`}>{i+1}</div>
                                      <span className={`text-[10px] font-black uppercase tracking-tight truncate text-left flex-1 ${activeSourceIndex === i ? 'text-white' : 'text-slate-300'}`}>{s.title}</span>
                                   </button>
                                ))
                            )}
                          </div>
                      </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'stats' && (
                <motion.div key="stats" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl mx-auto w-full">
                  <div className="bg-black/40 backdrop-blur-3xl p-6 md:p-8 rounded-[1.5rem] border border-white/10 shadow-xl">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-1.5 bg-purple-500/20 rounded-lg"><BarChart2 size={16} className="text-purple-400" /></div>
                        <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Match Metrics</h3>
                    </div>
                    <StatRow label="Possession" home={details.stats.possession[0]} away={details.stats.possession[1]} isPercent />
                    <StatRow label="Attempts" home={details.stats.shots[0]} away={details.stats.shots[1]} />
                    <StatRow label="Target" home={details.stats.shotsOnTarget[0]} away={details.stats.shotsOnTarget[1]} />
                    <StatRow label="Corners" home={details.stats.corners[0]} away={details.stats.corners[1]} />
                    <StatRow label="Fouls" home={details.stats.fouls[0]} away={details.stats.fouls[1]} />
                  </div>
                  <div className="bg-black/40 backdrop-blur-3xl p-6 md:p-8 rounded-[1.5rem] border border-white/10 shadow-xl">
                    <MatchEvents incidents={details.incidents} homeName={details.homeTeam.name} awayName={details.awayTeam.name} />
                  </div>
                </motion.div>
              )}

              {activeTab === 'lineups' && (
                <motion.div key="lineups" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col gap-6">
                  <div className="flex justify-center gap-2">
                    <button onClick={() => setViewMode('pitch')} className={`px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${viewMode === 'pitch' ? 'bg-white text-black border-white' : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'}`}>Tactical</button>
                    <button onClick={() => setViewMode('list')} className={`px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${viewMode === 'list' ? 'bg-white text-black border-white' : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'}`}>Roster</button>
                  </div>
                  {viewMode === 'pitch' ? (
                    <PitchView homeLineup={details.homeLineup} awayLineup={details.awayLineup} homeFormation={details.homeFormation} awayFormation={details.awayFormation} />
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto w-full">
                      <LineupList 
                        teamName={details.homeTeam.name} 
                        startXI={details.homeLineup} 
                        substitutes={details.homeSubstitutes} 
                        colorClass="text-pink-500" 
                        incidents={details.incidents}
                        isHome={true}
                      />
                      <LineupList 
                        teamName={details.awayTeam.name} 
                        startXI={details.awayLineup} 
                        substitutes={details.awaySubstitutes} 
                        colorClass="text-purple-400" 
                        incidents={details.incidents}
                        isHome={false}
                      />
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          ) : null}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default MatchDetailView;
