import React, { useState } from 'react';
import { CloudOff, HardDrive, ShieldCheck, WifiOff } from 'lucide-react';
import { getWorkspaceSettings, updateWorkspaceSettings } from '../../services/workspace';
import { Button, Sheet } from './Primitives';
import { useHaptics } from '../../hooks/useWorkspaceRuntime';

/** First run. Four short facts about local processing and retention. */
const POINTS = [
  {
    icon: ShieldCheck,
    title: 'Your documents stay on this device.',
  },
  {
    icon: CloudOff,
    title: 'Nothing is uploaded. No account is needed.',
  },
  {
    icon: WifiOff,
    title: 'Tools work offline after the app loads.',
  },
  {
    icon: HardDrive,
    title: 'Results stay here until you delete them.',
  },
] as const;

export const Onboarding: React.FC = () => {
  const [open, setOpen] = useState(() => !getWorkspaceSettings().onboardingComplete);
  const haptic = useHaptics();

  const finish = () => {
    updateWorkspaceSettings({ onboardingComplete: true });
    haptic('commit');
    setOpen(false);
  };

  return (
    <Sheet
      open={open}
      onClose={finish}
      title="Before you start"
      footer={
        <Button tone="primary" block onClick={finish}>
          Start using PDF Chef
        </Button>
      }
    >
      <ul className="space-y-2">
        {POINTS.map(({ icon: Icon, title }) => (
          <li key={title} className="flex items-center gap-3">
            <span
              aria-hidden
              className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius-control)] bg-[var(--accent-quiet)] text-[var(--accent-on-quiet)]"
            >
              <Icon size={18} strokeWidth={1.9} />
            </span>
            <span className="min-w-0 font-medium text-[var(--text-primary)]">{title}</span>
          </li>
        ))}
      </ul>
    </Sheet>
  );
};
