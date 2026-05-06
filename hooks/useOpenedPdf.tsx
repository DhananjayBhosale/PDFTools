import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import type { PDFFile } from '../types';

interface OpenedPdfContextValue {
  openedPdf: PDFFile | null;
  setOpenedPdfFile: (file: File) => PDFFile;
  clearOpenedPdf: () => void;
}

const OpenedPdfContext = createContext<OpenedPdfContextValue | null>(null);

const isPdfFile = (file: File) =>
  file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

export const OpenedPdfProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [openedPdf, setOpenedPdf] = useState<PDFFile | null>(null);
  const navigate = useNavigate();

  const setOpenedPdfFile = (file: File) => {
    const nextPdf: PDFFile = {
      id: uuidv4(),
      file,
      name: file.name,
      size: file.size,
    };

    setOpenedPdf(nextPdf);
    return nextPdf;
  };

  useEffect(() => {
    const launchQueue = (window as any).launchQueue;
    if (!launchQueue?.setConsumer) return;

    launchQueue.setConsumer(async (launchParams: any) => {
      const handle = launchParams?.files?.[0];
      if (!handle?.getFile) return;

      const file = await handle.getFile();
      if (!isPdfFile(file)) return;

      setOpenedPdfFile(file);
      navigate('/view');
    });
  }, [navigate]);

  const value = useMemo<OpenedPdfContextValue>(
    () => ({
      openedPdf,
      setOpenedPdfFile,
      clearOpenedPdf: () => setOpenedPdf(null),
    }),
    [openedPdf],
  );

  return <OpenedPdfContext.Provider value={value}>{children}</OpenedPdfContext.Provider>;
};

export const useOpenedPdf = () => {
  const context = useContext(OpenedPdfContext);
  if (!context) {
    throw new Error('useOpenedPdf must be used inside OpenedPdfProvider');
  }
  return context;
};
