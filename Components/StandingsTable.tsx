
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Trophy, RefreshCw, Globe, Loader2, ChevronRight, Star, ShieldCheck, HelpCircle, Zap, Radio, Activity } from 'lucide-react';
import { fetchLeagueStandings, fetchMatchesForDate } from '../services/geminiService';
import { Standing, Match } from '../types';

interface QuickLink {
  id: string;
  name: string;
  logo: string;
  type: string;
  isDynamic?: boolean;
}

const StandingRow: React.FC<{ standing: Standing; isLast: boolean; leagueId: string }> = ({ standing, isLast, leagueId }) => {
  // Common major league IDs for logic-based highlight colors
  const MAJOR_LEAGUE_IDS = ['17', '8', '23', '35', '34'];
  const isDomesticTop = MAJOR_LEAGUE_IDS.includes(leagueId);
  
  const isUCLQual = isDomesticTop && standing.rank <= 4;
  const isUELQual = isDomesticTop && (standing.rank === 5);
  const isUECLQual = isDomesticTop && (standing.rank === 6);
  const isRelegation = isDomesticTop && standing.rank >= 18;

  const getIndicatorColor = () => {
    if (isUCLQual) return 'bg-indigo-500 shadow-indigo-500/50';
    if (isUELQual) return 'bg-purple-500 shadow-purple-500/50';
    if (isUECLQual) return 'bg-cyan-500 shadow-cyan-500/50';
    if (isRelegation) return 'bg-pink-600 shadow-pink-600/50';
    return 'bg-transparent';
  };

  return (
    <motion.tr 
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={`group border-b border-white/5 hover:bg-white/[0.03] transition-all ${isLast ? 'border-0' : ''}`}
    >
      <td className="py-4 px-4 relative">
        <div className="flex items-center gap-3">
          <div className={`absolute left-0 w-1 h-6 rounded-r-full shadow-lg transition-all ${getIndicatorColor()}`} />
          <span className={`text-[11px] font-black w-5 text-center ${isUCLQual ? 'text-indigo-400' : 'text-slate-500'}`}>
            {standing.rank}
          </span>
        </div>
      </td>
      <td className="py-4 px-2">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white p-1 flex items-center justify-center shrink-0 border border-white/10 group-hover:border-indigo-500/30 transition-colors shadow-sm">
            {standing.logo ? (
              <img src={standing.logo} alt="" className="w-full h-full object-contain" />
            ) : (
              <HelpCircle size={14} className="text-slate-700" />
            )}
          </div>
          <span className="text-[11px] font-black text-white uppercase tracking-tight group-hover:text-indigo-400 transition-colors truncate max-w-[140px] md:max-w-none">
            {standing.team}
          </span>
        </div>
      </td>
      <td className="py-4 px-2 text-center text-[11px] font-bold text-slate-400">{standing.played}</td>
      <td className="py-4 px-2 text-center text-[11px] font-bold text-slate-300">{standing.won}</td>
      <td className="py-4 px-2 text-center text-[11px] font-bold text-slate-500">{standing.drawn}</td>
      <td className="py-4 px-2 text-center text-[11px] font-bold text-slate-500">{standing.lost}</td>
      <td className="py-4 px-2 text-center text-[11px] font-bold text-slate-400 hidden md:table-cell">{standing.goalDifference > 0 ? `+${standing.goalDifference}` : standing.goalDifference}</td>
      <td className="py-4 px-4 text-center text-[11px] font-black text-indigo-400">{standing.points}</td>
    </motion.tr>
  );
};

