import React, { Suspense } from 'react';
import { HashRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { Header } from './components/Layout/Header';
import { Background } from './components/UI/Background';
import { Dashboard } from './components/Tools/Dashboard';
import { RouteSEO } from './components/SEO/RouteSEO';

const MergePDF = React.lazy(() => import('./components/Tools/MergePDF').then((module) => ({ default: module.MergePDF })));
const ImageToPDF = React.lazy(() => import('./components/Tools/ImageToPDF').then((module) => ({ default: module.ImageToPDF })));
const SplitPDF = React.lazy(() => import('./components/Tools/SplitPDF').then((module) => ({ default: module.SplitPDF })));
const RotatePDF = React.lazy(() => import('./components/Tools/RotatePDF').then((module) => ({ default: module.RotatePDF })));
const CompressPDF = React.lazy(() => import('./components/Tools/CompressPDF').then((module) => ({ default: module.CompressPDF })));
const SecurityPDF = React.lazy(() => import('./components/Tools/SecurityPDF').then((module) => ({ default: module.SecurityPDF })));
const MetadataPDF = React.lazy(() => import('./components/Tools/MetadataPDF').then((module) => ({ default: module.MetadataPDF })));
const ReorderPDF = React.lazy(() => import('./components/Tools/ReorderPDF').then((module) => ({ default: module.ReorderPDF })));
const DeletePages = React.lazy(() => import('./components/Tools/DeletePages').then((module) => ({ default: module.DeletePages })));
const ExtractPages = React.lazy(() => import('./components/Tools/ExtractPages').then((module) => ({ default: module.ExtractPages })));
const PDFToImage = React.lazy(() => import('./components/Tools/PDFToImage').then((module) => ({ default: module.PDFToImage })));
const UnlockPDF = React.lazy(() => import('./components/Tools/UnlockPDF').then((module) => ({ default: module.UnlockPDF })));
const FlattenPDF = React.lazy(() => import('./components/Tools/FlattenPDF').then((module) => ({ default: module.FlattenPDF })));
const OCRPDF = React.lazy(() => import('./components/Tools/OCRPDF').then((module) => ({ default: module.OCRPDF })));
const EditPDF = React.lazy(() => import('./components/Tools/EditPDF').then((module) => ({ default: module.EditPDF })));
const SignPDF = React.lazy(() => import('./components/Tools/SignPDF').then((module) => ({ default: module.SignPDF })));
const ComparePDF = React.lazy(() => import('./components/Tools/ComparePDF').then((module) => ({ default: module.ComparePDF })));
const WatermarkPDF = React.lazy(() => import('./components/Tools/WatermarkPDF').then((module) => ({ default: module.WatermarkPDF })));
const PageNumbersPDF = React.lazy(() => import('./components/Tools/PageNumbersPDF').then((module) => ({ default: module.PageNumbersPDF })));
const RepairPDF = React.lazy(() => import('./components/Tools/RepairPDF').then((module) => ({ default: module.RepairPDF })));
const MakePDF = React.lazy(() => import('./components/Tools/MakePDF').then((module) => ({ default: module.MakePDF })));
const PrivacyPolicy = React.lazy(() => import('./components/Pages/PrivacyPolicy').then((module) => ({ default: module.PrivacyPolicy })));
const PdfChefPrivacy = React.lazy(() => import('./components/Pages/PdfChefPrivacy').then((module) => ({ default: module.PdfChefPrivacy })));

const PageLoader = () => (
  <div className="flex min-h-[50vh] items-center justify-center">
    <div className="flex flex-col items-center gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
      <p className="text-sm font-medium text-slate-500">Loading tool workspace...</p>
    </div>
  </div>
);

const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.24 }}
        className="flex-1"
      >
        <Suspense fallback={<PageLoader />}>
          <Routes location={location}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/compress" element={<CompressPDF />} />
            <Route path="/merge" element={<MergePDF />} />
            <Route path="/split" element={<SplitPDF />} />
            <Route path="/edit" element={<EditPDF />} />
            <Route path="/pdf-to-jpg" element={<PDFToImage />} />
            <Route path="/image-to-pdf" element={<ImageToPDF />} />
            <Route path="/make-pdf" element={<MakePDF />} />
            <Route path="/sign" element={<SignPDF />} />
            <Route path="/delete-pages" element={<DeletePages />} />
            <Route path="/reorder" element={<ReorderPDF />} />
            <Route path="/rotate" element={<RotatePDF />} />
            <Route path="/protect" element={<SecurityPDF />} />
            <Route path="/unlock" element={<UnlockPDF />} />
            <Route path="/extract" element={<ExtractPages />} />
            <Route path="/metadata" element={<MetadataPDF />} />
            <Route path="/flatten" element={<FlattenPDF />} />
            <Route path="/compare" element={<ComparePDF />} />
            <Route path="/ocr" element={<OCRPDF />} />
            <Route path="/watermark" element={<WatermarkPDF />} />
            <Route path="/page-numbers" element={<PageNumbersPDF />} />
            <Route path="/repair" element={<RepairPDF />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/pdf-chef-privacy" element={<PdfChefPrivacy />} />
            <Route path="*" element={<Dashboard />} />
          </Routes>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
};

const AppContent = () => {
  const location = useLocation();
  const isFullScreenTool = ['/image-to-pdf', '/pdf-to-jpg'].includes(location.pathname);

  return (
    <div className="min-h-screen font-sans text-slate-950 dark:text-white">
      <RouteSEO />
      <Background />
      {!isFullScreenTool && <Header />}
      <main className="flex flex-1 flex-col">
        <AnimatedRoutes />
      </main>
    </div>
  );
};

const App: React.FC = () => (
  <Router>
    <AppContent />
  </Router>
);

export default App;
