
import React from 'react';
import { Minus, Plus, RotateCcw } from 'lucide-react';

interface ZoomControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  min?: number;
  max?: number;
  className?: string;
}

export const ZoomControls: React.FC<ZoomControlsProps> = ({ 
  zoom, onZoomIn, onZoomOut, onReset, min = 0.5, max = 2.0, className = '' 
}) => {
  return (
    <div className={`flex items-center gap-1 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-1 ${className}`}>
      <button 
        onClick={onZoomOut} 
        disabled={zoom <= min}
        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md text-slate-500 dark:text-slate-400 disabled:opacity-30 transition-colors"
        aria-label="Zoom Out"
        title="Zoom Out (-)"
      >
        <Minus size={16} />
      </button>
      
      <div className="w-12 text-center font-mono text-xs font-bold text-slate-700 dark:text-slate-300 select-none">
        {Math.round(zoom * 100)}%
      </div>
      
      <button 
        onClick={onZoomIn} 
        disabled={zoom >= max}
        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md text-slate-500 dark:text-slate-400 disabled:opacity-30 transition-colors"
        aria-label="Zoom In"
        title="Zoom In (+)"
      >
        <Plus size={16} />
      </button>

      <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />
      
      <button 
        onClick={onReset} 
        disabled={zoom === 1}
        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md text-slate-500 dark:text-slate-400 disabled:opacity-30 transition-colors"
        aria-label="Reset Zoom"
        title="Reset to 100%"
      >
        <RotateCcw size={14} />
      </button>
    </div>
  );
};