const StandingsTable = () => {
  const [activeLeagueId, setActiveLeagueId] = useState<string>('');
  const [standings, setStandings] = useState<Standing[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dynamicLeagues, setDynamicLeagues] = useState<QuickLink[]>([]);
  const [loadingDynamic, setLoadingDynamic] = useState(true);

  const getLocalDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const loadStandings = async (id: string) => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await fetchLeagueStandings(id);
      setStandings(data);
    } catch (err) {
      console.error("Failed to load standings", err);
    } finally {
      setLoading(false);
    }
  };

  const discoverActiveLeagues = async () => {
    setLoadingDynamic(true);
    try {
      const today = getLocalDateString(new Date());
      const matches = await fetchMatchesForDate(today);
      
      const leaguesMap = new Map<string, { link: QuickLink, count: number }>();
      
      matches.forEach(m => {
        // Exclude Europa League variants explicitly
        const leagueName = m.league.toLowerCase();
        if (leagueName.includes('europa league') || leagueName.includes('uefa europa')) return;

        const idMatch = m.leagueLogo?.match(/\/(?:unique-tournament|tournament)\/(\d+)\//);
        const leagueId = idMatch ? idMatch[1] : null;
        
        if (leagueId) {
          if (!leaguesMap.has(leagueId)) {
            leaguesMap.set(leagueId, {
              link: {
                id: leagueId,
                name: m.league,
                logo: m.leagueLogo || '',
                type: 'active',
                isDynamic: true
              },
              count: 1
            });
          } else {
            leaguesMap.get(leagueId)!.count += 1;
          }
        }
      });

      // Sort by popularity (match count) to put big leagues at top
      const foundLeagues = Array.from(leaguesMap.values())
        .sort((a, b) => b.count - a.count)
        .map(v => v.link);

      setDynamicLeagues(foundLeagues);
      
      if (foundLeagues.length > 0 && !activeLeagueId) {
        setActiveLeagueId(foundLeagues[0].id);
      }
    } catch (err) {
      console.error("Failed to discover dynamic leagues", err);
    } finally {
      setLoadingDynamic(false);
    }
  };

  useEffect(() => {
    discoverActiveLeagues();
  }, []);

  useEffect(() => {
    if (activeLeagueId) {
      loadStandings(activeLeagueId);
    }
  }, [activeLeagueId]);

  const filteredStandings = standings.filter(s => 
    s.team.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeLeague = dynamicLeagues.find(l => l.id === activeLeagueId);

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl shadow-xl border border-white/20">
              <Trophy size={24} className="text-white" />
            </div>
            <div>
               <h2 className="text-2xl md:text-3xl font-black text-white tracking-tighter uppercase leading-none">
                  Nexus <span className="text-indigo-400">Standings</span>
               </h2>
               <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] block mt-1.5 flex items-center gap-2">
                  <RefreshCw size={10} className={loading ? 'animate-spin text-indigo-500' : ''} />
                  Dynamic Arena Synchronization
               </span>
            </div>
        </div>

        <div className="relative w-full md:w-80 group">
           <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-indigo-500 transition-colors">
              <Search size={16} />
           </div>
           <input 
             type="text" 
             value={searchQuery}
             onChange={(e) => setSearchQuery(e.target.value)}
             placeholder="Search team..." 
             className="w-full bg-slate-900 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-xs font-bold text-white uppercase tracking-widest outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-700"
           />
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-10 items-start">
        <div className="w-full lg:w-72 shrink-0 space-y-6">
          <div className="p-6 bg-[#0b0f1a] border border-white/5 rounded-[2.5rem] shadow-2xl">
            <div className="flex items-center gap-2 mb-6 px-2">
                <Activity size={14} className="text-pink-500" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Live Arena Hub</span>
            </div>
            
            <div className="flex flex-col gap-2 max-h-[600px] overflow-y-auto custom-scrollbar pr-1">
              {loadingDynamic ? (
                <div className="flex flex-col items-center py-12 gap-4">
                   <Loader2 size={24} className="text-pink-500 animate-spin opacity-50" />
                   <span className="text-[8px] font-black uppercase tracking-[0.3em] text-slate-600">Scanning Signal Nodes</span>
                </div>
              ) : dynamicLeagues.length > 0 ? (
                dynamicLeagues.map((link) => (
                  <button
                    key={link.id}
                    onClick={() => setActiveLeagueId(link.id)}
                    className={`group flex items-center gap-3 w-full px-4 py-3.5 rounded-2xl transition-all border ${
                      activeLeagueId === link.id 
                      ? 'bg-pink-600 border-pink-400/50 shadow-[0_10px_20px_rgba(236,72,153,0.3)]' 
                      : 'bg-white/5 border-transparent hover:bg-white/10 hover:border-white/10'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-lg bg-white p-1 flex items-center justify-center shrink-0 shadow-sm">
                        {link.logo ? <img src={link.logo} alt="" className="w-full h-full object-contain" /> : <Globe size={14} className="text-slate-400" />}
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-tight truncate flex-1 text-left ${activeLeagueId === link.id ? 'text-white' : 'text-slate-400 group-hover:text-white'}`}>
                      {link.name}
                    </span>
                    <div className={`w-1.5 h-1.5 rounded-full ${activeLeagueId === link.id ? 'bg-white' : 'bg-pink-500'} animate-pulse shrink-0`} />
                  </button>
                ))
              ) : (
                <div className="py-20 text-center px-6 flex flex-col items-center gap-4">
                  <Radio size={24} className="text-slate-800" />
                  <span className="text-[8px] font-black text-slate-700 uppercase tracking-widest leading-relaxed">
                    No active competition signals detected
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 w-full min-h-[600px]">
          <AnimatePresence mode="wait">
            {!activeLeagueId ? (
              <motion.div 
                key="empty-state"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center py-40 bg-[#0b0f1a] rounded-[3rem] border border-white/5"
              >
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-6">
                  <Activity size={32} className="text-slate-800" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-600">Awaiting Signal Link</span>
              </motion.div>
            ) : loading ? (
              <motion.div 
                key="loading"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center py-40 bg-[#0b0f1a] rounded-[3rem] border border-white/5"
              >
                <Loader2 className="w-16 h-16 text-indigo-500 animate-spin" />
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 mt-8">Establishing Data Tunnel</span>
              </motion.div>
            ) : (
              <motion.div
                key="table"
                initial={{ opacity: 0, scale: 0.99 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.99 }}
                className="bg-[#0b0f1a] rounded-[3rem] border border-white/5 overflow-hidden shadow-3xl"
              >
                <div className="px-8 py-8 md:px-12 bg-gradient-to-br from-indigo-950/40 via-transparent to-transparent border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-6">
                   <div className="flex items-center gap-6">
                      <div className="w-20 h-20 rounded-[2rem] bg-white p-3 shadow-2xl flex items-center justify-center">
                         {activeLeague?.logo ? <img src={activeLeague.logo} alt="" className="w-full h-full object-contain" /> : <Globe size={32} className="text-slate-400" />}
                      </div>
                      <div>
                         <div className="flex items-center gap-2 mb-1">
                            <ShieldCheck size={12} className="text-indigo-400" />
                            <span className="text-[8px] font-black text-indigo-400 uppercase tracking-[0.3em]">Verified Arena Signal</span>
                         </div>
                         <h3 className="text-2xl font-black text-white uppercase tracking-tighter leading-none">{activeLeague?.name}</h3>
                         <div className="flex items-center gap-4 mt-2">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                               <Zap size={10} className="text-pink-500" />
                               Competition Relay Phase
                            </span>
                         </div>
                      </div>
                   </div>
                </div>

                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead className="bg-white/[0.02] border-b border-white/5">
                      <tr>
                        <th className="py-6 px-4 text-[9px] font-black uppercase tracking-widest text-slate-500 text-center w-16">#</th>
                        <th className="py-6 px-2 text-[9px] font-black uppercase tracking-widest text-slate-500">Club</th>
                        <th className="py-6 px-2 text-[9px] font-black uppercase tracking-widest text-slate-500 text-center">P</th>
                        <th className="py-6 px-2 text-[9px] font-black uppercase tracking-widest text-slate-500 text-center">W</th>
                        <th className="py-6 px-2 text-[9px] font-black uppercase tracking-widest text-slate-500 text-center">D</th>
                        <th className="py-6 px-2 text-[9px] font-black uppercase tracking-widest text-slate-500 text-center">L</th>
                        <th className="py-6 px-2 text-[9px] font-black uppercase tracking-widest text-slate-500 text-center hidden md:table-cell">GD</th>
                        <th className="py-6 px-4 text-[9px] font-black uppercase tracking-widest text-slate-500 text-center">PTS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredStandings.length > 0 ? filteredStandings.map((standing, idx) => (
                        <StandingRow 
                          key={`${standing.team}-${idx}`} 
                          standing={standing} 
                          isLast={idx === filteredStandings.length - 1} 
                          leagueId={activeLeagueId}
                        />
                      )) : (
                        <tr>
                          <td colSpan={8} className="py-32 text-center">
                             <div className="flex flex-col items-center gap-4">
                               <Radio size={32} className="text-slate-800" />
                               <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">No table data available for this node</span>
                             </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="p-10 bg-white/[0.01] flex flex-wrap gap-x-8 gap-y-4 border-t border-white/5">
                    <div className="flex items-center gap-2.5">
                        <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Promotion Signal</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                        <div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.6)]" />
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Regional Qualification</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                        <div className="w-2 h-2 rounded-full bg-pink-600 shadow-[0_0_8px_rgba(219,39,119,0.6)]" />
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Relegation Zone</span>
                    </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default StandingsTable;
