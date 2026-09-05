import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ExternalLink, Files, History, Settings } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

const NavLink: React.FC<{ to: string; external?: boolean; children: React.ReactNode }> = ({ to, external = false, children }) => {
  const className = 'flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white';

  if (external) {
    return (
      <motion.a whileHover={{ y: -1 }} href={to} target="_blank" rel="noreferrer" className={className}>
        {children}
        <ExternalLink className="h-3 w-3" />
      </motion.a>
    );
  }

  return (
    <motion.div whileHover={{ y: -1 }}>
      <Link to={to} className={className}>
        {children}
      </Link>
    </motion.div>
  );
};

export const Header: React.FC = () => {
  return (
    <motion.header
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="sticky top-0 z-50 border-b border-gray-200 bg-white/60 backdrop-blur-xl transition-colors duration-500 dark:border-gray-800 dark:bg-gray-950/80"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <motion.div whileHover={{ scale: 1.02 }} className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-3">
              <img src="/pdf-chef-logo-exact.webp" alt="" aria-hidden className="h-11 w-11 object-contain" />
              <div>
                <span className="block text-lg font-bold text-gray-900 dark:text-white">
                  PDF Chef
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Private PDF tools
                </p>
              </div>
            </Link>
          </motion.div>

          <nav className="flex items-center gap-1">
            <div className="flex items-center gap-1 md:hidden">
              <Link to="/batch" aria-label="Batch processing" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"><Files className="h-5 w-5" /></Link>
              <Link to="/history" aria-label="Local history" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"><History className="h-5 w-5" /></Link>
              <Link to="/settings" aria-label="Settings" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"><Settings className="h-5 w-5" /></Link>
            </div>
            <div className="hidden items-center gap-1 md:flex">
              <NavLink to="/batch"><Files className="h-4 w-4" />Batch</NavLink>
              <NavLink to="/history"><History className="h-4 w-4" />History</NavLink>
              <NavLink to="/settings"><Settings className="h-4 w-4" />Settings</NavLink>
              <NavLink to="/privacy">Privacy</NavLink>
              <NavLink to="/terms">Terms</NavLink>
              <NavLink to="https://github.com/DhananjayBhosale/PDFChef" external>
                Source
              </NavLink>
            </div>
            <div className="ml-2">
              <ThemeToggle />
            </div>
          </nav>
        </div>
      </div>
    </motion.header>
  );
};
