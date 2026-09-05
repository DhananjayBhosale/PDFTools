import React from 'react';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface FAQItem {
  question: string;
  answer: string;
}

interface FAQProps {
  items: FAQItem[];
  title?: string;
}

/**
 * Tool help, collapsed by default.
 *
 * One group, one border, a hairline between questions: the previous shape gave
 * every question its own shadowed card with 24px of side padding, so a
 * four-question help section was four stacked panels and most of a screen of
 * ground. The rows carry the same copy and the same schema.
 */
export const FAQ: React.FC<FAQProps> = ({ items, title = 'Help' }) => {
  const [openIndex, setOpenIndex] = React.useState<number | null>(null);
  const [helpOpen, setHelpOpen] = React.useState(false);
  const baseId = React.useId();

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  return (
    <div className="mt-6 w-full">
      <script type="application/ld+json">{JSON.stringify(schema)}</script>

      <button
        type="button"
        aria-expanded={helpOpen}
        aria-controls="tool-help"
        onClick={() => setHelpOpen((open) => !open)}
        className="chef-target chef-pressable flex w-full items-center justify-between gap-2 rounded-[var(--radius-field)] border border-[var(--border-strong)] bg-[var(--surface-raised)] px-4 text-left text-sm font-semibold text-[var(--text-primary)]"
      >
        <span>{title}</span>
        <ChevronDown
          aria-hidden
          size={18}
          className={`shrink-0 text-[var(--text-secondary)] transition-transform ${helpOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {helpOpen && (
        <div
          id="tool-help"
          className="mt-2 divide-y divide-[var(--border-hairline)] overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border-hairline)] bg-[var(--surface-raised)]"
        >
          {items.map((item, index) => {
            const open = openIndex === index;
            return (
              <div key={item.question}>
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={`${baseId}-answer-${index}`}
                  onClick={() => setOpenIndex(open ? null : index)}
                  className="chef-target chef-pressable-row flex w-full items-center justify-between gap-3 px-3 text-left"
                >
                  <span className="min-w-0 text-sm font-semibold text-[var(--text-primary)]">{item.question}</span>
                  <ChevronDown
                    aria-hidden
                    size={18}
                    className={`shrink-0 text-[var(--text-secondary)] transition-transform duration-transition ${open ? 'rotate-180' : ''}`}
                  />
                </button>

                <AnimatePresence>
                  {open && (
                    <motion.div
                      id={`${baseId}-answer-${index}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <p className="px-3 pb-2.5 text-sm leading-relaxed text-[var(--text-secondary)]">{item.answer}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
