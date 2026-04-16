import React from 'react';

export const Background = () => {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-gradient-to-b from-blue-50 via-cyan-50 to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.10),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.12),transparent_35%)] dark:bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.16),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.12),transparent_34%)]" />
    </div>
  );
};
