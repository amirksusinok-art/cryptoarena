import React, { useState } from 'react';
import { Info, X } from 'lucide-react';

export const VirtualMarketBanner: React.FC = () => {
  const [closed, setClosed] = useState(false);
  if (closed) return null;

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-3 py-1.5 flex items-center justify-between text-xs text-amber-300">
      <div className="flex items-center space-x-2 overflow-hidden">
        <Info className="w-3.5 h-3.5 flex-shrink-0 text-amber-400" />
        <span className="font-medium tracking-wide truncate">
          <span className="font-bold uppercase tracking-wider text-amber-200">Virtual Simulated Market</span> — Торговля и цены полностью виртуальные.
        </span>
      </div>
      <button 
        onClick={() => setClosed(true)} 
        className="text-amber-400 hover:text-amber-200 ml-2 p-0.5"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
