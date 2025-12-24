import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Play, Tv, Wifi, Radio } from 'lucide-react';
import { getAllChannels } from '../services/geminiService';
import { Source } from '../types';

interface ChannelGridProps {
  onSelectChannel: (channel: Source) => void;
  searchQuery: string;
}

const ChannelGrid: React.FC<ChannelGridProps> = ({ onSelectChannel, searchQuery }) => {
  const [channels, setChannels] = useState<Source[]>([]);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'SPORTS' | 'ARABIC'>('ALL');

  useEffect(() => {
    const all = getAllChannels();
    setChannels(all);
  }, []);

  const filteredChannels = channels.filter(channel => {
    const title = (channel.title || '').toLowerCase();
    const matchesSearch = title.includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (activeFilter === 'SPORTS') return title.includes('sport') || title.includes('bein') || title.includes('dazn');
    if (activeFilter === 'ARABIC') return title.includes('ar:') || title.includes('quran') || /[\u0600-\u06FF]/.test(title);
    return true;
  });

  return (
    <div className="w-full max-w-7xl mx-auto space-y-12">
      {/* Header Glass Section */}
      <div className="flex flex-col lg:flex-row gap-8 justify-between items-start lg:items-center bg-white/5 p-10 rounded-[3rem] border border-white/10 backdrop-blur-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-[80px] pointer-events-none" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-4">
             <div className="p-3 bg-gradient-to-br from-pink-500 to-purple-600 rounded-2xl shadow-lg">
                <Tv size={32} className="text-white" />
             </div>
             <h2 className="text-4xl font-black text-white tracking-tighter uppercase">Broadcast <span className="text-pink-500">Center</span></h2>
          </div>
          <p className="text-slate-400 font-medium max-w-md">Access ultra-low latency streams from verified global sports networks instantly.</p>
        </div>

        <div className="w-full lg:w-auto flex flex-col gap-6 relative z-10">
             <div className="flex gap-3">
                {['ALL', 'SPORTS', 'ARABIC'].map(f => (
                    <button
                        key={f}
                        onClick={() => setActiveFilter(f as any)}
                        className={`flex-1 lg:flex-none px-6 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl border transition-all ${
                            activeFilter === f 
                            ? 'bg-white text-black border-white shadow-xl shadow-white/10' 
                            : 'bg-white/5 text-slate-500 border-white/5 hover:border-white/20 hover:text-white'
                        }`}
                    >
                        {f}
                    </button>
                ))}
             </div>
        </div>
      </div>

      {/* Grid of Channels */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <AnimatePresence>
            {filteredChannels.map((channel, idx) => (
                <motion.button
                    key={`${channel.title}-${idx}`}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    whileHover={{ y: -8, scale: 1.02 }}
                    onClick={() => onSelectChannel(channel)}
                    className="group relative p-8 bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-pink-500/40 rounded-[2.5rem] transition-all overflow-hidden flex flex-col items-center text-center shadow-2xl"
                >
                    {/* Status Glow */}
                    <div className="absolute top-4 right-6 flex items-center gap-2">
                      <span className="text-[8px] font-black text-green-500 tracking-widest uppercase opacity-0 group-hover:opacity-100 transition-opacity">Optimal</span>
                      <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.8)] animate-pulse" />
                    </div>

                    <div className="w-20 h-20 rounded-[2rem] bg-black/40 border border-white/10 flex items-center justify-center mb-6 group-hover:bg-gradient-to-br group-hover:from-pink-500 group-hover:to-purple-600 transition-all duration-500 shadow-inner group-hover:rotate-6">
                         <Tv size={32} className="text-slate-400 group-hover:text-white transition-colors" />
                    </div>
                    
                    <h3 className="text-lg font-black text-white leading-tight min-h-[2.5em] mb-4 group-hover:scale-105 transition-transform">
                        {channel.title}
                    </h3>

                    <div className="w-full mt-4 pt-6 border-t border-white/5 flex items-center justify-between">
                         <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500 group-hover:text-pink-500 transition-colors">
                            <Radio size={14} /> Encrypted
                         </div>
                         <div className="px-3 py-1 bg-white/5 rounded-lg text-[10px] font-black text-slate-400 group-hover:bg-white group-hover:text-black transition-all">
                            4K Signal
                         </div>
                    </div>

                    {/* Hover Interaction Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-pink-600/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center shadow-2xl translate-y-4 group-hover:translate-y-0 transition-all duration-500">
                            <Play size={24} fill="currentColor" className="ml-1" />
                        </div>
                    </div>
                </motion.button>
            ))}
        </AnimatePresence>
      </div>

      {filteredChannels.length === 0 && (
          <div className="py-32 text-center">
              <div className="inline-flex p-6 bg-white/5 rounded-full border border-white/10 mb-6">
                 <Search size={48} className="text-slate-700" />
              </div>
              <p className="text-2xl font-bold text-slate-500">No signal detected on "{searchQuery}"</p>
          </div>
      )}
    </div>
  );
};

export default ChannelGrid;