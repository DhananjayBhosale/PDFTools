package com.dhananjaytech.zenpdf_allpdftoolsinoneplace;

import com.dhananjaytech.zenpdf_allpdftoolsinoneplace.documents.AndroidDocumentsPlugin;
import com.dhananjaytech.zenpdf_allpdftoolsinoneplace.legacy.AndroidLegacyInspectorPlugin;
import com.dhananjaytech.zenpdf_allpdftoolsinoneplace.legacy.AndroidLegacySettingsWriterPlugin;
import com.dhananjaytech.zenpdf_allpdftoolsinoneplace.scanner.AndroidDocumentScannerPlugin;
import com.dhananjaytech.zenpdf_allpdftoolsinoneplace.security.PdfChefWebViewPolicy;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import com.getcapacitor.CapConfig;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Bitmap;
import android.webkit.ServiceWorkerClient;
import android.webkit.ServiceWorkerController;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import java.io.ByteArrayInputStream;

/** Capacitor host that registers the fixed legacy bridge surface before bridge startup. */
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(AndroidLegacyInspectorPlugin.class);
        registerPlugin(AndroidLegacySettingsWriterPlugin.class);
        registerPlugin(AndroidAppMetadataPlugin.class);
        registerPlugin(AndroidStorageStatsPlugin.class);
        registerPlugin(AndroidDocumentsPlugin.class);
        registerPlugin(AndroidDocumentScannerPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    protected void load() {
        WebView webView = findViewById(com.getcapacitor.android.R.id.webview);
        config = CapConfig.loadDefault(this);
        if (webView == null || !PdfChefWebViewPolicy.isTrustedConfig(config)) {
            if (webView != null) webView.stopLoading();
            return;
        }

        // This runs before Bridge construction, where Capacitor registers plugins and calls loadUrl().
        PdfChefWebViewPolicy.apply(webView);
        super.load();
        configureWebViewBoundary(getBridge());
    }

    private void configureWebViewBoundary(Bridge bridge) {
        WebView webView = bridge.getWebView();
        if (!PdfChefWebViewPolicy.isTrustedConfig(bridge.getConfig())
                || !PdfChefWebViewPolicy.isPackagedOrigin(bridge.getAppUrl())) {
            webView.stopLoading();
            return;
        }
        PdfChefWebViewPolicy.apply(webView);
        bridge.setWebViewClient(new PdfChefWebViewClient(bridge));
        ServiceWorkerController.getInstance().setServiceWorkerClient(new ServiceWorkerClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebResourceRequest request) {
                if (PdfChefWebViewPolicy.isPackagedOrigin(request.getUrl().toString())) {
                    WebResourceResponse response = bridge.getLocalServer().shouldInterceptRequest(request);
                    if (response != null) return response;
                }
                return blockedResponse();
            }
        });
    }

    private final class PdfChefWebViewClient extends BridgeWebViewClient {
        PdfChefWebViewClient(Bridge bridge) {
            super(bridge);
        }

        @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            PdfChefWebViewPolicy.Navigation decision = PdfChefWebViewPolicy.decide(request.getUrl().toString());
            if (decision == PdfChefWebViewPolicy.Navigation.ALLOW_PACKAGED_ORIGIN) return false;
            if (request.isForMainFrame()
                    && decision == PdfChefWebViewPolicy.Navigation.OPEN_EXTERNAL_BROWSER) {
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, request.getUrl()));
                } catch (ActivityNotFoundException ignored) {
                    // The navigation remains outside the bridge when no browser can handle it.
                }
            }
            return true;
        }

        @Override public void onPageStarted(WebView view, String url, Bitmap favicon) {
            if (!PdfChefWebViewPolicy.isPackagedOrigin(url)) {
                view.stopLoading();
                return;
            }
            super.onPageStarted(view, url, favicon);
        }

        @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            if (PdfChefWebViewPolicy.isPackagedOrigin(request.getUrl().toString())) {
                return super.shouldInterceptRequest(view, request);
            }
            return blockedResponse();
        }
    }

    private static WebResourceResponse blockedResponse() {
        return new WebResourceResponse("text/plain", "UTF-8", new ByteArrayInputStream(new byte[0]));
    }
}
