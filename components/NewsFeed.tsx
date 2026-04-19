
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NewsItem, Match } from '../types';
import { fetchHighlights, fetchHighlightsForMatches, fetchMatchesForDate } from '../services/geminiService';
import { Clock, ArrowRight, Play, Youtube, X, ChevronLeft, Search, RefreshCw, Calendar, Radio, History as HistoryIcon } from 'lucide-react';

interface NewsCardProps {
  item: NewsItem;
  index: number;
}

interface NewsFeedProps {
  specificMatch?: Match | null;
  onClearSpecific?: () => void;
}

const extractVideoId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
};

const NewsCard: React.FC<NewsCardProps> = ({ item, index }) => {
  const videoId = item.videoUrl ? extractVideoId(item.videoUrl) : null;

  const handleWatchClick = () => {
    if (item.videoUrl) {
      window.open(item.videoUrl, '_blank');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05 }}
      className="group flex flex-col bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-[2rem] overflow-hidden hover:border-pink-500/30 transition-all h-full shadow-2xl relative"
    >
      <div className="relative aspect-video bg-black overflow-hidden">
        <img 
          src={item.imageUrl} 
          alt={item.title} 
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 opacity-60 group-hover:opacity-80"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(e) => {
            if (videoId) {
              (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${videoId}/0.jpg`;
            }
          }}
        />
        
        <div className="absolute inset-0 flex items-center justify-center">
          <button 
            onClick={handleWatchClick}
            className="w-16 h-16 rounded-full bg-pink-600/90 text-white flex items-center justify-center shadow-2xl border border-white/20 backdrop-blur-md group-hover:scale-110 transition-transform active:scale-95"
          >
            <Play size={24} fill="currentColor" className="ml-1" />
          </button>
        </div>

        <div className="absolute top-4 right-4 px-3 py-1 bg-black/60 backdrop-blur-md rounded-full text-[8px] font-black text-white uppercase tracking-[0.2em] border border-white/10 flex items-center gap-2">
           <Youtube size={12} className="text-red-500" /> Highlight
        </div>

        <div className="absolute top-4 left-4 px-3 py-1 bg-emerald-500/20 backdrop-blur-md rounded-full text-[8px] font-black text-emerald-400 uppercase tracking-[0.2em] border border-emerald-500/30 flex items-center gap-2">
           <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Official Source
        </div>
      </div>

      <div className="p-6 md:p-8 flex-1 flex flex-col">
        <div className="flex items-center gap-2 mb-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">
            <Clock size={12} /> {item.timestamp}
        </div>
        
        <h3 className="text-lg font-black text-white mb-3 leading-tight group-hover:text-pink-400 transition-colors uppercase tracking-tight line-clamp-2">
          {item.title}
        </h3>
        
        <p className="text-xs text-slate-400 mb-6 line-clamp-3 leading-relaxed font-medium">
          {item.summary}
        </p>
        
        <div className="mt-auto pt-6 border-t border-white/5 flex items-center justify-between">
            <button 
              onClick={handleWatchClick}
              className="flex items-center gap-2 text-[10px] font-black text-pink-500 uppercase tracking-widest hover:text-pink-400 transition-colors"
            >
                Watch Highlight <ArrowRight size={12} />
            </button>
            <div className="w-1.5 h-1.5 rounded-full bg-pink-500/20 group-hover:bg-pink-500 shadow-lg transition-colors" />
        </div>
      </div>

    </motion.div>
  );
};

const NewsFeed: React.FC<NewsFeedProps> = ({ specificMatch, onClearSpecific }) => {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'today' | 'yesterday'>('today');
  const [searchQuery, setSearchQuery] = useState('');

  const getLocalDateString = (offset: number = 0) => {
    const d = new Date();
    d.setDate(d.getDate() - offset);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayIso = getLocalDateString(0);
  const yesterdayIso = getLocalDateString(1);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (specificMatch) {
        const data = await fetchHighlights(specificMatch.homeTeam.name, specificMatch.awayTeam.name, specificMatch.league, specificMatch.date, specificMatch.id);
        setNews(data);
      } else {
        const targetDate = activeTab === 'today' ? todayIso : yesterdayIso;

        const scheduleCurr = await fetchMatchesForDate(targetDate);

        // Deduplicate matches
        const uniqueSchedule = Array.from(new Map(scheduleCurr.map(m => [m.id, m])).values());

        const data = await fetchHighlightsForMatches(uniqueSchedule);
        
        // Sort by timestamp descending
        data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        
        setNews(data);
      }
    } catch (err) {
      console.error("News sync error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [specificMatch, activeTab]);

  const filteredNews = news.filter(item => 
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.summary.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Date Toggle & Search - High End UI */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-2">
          {!specificMatch && (
              <div className="flex items-center gap-1.5 p-1.5 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-xl shrink-0">
                  <button 
                    onClick={() => setActiveTab('today')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'today' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:text-white'}`}
                  >
                      <Calendar size={14} /> Today
                  </button>
                  <button 
                    onClick={() => setActiveTab('yesterday')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'yesterday' ? 'bg-slate-700 text-white shadow-lg shadow-slate-700/20' : 'text-slate-500 hover:text-white'}`}
                  >
                      <HistoryIcon size={14} /> Yesterday
                  </button>
              </div>
          )}

          {!specificMatch && (
              <div className="relative w-full md:max-w-md">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                      <Search size={16} className="text-slate-500" />
                  </div>
                  <input
                      type="text"
                      placeholder="Search matches or teams..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-pink-500/50 focus:bg-white/10 transition-all font-medium"
                  />
                  {searchQuery && (
                      <button 
                          onClick={() => setSearchQuery('')}
                          className="absolute inset-y-0 right-4 flex items-center text-slate-500 hover:text-white transition-colors"
                      >
                          <X size={14} />
                      </button>
                  )}
              </div>
          )}
      </div>

      {specificMatch && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 md:p-10 rounded-[2.5rem] bg-gradient-to-br from-pink-600/20 to-purple-600/10 border border-pink-500/20 backdrop-blur-xl flex flex-col md:flex-row items-center justify-between gap-6"
        >
           <div className="flex items-center gap-6">
              <div className="hidden sm:flex -space-x-4">
                 <div className="w-16 h-16 rounded-full bg-black/60 border border-white/10 p-2 flex items-center justify-center overflow-hidden">
                    <img src={specificMatch.homeTeam.logo} alt="" className="w-full h-full object-contain" loading="lazy" referrerPolicy="no-referrer" />
                 </div>
                 <div className="w-16 h-16 rounded-full bg-black/60 border border-white/10 p-2 flex items-center justify-center overflow-hidden">
                    <img src={specificMatch.awayTeam.logo} alt="" className="w-full h-full object-contain" loading="lazy" referrerPolicy="no-referrer" />
                 </div>
              </div>
              <div className="flex flex-col">
                 <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_#6366f1] animate-pulse" />
                    <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Match Data Loaded</span>
                 </div>
                 <h3 className="text-xl font-black text-white uppercase tracking-tighter">
                   {specificMatch.homeTeam.name} vs {specificMatch.awayTeam.name}
                 </h3>
                 <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">Official High-Definition Summary</span>
              </div>
           </div>
           
           <button 
             onClick={onClearSpecific}
             className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/10 transition-all active:scale-95"
           >
              <ChevronLeft size={14} /> Back to Feed
           </button>
        </motion.div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {[1,2,3,4,5,6,7,8].map((i) => (
               <div key={i} className="aspect-[4/5] rounded-[2rem] bg-white/5 animate-pulse border border-white/5 flex flex-col p-8 gap-4 overflow-hidden relative">
                  <div className="aspect-video bg-white/5 rounded-2xl" />
                  <div className="h-6 w-3/4 bg-white/5 rounded-lg" />
                  <div className="h-4 w-1/2 bg-white/5 rounded-lg" />
                  <div className="mt-auto h-10 w-full bg-white/5 rounded-xl" />
               </div>
          ))}
        </div>
      ) : filteredNews.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {filteredNews.map((item, idx) => (
            <NewsCard key={item.id} item={item} index={idx} />
          ))}
        </div>
      ) : (
        <div className="py-32 text-center flex flex-col items-center gap-6 bg-white/[0.02] rounded-[3rem] border border-dashed border-white/10">
           <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
              <RefreshCw size={32} className="text-slate-700" />
           </div>
           <div>
              <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-2">No Data Found</h3>
              <p className="text-slate-500 text-[11px] font-black uppercase tracking-widest max-w-xs mx-auto">
                No highlights were found for {activeTab === 'today' ? "today's" : "yesterday's"} matches.
              </p>
           </div>
           <button onClick={fetchData} className="flex items-center gap-2 px-8 py-3 bg-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-600/20 active:scale-95">
             <RefreshCw size={14} /> Refresh Feed
           </button>
        </div>
      )}
    </div>
  );
};

export default NewsFeed;
