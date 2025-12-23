import React from 'react';
import { Link } from 'react-router-dom';
import { ThemeToggle } from './ThemeToggle';
import { Zap } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur-md border-b border-slate-200/50 dark:border-slate-800/50 bg-white/70 dark:bg-slate-950/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="relative w-8 h-8 flex items-center justify-center bg-slate-900 dark:bg-white rounded-lg text-white dark:text-slate-900 font-bold text-xl group-hover:scale-105 transition-transform duration-200">
            Z
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white dark:border-slate-900" />
          </div>
          <span className="font-bold text-lg tracking-tight text-slate-900 dark:text-white group-hover:opacity-80 transition-opacity">
            ZenPDF
          </span>
        </Link>
        
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-400">
            <Zap size={12} className="text-amber-500 fill-amber-500" />
            <span>Local & Private</span>
          </div>
          <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 hidden md:block" />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
};
