
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, User, Bot, ExternalLink, RefreshCw } from 'lucide-react';
import { ChatMessage } from '../types';
import { sendChatMessage } from '../services/geminiService';

const ChatInterface = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text: "👋 Hi! I'm your XStream Arena Assistant. Ask me about live scores, team stats, or player history!",
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);

    const history = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
    }));

    const response = await sendChatMessage(userMsg.text, history);

    const botMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'model',
      text: response.text,
      sources: response.sources,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, botMsg]);
    setIsTyping(false);
  };

  return (
    <div className="flex flex-col h-[70vh] md:h-[600px] w-full max-w-2xl bg-slate-900/40 backdrop-blur-xl rounded-3xl border border-white/5 shadow-2xl overflow-hidden relative">
      {/* Mini Header */}
      <div className="p-3 border-b border-white/5 bg-slate-900/60 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center shadow-lg">
            <Sparkles size={14} className="text-white" />
        </div>
        <div className="flex-1">
            <h3 className="text-white font-bold text-xs">Arena AI</h3>
            <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                <span className="text-[8px] text-slate-500 uppercase tracking-widest font-black">Sync Active</span>
            </div>
        </div>
        <button 
            onClick={() => setMessages([messages[0]])} 
            className="p-1.5 text-slate-500 hover:text-white bg-white/5 rounded-full transition-colors"
        >
            <RefreshCw size={12} />
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {messages.map((msg) => (
            <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
                {msg.role === 'model' && (
                    <div className="w-6 h-6 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center shrink-0">
                        <Bot size={12} className="text-purple-400" />
                    </div>
                )}
                
                <div className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`px-3.5 py-2.5 rounded-2xl text-[11px] leading-relaxed ${
                        msg.role === 'user' 
                        ? 'bg-pink-600 text-white rounded-br-none shadow-lg' 
                        : 'bg-slate-800 text-slate-200 rounded-bl-none border border-white/5'
                    }`}>
                        {msg.text}
                    </div>
                    
                    {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {msg.sources.slice(0, 1).map((src, i) => (
                                <a 
                                    key={i} 
                                    href={src.uri} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 px-1.5 py-0.5 bg-white/5 rounded-md text-[8px] text-slate-500 hover:text-white border border-white/5"
                                >
                                    <ExternalLink size={8} />
                                    {src.title?.substring(0, 20)}...
                                </a>
                            ))}
                        </div>
                    )}
                </div>

                {msg.role === 'user' && (
                    <div className="w-6 h-6 rounded-full bg-slate-700 border border-white/10 flex items-center justify-center shrink-0">
                        <User size={12} className="text-slate-300" />
                    </div>
                )}
            </motion.div>
        ))}

        {isTyping && (
            <div className="flex gap-2.5 justify-start">
                 <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center shrink-0">
                    <Bot size={12} className="text-purple-400" />
                </div>
                <div className="bg-slate-800 px-3 py-2 rounded-2xl rounded-bl-none border border-white/5 flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" />
                    <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce delay-75" />
                    <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce delay-150" />
                </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input - Compact */}
      <div className="p-3 bg-slate-900/60 border-t border-white/5">
        <form 
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="flex items-center gap-2 bg-slate-800/50 p-1.5 rounded-2xl border border-white/10 focus-within:border-pink-500/50"
        >
            <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask Oracle..."
                className="flex-1 bg-transparent border-none outline-none text-white text-xs px-3 py-1"
                disabled={isTyping}
            />
            <button 
                type="submit"
                disabled={!inputValue.trim() || isTyping}
                className="p-2 rounded-xl bg-pink-600 text-white disabled:opacity-50 transition-all active:scale-95"
            >
                <Send size={14} />
            </button>
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;
