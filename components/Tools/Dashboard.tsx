import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  FileStack, Scissors, Image as ImageIcon, RotateCw, Shield, 
  FileText, Layers, Lock, FileSearch, ArrowRight, Search, 
  FileImage, PenTool, Eraser, Move, Unlock, Maximize, GitCompare, ScanText, FileSignature
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ToolRoute } from '../../types';

// SEO-Optimized Tool Registry
const tools: ToolRoute[] = [
  // --- TIER 1: HIGH INTENT (Hero Tools) ---
  { 
    path: '/compress', 
    label: 'Compress PDF', 
    description: 'Reduce file size while maintaining quality.', 
    icon: Layers, 
    color: 'text-indigo-500', 
    category: 'core', 
    tier: 1,
    keywords: ['shrink', 'reduce', 'optimize', 'size']
  },
  { 
    path: '/merge', 
    label: 'Merge PDF', 
    description: 'Combine multiple PDFs into one file.', 
    icon: FileStack, 
    color: 'text-blue-500', 
    category: 'core', 
    tier: 1,
    keywords: ['combine', 'join', 'binder']
  },
  { 
    path: '/split', 
    label: 'Split PDF', 
    description: 'Extract pages or split into separate files.', 
    icon: Scissors, 
    color: 'text-rose-500', 
    category: 'core', 
    tier: 1,
    keywords: ['cut', 'extract', 'separate']
  },
  { 
    path: '/edit', 
    label: 'Edit PDF', 
    description: 'Add text, shapes, and annotations.', 
    icon: PenTool, 
    color: 'text-pink-500', 
    category: 'core', 
    tier: 1,
    keywords: ['modify', 'change', 'text']
  },
  { 
    path: '/pdf-to-jpg', 
    label: 'PDF to JPG', 
    description: 'Convert PDF pages to images.', 
    icon: FileImage, 
    color: 'text-amber-500', 
    category: 'convert', 
    tier: 1,
    keywords: ['image', 'convert', 'png', 'jpeg']
  },
  { 
    path: '/image-to-pdf', 
    label: 'JPG to PDF', 
    description: 'Turn your images into a PDF document.', 
    icon: ImageIcon, 
    color: 'text-purple-500', 
    category: 'convert', 
    tier: 1,
    keywords: ['photo', 'convert', 'create']
  },
  { 
    path: '/sign', 
    label: 'Sign PDF', 
    description: 'Sign documents digitally.', 
    icon: FileSignature, 
    color: 'text-teal-500', 
    category: 'security', 
    tier: 1,
    keywords: ['signature', 'contract', 'form']
  },

  // --- TIER 2: QUICK TOOLS ---
  { 
    path: '/delete-pages', 
    label: 'Delete Pages', 
    description: 'Remove unwanted pages.', 
    icon: Eraser, 
    color: 'text-red-500', 
    category: 'pages', 
    tier: 2,
    keywords: ['remove', 'cut']
  },
  { 
    path: '/reorder', 
    label: 'Reorder Pages', 
    description: 'Rearrange page order.', 
    icon: Move, 
    color: 'text-orange-500', 
    category: 'pages', 
    tier: 2,
    keywords: ['sort', 'arrange']
  },
  { 
    path: '/rotate', 
    label: 'Rotate Pages', 
    description: 'Fix page orientation.', 
    icon: RotateCw, 
    color: 'text-cyan-500', 
    category: 'pages', 
    tier: 2,
    keywords: ['turn', 'orientation']
  },
  { 
    path: '/protect', 
    label: 'Protect PDF', 
    description: 'Encrypt with password.', 
    icon: Lock, 
    color: 'text-emerald-500', 
    category: 'security', 
    tier: 2,
    keywords: ['lock', 'password', 'encrypt']
  },
  { 
    path: '/unlock', 
    label: 'Unlock PDF', 
    description: 'Remove PDF passwords.', 
    icon: Unlock, 
    color: 'text-lime-500', 
    category: 'security', 
    tier: 2,
    keywords: ['decrypt', 'open']
  },
  { 
    path: '/extract', 
    label: 'Extract Pages', 
    description: 'Get specific pages.', 
    icon: FileText, 
    color: 'text-violet-500', 
    category: 'pages', 
    tier: 2,
    keywords: ['pull', 'take']
  },
  { 
    path: '/metadata', 
    label: 'Metadata', 
    description: 'Edit file info.', 
    icon: FileSearch, 
    color: 'text-sky-500', 
    category: 'core', 
    tier: 2,
    keywords: ['info', 'author', 'title']
  },

  // --- TIER 3: ADVANCED ---
  { 
    path: '/flatten', 
    label: 'Flatten PDF', 
    description: 'Merge layers and forms.', 
    icon: Maximize, 
    color: 'text-slate-500', 
    category: 'core', 
    tier: 3,
    keywords: ['merge layers', 'form']
  },
  { 
    path: '/compare', 
    label: 'Compare PDFs', 
    description: 'Find differences.', 
    icon: GitCompare, 
    color: 'text-slate-500', 
    category: 'core', 
    tier: 3,
    keywords: ['diff', 'changes']
  },
  { 
    path: '/ocr', 
    label: 'OCR PDF', 
    description: 'Make text searchable.', 
    icon: ScanText, 
    color: 'text-slate-500', 
    category: 'core', 
    tier: 3,
    experimental: true,
    keywords: ['text recognition', 'scan']
  },
];

