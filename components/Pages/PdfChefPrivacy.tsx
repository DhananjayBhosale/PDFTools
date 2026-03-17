import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield, AlertTriangle, Info } from 'lucide-react';
import { SEOHead } from '../SEO/SEOHead';

export const PdfChefPrivacy: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      <SEOHead 
        title="Privacy Policy - PDF Chef"
        description="Privacy Policy for the PDF Chef Android application."
      />
      
      <div className="mb-8">
        <Link to="/" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
          <ArrowLeft size={16} className="mr-2" />
          Back to Home
        </Link>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="bg-slate-50 dark:bg-slate-800/50 px-8 py-10 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center">
              <Shield size={24} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Privacy Policy for PDF Chef</h1>
              <p className="text-slate-500 dark:text-slate-400 mt-1">Effective Date: [Insert Date]</p>
            </div>
          </div>
        </div>

        {/* Play Store Summary */}
        <div className="px-8 py-6 bg-blue-50/50 dark:bg-blue-900/10 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-lg font-bold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
            <Info size={18} /> Play Store Summary
          </h2>
          <div className="text-sm text-blue-800 dark:text-blue-200 space-y-3">
            <p>
              PDF Chef is designed with your privacy as our top priority. As a local-first document utility, PDF Chef processes your PDF files and images directly on your Android device. We do not upload your documents, signatures, or images to our servers for processing.
            </p>
            <p>
              To function properly, the app requires access to your device's storage to read and save your documents, and access to your camera if you choose to scan physical documents into PDFs. These permissions are strictly used for providing the app's core features.
            </p>
            <p>
              We do not require you to create an account, and we do not collect, sell, or share your personal data with third parties. [Optional: We may use standard third-party services like Google Analytics or Crashlytics solely to monitor app performance and fix bugs, which collect anonymous usage data.]
            </p>
          </div>
        </div>

        {/* Full Policy Content */}
        <div className="px-8 py-10 prose prose-slate dark:prose-invert max-w-none">
          <h3>1. Introduction</h3>
          <p>
            Welcome to PDF Chef ("we," "our," or "us"). We are committed to protecting your privacy. This Privacy Policy explains how our Android application, PDF Chef (the "App"), collects, uses, and safeguards your information when you use our services.
          </p>

          <h3>2. Information We Collect</h3>
          <p>
            PDF Chef is designed to minimize data collection. 
            <strong> We do not require you to create an account, and we do not collect your name, email address, or other direct personal identifiers.</strong>
          </p>

          <h3>3. How the App Works</h3>
          <p>
            PDF Chef is a local-first utility application. This means the core functionality of the App—including merging, splitting, signing, compressing, and converting PDFs—is performed locally on your device's hardware.
          </p>

          <h3>4. File and Document Processing</h3>
          <p>
            <strong>Your files remain on your device.</strong> When you use PDF Chef to edit, convert, or modify documents and images, the processing happens on your phone or tablet. We do not upload, store, or transmit your documents, images, signatures, or watermarks to our servers.
          </p>

          <h3>5. Camera, Storage, and File Access Permissions</h3>
          <p>To provide its features, PDF Chef requests the following device permissions:</p>
          <ul>
            <li><strong>Storage / Media / Files:</strong> Required to select documents or images from your device for editing, and to save the modified PDF files back to your device.</li>
            <li><strong>Camera:</strong> Required only if you use the "Scan to PDF" feature to capture photos of physical documents. Images captured are processed locally to create your PDF.</li>
          </ul>
          <p>These permissions are used strictly for the App's core functionality. We do not access files or camera data in the background.</p>

          <h3>6. Server Uploads</h3>
          <p>
            As stated above, PDF Chef processes your files locally. We do not upload your personal files to our servers. [If applicable: Any features requiring cloud processing will explicitly ask for your consent before uploading a specific file.]
          </p>

          <h3>7. Data Sharing and Third-Party Sharing</h3>
          <p>
            <strong>We do not sell your personal data.</strong> Because we do not collect personal data or user files, we have nothing to sell or share with data brokers.
          </p>

          <h3>8. Analytics, Diagnostics, and Crash Reporting</h3>
          <p>
            [Select one of the following and delete the other:]<br/>
            <em>Option A (No Analytics):</em> We do not use any analytics or crash reporting tools. The App operates entirely offline without sending diagnostic data.<br/>
            <em>Option B (Standard Analytics):</em> To improve the App, we may use third-party diagnostic tools (such as Firebase Crashlytics or Google Analytics for Firebase). These tools collect anonymous, aggregated data about app crashes, device models, and general feature usage. This data contains no personally identifiable information or document content and is used solely to fix bugs and improve performance.
          </p>

          <h3>9. Advertising</h3>
          <p>
            [Select one of the following and delete the other:]<br/>
            <em>Option A (No Ads):</em> PDF Chef does not display third-party advertisements.<br/>
            <em>Option B (Ad-Supported):</em> PDF Chef uses third-party advertising networks (such as Google AdMob) to provide the App for free. These networks may use anonymous device identifiers (such as the Android Advertising ID) to serve personalized or non-personalized ads. You can manage your ad tracking preferences in your Android device settings.
          </p>

          <h3>10. Third-Party Services and SDKs</h3>
          <p>
            The App may integrate third-party Software Development Kits (SDKs) to provide specific functionality [e.g., ads or analytics, if selected above]. These third parties have their own privacy policies. We encourage you to review the privacy policies of any integrated services, such as Google Play Services.
          </p>

          <h3>11. Data Retention</h3>
          <p>
            Because we do not collect or store your files on our servers, we do not have a data retention policy for your documents. Your files are retained on your device for as long as you choose to keep them. [If using analytics: Anonymous diagnostic data is retained by our third-party providers in accordance with their respective privacy policies.]
          </p>

          <h3>12. Children's Privacy</h3>
          <p>
            PDF Chef is a general utility application and is not directed at children under the age of 13. We do not knowingly collect personal information from children. If you are a parent or guardian and believe your child has provided us with personal information, please contact us so we can take necessary action.
          </p>

          <h3>13. Security</h3>
          <p>
            We rely on the robust security features of the Android operating system to protect your data. By processing files locally, we significantly reduce the risk of data breaches. However, please ensure your device is secured with a PIN, password, or biometric lock to protect the files stored on it.
          </p>

          <h3>14. User Rights and Contact Information</h3>
          <p>
            Because we do not collect personal data, there is no user profile for you to delete or data for us to export. If you have any questions, concerns, or requests regarding this Privacy Policy or the App's privacy practices, please contact us at:
          </p>
          <p>
            <strong>Email:</strong> [Insert Contact Email]<br/>
            <strong>Developer:</strong> [Insert Developer/Company Name]<br/>
            <strong>Website:</strong> [Insert Website URL, if applicable]
          </p>

          <h3>15. Changes to this Privacy Policy</h3>
          <p>
            We may update this Privacy Policy from time to time to reflect changes in our practices or legal requirements. We will notify you of any material changes by updating the "Effective Date" at the top of this policy and, if necessary, providing a notice within the App. We encourage you to review this policy periodically.
          </p>
        </div>

        {/* Developer Notes */}
        <div className="bg-amber-50 dark:bg-amber-900/10 px-8 py-8 border-t border-amber-200 dark:border-amber-800">
          <h2 className="text-lg font-bold text-amber-900 dark:text-amber-100 mb-4 flex items-center gap-2">
            <AlertTriangle size={18} /> Developer Notes (Remove Before Publishing)
          </h2>
          <div className="text-sm text-amber-800 dark:text-amber-200 space-y-4">
            <p><strong>Placeholders to replace:</strong></p>
            <ul className="list-disc pl-5 space-y-1">
              <li><code>[Insert Date]</code> - The date this policy goes live.</li>
              <li><code>[Insert Contact Email]</code> - Your support or privacy email address.</li>
              <li><code>[Insert Developer/Company Name]</code> - Your name or company name as listed on Google Play.</li>
              <li><code>[Insert Website URL, if applicable]</code> - Your website, or remove this line.</li>
            </ul>
            
            <p className="mt-4"><strong>Implementation Checks:</strong></p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Analytics & Crash Reporting (Section 8):</strong> Choose Option A or B based on whether you actually integrated Firebase/Crashlytics. Delete the other option.</li>
              <li><strong>Advertising (Section 9):</strong> Choose Option A or B based on whether you show ads (like AdMob). Delete the other option.</li>
              <li><strong>Cloud Features (Section 6):</strong> If you ever add a feature that uploads a PDF to a server (e.g., for heavy OCR), you must update this policy to reflect that.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
