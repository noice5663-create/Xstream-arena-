import React from 'react';
import { motion } from 'framer-motion';

const LiveBadge = () => {
  return (
    <div className="flex items-center gap-2 px-2 py-1 bg-red-500/10 border border-red-500/50 rounded-full">
      <motion.div
        className="w-2 h-2 bg-red-500 rounded-full"
        animate={{ opacity: [1, 0.4, 1] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
      <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Live</span>
    </div>
  );
};

export default LiveBadge;