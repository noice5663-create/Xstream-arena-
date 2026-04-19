
import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Calendar, Loader2, RefreshCw, Zap, Activity, Clock, ChevronRight, Globe, Layers, Filter, Check, X, ChevronDown, Search } from 'lucide-react';
import { fetchLiveMatches, fetchMatchesForDate, fetchLiveOnSatData, getAllChannels, normalizeChannelName, BIG_COMPETITIONS } from '../services/geminiService';
import { Match, Source } from '../types';
import MatchCard from './MatchCard';
import MatchDetailView from './MatchDetail';

type FilterType = 'LIVE' | 'SCHEDULE';

interface LeagueGroup {
  id: string; // The group key (logo URL or name fallback)
  name: string;
  logo?: string;
  matches: Match[];
}

interface SofaScoreEmbedProps {
  searchQuery?: string;
  onGoToHighlights?: (match: Match) => void;
  onGoToStandings?: (leagueId: string) => void;
}

const LeagueSpotlightSection = React.memo(({ 
  group, 
  onMatchClick, 
  onHighlightsClick,
  onLeagueClick,
  liveOnSatData,
  preProcessedIptv
}: { 
  group: LeagueGroup; 
  onMatchClick: (m: Match) => void;
  onHighlightsClick: (m: Match) => void;
  onLeagueClick: (leagueId: string) => void;
  liveOnSatData: any[];
  preProcessedIptv: any[];
}) => {
  const [logoError, setLogoError] = useState(false);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="relative w-full mb-12 last:mb-0"
    >
      {/* SECTION HEADER */}
      <div 
        className="flex items-center gap-4 mb-6 px-4 cursor-pointer group/header"
        onClick={() => {
          const idMatch = group.logo?.match(/\/(?:unique-tournament|tournament)\/(\d+)\//);
          const leagueId = idMatch ? idMatch[1] : null;
          if (leagueId) onLeagueClick(leagueId);
        }}
      >
        <div className="relative group">
          <div className="absolute -inset-2 bg-indigo-500/20 rounded-xl blur-lg group-hover:opacity-100 opacity-50 transition-opacity" />
          <div className="w-12 h-12 rounded-xl bg-white p-2 border border-white/10 shadow-2xl relative z-10 overflow-hidden flex items-center justify-center group-hover/header:border-pink-500/50 transition-colors">
             {!logoError && group.logo ? (
                <img src={group.logo} alt="" className="w-full h-full object-contain" onError={() => setLogoError(true)} loading="lazy" />
             ) : (
                <Globe size={20} className="text-slate-400" />
             )}
          </div>
        </div>
        <div className="flex flex-col">
            <h3 className="text-lg md:text-xl font-black text-white uppercase tracking-tighter leading-none group-hover/header:text-pink-400 transition-colors">
              {group.name}
            </h3>
            <span className="text-[8px] font-bold text-slate-500 uppercase tracking-[0.3em] mt-1 flex items-center gap-1.5">
               <Layers size={10} className="text-indigo-500" /> View Standings
            </span>
        </div>
      </div>

      {/* SPOTLIGHT CONTAINER */}
      <div className="relative rounded-[3rem] overflow-hidden border border-white/5 bg-[#0f172a]/20 backdrop-blur-sm p-6 md:p-10">
        
        {/* HUGE BACKGROUND WATERMARK */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden">
          {!logoError && group.logo ? (
             <img 
               src={group.logo} 
               alt="" 
               className="w-[300px] h-[300px] md:w-[600px] md:h-[600px] object-contain opacity-[0.18] brightness-125 saturate-125 scale-110 group-hover:scale-125 transition-transform duration-1000"
               loading="lazy"
             />
          ) : (
             <Globe className="w-64 h-64 text-white/[0.02]" />
          )}
        </div>

        {/* GLOWS */}
        <div className="absolute -top-20 -right-20 w-80 h-80 bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />

        {/* MATCH GRID */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 md:gap-8 relative z-10">
          {group.matches.map((match) => (
            <MatchCard 
              key={match.id} 
              match={match} 
              onClick={onMatchClick} 
              onHighlightsClick={onHighlightsClick}
              liveOnSatData={liveOnSatData}
              preProcessedIptv={preProcessedIptv}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
});

const TournamentSchedule: React.FC<SofaScoreEmbedProps> = ({ searchQuery = '', onGoToHighlights, onGoToStandings }) => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [liveOnSatData, setLiveOnSatData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('LIVE');
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeLeagues, setActiveLeagues] = useState<string[]>([]);
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const filterRef = useRef<HTMLDivElement>(null);

  const preProcessedIptv = useMemo(() => {
    const allIptv = getAllChannels();
    return allIptv.map(ch => ({
      source: ch,
      normalized: normalizeChannelName(ch.name),
      original: ch.name
    }));
  }, []); // Only once
  
  const getLocalDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [selectedDate, setSelectedDate] = useState<string>(getLocalDateString(new Date()));

  const loadData = async (isInitial = false) => {
    setLoading(true);
    // Use a local variable to prevent race conditions
    const currentFetchId = Date.now();
    (window as any).lastFetchId = currentFetchId;

    try {
      let results: Match[] = [];
      const liveOnSat = await fetchLiveOnSatData();
      setLiveOnSatData(liveOnSat);

      if (filter === 'LIVE') {
        results = await fetchLiveMatches();
      } else if (filter === 'SCHEDULE') {
        const rawResults = await fetchMatchesForDate(selectedDate);
        results = rawResults.filter(m => m.date === selectedDate);
      }

      // If a newer fetch has started, ignore this result
      if ((window as any).lastFetchId !== currentFetchId) return;

      const statusPriority: Record<string, number> = {
        'LIVE': 0,
        'SCHEDULED': 1,
        'FINISHED': 2
      };

      const sorted = [...results].sort((a, b) => {
        const priorityA = statusPriority[a.status] ?? 3;
        const priorityB = statusPriority[b.status] ?? 3;
        
        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }
        return (a.timestamp || 0) - (b.timestamp || 0);
      });
      
      setMatches(sorted);
    } catch (err) {
      console.error("Signal sync error:", err);
    } finally {
      if (isInitial || (window as any).lastFetchId === currentFetchId) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadData(true);
  }, [filter, selectedDate]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const displayLeagueGroups = useMemo(() => {
    const filtered = matches.filter(match => {
      const q = (searchQuery || localSearchQuery).toLowerCase();
      return (
        match.homeTeam.name.toLowerCase().includes(q) ||
        match.awayTeam.name.toLowerCase().includes(q) ||
        match.league.toLowerCase().includes(q)
      );
    });

    const groupsMap = filtered.reduce((acc: Record<string, LeagueGroup>, match) => {
      const visualKey = match.leagueLogo || `NAME_${match.league}`;
      if (!acc[visualKey]) {
        acc[visualKey] = {
          id: visualKey,
          name: match.league,
          logo: match.leagueLogo,
          matches: []
        };
      }
      acc[visualKey].matches.push(match);
      return acc;
    }, {} as Record<string, LeagueGroup>);

    const sorted = (Object.values(groupsMap) as LeagueGroup[]).sort((a, b) => {
      const aIsBig = BIG_COMPETITIONS.some(big => a.name.includes(big));
      const bIsBig = BIG_COMPETITIONS.some(big => b.name.includes(big));
      
      if (aIsBig && !bIsBig) return -1;
      if (!aIsBig && bIsBig) return 1;
      
      return b.matches.length - a.matches.length;
    });
    
    return activeLeagues.length > 0 
      ? sorted.filter(g => activeLeagues.includes(g.id))
      : sorted;
  }, [matches, searchQuery, localSearchQuery, activeLeagues]);

  const toggleLeagueFilter = (id: string) => {
    setActiveLeagues(prev => 
      prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id]
    );
  };

  const quickDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + (i - 1)); // yesterday, today, and 5 days future
    return getLocalDateString(d);
  });

  const getDayName = (dateStr: string) => {
    const today = getLocalDateString(new Date());
    if (dateStr === today) return "Today";
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString(undefined, { weekday: 'short' });
  };

  const handleHighlightsClick = useCallback((match: Match) => {
    setSelectedMatch(match);
  }, []);

  const handleLeagueClick = useCallback((leagueId: string) => {
    if (onGoToStandings) onGoToStandings(leagueId);
  }, [onGoToStandings]);

  const handleMatchClick = useCallback((m: Match) => {
    setSelectedMatch(m);
  }, []);

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Top Navigation Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-50">
        <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-pink-600 to-purple-600 rounded-xl shadow-lg border border-white/10">
              <Zap size={18} className="text-white fill-white" />
            </div>
            <div className="flex items-center gap-4">
               <div>
                  <h2 className="text-xl md:text-2xl font-black text-white tracking-tighter uppercase leading-none">
                      Arena <span className="text-pink-400">Signals</span>
                  </h2>
                  <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block mt-0.5">Organized by Competition</span>
               </div>
               
               {/* SPOTLIGHT FILTER BUTTON */}
               <div className="relative" ref={filterRef}>
                  <button 
                    onClick={() => setIsFilterOpen(!isFilterOpen)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all text-[9px] font-black uppercase tracking-widest ${isFilterOpen ? 'bg-pink-600 border-pink-500 text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'}`}
                  >
                    <Filter size={12} />
                    <span className="hidden sm:inline">League Filter</span>
                    <ChevronDown size={10} className={`transition-transform duration-300 ${isFilterOpen ? 'rotate-180' : ''}`} />
                    {activeLeagues.length > 0 && (
                      <span className="flex items-center justify-center w-3.5 h-3.5 bg-white text-black text-[7px] rounded-full font-black animate-pulse">
                        {activeLeagues.length}
                      </span>
                    )}
                  </button>

                  <AnimatePresence>
                    {isFilterOpen && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute left-0 mt-2 w-64 md:w-72 bg-[#0b0f1a]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-3xl overflow-hidden z-[100]"
                      >
                        <div className="p-3 border-b border-white/10 flex items-center justify-between bg-white/5">
                            <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Available Leagues</span>
                            {activeLeagues.length > 0 && (
                                <button 
                                  onClick={() => setActiveLeagues([])}
                                  className="text-[7px] font-black uppercase tracking-widest text-pink-500 hover:text-pink-400"
                                >
                                  Reset All
                                </button>
                            )}
                        </div>
                        <div className="max-h-80 overflow-y-auto custom-scrollbar p-1">
                          {displayLeagueGroups.length > 0 ? displayLeagueGroups.map((group) => (
                            <button
                              key={group.id}
                              onClick={() => toggleLeagueFilter(group.id)}
                              className={`w-full flex items-center gap-3 p-2 rounded-xl transition-all mb-1 last:mb-0 ${activeLeagues.includes(group.id) ? 'bg-pink-500/10 border border-pink-500/20' : 'hover:bg-white/5 border border-transparent'}`}
                            >
                                <div className="w-8 h-8 rounded-lg bg-white p-1 flex items-center justify-center overflow-hidden shrink-0">
                                   {group.logo ? <img src={group.logo} alt="" className="w-full h-full object-contain" /> : <Globe size={14} className="text-slate-400" />}
                                </div>
                                <span className={`text-[10px] font-bold uppercase tracking-tight text-left truncate flex-1 ${activeLeagues.includes(group.id) ? 'text-white' : 'text-slate-400'}`}>
                                  {group.name}
                                </span>
                                {activeLeagues.includes(group.id) && <Check size={12} className="text-pink-500" />}
                            </button>
                          )) : (
                            <div className="p-6 text-center">
                               <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">No leagues found</span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
               </div>
            </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto scrollbar-hide">
           <div className="relative shrink-0">
               <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
               <input 
                   type="text" 
                   placeholder="Search teams or matches..." 
                   value={localSearchQuery}
                   onChange={(e) => setLocalSearchQuery(e.target.value)}
                   className="bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-pink-500/50 focus:bg-white/10 transition-all w-48 md:w-64"
               />
           </div>
           <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-xl border border-white/5 shrink-0">
              {[
                { id: 'LIVE', label: 'Live', icon: Activity },
                { id: 'SCHEDULE', label: 'Schedule', icon: Calendar }
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => { setFilter(item.id as FilterType); }}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                    filter === item.id ? 'bg-white text-black' : 'text-slate-500 hover:text-white'
                  }`}
                >
                  <item.icon size={11} />
                  {item.label}
                </button>
              ))}
              <button onClick={loadData} disabled={loading} className="p-2 text-slate-500 hover:text-white transition-all">
                 <RefreshCw size={14} className={loading ? 'animate-spin text-pink-500' : ''} />
              </button>
           </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Timeline */}
        <div className="w-full lg:w-48 shrink-0 flex flex-col gap-4">
            <div className="hidden lg:flex flex-col gap-2 p-4 bg-white/[0.03] border border-white/5 rounded-[2rem] backdrop-blur-xl sticky top-20">
                <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em] mb-2 px-2">Timeline</span>
                {quickDates.map((date) => {
                    const isSelected = selectedDate === date;
                    const isToday = getLocalDateString(new Date()) === date;
                    const dayNum = date.split('-')[2];
                    
                    return (
                        <button
                            key={date}
                            onClick={() => { setSelectedDate(date); }}
                            className={`group flex items-center justify-between w-full px-4 py-3 rounded-2xl border transition-all ${
                                isSelected 
                                ? 'bg-indigo-600 border-indigo-500/50 shadow-lg shadow-indigo-600/20' 
                                : 'bg-transparent border-transparent hover:bg-white/5'
                            }`}
                        >
                            <div className="flex flex-col items-start">
                                <span className={`text-[7px] font-black uppercase tracking-widest ${isSelected ? 'text-white/70' : 'text-slate-500'}`}>
                                    {getDayName(date)}
                                </span>
                                <span className={`text-base font-black ${isSelected ? 'text-white' : 'text-slate-200 group-hover:text-indigo-500'}`}>
                                    {dayNum}
                                </span>
                            </div>
                            {isSelected && <ChevronRight size={14} className="text-white/50" />}
                        </button>
                    );
                })}
            </div>

            {/* Mobile Date Row */}
            <div className="lg:hidden flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {quickDates.map((date) => (
                <button
                  key={date}
                  onClick={() => { setSelectedDate(date); }}
                  className={`flex flex-col items-center justify-center min-w-[55px] h-12 rounded-xl border transition-all ${
                    selectedDate === date ? 'bg-indigo-600 border-white/20' : 'bg-white/5 border-white/5'
                  }`}
                >
                  <span className={`text-[6px] font-black uppercase ${selectedDate === date ? 'text-white' : 'text-slate-500'}`}>{getDayName(date)}</span>
                  <span className={`text-sm font-black ${selectedDate === date ? 'text-white' : 'text-slate-200'}`}>{date.split('-')[2]}</span>
                </button>
              ))}
            </div>
        </div>

        {/* Grouped Content */}
        <div className="flex-1 w-full min-w-0 relative">
            {loading ? (
                <div className="flex flex-col items-center justify-center py-32 gap-4">
                    <Loader2 size={32} className="text-indigo-500 animate-spin opacity-50" />
                    <span className="text-slate-600 font-black uppercase tracking-[0.3em] text-[8px] animate-pulse">Syncing Match Data</span>
                </div>
            ) : (
                <div className="space-y-12">
                    <AnimatePresence mode="popLayout">
                        {displayLeagueGroups.length > 0 ? [
                            ...displayLeagueGroups.map((group, idx) => (
                              <motion.div
                                key={group.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ duration: 0.2 }}
                              >
                                <LeagueSpotlightSection 
                                  group={group} 
                                  onMatchClick={handleMatchClick} 
                                  onHighlightsClick={handleHighlightsClick}
                                  onLeagueClick={handleLeagueClick}
                                  liveOnSatData={liveOnSatData}
                                  preProcessedIptv={preProcessedIptv}
                                />
                              </motion.div>
                            ))
                        ] : (
                          <motion.div 
                            key="no-matches"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex flex-col items-center justify-center py-32 text-center px-4 bg-white/[0.02] rounded-[3rem] border border-white/5 backdrop-blur-sm"
                          >
                              <Globe size={32} className="text-slate-800 mb-4" />
                              <h3 className="text-lg font-black text-white uppercase mb-2 tracking-tight">No Active Matches</h3>
                              <p className="text-slate-600 text-[10px] md:text-xs max-w-[240px] mx-auto uppercase tracking-widest leading-relaxed">
                                  {activeLeagues.length > 0 ? "All selected competition signals are currently offline." : "No signals found for this date."}
                              </p>
                              {activeLeagues.length > 0 && (
                                <button 
                                  onClick={() => setActiveLeagues([])}
                                  className="mt-6 px-6 py-2 bg-pink-600 rounded-xl text-[9px] font-black uppercase tracking-widest text-white shadow-lg"
                                >
                                  Reset Arena Filter
                                </button>
                              )}
                          </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}
        </div>
      </div>

      <AnimatePresence>
        {selectedMatch && (
          <MatchDetailView 
            match={selectedMatch} 
            onClose={() => setSelectedMatch(null)} 
            onGoToSummary={() => {
              setSelectedMatch(null);
              if (onGoToHighlights) onGoToHighlights(selectedMatch);
            }} 
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default TournamentSchedule;
