import React from 'react';
import { ProcessingStatus } from '../../types';

interface StatusToastProps {
  status: ProcessingStatus;
}

export const StatusToast: React.FC<StatusToastProps> = ({ status }) => {
  if (status.isProcessing) return null;

  const message = status.error || status.message;
  if (!message) return null;

  return (
    <div className={`fixed bottom-3 right-3 z-50 px-3 py-2 rounded-lg text-sm shadow-lg ${
      status.error ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
    }`}>
      {message}
    </div>
  );
};
