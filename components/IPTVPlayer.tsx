import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Tv, List, Grid, Play, X, ChevronRight, LayoutGrid, Heart, History, Settings, Info, Radio, Zap, Plus, Clock, Loader2 } from 'lucide-react';
import { getAllChannels, normalizeChannelName } from '../services/geminiService';
import { Source, EPGData, EPGProgram } from '../types';
import SmartPlayer from './SmartPlayer';
import { iptvService } from '../services/iptvService';

const IPTVPlayer: React.FC<{ onOpenManager: () => void; onBack: () => void }> = ({ onOpenManager, onBack }) => {
  const [channels, setChannels] = useState<Source[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Source | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All Channels');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [epgData, setEpgData] = useState<EPGData>({});
  const [isEpgLoading, setIsEpgLoading] = useState(false);
  const [visibleCount, setVisibleCount] = useState(40);
  const [isInfiniteScrollLoading, setIsInfiniteScrollLoading] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000); // Update every minute
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const all = getAllChannels();
    setChannels(all);

    // Fetch EPG if any channel has an epgUrl
    const epgUrls = Array.from(new Set(all.map(c => c.epgUrl).filter(Boolean)));
    if (epgUrls.length > 0) {
      setIsEpgLoading(true);
      Promise.all(epgUrls.map(url => iptvService.fetchEPG(url!)))
        .then(results => {
          const merged: EPGData = {};
          results.forEach(data => {
            Object.assign(merged, data);
          });
          setEpgData(merged);
        })
        .finally(() => setIsEpgLoading(false));
    }
  }, []);

  // Reset visible count when category or search changes
  useEffect(() => {
    setVisibleCount(40);
  }, [selectedCategory, searchQuery]);

  const getCurrentProgram = (channel: Source): EPGProgram | null => {
    const id = channel.epgId;
    if (!id || !epgData[id]) return null;
    return epgData[id].find(p => now >= p.start && now <= p.stop) || null;
  };

  const getProgress = (program: EPGProgram) => {
    const total = program.stop - program.start;
    const elapsed = now - program.start;
    return Math.min(Math.max((elapsed / total) * 100, 0), 100);
  };

  const categories = useMemo(() => {
    const cats = new Set<string>();
    cats.add('All Channels');
    
    // Only show channels that came from playlists
    const playlistChannels = channels.filter(c => c.playlistId);
    
    // Add standard groups from playlist channels
    playlistChannels.forEach(c => {
      if (c.group) cats.add(c.group);
    });
    
    return Array.from(cats);
  }, [channels]);

  const filteredChannels = useMemo(() => {
    const query = searchQuery.toLowerCase();
    const normQuery = normalizeChannelName(searchQuery);
    
    // Only show channels that came from playlists
    const playlistChannels = channels.filter(c => c.playlistId);
    
    return playlistChannels.filter(c => {
      const normName = normalizeChannelName(c.name || "");
      const normGroup = normalizeChannelName(c.group || "");
      
      const matchesSearch = 
        (c.name || '').toLowerCase().includes(query) || 
        normName.includes(normQuery) || 
        normGroup.includes(normQuery);
        
      const matchesCategory = selectedCategory === 'All Channels' || c.group === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [channels, searchQuery, selectedCategory]);

  const visibleChannels = useMemo(() => {
    return filteredChannels.slice(0, visibleCount);
  }, [filteredChannels, visibleCount]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollHeight - target.scrollTop <= target.clientHeight + 100) {
      if (visibleCount < filteredChannels.length && !isInfiniteScrollLoading) {
        setIsInfiniteScrollLoading(true);
        setTimeout(() => {
          setVisibleCount(prev => prev + 40);
          setIsInfiniteScrollLoading(false);
        }, 100);
      }
    }
  };

  if (channels.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-160px)] bg-[#020617] rounded-[2.5rem] border border-white/10 p-12 text-center gap-8">
        <div className="w-32 h-32 bg-white/5 rounded-[3rem] flex items-center justify-center border border-white/10 shadow-2xl">
          <Tv size={64} className="text-slate-700" />
        </div>
        <div className="space-y-4">
          <h2 className="text-4xl font-black text-white uppercase tracking-tighter">No Playlists Found</h2>
          <p className="text-slate-500 font-medium max-w-md mx-auto">Connect your M3U or Xtream server to start watching your favorite channels.</p>
        </div>
        <div className="flex gap-4">
            <button 
            onClick={onBack}
            className="px-8 py-5 bg-white/5 border border-white/10 rounded-3xl text-slate-400 font-black uppercase tracking-widest hover:text-white transition-all"
            >
            Back
            </button>
            <button 
            onClick={onOpenManager}
            className="px-10 py-5 bg-gradient-to-r from-pink-600 to-purple-600 rounded-3xl text-white font-black uppercase tracking-widest shadow-2xl shadow-pink-600/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
            >
            <Plus size={20} /> Add New Playlist
            </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-160px)] bg-[#020617] text-white overflow-hidden rounded-[2.5rem] border border-white/10 shadow-3xl relative z-10">
      {/* Category Sidebar */}
      <motion.div 
        animate={{ width: isSidebarCollapsed ? 80 : 280 }}
        className="h-full border-r border-white/5 bg-black/40 backdrop-blur-3xl flex flex-col shrink-0"
      >
        <div className="p-6 flex items-center justify-between">
          {!isSidebarCollapsed && <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Categories</span>}
          <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
            <LayoutGrid size={18} className="text-pink-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 space-y-1 custom-scrollbar pb-6">
          <button
            onClick={onBack}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-wider text-slate-500 hover:bg-white/5 hover:text-white transition-all mb-4 border border-white/5"
          >
            <LayoutGrid size={14} />
            {!isSidebarCollapsed && <span>Back</span>}
          </button>

          {isEpgLoading && (
            <div className="px-4 py-2 mb-4 bg-pink-500/10 border border-pink-500/20 rounded-xl flex items-center gap-3">
              <Loader2 size={12} className="text-pink-500 animate-spin" />
              {!isSidebarCollapsed && <span className="text-[8px] font-black text-pink-500 uppercase tracking-widest">Syncing Guide...</span>}
            </div>
          )}

          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all group ${
                selectedCategory === cat 
                ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-lg shadow-pink-600/20' 
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className={`p-1.5 rounded-lg transition-colors ${selectedCategory === cat ? 'bg-white/20' : 'bg-white/5 group-hover:bg-white/10'}`}>
                <Tv size={14} className={selectedCategory === cat ? 'text-white' : 'text-slate-500'} />
              </div>
              {!isSidebarCollapsed && <span className="truncate">{cat}</span>}
              {!isSidebarCollapsed && selectedCategory === cat && <ChevronRight size={14} className="ml-auto opacity-50" />}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Channel List & Player Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-black/20">
        {/* Top Bar */}
        <div className="h-20 border-b border-white/5 flex items-center justify-between px-8 bg-black/40 backdrop-blur-md shrink-0">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search channels..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-xs font-bold focus:border-pink-500 outline-none transition-all placeholder:text-slate-600"
            />
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500">{filteredChannels.length} Channels Online</span>
            </div>
            <div className="p-2 bg-white/5 border border-white/10 rounded-xl text-slate-400">
                <Settings size={18} />
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Channel Grid/List */}
          <div 
            className="flex-1 overflow-y-auto p-6 custom-scrollbar"
            onScroll={handleScroll}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
              {visibleChannels.map((channel, idx) => (
                <button
                  key={`${channel.name}-${idx}`}
                  onClick={() => setSelectedChannel(channel)}
                  className={`group relative p-5 rounded-[2rem] border transition-all flex flex-col items-center text-center gap-4 ${
                    selectedChannel?.url === channel.url 
                    ? 'bg-gradient-to-br from-pink-600/30 to-purple-600/30 border-pink-500 shadow-2xl shadow-pink-500/10' 
                    : 'bg-white/[0.03] border-white/5 hover:border-white/20 hover:bg-white/[0.08]'
                  }`}
                >
                  <div className="w-20 h-20 rounded-3xl bg-black/40 border border-white/10 flex items-center justify-center overflow-hidden group-hover:scale-110 transition-transform duration-500 shadow-inner">
                    {channel.logo ? (
                      <img 
                        src={channel.logo} 
                        alt="" 
                        className="w-full h-full object-contain p-3" 
                        referrerPolicy="no-referrer"
                        loading="lazy"
                      />
                    ) : (
                      <Tv size={32} className="text-slate-600 group-hover:text-pink-500 transition-colors" />
                    )}
                  </div>
                  <div className="flex flex-col gap-1 w-full">
                    <span className="text-[11px] font-black uppercase tracking-tight line-clamp-2 h-8 flex items-center justify-center leading-tight">
                        {channel.name}
                    </span>
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">{channel.group || 'Live'}</span>
                    </div>
                  </div>

                  {/* EPG Info */}
                  {(() => {
                    const program = getCurrentProgram(channel);
                    if (!program) return null;
                    return (
                      <div className="w-full mt-2 space-y-1.5 text-left bg-black/20 p-3 rounded-2xl border border-white/5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[9px] font-bold text-pink-400 truncate uppercase tracking-tight">{program.title}</span>
                          <Clock size={10} className="text-slate-500 shrink-0" />
                        </div>
                        <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${getProgress(program)}%` }}
                            className="h-full bg-gradient-to-r from-pink-500 to-purple-500"
                          />
                        </div>
                      </div>
                    );
                  })()}
                  
                  {selectedChannel?.url === channel.url && (
                    <div className="absolute top-4 right-4">
                      <div className="w-2 h-2 rounded-full bg-pink-500 shadow-[0_0_12px_#ec4899] animate-pulse" />
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-pink-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-[2rem]" />
                </button>
              ))}
            </div>

            {isInfiniteScrollLoading && (
              <div className="flex justify-center py-8">
                <Loader2 className="text-pink-500 animate-spin" size={24} />
              </div>
            )}

            {filteredChannels.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-slate-700 gap-6 py-20">
                    <div className="p-8 bg-white/5 rounded-full border border-white/10">
                        <Search size={64} className="opacity-20" />
                    </div>
                    <span className="text-sm font-black uppercase tracking-[0.4em]">No Signal Found</span>
                </div>
            )}
          </div>

          {/* Preview Player (Smarters Style) */}
          <AnimatePresence>
            {selectedChannel && (
              <motion.div 
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 200 }}
                className="w-full max-w-[480px] border-l border-white/10 bg-black/80 backdrop-blur-3xl flex flex-col shadow-4xl z-20"
              >
                <div className="p-8 border-b border-white/5 flex items-center justify-between bg-black/40">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-pink-600 flex items-center justify-center shrink-0 shadow-lg shadow-pink-600/20">
                        <Radio size={20} className="text-white" />
                    </div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-white truncate">{selectedChannel.name}</h3>
                  </div>
                  <button onClick={() => setSelectedChannel(null)} className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all active:scale-90">
                    <X size={20} />
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="p-8 space-y-8">
                        <div className="aspect-video bg-black rounded-[2.5rem] overflow-hidden border border-white/10 shadow-3xl group relative">
                            <SmartPlayer src={selectedChannel.url} autoPlay />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-5 bg-white/5 rounded-3xl border border-white/5 flex flex-col gap-2">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Signal Status</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                                    <span className="text-[11px] font-black text-white uppercase">Optimal</span>
                                </div>
                            </div>
                            <div className="p-5 bg-white/5 rounded-3xl border border-white/5 flex flex-col gap-2">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Resolution</span>
                                <div className="flex items-center gap-2">
                                    <Zap size={14} className="text-pink-500" />
                                    <span className="text-[11px] font-black text-white uppercase">Full HD</span>
                                </div>
                            </div>
                        </div>

                        {/* Now Playing / EPG */}
                        {(() => {
                            const program = getCurrentProgram(selectedChannel);
                            if (!program) return null;
                            return (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3 text-slate-500">
                                        <Clock size={16} className="text-pink-500" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Now Playing</span>
                                    </div>
                                    <div className="p-6 bg-gradient-to-br from-pink-600/10 to-purple-600/10 rounded-[2rem] border border-pink-500/20 space-y-4">
                                        <div className="space-y-2">
                                            <h4 className="text-sm font-black text-white uppercase tracking-tight">{program.title}</h4>
                                            {program.description && (
                                                <p className="text-[10px] text-slate-400 font-medium line-clamp-3 leading-relaxed">
                                                    {program.description}
                                                </p>
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-[9px] font-black uppercase tracking-widest">
                                                <span className="text-slate-500">{new Date(program.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                <span className="text-pink-500">{Math.round(getProgress(program))}% Complete</span>
                                                <span className="text-slate-500">{new Date(program.stop).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                                <motion.div 
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${getProgress(program)}%` }}
                                                    className="h-full bg-gradient-to-r from-pink-500 to-purple-500"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                        <div className="space-y-4">
                            <div className="flex items-center gap-3 text-slate-500">
                                <Info size={16} className="text-pink-500" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Stream Intelligence</span>
                            </div>
                            <div className="p-6 bg-white/5 rounded-[2rem] border border-white/5 space-y-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">Provider Node</span>
                                    <span className="text-[10px] font-black text-white uppercase tracking-wider">XStream-01</span>
                                </div>
                                <div className="w-full h-px bg-white/5" />
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">Category</span>
                                    <span className="text-[10px] font-black text-pink-400 uppercase tracking-wider">{selectedCategory}</span>
                                </div>
                                <div className="w-full h-px bg-white/5" />
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">Latency</span>
                                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-wider">0.4s</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-8 bg-black/40 border-t border-white/5">
                   <button 
                    onClick={() => {
                        // SmartPlayer handles fullscreen via its own controls
                    }}
                    className="w-full py-5 bg-white text-black rounded-[1.5rem] font-black uppercase tracking-[0.2em] shadow-2xl hover:bg-pink-600 hover:text-white transition-all active:scale-95 flex items-center justify-center gap-3 group"
                   >
                     <Play size={20} fill="currentColor" className="group-hover:scale-125 transition-transform" /> 
                     Launch Full Arena
                   </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default IPTVPlayer;
