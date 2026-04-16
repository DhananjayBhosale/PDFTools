import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowDownUp,
  CircleDot,
  Database,
  Droplets,
  Edit3,
  FileDown,
  FileImage,
  FileSignature,
  FileStack,
  FileText,
  GitCompare,
  Hash,
  Image as ImageIcon,
  Lock,
  Minimize2,
  RotateCw,
  Scissors,
  Search,
  Smartphone,
  Square,
  Trash2,
  Unlock,
  Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type ToolCategory = 'Arrange' | 'Convert' | 'Review & Secure';
type ToolColor =
  | 'orange'
  | 'teal'
  | 'purple'
  | 'blue'
  | 'red'
  | 'sky'
  | 'cyan'
  | 'green'
  | 'yellow'
  | 'indigo'
  | 'violet'
  | 'amber'
  | 'emerald'
  | 'lime';

type CategoryFilter = 'All' | ToolCategory;

interface ToolCardData {
  id: number;
  name: string;
  icon: LucideIcon;
  category: ToolCategory;
  description: string;
  color: ToolColor;
  path: string;
}

const tools: ToolCardData[] = [
  { id: 1, name: 'Merge', icon: FileStack, category: 'Arrange', description: 'Combine multiple PDFs', color: 'orange', path: '/merge' },
  { id: 2, name: 'Split', icon: Scissors, category: 'Arrange', description: 'Divide PDF into parts', color: 'teal', path: '/split' },
  { id: 3, name: 'Reorder', icon: ArrowDownUp, category: 'Arrange', description: 'Rearrange pages', color: 'purple', path: '/reorder' },
  { id: 4, name: 'Rotate', icon: RotateCw, category: 'Arrange', description: 'Rotate PDF pages', color: 'blue', path: '/rotate' },
  { id: 5, name: 'Delete pages', icon: Trash2, category: 'Arrange', description: 'Remove unwanted pages', color: 'red', path: '/delete-pages' },
  { id: 6, name: 'Extract pages', icon: FileText, category: 'Arrange', description: 'Export only selected pages', color: 'sky', path: '/extract' },
  { id: 7, name: 'Page numbers', icon: Hash, category: 'Arrange', description: 'Add numbered labels to pages', color: 'blue', path: '/page-numbers' },
  { id: 8, name: 'Watermark', icon: Droplets, category: 'Arrange', description: 'Add text watermark on each page', color: 'cyan', path: '/watermark' },
  { id: 9, name: 'Flatten', icon: Minimize2, category: 'Arrange', description: 'Flatten form fields', color: 'cyan', path: '/flatten' },
  { id: 10, name: 'Compress', icon: FileDown, category: 'Convert', description: 'Reduce file size', color: 'green', path: '/compress' },
  { id: 11, name: 'PDF to Image', icon: FileImage, category: 'Convert', description: 'Convert to images', color: 'yellow', path: '/pdf-to-jpg' },
  { id: 12, name: 'Image to PDF', icon: ImageIcon, category: 'Convert', description: 'Create PDF from images', color: 'teal', path: '/image-to-pdf' },
  { id: 13, name: 'Make PDF', icon: Smartphone, category: 'Convert', description: 'Capture photos and make a PDF', color: 'indigo', path: '/make-pdf' },
  { id: 14, name: 'Edit', icon: Edit3, category: 'Convert', description: 'Edit PDF content', color: 'indigo', path: '/edit' },
  { id: 15, name: 'Compare', icon: GitCompare, category: 'Review & Secure', description: 'Visual compare + export text report', color: 'violet', path: '/compare' },
  { id: 16, name: 'Extract text', icon: FileText, category: 'Review & Secure', description: 'Extract text content', color: 'sky', path: '/ocr' },
  { id: 17, name: 'Metadata', icon: Database, category: 'Review & Secure', description: 'View or edit metadata', color: 'orange', path: '/metadata' },
  { id: 18, name: 'Sign', icon: FileSignature, category: 'Review & Secure', description: 'Digitally sign PDF', color: 'amber', path: '/sign' },
  { id: 19, name: 'Protect', icon: Lock, category: 'Review & Secure', description: 'Add password protection', color: 'emerald', path: '/protect' },
  { id: 20, name: 'Unlock', icon: Unlock, category: 'Review & Secure', description: 'Remove password', color: 'lime', path: '/unlock' },
  { id: 21, name: 'Repair', icon: Wrench, category: 'Review & Secure', description: 'Re-save for compatibility fixes', color: 'amber', path: '/repair' },
];