const HeroCard: React.FC<{ tool: ToolRoute }> = ({ tool }) => (
  <Link 
    to={tool.path}
    className="group relative flex flex-col p-6 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl hover:border-blue-500/50 dark:hover:border-blue-500/50 hover:shadow-xl hover:shadow-blue-500/5 dark:hover:shadow-blue-900/10 hover:-translate-y-1 transition-all duration-300 overflow-hidden"
  >
    <div className={`absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity ${tool.color} -rotate-12 transform scale-150 origin-top-right`}>
      <tool.icon size={80} strokeWidth={1.5} />
    </div>
    
    <div className="flex items-start justify-between mb-4">
      <div className={`p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 ${tool.color} ring-1 ring-slate-100 dark:ring-slate-700 group-hover:scale-110 transition-transform duration-300`}>
        <tool.icon size={26} />
      </div>
      <ArrowRight size={20} className="text-slate-300 dark:text-slate-700 group-hover:text-blue-500 transition-colors -translate-x-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0" />
    </div>
    
    <h3 className="font-bold text-slate-900 dark:text-white text-lg mb-2">{tool.label}</h3>
    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{tool.description}</p>
  </Link>
);

const QuickCard: React.FC<{ tool: ToolRoute }> = ({ tool }) => (
  <Link 
    to={tool.path}
    className="group flex items-center gap-3 p-4 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all duration-200"
    title={tool.description}
  >
    <div className={`p-2 rounded-lg bg-slate-50 dark:bg-slate-800 ${tool.color}`}>
      <tool.icon size={18} />
    </div>
    <span className="font-semibold text-slate-700 dark:text-slate-300 text-sm">{tool.label}</span>
  </Link>
);

const AdvancedCard: React.FC<{ tool: ToolRoute }> = ({ tool }) => (
  <Link 
    to={tool.path}
    className="flex items-center gap-3 p-3 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
  >
    <tool.icon size={16} />
    <span className="text-sm font-medium">{tool.label}</span>
    {tool.experimental && (
      <span className="text-[10px] font-bold uppercase tracking-wide bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded">Exp</span>
    )}
  </Link>
);

export const Dashboard = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const filteredTools = useMemo(() => {
    if (!searchQuery) return tools;
    const lowerQuery = searchQuery.toLowerCase();
    return tools.filter(t => 
      t.label.toLowerCase().includes(lowerQuery) || 
      t.description.toLowerCase().includes(lowerQuery) ||
      t.keywords?.some(k => k.toLowerCase().includes(lowerQuery))
    );
  }, [searchQuery]);

  const hasSearch = searchQuery.length > 0;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 md:py-16">
      
      {/* Search Header */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-2xl mx-auto mb-12"
      >
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-6">
          Everything PDF. <br/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
             100% Local & Private.
          </span>
        </h1>
        
        <div className="relative group max-w-lg mx-auto">
          <div className="absolute inset-0 bg-blue-500/20 dark:bg-blue-500/10 rounded-2xl blur-xl group-hover:blur-2xl transition-all opacity-50" />
          <div className="relative flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg p-2 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all duration-300">
            <Search className="ml-3 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="What do you want to do with your PDF?"
              className="w-full bg-transparent border-none outline-none focus:outline-none focus:ring-0 text-slate-900 dark:text-white placeholder-slate-400 px-3 py-2 text-lg"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoComplete="off"
            />
          </div>
        </div>
      </motion.div>

      {/* Tools Grid */}
      <AnimatePresence mode="wait">
        {hasSearch ? (
          // Search Results View
          <motion.div 
            key="search-results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {filteredTools.length > 0 ? (
              filteredTools.map(tool => <HeroCard key={tool.path} tool={tool} />)
            ) : (
              <div className="col-span-full text-center py-12 text-slate-500">
                No tools found for "{searchQuery}". Try "merge", "compress", or "image".
              </div>
            )}
          </motion.div>
        ) : (
          // Structured Tier View
          <motion.div 
            key="tiers"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-12"
          >
            {/* TIER 1: HERO TOOLS */}
            <section>
              <h2 className="sr-only">Most Popular Tools</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {tools.filter(t => t.tier === 1).map(tool => (
                  <HeroCard key={tool.path} tool={tool} />
                ))}
              </div>
            </section>

            {/* TIER 2: QUICK TOOLS */}
            <section>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-4 px-1">Quick Tools</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {tools.filter(t => t.tier === 2).map(tool => (
                  <QuickCard key={tool.path} tool={tool} />
                ))}
              </div>
            </section>

            {/* TIER 3: ADVANCED TOOLS */}
            <section className="border-t border-slate-200 dark:border-slate-800 pt-8">
              <button 
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 transition-colors mb-4"
              >
                <span>{showAdvanced ? 'Hide' : 'Show'} Advanced Tools</span>
                <ArrowRight size={14} className={`transition-transform duration-200 ${showAdvanced ? 'rotate-90' : ''}`} />
              </button>
              
              <AnimatePresence>
                {showAdvanced && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 pb-4">
                      {tools.filter(t => t.tier === 3).map(tool => (
                        <AdvancedCard key={tool.path} tool={tool} />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Privacy Footer */}
      <div className="mt-20 text-center border-t border-slate-200 dark:border-slate-800 pt-8">
        <p className="text-slate-500 dark:text-slate-400 text-sm flex items-center justify-center gap-2">
          <Shield size={14} className="text-green-500" />
          Files stay on your device. No data is ever uploaded to our servers.
        </p>
      </div>

    </div>
  );
};