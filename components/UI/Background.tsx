import React from 'react';

export const Background = () => {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none bg-slate-50 dark:bg-slate-950">
      <div className="absolute top-[-10%] left-[-10%] w-[60vw] h-[60vw] bg-purple-300/20 dark:bg-purple-900/10 rounded-full blur-[100px] animate-blob mix-blend-multiply dark:mix-blend-screen" />
      <div className="absolute top-[10%] right-[-10%] w-[50vw] h-[50vw] bg-blue-300/20 dark:bg-blue-900/10 rounded-full blur-[100px] animate-blob animation-delay-2000 mix-blend-multiply dark:mix-blend-screen" />
      <div className="absolute bottom-[-10%] left-[20%] w-[50vw] h-[50vw] bg-cyan-300/20 dark:bg-cyan-900/10 rounded-full blur-[100px] animate-blob animation-delay-4000 mix-blend-multiply dark:mix-blend-screen" />
      
      {/* Noise Texture Overlay */}
      <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]" 
           style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}>
      </div>
    </div>
  );
};
