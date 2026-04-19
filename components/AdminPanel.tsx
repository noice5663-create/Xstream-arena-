
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Shield, Plus, Trash2, Edit2, Save, Search, Globe, Tv, Link as LinkIcon, Key, User, Server, Loader2, Check, AlertCircle, RefreshCw, ChevronLeft } from 'lucide-react';
import { iptvService } from '../services/iptvService';
import { findIptvSourcesForMatch, normalizeChannelName, matchOfficialChannelToIptv } from '../services/geminiService';
import { Source, IptvConfig, Fixture } from '../types';

// Separate component for match row to allow memoization
const ScraperMatchRow = React.memo(({ 
  match, 
  preProcessedIptv 
}: { 
  match: any, 
  preProcessedIptv: { source: Source, normalized: string, original: string }[] 
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const rowRef = React.useRef<HTMLTableRowElement>(null);

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

    if (rowRef.current) {
      observer.observe(rowRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Memoize channel mappings to avoid re-calculating on every render
  const channelMappings = React.useMemo(() => {
    if (!isVisible) return [];
    return (match.broadcasters || []).map((officialName: string) => {
      let displayAndMatchName = officialName;
      if (displayAndMatchName.toLowerCase().includes('bein sports mena')) {
          displayAndMatchName = displayAndMatchName.replace(/\bMENA\b/i, '').replace(/\s+/g, ' ').trim();
      }

      const matched = matchOfficialChannelToIptv(
        displayAndMatchName, 
        preProcessedIptv,
        match.competition.toLowerCase().includes('algeria'),
        match.competition.toLowerCase().includes('premier league') || match.competition.toLowerCase().includes('england')
      );

      return { official: displayAndMatchName, matched };
    });
  }, [isVisible, match.broadcasters, match.competition, preProcessedIptv]);

  return (
    <tr ref={rowRef} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
      <td className="py-4 px-4">
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-white uppercase tracking-tight">
            {match.home_team} v {match.away_team}
          </span>
          <span className="text-[8px] text-slate-500 uppercase tracking-widest mt-1">
            {match.competition} | {match.match_time}
          </span>
        </div>
      </td>
      <td className="py-4 px-4" colSpan={2}>
        <div className="flex flex-col gap-2">
          {!isVisible ? (
            <div className="flex items-center gap-2 text-slate-500">
              <Loader2 size={12} className="animate-spin" />
              <span className="text-[8px] uppercase tracking-widest">Loading matches...</span>
            </div>
          ) : channelMappings.map((mapping, i) => (
            <div key={i} className="grid grid-cols-2 gap-4 items-center">
              <div className="flex">
                <span className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[7px] font-black text-slate-400 uppercase tracking-widest">
                  {mapping.official}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {mapping.matched.length > 0 ? (
                  mapping.matched.map((src, j) => (
                    <div key={j} className="flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full bg-emerald-500" />
                      <span className="text-[8px] font-black text-emerald-400 uppercase tracking-tight">
                        {src.name}
                      </span>
                      <span className="text-[6px] text-slate-600 uppercase tracking-widest">
                        ({src.playlistName || 'Manual'})
                      </span>
                    </div>
                  ))
                ) : (
                  <span className="text-[7px] font-black text-slate-700 uppercase tracking-widest italic">
                    No Match Found
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </td>
    </tr>
  );
});

ScraperMatchRow.displayName = 'ScraperMatchRow';

interface AdminPanelProps {
  onClose: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ onClose }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authKey, setAuthKey] = useState('');
  const [authError, setAuthError] = useState(false);

  const [activeTab, setActiveTab] = useState<'add' | 'scraper' | 'playlists'>('add');
  const [iptvType, setIptvType] = useState<'m3u' | 'xtream'>('m3u');
  
  // Scraper states
  const [scrapedMatches, setScrapedMatches] = useState<Fixture[]>([]);
  const [isScraping, setIsScraping] = useState(false);
  const [lastScraped, setLastScraped] = useState<string | null>(null);
  const [playlistName, setPlaylistName] = useState('');
  const [m3uUrl, setM3uUrl] = useState('');
  const [epgUrl, setEpgUrl] = useState('');
  const [xtreamHost, setXtreamHost] = useState('');
  const [xtreamPort, setXtreamPort] = useState('');
  const [xtreamUser, setXtreamUser] = useState('');
  const [xtreamPass, setXtreamPass] = useState('');
  
  // Manual Add states
  const [manualName, setManualName] = useState('');
  const [manualUrl, setManualUrl] = useState('');
  const [manualEpgId, setManualEpgId] = useState('');
  const [manualGroup, setManualGroup] = useState('General');
  
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetchedChannels, setFetchedChannels] = useState<Source[]>([]);
  const [registeredChannels, setRegisteredChannels] = useState<Source[]>([]);
  const [playlists, setPlaylists] = useState<IptvConfig[]>([]);

  // Memoize pre-processed IPTV list to avoid re-calculating on every render
  const preProcessedIptv = React.useMemo(() => {
    const allIptv = iptvService.getGlobalRegistry();
    return allIptv.map(ch => ({
      source: ch,
      normalized: normalizeChannelName(ch.name),
      original: ch.name
    }));
  }, [registeredChannels]); // Re-calculate only when channels change

  const [searchQuery, setSearchQuery] = useState('');
  const [visibleFetchedCount, setVisibleFetchedCount] = useState(50);
  const [visibleRegisteredCount, setVisibleRegisteredCount] = useState(50);
  const [visibleScrapedCount, setVisibleScrapedCount] = useState(100);
  const [editingUri, setEditingUri] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [tunnelActive, setTunnelActive] = useState(iptvService.isTunnelActive());
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      setRegisteredChannels(iptvService.getGlobalRegistry());
      setPlaylists(iptvService.getPlaylists());
      setSelectedPlaylistId(null);
      
      if (activeTab === 'scraper') {
        fetchScrapedMatches();
      }
    }
  }, [isAuthenticated, activeTab]);

  const triggerScrape = async () => {
    setIsScraping(true);
    try {
      const response = await fetch('/api/matches/scrape-now', { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          setScrapedMatches(data);
          setLastScraped(new Date().toLocaleTimeString());
        } else {
          fetchScrapedMatches();
        }
      }
    } catch (err) {
      console.error("Failed to trigger scrape:", err);
    } finally {
      setIsScraping(false);
    }
  };

  const fetchScrapedMatches = async () => {
    setIsScraping(true);
    try {
      const response = await fetch('/api/matches/scraped');
      if (response.ok) {
        const data = await response.json();
        setScrapedMatches(data);
        setLastScraped(new Date().toLocaleTimeString());
      } else {
        console.error(`Failed to fetch scraped matches: ${response.status} ${response.statusText}`);
      }
    } catch (err) {
      console.error("Failed to fetch scraped matches:", err);
    } finally {
      setIsScraping(false);
    }
  };

  useEffect(() => {
    setVisibleFetchedCount(50);
  }, [fetchedChannels, searchQuery]);

  useEffect(() => {
    setVisibleRegisteredCount(50);
  }, [registeredChannels, searchQuery]);

  useEffect(() => {
    setVisibleScrapedCount(50);
  }, [scrapedMatches]);

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (authKey === 'Algeria@2022qatar') {
      setIsAuthenticated(true);
      setAuthError(false);
    } else {
      setAuthError(true);
      setTimeout(() => setAuthError(false), 2000);
    }
  };

  const handleFetch = async () => {
    setIsFetching(true);
    setFetchError(null);
    setFetchedChannels([]); // Clear previous results to save memory
    try {
      const config: any = {
        id: Date.now().toString(),
        name: playlistName || 'Untitled Playlist',
        type: iptvType,
        m3uUrl: iptvType === 'm3u' ? m3uUrl : undefined,
        epgUrl: epgUrl || undefined,
        host: iptvType === 'xtream' ? xtreamHost : undefined,
        port: iptvType === 'xtream' ? xtreamPort : undefined,
        username: iptvType === 'xtream' ? xtreamUser : undefined,
        password: iptvType === 'xtream' ? xtreamPass : undefined,
      };

      const channels = await iptvService.fetchChannels(config);
      if (channels.length === 0) {
        setFetchError("No channels found or connection failed.");
        return;
      }
      
      // Auto-import like Smarters Pro
      const channelsToSave = channels.map(channel => ({
        ...channel,
        epgUrl: config.epgUrl,
        playlistName: config.name,
        playlistId: config.id
      }));
      
      try {
        iptvService.saveManyToRegistry(channelsToSave);
        iptvService.savePlaylist(config);
      } catch (saveErr: any) {
        setFetchError(saveErr.message || "Failed to save playlist. It might be too large.");
        return;
      }
      
      setRegisteredChannels(iptvService.getGlobalRegistry());
      setPlaylists(iptvService.getPlaylists());
      
      // Limit fetched channels in state to prevent UI freeze
      const displayLimit = 5000;
      setFetchedChannels(channels.slice(0, displayLimit));
      
      if (channels.length > displayLimit) {
        console.warn(`Playlist has ${channels.length} channels. Only showing first ${displayLimit} in discovery.`);
      }

      setPlaylistName(''); // Clear name after success
      
      // Success feedback
      setTimeout(() => {
        onClose();
      }, 1500);

    } catch (err: any) {
      setFetchError(err.message || "Failed to connect to source.");
    } finally {
      setIsFetching(false);
    }
  };

  const addToRegistry = (channel: Source) => {
    try {
      iptvService.saveToRegistry(channel);
      setRegisteredChannels(iptvService.getGlobalRegistry());
    } catch (err: any) {
      setFetchError(err.message);
    }
  };

  const importAll = () => {
    if (filteredFetched.length > 5000) {
      if (!window.confirm(`You are about to import ${filteredFetched.length} channels. This may slow down the app. Continue?`)) {
        return;
      }
    }
    try {
      iptvService.saveManyToRegistry(filteredFetched);
      setRegisteredChannels(iptvService.getGlobalRegistry());
    } catch (err: any) {
      setFetchError(err.message);
    }
  };

  const removeFromRegistry = (url: string) => {
    iptvService.removeFromRegistry(url);
    setRegisteredChannels(iptvService.getGlobalRegistry());
  };

  const deletePlaylist = (id: string) => {
    if (window.confirm("Are you sure you want to delete this playlist and all its channels?")) {
      iptvService.removePlaylist(id);
      setPlaylists(iptvService.getPlaylists());
      setRegisteredChannels(iptvService.getGlobalRegistry());
    }
  };

  const clearRegistry = () => {
    if (window.confirm("Are you sure you want to clear the entire registry?")) {
      localStorage.removeItem("arena_global_channels");
      localStorage.removeItem("arena_playlists");
      setRegisteredChannels([]);
      setPlaylists([]);
    }
  };

  const handleManualAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName || !manualUrl) return;
    
    const newChannel: Source = {
      name: manualName,
      url: manualUrl,
      epgId: manualEpgId || undefined,
      group: manualGroup || 'General',
      logo: ''
    };
    
    addToRegistry(newChannel);
    setManualName('');
    setManualUrl('');
    setManualEpgId('');
    setManualGroup('General');
  };

  const startEditing = (channel: Source) => {
    setEditingUri(channel.url);
    setEditTitle(channel.name || '');
  };

  const saveEdit = () => {
    if (editingUri) {
      iptvService.updateInRegistry(editingUri, editTitle);
      setRegisteredChannels(iptvService.getGlobalRegistry());
      setEditingUri(null);
    }
  };

  const filteredFetched = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return fetchedChannels.filter(c => 
      c.name?.toLowerCase().includes(query)
    );
  }, [fetchedChannels, searchQuery]);

  const filteredScraped = useMemo(() => {
    const query = searchQuery.toLowerCase();
    if (!query) return scrapedMatches;
    return scrapedMatches.filter(m => 
      m.home_team.toLowerCase().includes(query) || 
      m.away_team.toLowerCase().includes(query) || 
      m.competition.toLowerCase().includes(query) ||
      (m.broadcasters || []).some(b => b.toLowerCase().includes(query))
    );
  }, [scrapedMatches, searchQuery]);

  if (!isAuthenticated) {
    return (
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[300] flex items-center justify-center bg-black/95 backdrop-blur-2xl p-4"
      >
        <motion.div 
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          className="w-full max-w-md bg-slate-900 border border-white/10 rounded-[2.5rem] p-10 shadow-3xl text-center relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-500" />
          
          <button onClick={onClose} className="absolute top-6 right-6 text-slate-500 hover:text-white transition-colors">
            <X size={20} />
          </button>

          <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-white/10">
            <Shield size={40} className="text-pink-500" />
          </div>

          <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">Arena Command</h2>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mb-8">Authorization Required</p>

          <form onSubmit={handleAuth} className="space-y-4">
            <div className="relative">
              <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input 
                type="password" 
                value={authKey}
                onChange={(e) => setAuthKey(e.target.value)}
                placeholder="Enter Security Key"
                className={`w-full bg-black/40 border ${authError ? 'border-red-500 animate-shake' : 'border-white/10'} rounded-2xl py-4 pl-12 pr-4 text-white outline-none focus:border-pink-500 transition-all`}
                autoFocus
              />
            </div>
            <button 
              type="submit"
              className="w-full py-4 bg-gradient-to-r from-pink-600 to-purple-600 rounded-2xl text-white font-black uppercase tracking-widest shadow-xl shadow-pink-600/20 active:scale-95 transition-all"
            >
              Access Terminal
            </button>
          </form>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/95 backdrop-blur-2xl p-4 md:p-10"
    >
      <motion.div 
        initial={{ scale: 0.95, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        className="w-full max-w-6xl h-full max-h-[90vh] bg-slate-950 border border-white/10 rounded-[3rem] shadow-3xl flex flex-col overflow-hidden relative"
      >
        {/* Header */}
        <div className="p-8 border-b border-white/5 flex items-center justify-between bg-black/40">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-pink-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Shield size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-tighter">Arena Playlist Manager</h2>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Server Connection Active</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="w-12 h-12 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl flex items-center justify-center text-slate-400 hover:text-white transition-all">
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-8 pt-6 gap-4">
          <button 
            onClick={() => setActiveTab('add')}
            className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${activeTab === 'add' ? 'bg-white text-black border-white' : 'bg-white/5 text-slate-500 border-white/10 hover:text-white'}`}
          >
            Add New Server
          </button>
          <button 
            onClick={() => setActiveTab('playlists')}
            className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${activeTab === 'playlists' ? 'bg-white text-black border-white' : 'bg-white/5 text-slate-500 border-white/10 hover:text-white'}`}
          >
            My Playlists ({playlists.length})
          </button>
          <button 
            onClick={() => setActiveTab('scraper')}
            className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${activeTab === 'scraper' ? 'bg-white text-black border-white' : 'bg-white/5 text-slate-500 border-white/10 hover:text-white'}`}
          >
            Scraper Section
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col p-8">
          <AnimatePresence mode="wait">
            {activeTab === 'add' ? (
              <motion.div 
                key="add"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="h-full flex flex-col lg:flex-row gap-8"
              >
                {/* Form Side */}
                <div className="w-full lg:w-1/3 space-y-6 overflow-y-auto pr-2 custom-scrollbar">
                  <div className="bg-white/5 rounded-3xl p-6 border border-white/10">
                    <h3 className="text-xs font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                      <RefreshCw size={14} className="text-pink-500" /> Bulk Import
                    </h3>
                    
                    <div className="flex gap-2 mb-4">
                      <button 
                        onClick={() => setIptvType('m3u')}
                        className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${iptvType === 'm3u' ? 'bg-pink-600 text-white border-pink-500' : 'bg-white/5 text-slate-500 border-white/5'}`}
                      >
                        M3U Playlist
                      </button>
                      <button 
                        onClick={() => setIptvType('xtream')}
                        className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${iptvType === 'xtream' ? 'bg-pink-600 text-white border-pink-500' : 'bg-white/5 text-slate-500 border-white/5'}`}
                      >
                        Xtream API
                      </button>
                    </div>

                    <div className="flex items-center justify-between px-4 py-3 bg-white/5 rounded-xl border border-white/5 mb-2">
                      <div className="flex items-center gap-2">
                        <Globe size={14} className="text-indigo-400" />
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">CORS Tunnel</span>
                      </div>
                      <button 
                        onClick={() => {
                          const next = !tunnelActive;
                          iptvService.setTunnelActive(next);
                          setTunnelActive(next);
                          setFetchedChannels([]); // Clear to force refresh if they try again
                        }}
                        className={`w-10 h-5 rounded-full relative transition-all ${tunnelActive ? 'bg-emerald-500' : 'bg-slate-700'}`}
                      >
                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${tunnelActive ? 'right-1' : 'left-1'}`} />
                      </button>
                    </div>
                    <p className="text-[8px] text-slate-600 uppercase tracking-widest px-1 mb-6">
                      {tunnelActive 
                        ? "Server-side fetch enabled. Bypasses CORS but may be blocked by provider firewalls." 
                        : "Direct browser fetch enabled. Bypasses server IP blocks but requires provider CORS support."}
                    </p>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Playlist Name</label>
                        <div className="relative">
                          <Edit2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={14} />
                          <input 
                            type="text" 
                            value={playlistName}
                            onChange={(e) => setPlaylistName(e.target.value)}
                            placeholder="e.g. My Premium IPTV"
                            className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-xs text-white outline-none focus:border-pink-500"
                          />
                        </div>
                      </div>

                      {iptvType === 'm3u' ? (
                        <>
                          <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">M3U URL</label>
                            <div className="relative">
                              <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={14} />
                              <input 
                                type="text" 
                                value={m3uUrl}
                                onChange={(e) => setM3uUrl(e.target.value)}
                                placeholder="https://example.com/playlist.m3u"
                                className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-xs text-white outline-none focus:border-pink-500"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">EPG URL (XMLTV) - Optional</label>
                            <div className="relative">
                              <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={14} />
                              <input 
                                type="text" 
                                value={epgUrl}
                                onChange={(e) => setEpgUrl(e.target.value)}
                                placeholder="https://example.com/epg.xml"
                                className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-xs text-white outline-none focus:border-pink-500"
                              />
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="grid grid-cols-3 gap-4">
                            <div className="col-span-2 space-y-2">
                              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Host</label>
                              <div className="relative">
                                <Server className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={14} />
                                <input 
                                  type="text" 
                                  value={xtreamHost}
                                  onChange={(e) => setXtreamHost(e.target.value)}
                                  placeholder="http://host.com"
                                  className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-xs text-white outline-none focus:border-pink-500"
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Port</label>
                              <input 
                                type="text" 
                                value={xtreamPort}
                                onChange={(e) => setXtreamPort(e.target.value)}
                                placeholder="8080"
                                className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-xs text-white outline-none focus:border-pink-500"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Username</label>
                            <div className="relative">
                              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={14} />
                              <input 
                                type="text" 
                                value={xtreamUser}
                                onChange={(e) => setXtreamUser(e.target.value)}
                                placeholder="User"
                                className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-xs text-white outline-none focus:border-pink-500"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Password</label>
                            <div className="relative">
                              <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={14} />
                              <input 
                                type="password" 
                                value={xtreamPass}
                                onChange={(e) => setXtreamPass(e.target.value)}
                                placeholder="Pass"
                                className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-xs text-white outline-none focus:border-pink-500"
                              />
                            </div>
                          </div>
                        </>
                      )}
                      
                      <button 
                        onClick={handleFetch}
                        disabled={isFetching || fetchedChannels.length > 0}
                        className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 mt-4 ${
                          fetchedChannels.length > 0 
                          ? 'bg-emerald-600 text-white' 
                          : 'bg-white text-black hover:bg-pink-50'
                        }`}
                      >
                        {isFetching ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : fetchedChannels.length > 0 ? (
                          <Check size={16} />
                        ) : (
                          <RefreshCw size={16} />
                        )}
                        {isFetching 
                          ? 'Parsing Playlist...' 
                          : fetchedChannels.length > 0 
                            ? `${fetchedChannels.length} Channels Loaded!` 
                            : 'Connect & Load Channels'}
                      </button>

                      {fetchError && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3"
                        >
                          <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                          <span className="text-[10px] font-bold text-red-400 leading-relaxed uppercase tracking-tight">{fetchError}</span>
                        </motion.div>
                      )}
                    </div>
                  </div>

                  {/* Manual Add Section */}
                  <div className="bg-white/5 rounded-3xl p-6 border border-white/10">
                    <h3 className="text-xs font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                      <Plus size={14} className="text-emerald-500" /> Manual Entry
                    </h3>
                    <form onSubmit={handleManualAdd} className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Channel Name</label>
                        <input 
                          type="text" 
                          value={manualName}
                          onChange={(e) => setManualName(e.target.value)}
                          placeholder="e.g. beIN Sports 1"
                          className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-xs text-white outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Stream URL</label>
                        <input 
                          type="text" 
                          value={manualUrl}
                          onChange={(e) => setManualUrl(e.target.value)}
                          placeholder="http://..."
                          className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-xs text-white outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">EPG ID (Optional)</label>
                        <input 
                          type="text" 
                          value={manualEpgId}
                          onChange={(e) => setManualEpgId(e.target.value)}
                          placeholder="e.g. beIN.Sports.1"
                          className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-xs text-white outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Category</label>
                        <input 
                          type="text" 
                          value={manualGroup}
                          onChange={(e) => setManualGroup(e.target.value)}
                          placeholder="e.g. Sports"
                          className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-xs text-white outline-none focus:border-emerald-500"
                        />
                      </div>
                      <button 
                        type="submit"
                        disabled={!manualName || !manualUrl}
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:hover:bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
                      >
                        Add to Registry
                      </button>
                    </form>
                  </div>
                </div>

                {/* Results Side */}
                <div className="flex-1 bg-white/5 rounded-3xl border border-white/10 flex flex-col overflow-hidden">
                  <div className="p-6 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                        <Tv size={14} className="text-indigo-500" /> Discovered Channels ({fetchedChannels.length}{fetchedChannels.length === 5000 ? '+' : ''})
                      </h3>
                      {filteredFetched.length > 0 && (
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={importAll}
                            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[9px] font-black uppercase tracking-widest rounded-lg transition-all active:scale-95 flex items-center gap-2"
                          >
                            <Plus size={12} /> Import All
                          </button>
                          <button 
                            onClick={() => setFetchedChannels([])}
                            className="px-4 py-1.5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-[9px] font-black uppercase tracking-widest rounded-lg transition-all active:scale-95 flex items-center gap-2"
                          >
                            <Trash2 size={12} /> Clear
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="relative w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                      <input 
                        type="text" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Filter results..."
                        className="w-full bg-black/40 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-[10px] text-white outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 custom-scrollbar" onScroll={(e) => {
                    const target = e.currentTarget;
                    if (target.scrollHeight - target.scrollTop <= target.clientHeight + 50) {
                      if (visibleFetchedCount < filteredFetched.length) {
                        setVisibleFetchedCount(prev => prev + 50);
                      }
                    }
                  }}>
                    {filteredFetched.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {filteredFetched.slice(0, visibleFetchedCount).map((channel, idx) => {
                          const isAlreadyAdded = registeredChannels.some(c => c.url === channel.url);
                          return (
                            <div key={idx} className="p-3 bg-black/40 border border-white/5 rounded-xl flex items-center justify-between group hover:border-white/20 transition-all">
                              <div className="flex items-center gap-3 min-w-0">
                                {channel.logo && (
                                  <img src={channel.logo} alt="" className="w-8 h-8 rounded object-contain bg-black/20" referrerPolicy="no-referrer" loading="lazy" />
                                )}
                                <div className="flex flex-col min-w-0">
                                  <span className="text-[10px] font-bold text-white truncate uppercase tracking-tight">{channel.name}</span>
                                  <span className="text-[8px] text-slate-600 truncate">{channel.group}</span>
                                </div>
                              </div>
                              <button 
                                onClick={() => addToRegistry(channel)}
                                disabled={isAlreadyAdded}
                                className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isAlreadyAdded ? 'bg-emerald-500/20 text-emerald-500' : 'bg-white/5 text-slate-400 hover:bg-pink-600 hover:text-white'}`}
                              >
                                {isAlreadyAdded ? <Check size={14} /> : <Plus size={14} />}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-700 gap-4">
                        <Globe size={48} className="opacity-20" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em]">No Signal Discovered</span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ) : activeTab === 'playlists' ? (
              <motion.div 
                key="playlists"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="h-full flex flex-col bg-white/5 rounded-3xl border border-white/10 overflow-hidden"
              >
                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {selectedPlaylistId && (
                      <button 
                        onClick={() => setSelectedPlaylistId(null)}
                        className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-all"
                      >
                        <ChevronLeft size={14} />
                      </button>
                    )}
                    <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                      <Server size={14} className="text-pink-500" /> 
                      {selectedPlaylistId 
                        ? (selectedPlaylistId === 'manual' ? 'Manual Channels' : `Channels: ${playlists.find(p => p.id === selectedPlaylistId)?.name}`)
                        : 'My IPTV Servers'}
                    </h3>
                  </div>
                  {selectedPlaylistId && (
                    <div className="relative w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                      <input 
                        type="text" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search playlist..."
                        className="w-full bg-black/40 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-[10px] text-white outline-none focus:border-pink-500"
                      />
                    </div>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                  {selectedPlaylistId ? (
                    <div className="space-y-2">
                      {registeredChannels
                        .filter(c => selectedPlaylistId === 'manual' ? !c.playlistId : c.playlistId === selectedPlaylistId)
                        .filter(c => !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase()))
                        .map((channel, idx) => (
                          <div key={idx} className="p-4 bg-black/40 border border-white/5 rounded-2xl flex items-center justify-between group hover:border-white/20 transition-all">
                            <div className="flex-1 min-w-0 pr-4">
                              {editingUri === channel.url ? (
                                <div className="flex items-center gap-2">
                                  <input 
                                    type="text" 
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    className="flex-1 bg-white/10 border border-pink-500 rounded-lg px-3 py-1.5 text-xs text-white outline-none"
                                    autoFocus
                                  />
                                  <button onClick={saveEdit} className="p-2 bg-emerald-600 text-white rounded-lg"><Save size={14} /></button>
                                  <button onClick={() => setEditingUri(null)} className="p-2 bg-white/10 text-slate-400 rounded-lg"><X size={14} /></button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-3">
                                  {channel.logo && (
                                    <img src={channel.logo} alt="" className="w-10 h-10 rounded-lg object-contain bg-black/20" referrerPolicy="no-referrer" loading="lazy" />
                                  )}
                                  <div className="flex flex-col">
                                    <span className="text-xs font-black text-white uppercase tracking-tight">{channel.name}</span>
                                    <span className="text-[9px] text-slate-600 truncate">{channel.group}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => startEditing(channel)}
                                className="w-9 h-9 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl flex items-center justify-center transition-all"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button 
                                onClick={() => removeFromRegistry(channel.url)}
                                className="w-9 h-9 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl flex items-center justify-center transition-all"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (playlists.length > 0 || registeredChannels.some(c => !c.playlistId)) ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {playlists.map((playlist) => (
                        <div 
                          key={playlist.id} 
                          onClick={() => setSelectedPlaylistId(playlist.id)}
                          className="p-6 bg-black/40 border border-white/5 rounded-3xl flex flex-col gap-4 group hover:border-pink-500/30 transition-all relative overflow-hidden cursor-pointer"
                        >
                          <div className="absolute top-0 left-0 w-1 h-full bg-pink-600" />
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-pink-600/10 rounded-xl flex items-center justify-center border border-pink-500/20">
                                <Server size={20} className="text-pink-500" />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-sm font-black text-white uppercase tracking-tight">{playlist.name}</span>
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{playlist.type === 'xtream' ? 'Xtream API' : 'M3U Playlist'}</span>
                              </div>
                            </div>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                deletePlaylist(playlist.id);
                              }}
                              className="w-8 h-8 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                              <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Channels</div>
                              <div className="text-xs font-black text-white">{registeredChannels.filter(c => c.playlistId === playlist.id).length}</div>
                            </div>
                            <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                              <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Status</div>
                              <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <div className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Active</div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="text-[9px] text-slate-600 truncate font-mono bg-black/20 p-2 rounded-lg">
                            {playlist.type === 'm3u' ? playlist.m3uUrl : `${playlist.host}:${playlist.port}`}
                          </div>
                        </div>
                      ))}
                      
                      {/* Manual Channels Virtual Playlist */}
                      {registeredChannels.some(c => !c.playlistId) && (
                        <div 
                          onClick={() => setSelectedPlaylistId('manual')}
                          className="p-6 bg-black/40 border border-white/5 rounded-3xl flex flex-col gap-4 group hover:border-indigo-500/30 transition-all relative overflow-hidden cursor-pointer"
                        >
                          <div className="absolute top-0 left-0 w-1 h-full bg-indigo-600" />
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-indigo-600/10 rounded-xl flex items-center justify-center border border-indigo-500/20">
                                <Tv size={20} className="text-indigo-500" />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-sm font-black text-white uppercase tracking-tight">Manual Channels</span>
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Direct Add / Hardcoded</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                              <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Channels</div>
                              <div className="text-xs font-black text-white">{registeredChannels.filter(c => !c.playlistId).length}</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-700 gap-4">
                      <Server size={48} className="opacity-20" />
                      <span className="text-[10px] font-black uppercase tracking-[0.3em]">No Servers Configured</span>
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="scraper"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="h-full flex flex-col bg-white/5 rounded-3xl border border-white/10 overflow-hidden"
              >
                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                      <RefreshCw size={14} className="text-pink-500" /> Scraper Live Feed
                      {lastScraped && (
                        <span className="text-[8px] text-slate-500 font-normal normal-case tracking-normal ml-2">
                          Last updated: {lastScraped}
                        </span>
                      )}
                    </h3>
                    <button 
                      onClick={triggerScrape}
                      disabled={isScraping}
                      className="px-4 py-1.5 bg-pink-600 hover:bg-pink-500 text-white text-[9px] font-black uppercase tracking-widest rounded-lg transition-all active:scale-95 flex items-center gap-2"
                    >
                      {isScraping ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                      Scrape Now
                    </button>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="relative w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                      <input 
                        type="text" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search matches or channels..."
                        className="w-full bg-black/40 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-[10px] text-white outline-none focus:border-pink-500"
                      />
                    </div>
                    <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest">
                      Total: {filteredScraped.length} / {scrapedMatches.length}
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-auto p-6 custom-scrollbar flex flex-col gap-8">
                  <div>
                    <h4 className="text-[10px] font-black text-white uppercase tracking-widest mb-4 px-4">LiveOnSat</h4>
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/10">
                          <th className="py-4 px-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">Match</th>
                          <th className="py-4 px-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">Official Channel</th>
                          <th className="py-4 px-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">Matched IPTV Source</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredScraped.filter(m => m.source === 'LiveOnSat').slice(0, visibleScrapedCount).map((match, idx) => (
                          <ScraperMatchRow 
                            key={`liveonsat-${match.home_team}-${match.away_team}-${idx}`} 
                            match={match} 
                            preProcessedIptv={preProcessedIptv} 
                          />
                        ))}
                        {filteredScraped.filter(m => m.source === 'LiveOnSat').length === 0 && (
                          <tr>
                            <td colSpan={3} className="py-8 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest">
                              No LiveOnSat matches found
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div>
                    <h4 className="text-[10px] font-black text-white uppercase tracking-widest mb-4 px-4">SportEventz</h4>
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/10">
                          <th className="py-4 px-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">Match</th>
                          <th className="py-4 px-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">Official Channel</th>
                          <th className="py-4 px-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">Matched IPTV Source</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredScraped.filter(m => m.source === 'SportEventz').slice(0, visibleScrapedCount).map((match, idx) => (
                          <ScraperMatchRow 
                            key={`sporteventz-${match.home_team}-${match.away_team}-${idx}`} 
                            match={match} 
                            preProcessedIptv={preProcessedIptv} 
                          />
                        ))}
                        {filteredScraped.filter(m => m.source === 'SportEventz').length === 0 && (
                          <tr>
                            <td colSpan={3} className="py-8 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest">
                              No SportEventz matches found
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {visibleScrapedCount < filteredScraped.length && (
                    <div className="flex justify-center p-8 gap-4">
                      <button 
                        onClick={() => setVisibleScrapedCount(prev => prev + 100)}
                        className="px-8 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-[10px] font-black text-slate-500 uppercase tracking-widest transition-all"
                      >
                        Load More
                      </button>
                      <button 
                        onClick={() => setVisibleScrapedCount(filteredScraped.length)}
                        className="px-8 py-3 bg-pink-600/10 hover:bg-pink-600/20 border border-pink-500/20 rounded-2xl text-[10px] font-black text-pink-500 uppercase tracking-widest transition-all"
                      >
                        Show All
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default AdminPanel;
