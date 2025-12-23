import React, { Suspense } from 'react';
import { HashRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { Header } from './components/Layout/Header';
import { Background } from './components/UI/Background';
import { Dashboard } from './components/Tools/Dashboard';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

// Lazy Load Tools to split code chunks (pdf-lib, etc.)
// This prevents the main bundle from including heavy PDF libraries until needed.
const MergePDF = React.lazy(() => import('./components/Tools/MergePDF').then(module => ({ default: module.MergePDF })));
const ImageToPDF = React.lazy(() => import('./components/Tools/ImageToPDF').then(module => ({ default: module.ImageToPDF })));
const SplitPDF = React.lazy(() => import('./components/Tools/SplitPDF').then(module => ({ default: module.SplitPDF })));
const RotatePDF = React.lazy(() => import('./components/Tools/RotatePDF').then(module => ({ default: module.RotatePDF })));
const CompressPDF = React.lazy(() => import('./components/Tools/CompressPDF').then(module => ({ default: module.CompressPDF })));
const SecurityPDF = React.lazy(() => import('./components/Tools/SecurityPDF').then(module => ({ default: module.SecurityPDF })));
const MetadataPDF = React.lazy(() => import('./components/Tools/MetadataPDF').then(module => ({ default: module.MetadataPDF })));
const ReorderPDF = React.lazy(() => import('./components/Tools/ReorderPDF').then(module => ({ default: module.ReorderPDF })));
const DeletePages = React.lazy(() => import('./components/Tools/DeletePages').then(module => ({ default: module.DeletePages })));
const PDFToImage = React.lazy(() => import('./components/Tools/PDFToImage').then(module => ({ default: module.PDFToImage })));
const UnlockPDF = React.lazy(() => import('./components/Tools/UnlockPDF').then(module => ({ default: module.UnlockPDF })));
const FlattenPDF = React.lazy(() => import('./components/Tools/FlattenPDF').then(module => ({ default: module.FlattenPDF })));
const OCRPDF = React.lazy(() => import('./components/Tools/OCRPDF').then(module => ({ default: module.OCRPDF })));
const EditPDF = React.lazy(() => import('./components/Tools/EditPDF').then(module => ({ default: module.EditPDF })));
const SignPDF = React.lazy(() => import('./components/Tools/SignPDF').then(module => ({ default: module.SignPDF })));
const ComparePDF = React.lazy(() => import('./components/Tools/ComparePDF').then(module => ({ default: module.ComparePDF })));
const PrivacyPolicy = React.lazy(() => import('./components/Pages/PrivacyPolicy').then(module => ({ default: module.PrivacyPolicy })));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[50vh]">
    <div className="flex flex-col items-center gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      <p className="text-sm text-slate-500 font-medium">Loading tool...</p>
    </div>
  </div>
);

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
        <Suspense fallback={<PageLoader />}>
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
            
            {/* Pages */}
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            
            <Route path="*" element={<Dashboard />} />
          </Routes>
        </Suspense>
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