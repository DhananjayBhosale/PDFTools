import React from 'react';
import { HashRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { Header } from './components/Layout/Header';
import { Background } from './components/UI/Background';
import { Dashboard } from './components/Tools/Dashboard';
import { MergePDF } from './components/Tools/MergePDF';
import { ImageToPDF } from './components/Tools/ImageToPDF';
import { SplitPDF } from './components/Tools/SplitPDF';
import { RotatePDF } from './components/Tools/RotatePDF';
import { CompressPDF } from './components/Tools/CompressPDF';
import { SecurityPDF } from './components/Tools/SecurityPDF';
import { MetadataPDF } from './components/Tools/MetadataPDF';
import { ReorderPDF } from './components/Tools/ReorderPDF';
import { DeletePages } from './components/Tools/DeletePages';
import { PDFToImage } from './components/Tools/PDFToImage';
import { UnlockPDF } from './components/Tools/UnlockPDF';
import { FlattenPDF } from './components/Tools/FlattenPDF';
import { OCRPDF } from './components/Tools/OCRPDF';
import { EditPDF } from './components/Tools/EditPDF';
import { SignPDF } from './components/Tools/SignPDF';
import { ComparePDF } from './components/Tools/ComparePDF';
import { AnimatePresence, motion } from 'framer-motion';

// Wrapper for animated routes
const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
        className="flex-1 w-full"
      >
        <Routes location={location}>
          <Route path="/" element={<Dashboard />} />
          
          {/* Tier 1: Hero Tools */}
          <Route path="/compress" element={<CompressPDF />} />
          <Route path="/merge" element={<MergePDF />} />
          <Route path="/split" element={<SplitPDF />} />
          <Route path="/edit" element={<EditPDF />} />
          <Route path="/pdf-to-jpg" element={<PDFToImage />} />
          <Route path="/image-to-pdf" element={<ImageToPDF />} />
          <Route path="/sign" element={<SignPDF />} />

          {/* Tier 2: Quick Tools */}
          <Route path="/delete-pages" element={<DeletePages />} />
          <Route path="/reorder" element={<ReorderPDF />} />
          <Route path="/rotate" element={<RotatePDF />} />
          <Route path="/protect" element={<SecurityPDF />} />
          <Route path="/unlock" element={<UnlockPDF />} />
          <Route path="/extract" element={<SplitPDF />} /> 
          <Route path="/metadata" element={<MetadataPDF />} />

          {/* Tier 3: Advanced */}
          <Route path="/flatten" element={<FlattenPDF />} />
          <Route path="/compare" element={<ComparePDF />} />
          <Route path="/ocr" element={<OCRPDF />} />
          
          <Route path="*" element={<Dashboard />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <div className="min-h-screen flex flex-col font-sans">
        <Background />
        <Header />
        <main className="flex-1 w-full max-w-7xl mx-auto flex flex-col">
           <AnimatedRoutes />
        </main>
      </div>
    </Router>
  );
};

export default App;