const toneClasses: Record<ToolColor, { iconBox: string; icon: string }> = {
  orange: { iconBox: 'bg-rose-50 dark:bg-rose-950/35', icon: 'text-rose-500 dark:text-rose-300' },
  teal: { iconBox: 'bg-cyan-50 dark:bg-cyan-950/35', icon: 'text-cyan-500 dark:text-cyan-300' },
  purple: { iconBox: 'bg-purple-50 dark:bg-purple-950/35', icon: 'text-purple-500 dark:text-purple-300' },
  blue: { iconBox: 'bg-blue-50 dark:bg-blue-950/35', icon: 'text-blue-500 dark:text-blue-300' },
  red: { iconBox: 'bg-red-50 dark:bg-red-950/35', icon: 'text-red-500 dark:text-red-300' },
  sky: { iconBox: 'bg-blue-50 dark:bg-blue-950/35', icon: 'text-blue-500 dark:text-blue-300' },
  cyan: { iconBox: 'bg-cyan-50 dark:bg-cyan-950/35', icon: 'text-cyan-500 dark:text-cyan-300' },
  green: { iconBox: 'bg-emerald-50 dark:bg-emerald-950/35', icon: 'text-emerald-500 dark:text-emerald-300' },
  yellow: { iconBox: 'bg-amber-50 dark:bg-amber-950/35', icon: 'text-amber-500 dark:text-amber-300' },
  indigo: { iconBox: 'bg-indigo-50 dark:bg-indigo-950/35', icon: 'text-indigo-500 dark:text-indigo-300' },
  violet: { iconBox: 'bg-violet-50 dark:bg-violet-950/35', icon: 'text-violet-500 dark:text-violet-300' },
  amber: { iconBox: 'bg-amber-50 dark:bg-amber-950/35', icon: 'text-amber-500 dark:text-amber-300' },
  emerald: { iconBox: 'bg-emerald-50 dark:bg-emerald-950/35', icon: 'text-emerald-500 dark:text-emerald-300' },
  lime: { iconBox: 'bg-lime-50 dark:bg-lime-950/35', icon: 'text-lime-600 dark:text-lime-300' },
};

const categoryOrder: CategoryFilter[] = ['All', 'Arrange', 'Convert', 'Review & Secure'];

const ToolCard: React.FC<{ tool: ToolCardData; index: number }> = ({ tool, index }) => {
  const Icon = tool.icon;
  const tone = toneClasses[tool.color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: Math.min(index * 0.02, 0.2) }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
    >
      <Link
        to={tool.path}
        className="group block rounded-[22px] border border-slate-200 bg-white/90 p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition-all hover:border-slate-300 hover:shadow-[0_12px_32px_rgba(15,23,42,0.07)] dark:border-slate-800 dark:bg-slate-900/65 dark:hover:border-slate-700"
      >
        <div className="flex items-center gap-4">
          <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${tone.iconBox}`}>
            <Icon className={`h-8 w-8 ${tone.icon}`} />
          </div>
          <h3 className="text-2xl font-medium leading-none tracking-[-0.01em] text-slate-900 dark:text-white">{tool.name}</h3>
        </div>
      </Link>
    </motion.div>
  );
};

export const Dashboard: React.FC = () => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('All');

  const categoryCounts = useMemo(() => {
    const counts: Record<CategoryFilter, number> = {
      All: tools.length,
      Arrange: 0,
      Convert: 0,
      'Review & Secure': 0,
    };

    for (const tool of tools) {
      counts[tool.category] += 1;
    }

    return counts;
  }, []);

  const filteredTools = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return tools.filter((tool) => {
      const categoryMatch = category === 'All' || tool.category === category;
      if (!categoryMatch) return false;
      if (!normalized) return true;

      const haystack = `${tool.name} ${tool.description} ${tool.category}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [category, query]);

  return (
    <div className="px-4 py-8 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-[1320px]">
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <div className="text-center">
            <h1 className="text-4xl font-semibold tracking-[-0.03em] text-slate-900 dark:text-white md:text-6xl">PDF Chef</h1>
            <p className="mt-4 text-xl font-medium text-slate-600 dark:text-slate-300">Private PDF tools. On your device.</p>
            <p className="mt-2 text-lg font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">MERGE. SPLIT. CONVERT. PROTECT.</p>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-lg font-medium text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                <CircleDot className="h-5 w-5" />
                100% Private
              </div>
              <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-lg font-medium text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                <Square className="h-5 w-5" />
                Works Offline
              </div>
            </div>
          </div>

          <div className="mx-auto mt-9 max-w-5xl">
            <label htmlFor="tool-search" className="sr-only">
              Find a tool
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-5 top-1/2 h-6 w-6 -translate-y-1/2 text-slate-400" />
              <input
                id="tool-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find a tool..."
                className="h-16 w-full rounded-3xl border border-slate-200 bg-white pl-14 pr-5 text-xl text-slate-700 shadow-sm outline-none transition focus:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-slate-600"
              />
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {categoryOrder.map((item) => {
              const selected = item === category;
              return (
                <button
                  key={item}
                  onClick={() => setCategory(item)}
                  className={`rounded-2xl border px-6 py-2 text-lg font-medium transition ${
                    selected
                      ? 'border-orange-500 bg-orange-500 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600'
                  }`}
                >
                  {item} <span className={`ml-1 ${selected ? 'text-orange-100' : 'text-slate-400 dark:text-slate-500'}`}>{categoryCounts[item]}</span>
                </button>
              );
            })}
          </div>

        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
          className="mt-8"
        >
          {filteredTools.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white/60 p-10 text-center text-xl text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
              No tools match your search.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {filteredTools.map((tool, index) => (
                <ToolCard key={tool.id} tool={tool} index={index} />
              ))}
            </div>
          )}
        </motion.section>
      </div>
    </div>
  );
};
