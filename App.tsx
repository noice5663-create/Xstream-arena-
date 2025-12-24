
import React, { useState, useEffect } from 'react';
import { Trophy, Newspaper, Menu, Bell, Globe, MessageSquare, Tv, X, Zap, Settings, ChevronRight, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import StandingsTable from './components/StandingsTable';
import NewsFeed from './components/NewsFeed';
import ChatInterface from './components/ChatInterface';
import ChannelGrid from './components/ChannelGrid';
import SmartPlayer from './components/SmartPlayer';
import SofaScoreEmbed from './components/SofaScoreEmbed';
import { Source, Match } from './types';

enum View {
  MATCHES = 'matches',
  CHANNELS = 'channels',
  STANDINGS = 'standings',
  NEWS = 'news',
  CHAT = 'chat',
}

const GeometricBackground = () => (
  <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#020617]">
    <motion.div 
      animate={{ x: [0, 40, -20, 0], y: [0, -30, 20, 0] }}
      transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
      className="blob w-[600px] h-[600px] bg-purple-600/20 -top-40 -left-40" 
    />
    <motion.div 
      animate={{ x: [0, -50, 30, 0], y: [0, 40, -20, 0] }}
      transition={{ duration: 35, repeat: Infinity, ease: "linear" }}
      className="blob w-[700px] h-[700px] bg-pink-600/15 bottom-[-20%] right-[-20%]" 
    />
  </div>
);

const App = () => {
  const [currentView, setCurrentView] = useState<View>(View.MATCHES);
  const [selectedChannel, setSelectedChannel] = useState<Source | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeHighlightMatch, setActiveHighlightMatch] = useState<Match | null>(null);

  const navItems = [
    { id: View.MATCHES, label: 'Live Arena', icon: Zap, color: 'text-pink-400' },
    { id: View.CHANNELS, label: 'Broadcast', icon: Tv, color: 'text-purple-400' },
    { id: View.STANDINGS, label: 'Standings', icon: Trophy, color: 'text-indigo-400' },
    { id: View.NEWS, label: 'Highlights', icon: Newspaper, color: 'text-pink-300' },
    { id: View.CHAT, label: 'AI Oracle', icon: MessageSquare, color: 'text-purple-300' },
  ];

  const handleNavItemClick = (view: View) => {
    if (view !== View.NEWS) setActiveHighlightMatch(null);
    setCurrentView(view);
    setIsSidebarOpen(false);
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full p-6 gap-8">
      <div className="flex flex-col gap-1">
        <div className="text-[10px] font-black text-slate-500 px-4 py-2 uppercase tracking-[0.5em] mb-4">Command Nexus</div>
        <div className="flex flex-col gap-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavItemClick(item.id)}
              className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl text-[12px] font-bold transition-all duration-150 group relative ${
                currentView === item.id ? 'nav-btn-active' : 'text-slate-300 bg-white/5 border border-white/5 hover:bg-white/10'
              }`}
            >
              <item.icon size={18} className={currentView === item.id ? 'text-white' : item.color} strokeWidth={2.5} />
              <span className="tracking-tight uppercase font-black">{item.label}</span>
              {currentView === item.id && (
                <div className="ml-auto w-1 h-1 rounded-full bg-white" />
              )}
            </button>
          ))}
        </div>
      </div>
      
      {/* Premium CTA / Launch Button Section Removed */}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-[#020617] text-slate-100 overflow-hidden flex flex-col">
      <GeometricBackground />

      <header className="h-20 shrink-0 bg-[#020617]/40 backdrop-blur-2xl border-b border-white/10 px-6 flex items-center justify-between z-[110] relative">
        <div className="flex items-center gap-6">
          <button 
            className="lg:hidden w-11 h-11 flex items-center justify-center bg-white/5 rounded-2xl border border-white/10 shadow-lg hover:border-pink-500/50 transition-all"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            {isSidebarOpen ? <X size={22} className="text-pink-500" /> : <Menu size={22} />}
          </button>
          
          <div className="flex items-center gap-4 cursor-pointer group" onClick={() => handleNavItemClick(View.MATCHES)}>
            <div className="relative">
              <div className="absolute -inset-2 bg-gradient-to-br from-pink-500 to-purple-600 rounded-xl blur-md opacity-40 group-hover:opacity-100 transition-opacity" />
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center shadow-2xl relative z-10 border border-white/20">
                <span className="font-black text-white text-xl">X</span>
              </div>
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl md:text-2xl font-black text-white tracking-tighter uppercase leading-none">
                XStream <span className="text-pink-500">Arena</span>
              </h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-pulse" />
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.3em]">Signal Optimized</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-5">
          <div className="hidden sm:flex items-center gap-2.5 bg-white/5 border border-white/10 rounded-2xl py-2 px-4 text-[10px] font-black text-slate-300">
             <Activity size={14} className="text-pink-500" />
             <span className="uppercase tracking-widest">Nexus Node: Alpha-01</span>
          </div>
          <div className="hidden sm:flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-full py-1.5 px-4 text-[9px] font-black text-green-500 shadow-[0_0_15px_rgba(34,197,94,0.1)]">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> BROADCAST LIVE
          </div>
          <button className="w-11 h-11 flex items-center justify-center bg-white/5 rounded-2xl border border-white/10 relative hover:bg-white/10 transition-all group">
            <Bell size={18} className="text-slate-300 group-hover:text-white" />
            <span className="absolute top-3 right-3 w-2 h-2 bg-pink-600 rounded-full shadow-[0_0_8px_rgba(236,72,153,0.8)]" />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative z-10">
        <aside className="hidden lg:flex w-[280px] border-r border-white/10 flex-col shrink-0 bg-[#020617]/40 backdrop-blur-3xl">
          <SidebarContent />
        </aside>

        <AnimatePresence>
          {isSidebarOpen && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[120] lg:hidden" />
              <motion.aside initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'tween', duration: 0.2 }} className="fixed top-0 bottom-0 left-0 w-[280px] bg-[#0b0f1a] border-r border-white/10 z-[130] lg:hidden flex flex-col shadow-2xl">
                <div className="p-5 border-b border-white/5 flex items-center justify-between">
                   <span className="text-xs font-black text-white uppercase tracking-widest">Command Nexus</span>
                   <button onClick={() => setIsSidebarOpen(false)} className="text-slate-400 p-2"><X size={20} /></button>
                </div>
                <SidebarContent />
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        <main className="flex-1 overflow-y-auto custom-scrollbar relative z-10 scroll-smooth">
          <div className="p-6 md:p-10 max-w-[1500px] mx-auto w-full">
            <AnimatePresence mode="wait">
              {currentView === View.MATCHES && (
                <motion.div key="matches" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
                  <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
                     <div className="flex items-center gap-4">
                        <div className="w-1.5 h-12 bg-pink-500 rounded-full shadow-[0_0_15px_rgba(236,72,153,0.5)]" />
                        <div>
                           <h2 className="text-4xl font-black text-white uppercase tracking-tighter leading-none">Arena <span className="text-pink-500">Live</span></h2>
                           <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mt-2">Synchronizing Global Match Nodes</p>
                        </div>
                     </div>
                  </div>
                  <SofaScoreEmbed onGoToHighlights={(match) => {
                    setActiveHighlightMatch(match);
                    setCurrentView(View.NEWS);
                  }} />
                </motion.div>
              )}
              {currentView === View.CHANNELS && (
                <motion.div key="channels" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
                  <ChannelGrid onSelectChannel={setSelectedChannel} searchQuery={''} />
                </motion.div>
              )}
              {currentView === View.STANDINGS && (
                <motion.div key="standings" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
                  <StandingsTable />
                </motion.div>
              )}
              {currentView === View.NEWS && (
                <motion.div key="news" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
                  <div className="mb-8 flex items-center gap-4">
                    <div className="w-1.5 h-10 bg-pink-500 rounded-full shadow-[0_0_15px_rgba(236,72,153,0.5)]" />
                    <h2 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">Arena <span className="text-pink-500">Highlights</span></h2>
                  </div>
                  <NewsFeed specificMatch={activeHighlightMatch} onClearSpecific={() => setActiveHighlightMatch(null)} />
                </motion.div>
              )}
              {currentView === View.CHAT && (
                <motion.div key="chat" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }} className="flex flex-col items-center">
                  <div className="mb-10 text-center">
                      <h2 className="text-4xl font-black text-white uppercase tracking-tighter leading-none mb-3">Arena <span className="text-pink-500">Oracle</span></h2>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em]">Ask the Artificial Intelligence Hub</p>
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl">
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="w-full max-w-6xl aspect-video bg-[#0b0f1a] rounded-[3rem] border border-white/10 shadow-[0_50px_100px_rgba(0,0,0,0.8)] relative overflow-hidden">
              <button onClick={() => setSelectedChannel(null)} className="absolute top-6 right-6 z-[210] w-12 h-12 bg-white text-black rounded-2xl flex items-center justify-center shadow-2xl transition-all active:scale-90 hover:bg-pink-500 hover:text-white">
                <X size={24} />
              </button>
              <div className="w-full h-full"><SmartPlayer src={selectedChannel.uri} autoPlay /></div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
