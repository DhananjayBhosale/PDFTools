import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ExternalLink } from 'lucide-react';
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
      className="sticky top-0 z-50 border-b border-gray-200/50 bg-white/60 backdrop-blur-xl transition-colors duration-500 dark:border-gray-800 dark:bg-gray-950/80"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <motion.div whileHover={{ scale: 1.02 }} className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-500 shadow-lg dark:from-purple-500 dark:to-blue-600">
                <span className="text-lg font-bold text-white">PC</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900 dark:text-white">
                  PDF Chef
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Private PDF tools
                </p>
              </div>
            </Link>
          </motion.div>

          <nav className="flex items-center gap-1">
            <div className="hidden items-center gap-1 md:flex">
              <NavLink to="/privacy-policy">Privacy</NavLink>
              <NavLink to="/pdf-chef-privacy">Android privacy</NavLink>
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
