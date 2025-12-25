import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Play, Pause, Volume2, VolumeX, Maximize, RefreshCw, AlertTriangle, Settings, Radio } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SmartPlayerProps {
  src: string;
  poster?: string;
  autoPlay?: boolean;
}

const SmartPlayer: React.FC<SmartPlayerProps> = ({ src, poster, autoPlay = false }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showControls, setShowControls] = useState(false);

  const isYoutube = src.includes('youtube.com') || src.includes('youtu.be');

  useEffect(() => {
    // Reset state on source change
    setError(null);
    setLoading(true);
    setIsPlaying(false);

    if (isYoutube) {
        setLoading(false);
        return;
    }

    const video = videoRef.current;
    if (!video) return;

    let hls: Hls | null = null;

    const handleSuccess = () => {
        setLoading(false);
        if (autoPlay) {
            video.play().then(() => setIsPlaying(true)).catch(() => {
                video.muted = true;
                setIsMuted(true);
                video.play().then(() => setIsPlaying(true)).catch(() => {});
            });
        }
    };

    const handleError = (e: any) => {
        if (!hls) {
             console.error("Video Error:", e);
             setError("Stream connection failed.");
             setLoading(false);
        }
    };

    if (Hls.isSupported() && (src.includes('.m3u8') || src.includes('.ts') || src.includes(':8080'))) {
      hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 90,
      });
      
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, handleSuccess);
      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
            switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                    hls?.startLoad();
                    break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                    hls?.recoverMediaError();
                    break;
                default:
                    hls?.destroy();
                    setError("Stream unavailable.");
                    break;
            }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      video.addEventListener('loadedmetadata', handleSuccess);
      video.addEventListener('error', handleError);
    } else {
      video.src = src;
      video.addEventListener('loadedmetadata', handleSuccess);
      video.addEventListener('error', handleError);
    }

    return () => {
      if (hls) hls.destroy();
      if (video) {
          video.removeEventListener('loadedmetadata', handleSuccess);
          video.removeEventListener('error', handleError);
          video.pause();
          video.src = "";
      }
    };
  }, [src, isYoutube, autoPlay]);

  const togglePlay = () => {
    if (videoRef.current) {
        if (isPlaying) videoRef.current.pause();
        else videoRef.current.play();
        setIsPlaying(!isPlaying);
    }
  };

  const handleVolumeChange = (newVolume: number) => {
      if (videoRef.current) {
          videoRef.current.volume = newVolume;
          videoRef.current.muted = newVolume === 0;
          setVolume(newVolume);
          setIsMuted(newVolume === 0);
      }
  };

  const toggleMute = () => {
      if (videoRef.current) {
          const newMutedState = !isMuted;
          videoRef.current.muted = newMutedState;
          setIsMuted(newMutedState);
          if (newMutedState) setVolume(0);
          else setVolume(1);
      }
  };

  const toggleFullscreen = () => {
      if (containerRef.current) {
          if (!document.fullscreenElement) containerRef.current.requestFullscreen();
          else document.exitFullscreen();
      }
  };

  if (isYoutube) {
    return (
        <div className="w-full h-full relative bg-black rounded-xl overflow-hidden shadow-2xl">
            <iframe
                src={src}
                className="w-full h-full border-0"
                title="YouTube Live Stream"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
            />
        </div>
    );
  }

  return (
    <div 
        ref={containerRef}
        className="w-full h-full relative bg-black group select-none overflow-hidden rounded-xl shadow-2xl flex flex-col justify-center"
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => setShowControls(false)}
    >
        <video 
            ref={videoRef}
            poster={poster}
            className="w-full h-full object-contain"
            playsInline
            onClick={togglePlay}
        />

        {/* Loading Overlay */}
        <AnimatePresence>
            {loading && !error && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-20"
                >
                    <div className="w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mb-4" />
                    <span className="text-white font-bold tracking-widest text-sm">CONNECTING</span>
                </motion.div>
            )}
        </AnimatePresence>

        {/* Error Overlay */}
        <AnimatePresence>
            {error && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-30 p-6 text-center"
                >
                    <AlertTriangle size={48} className="text-red-500 mb-4" />
                    <h3 className="text-white font-bold text-lg mb-2">Stream Error</h3>
                    <p className="text-gray-400 text-sm mb-4 max-w-md">{error}</p>
                    <button 
                        onClick={() => window.location.reload()} 
                        className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full text-white text-sm transition-colors border border-white/5"
                    >
                        <RefreshCw size={14} /> Retry Connection
                    </button>
                </motion.div>
            )}
        </AnimatePresence>

        {/* Play/Pause Center Icon (Flash effect) */}
        {!loading && !isPlaying && !error && (
             <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                 <div className="w-20 h-20 bg-black/40 rounded-full flex items-center justify-center backdrop-blur-md border border-white/10 shadow-lg">
                    <Play size={40} className="ml-2 text-white" fill="white" />
                 </div>
             </div>
        )}

        {/* Modern Glass Control Bar */}
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: showControls || !isPlaying ? 1 : 0, y: showControls || !isPlaying ? 0 : 20 }}
            transition={{ duration: 0.3 }}
            className="absolute bottom-4 left-4 right-4 bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl p-3 z-20 flex flex-col gap-2"
        >
            {/* Live Indicator & Progress */}
            <div className="flex items-center gap-2 mb-1">
                 <div className="flex items-center gap-1.5 px-2 py-0.5 bg-red-500/20 border border-red-500/30 rounded text-[10px] font-bold text-red-400 uppercase tracking-wider">
                     <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> Live
                 </div>
                 <div className="h-1 flex-1 bg-white/10 rounded-full overflow-hidden">
                     <div className="h-full w-full bg-gradient-to-r from-pink-500 to-purple-600 origin-left scale-x-100" />
                 </div>
            </div>

            {/* Main Controls */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={togglePlay} className="text-white hover:text-pink-400 transition-colors">
                        {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
                    </button>
                    
                    <div className="flex items-center gap-2 group/vol">
                        <button onClick={toggleMute} className="text-slate-300 hover:text-white transition-colors">
                            {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
                        </button>
                        <div className="w-0 overflow-hidden group-hover/vol:w-24 transition-all duration-300">
                             <input 
                                type="range" 
                                min="0" 
                                max="1" 
                                step="0.1" 
                                value={volume} 
                                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                                className="w-20 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-pink-500"
                             />
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button className="text-slate-300 hover:text-white transition-colors">
                        <Settings size={20} />
                    </button>
                    <button onClick={toggleFullscreen} className="text-slate-300 hover:text-white transition-colors">
                        <Maximize size={20} />
                    </button>
                </div>
            </div>
        </motion.div>
    </div>
  );
};

export default SmartPlayer;