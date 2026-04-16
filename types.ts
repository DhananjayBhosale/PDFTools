import React from 'react';

export interface PDFFile {
  id: string;
  file: File;
  name: string;
  size: number;
  previewUrl?: string;
  pageCount?: number;
}

export interface ProcessingStatus {
  isProcessing: boolean;
  progress: number; // 0 to 100
  message: string;
  error?: string;
}

export interface ToolRoute {
  path: string;
  label: string;
  icon: React.ComponentType<any>;
  description: string;
  color: string;
  category: 'core' | 'convert' | 'security' | 'pages';
  tier: 1 | 2 | 3; // 1 = Hero, 2 = Quick, 3 = Advanced
  experimental?: boolean;
  keywords?: string[]; // For search filtering
}

export interface PDFMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
  producer?: string;
  creationDate?: Date;
  modificationDate?: Date;
}
