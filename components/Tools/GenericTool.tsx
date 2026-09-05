import React from 'react';
import { Construction, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Props {
  title: string;
  description: string;
}

export const GenericTool: React.FC<Props> = ({ title, description }) => {
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center">
      <div className="mb-3 grid h-12 w-12 place-items-center rounded-[var(--radius-panel)] bg-[var(--surface-sunken)] text-[var(--text-tertiary)]">
        <Construction aria-hidden size={24} />
      </div>
      <h1 className="text-3xl font-bold text-[var(--text-primary)]">{title}</h1>
      <p className="mt-1 max-w-measure text-sm text-[var(--text-secondary)]">{description}</p>

      <Link to="/" className="chef-target chef-pressable mt-4 flex items-center gap-2 rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-[var(--surface-raised)] px-4 text-sm font-semibold text-[var(--text-primary)]">
        <ArrowLeft aria-hidden size={18} />
        Back to tools
      </Link>
    </div>
  );
};