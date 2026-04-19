
import React, { useState, useEffect } from 'react';
import { Trophy, Newspaper, Menu, Bell, Globe, MessageSquare, Tv, X, Zap, Activity, ShieldAlert, Lock, ArrowRight, ShieldCheck, LayoutGrid, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import StandingsTable from './components/StandingsTable';
import NewsFeed from './components/NewsFeed';
import ChatInterface from './components/ChatInterface';
import IPTVPlayer from './components/IPTVPlayer';
import SmartPlayer from './components/SmartPlayer';
import SofaScoreEmbed from './components/SofaScoreEmbed';
import AdminPanel from './components/AdminPanel';
import { Source, Match } from './types';

enum View {
  MATCHES = 'matches',
  CHANNELS = 'channels',
  SCRAPER = 'scraper',
  STANDINGS = 'standings',
  NEWS = 'news',
  CHAT = 'chat',
}

const GeometricBackground = React.memo(() => (
  <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#020617]">
    <div className="blob w-[600px] h-[600px] bg-indigo-600/10 -top-40 -left-40 blur-[120px]" />
    <div className="blob w-[700px] h-[700px] bg-blue-600/10 bottom-[-20%] right-[-20%] blur-[120px]" />
  </div>
));

const SidebarContent = React.memo(({ currentView, handleNavItemClick, onOpenAdmin }: { currentView: View, handleNavItemClick: (v: View) => void, onOpenAdmin: () => void }) => {
  const navItems = [
    { id: View.MATCHES, label: 'Live Matches', icon: Zap, color: 'text-pink-400' },
    { id: View.CHANNELS, label: 'TV Channels', icon: Tv, color: 'text-purple-400' },
    { id: View.SCRAPER, label: 'Live Scraper', icon: Activity, color: 'text-emerald-400' },
    { id: View.STANDINGS, label: 'League Table', icon: Trophy, color: 'text-indigo-400' },
    { id: View.NEWS, label: 'Match Highlights', icon: Newspaper, color: 'text-pink-300' },
    { id: View.CHAT, label: 'AI Assistant', icon: MessageSquare, color: 'text-purple-300' },
  ];

  return (
    <div className="flex flex-col h-full p-6 gap-8">
      <div className="flex flex-col gap-1">
        <div className="text-[10px] font-black text-slate-500 px-4 py-2 uppercase tracking-[0.5em] mb-4">Navigation</div>
        <div className="flex flex-col gap-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavItemClick(item.id)}
              className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-[12px] font-black transition-all duration-200 group relative ${
                currentView === item.id ? 'nav-btn-active scale-[1.02]' : 'text-slate-400 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20'
              }`}
            >
              <item.icon size={18} className={currentView === item.id ? 'text-white' : item.color} strokeWidth={2.5} />
              <span className="tracking-tight uppercase">{item.label}</span>
              {currentView === item.id && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_#fff]" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-auto px-4 py-6 border-t border-white/5">
        <div className="flex flex-col gap-3">
            <button 
              onClick={onOpenAdmin}
              className="w-full flex items-center gap-3 px-4 py-3 bg-white/5 hover:bg-pink-600/20 border border-white/10 hover:border-pink-500/50 rounded-xl text-[10px] font-black text-slate-400 hover:text-pink-400 transition-all active:scale-95 group"
            >
              <LayoutGrid size={14} className="group-hover:rotate-90 transition-transform duration-500" />
              <span className="uppercase tracking-widest">Manage Playlists</span>
            </button>

            <div className="flex items-center gap-2.5 mt-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]" />
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Status: Live</span>
            </div>
            <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6]" />
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">Data Stream Ready</span>
            </div>
        </div>
      </div>
    </div>
  );
});

const App = () => {
  const [currentView, setCurrentView] = useState<View>(View.MATCHES);
  const [selectedChannel, setSelectedChannel] = useState<Source | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeHighlightMatch, setActiveHighlightMatch] = useState<Match | null>(null);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isServerReady, setIsServerReady] = useState(false);
  const [serverCheckAttempts, setServerCheckAttempts] = useState(0);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);

  useEffect(() => {
    const checkServer = async () => {
      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          setIsServerReady(true);
        } else {
          throw new Error();
        }
      } catch (err) {
        setServerCheckAttempts(prev => prev + 1);
        setTimeout(checkServer, 2000);
      }
    };
    checkServer();
  }, []);

  const handleNavItemClick = (view: View) => {
    if (view !== View.NEWS) setActiveHighlightMatch(null);
    setCurrentView(view);
    setIsSidebarOpen(false);
  };

  if (!isServerReady) {
    return (
      <div className="fixed inset-0 bg-[#020617] flex flex-col items-center justify-center z-[1000]">
        <GeometricBackground />
        <div className="relative z-10 flex flex-col items-center gap-8">
          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-br from-pink-500 to-purple-600 rounded-2xl blur-xl opacity-50 animate-pulse" />
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center shadow-2xl relative z-10 border border-white/30">
              <Trophy size={40} className="text-white" />
            </div>
          </div>
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-black text-white uppercase tracking-tighter">
              XStream <span className="text-pink-400">Arena</span>
            </h1>
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-3 px-4 py-2 bg-white/5 border border-white/10 rounded-xl">
                <Loader2 size={16} className="text-pink-500 animate-spin" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {serverCheckAttempts > 5 ? 'Waking up Arena Servers...' : 'Initializing Arena Signal...'}
                </span>
              </div>
              <p className="text-[8px] font-black text-slate-600 uppercase tracking-[0.3em]">
                Please wait while we establish a secure connection
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#020617] text-slate-100 overflow-hidden flex flex-col">
      <GeometricBackground />

      <header className="h-20 shrink-0 bg-[#020617]/60 backdrop-blur-3xl border-b border-white/10 px-6 flex items-center justify-between z-[110] relative">
        <div className="flex items-center gap-6">
          <button 
            className="lg:hidden w-12 h-12 flex items-center justify-center bg-white/5 rounded-2xl border border-white/10 shadow-lg hover:border-pink-500/50 transition-all active:scale-90"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            {isSidebarOpen ? <X size={24} className="text-pink-500" /> : <Menu size={24} />}
          </button>
          
          <div className="flex items-center gap-4 cursor-pointer group" onClick={() => handleNavItemClick(View.MATCHES)}>
            <div className="relative">
              <div className="absolute -inset-2 bg-gradient-to-br from-pink-500 to-purple-600 rounded-xl blur-md opacity-40 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center shadow-2xl relative z-10 border border-white/30">
                <Trophy size={24} className="text-white" />
              </div>
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl md:text-2xl font-black text-white tracking-tighter uppercase leading-none">
                XStream <span className="text-pink-400">Arena</span>
              </h1>
              <div className="flex items-center gap-1.5 mt-1">
                <div className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-pulse" />
                <span className="text-[8px] font-black text-slate-600 uppercase tracking-[0.4em]">Arena Signal Connected</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-5">
          <div className="hidden sm:flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl py-2.5 px-5 text-[10px] font-black text-slate-300 backdrop-blur-md">
             <Activity size={14} className="text-pink-400" />
             <span className="uppercase tracking-widest">Arena Live Feed</span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative z-10">
        <aside className="hidden lg:flex w-[300px] border-r border-white/10 flex-col shrink-0 bg-[#020617]/40 backdrop-blur-3xl">
          <SidebarContent currentView={currentView} handleNavItemClick={handleNavItemClick} onOpenAdmin={() => setIsAdminOpen(true)} />
        </aside>

        <AnimatePresence>
          {isSidebarOpen && (
            <motion.div 
              key="sidebar-overlay"
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsSidebarOpen(false)} 
              className="fixed inset-0 bg-black/95 backdrop-blur-md z-[120] lg:hidden" 
            />
          )}
          {isSidebarOpen && (
            <motion.aside 
              key="sidebar-menu"
              initial={{ x: '-100%' }} 
              animate={{ x: 0 }} 
              exit={{ x: '-100%' }} 
              transition={{ type: 'spring', damping: 25, stiffness: 200 }} 
              className="fixed top-0 bottom-0 left-0 w-[300px] bg-[#0b0f1a] border-r border-white/10 z-[130] lg:hidden flex flex-col shadow-4xl"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                 <span className="text-xs font-black text-white uppercase tracking-widest">Navigation</span>
                 <button onClick={() => setIsSidebarOpen(false)} className="text-slate-400 p-2 hover:text-pink-400 transition-colors"><X size={24} /></button>
              </div>
              <SidebarContent currentView={currentView} handleNavItemClick={handleNavItemClick} onOpenAdmin={() => setIsAdminOpen(true)} />
            </motion.aside>
          )}
        </AnimatePresence>

        <main className="flex-1 overflow-y-auto custom-scrollbar relative z-10 scroll-smooth">
          <div className="p-6 md:p-12 max-w-[1600px] mx-auto w-full">
            <AnimatePresence mode="wait">
               {currentView === View.MATCHES && (
                <motion.div key="matches" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
                  <div className="mt-4">
                    <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-8">
                       <div className="flex items-center gap-5">
                          <div className="w-2 h-14 bg-pink-500 rounded-full shadow-[0_0_20px_rgba(236,72,153,0.6)]" />
                          <div>
                             <h2 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter leading-none">Live <span className="text-pink-400">Scores</span></h2>
                             <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em] mt-3">Real-time scores and match statistics</p>
                          </div>
                       </div>
                    </div>
                    <SofaScoreEmbed 
                      onGoToHighlights={(match) => {
                        setActiveHighlightMatch(match);
                        setCurrentView(View.NEWS);
                      }} 
                      onGoToStandings={(leagueId) => {
                        setSelectedLeagueId(leagueId);
                        setCurrentView(View.STANDINGS);
                      }}
                    />
                  </div>
                </motion.div>
              )}
              {currentView === View.CHANNELS && (
                <motion.div key={`channels-${refreshKey}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
                  <IPTVPlayer onOpenManager={() => setIsAdminOpen(true)} onBack={() => setCurrentView(View.MATCHES)} />
                </motion.div>
              )}
              {currentView === View.SCRAPER && (
                <motion.div key="scraper" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
                  <div className="text-white text-center py-20">Scraper Feed is currently unavailable.</div>
                </motion.div>
              )}
              {currentView === View.STANDINGS && (
                <motion.div key="standings" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
                  <StandingsTable initialLeagueId={selectedLeagueId || undefined} />
                </motion.div>
              )}
               {currentView === View.NEWS && (
                <motion.div key="news" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
                  <div className="mb-10 flex items-center gap-5">
                    <div className="w-2 h-12 bg-indigo-500 rounded-full shadow-[0_0_20px_rgba(99,102,241,0.6)]" />
                    <h2 className="text-4xl font-black text-white uppercase tracking-tighter leading-none">Match <span className="text-indigo-400">Highlights</span></h2>
                  </div>
                  <NewsFeed specificMatch={activeHighlightMatch} onClearSpecific={() => setActiveHighlightMatch(null)} />
                </motion.div>
              )}
              {currentView === View.CHAT && (
                <motion.div key="chat" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }} className="flex flex-col items-center">
                  <div className="mb-12 text-center">
                      <h2 className="text-5xl font-black text-white uppercase tracking-tighter leading-none mb-4">AI <span className="text-indigo-400">Assistant</span></h2>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.6em]">Ask anything about the Premier League</p>
                  </div>
                  <ChatInterface />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>

      <AnimatePresence>
        {selectedChannel && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/98 backdrop-blur-3xl">
            <motion.div initial={{ scale: 0.95, y: 40 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 40 }} className="w-full max-w-7xl aspect-video bg-[#0b0f1a] rounded-[4rem] border border-white/20 shadow-[0_100px_200px_rgba(0,0,0,1)] relative overflow-hidden">
              <button onClick={() => setSelectedChannel(null)} className="absolute top-8 right-8 z-[210] w-14 h-14 bg-white text-black rounded-3xl flex items-center justify-center shadow-4xl transition-all active:scale-90 hover:bg-indigo-600 hover:text-white">
                <X size={28} />
              </button>
              <div className="w-full h-full"><SmartPlayer src={selectedChannel.url} autoPlay /></div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isAdminOpen && (
          <AdminPanel onClose={() => {
            setIsAdminOpen(false);
            setRefreshKey(prev => prev + 1);
          }} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
