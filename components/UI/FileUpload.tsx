import React, { useRef, useState } from 'react';
import { UploadCloud, FileType } from 'lucide-react';
import { motion } from 'framer-motion';

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  accept: string;
  multiple?: boolean;
  label?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({ 
  onFilesSelected, 
  accept, 
  multiple = false,
  label = "Drop your PDF here"
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      onFilesSelected(files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      onFilesSelected(files);
    }
    // Reset value so the same file can be selected again if needed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      className={`
        relative overflow-hidden rounded-3xl border-2 border-dashed transition-all duration-300 cursor-pointer
        flex flex-col items-center justify-center p-12 text-center group
        ${isDragging 
          ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-500/10 scale-[1.02]' 
          : 'border-slate-300 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-slate-50 dark:hover:bg-slate-800/50'
        }
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
    >
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept={accept}
        multiple={multiple}
        onChange={handleFileChange}
      />
      
      <div className={`p-4 rounded-full mb-4 transition-colors duration-300 ${isDragging ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 group-hover:text-blue-600 dark:group-hover:text-blue-400'}`}>
        <UploadCloud size={32} />
      </div>
      
      <h3 className="text-xl font-semibold text-slate-800 dark:text-white mb-2">{label}</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
        Or click to browse. Files are processed locally and never uploaded.
      </p>
    </motion.div>
  );
};