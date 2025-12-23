import React from 'react';
import { motion } from 'framer-motion';
import { Check, RotateCw } from 'lucide-react';

interface PageThumbnailProps {
  pageIndex: number;
  imageUrl: string;
  isSelected: boolean;
  onToggle: () => void;
  rotation?: number; // Visual rotation in degrees
}

export const PageThumbnail: React.FC<PageThumbnailProps> = ({
  pageIndex,
  imageUrl,
  isSelected,
  onToggle,
  rotation = 0
}) => {
  return (
    <motion.div
      layout
      whileHover={{ y: -4 }}
      onClick={onToggle}
      className={`
        relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all duration-200
        ${isSelected 
          ? 'border-blue-500 shadow-md ring-2 ring-blue-500/20' 
          : 'border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500'
        }
      `}
    >
      {/* Page Image */}
      <div className="bg-slate-100 dark:bg-slate-800 aspect-[3/4] relative overflow-hidden">
        <motion.img
          src={imageUrl}
          alt={`Page ${pageIndex + 1}`}
          className="w-full h-full object-contain p-2"
          initial={false}
          animate={{ rotate: rotation }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
        />
        
        {/* Selection Overlay (Active) */}
        {isSelected && (
          <div className="absolute inset-0 bg-blue-500/10 flex items-center justify-center pointer-events-none">
            <motion.div 
              initial={{ scale: 0 }} 
              animate={{ scale: 1 }}
              className="bg-blue-500 text-white p-2 rounded-full shadow-lg"
            >
              <Check size={20} strokeWidth={3} />
            </motion.div>
          </div>
        )}

        {/* Hover Overlay (Inactive) */}
        {!isSelected && (
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 dark:group-hover:bg-white/5 transition-colors" />
        )}
      </div>

      {/* Footer Info */}
      <div className={`
        px-3 py-2 text-xs font-bold flex items-center justify-between
        ${isSelected 
          ? 'bg-blue-500 text-white' 
          : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400'
        }
      `}>
        <span>Page {pageIndex + 1}</span>
        {rotation !== 0 && (
          <span className="flex items-center gap-1 opacity-80">
            <RotateCw size={10} /> {rotation}°
          </span>
        )}
      </div>
    </motion.div>
  );
};
