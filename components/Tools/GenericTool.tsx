import React from 'react';
import { Construction, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Props {
  title: string;
  description: string;
}

export const GenericTool: React.FC<Props> = ({ title, description }) => {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-8">
      <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center text-slate-400 mb-6 animate-pulse">
        <Construction size={40} />
      </div>
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">{title}</h1>
      <p className="text-slate-500 dark:text-slate-400 max-w-md mb-10 text-lg leading-relaxed">{description}</p>
      
      <Link to="/" className="px-6 py-3 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-2">
        <ArrowLeft size={18} />
        Back to Dashboard
      </Link>
    </div>
  );
};