
import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface SEOHeadProps {
  title: string;
  description: string;
  path?: string;
  keywords?: string[];
}

export const SEOHead: React.FC<SEOHeadProps> = ({ title, description, path, keywords }) => {
  const location = useLocation();
  const currentUrl = `https://zenpdf.app${path || location.pathname}`;

  useEffect(() => {
    // Update Title
    document.title = title;

    // Update Meta Tags
    const metaTags = {
      'description': description,
      'og:title': title,
      'og:description': description,
      'og:url': currentUrl,
      'twitter:title': title,
      'twitter:description': description,
      'twitter:url': currentUrl,
    };

    Object.entries(metaTags).forEach(([name, content]) => {
      // Try name, property, then itemProp
      let element = document.querySelector(`meta[name="${name}"]`) || 
                    document.querySelector(`meta[property="${name}"]`);

      if (!element) {
        element = document.createElement('meta');
        if (name.startsWith('og:') || name.startsWith('twitter:')) {
            element.setAttribute('property', name);
        } else {
            element.setAttribute('name', name);
        }
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    });

    // Update Canonical
    let linkCanonical = document.querySelector('link[rel="canonical"]');
    if (!linkCanonical) {
      linkCanonical = document.createElement('link');
      linkCanonical.setAttribute('rel', 'canonical');
      document.head.appendChild(linkCanonical);
    }
    linkCanonical.setAttribute('href', currentUrl);

  }, [title, description, currentUrl]);

  return null;
};
