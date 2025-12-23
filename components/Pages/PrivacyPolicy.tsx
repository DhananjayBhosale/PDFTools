
import React from 'react';
import { SEOHead } from '../SEO/SEOHead';
import { Link } from 'react-router-dom';
import { Shield } from 'lucide-react';

export const PrivacyPolicy: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <SEOHead 
        title="Privacy Policy - ZenPDF"
        description="Read our privacy policy. We do not store your files. All PDF processing happens locally in your browser."
      />
      
      <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="text-green-500" size={32} />
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Privacy Policy</h1>
        </div>

        <div className="prose dark:prose-invert max-w-none text-slate-600 dark:text-slate-400">
          <p className="text-lg leading-relaxed mb-6">
            At ZenPDF, we believe your data belongs to you. Our architecture is fundamentally different from most other PDF tools on the web.
          </p>

          <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-8 mb-4">No Server Uploads</h2>
          <p>
            ZenPDF is a <strong>client-side application</strong>. This means that all PDF processing (merging, splitting, compressing, etc.) happens exclusively within your web browser using WebAssembly technology. Your files are <strong>never</strong> uploaded to our servers, stored in a database, or transmitted over the internet to be processed.
          </p>

          <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-8 mb-4">No Data Storage</h2>
          <p>
            Since we don't have a backend database for file processing, we cannot store your documents even if we wanted to. Once you close the tab or refresh the page, your loaded files are cleared from your browser's memory.
          </p>

          <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-8 mb-4">Offline Capability</h2>
          <p>
            ZenPDF is a Progressive Web App (PWA). Once loaded, it can function entirely offline. You can disconnect your internet connection before opening your files to verify that no network traffic occurs during processing.
          </p>

          <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-8 mb-4">Analytics</h2>
          <p>
            We use privacy-friendly analytics (like simple page view counting) that do not track personal identities or file contents. We do not use cookies for tracking purposes.
          </p>

          <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800">
            <Link to="/" className="text-blue-600 hover:text-blue-700 font-medium">← Back to Home</Link>
          </div>
        </div>
      </div>
    </div>
  );
};
