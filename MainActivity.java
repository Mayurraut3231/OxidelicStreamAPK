package com.oxidelicstream.app;

import android.annotation.SuppressLint;
import android.graphics.Bitmap;
import android.os.Build;
import android.os.Bundle;
import android.os.Message;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.content.Intent;
import android.net.Uri;
import android.app.AlertDialog;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;
import androidx.webkit.WebResourceErrorCompat;
import androidx.webkit.WebResourceRequestCompat;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;

import org.json.JSONObject;

import java.net.URL;
import java.io.BufferedReader;
import java.io.InputStreamReader;

public class MainActivity extends AppCompatActivity {
    private static final String HOME_URL = "https://appassets.androidplatform.net/assets/site/index.html";

    private SwipeRefreshLayout swipeRefreshLayout;
    private FrameLayout rootContainer;
    private FrameLayout fullscreenContainer;
    private WebView webView;
    private LinearLayout loadingOverlay;
    private LinearLayout errorOverlay;
    private ProgressBar progressBar;
    private TextView loadingText;
    private View customView;
    private WebChromeClient.CustomViewCallback customViewCallback;
    private WebViewAssetLoader assetLoader;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        rootContainer = findViewById(R.id.root_container);
        fullscreenContainer = findViewById(R.id.fullscreen_container);
        swipeRefreshLayout = findViewById(R.id.swipe_refresh);
        webView = findViewById(R.id.web_view);
        loadingOverlay = findViewById(R.id.loading_overlay);
        errorOverlay = findViewById(R.id.error_overlay);
        progressBar = findViewById(R.id.progress_bar);
        loadingText = findViewById(R.id.loading_text);

        assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        swipeRefreshLayout.setColorSchemeResources(android.R.color.holo_red_light, android.R.color.holo_orange_light);
        swipeRefreshLayout.setOnRefreshListener(() -> webView.reload());

        configureWebView();

        // 🔥 CHECK FOR UPDATE
        checkForUpdate();

        findViewById(R.id.retry_button).setOnClickListener(v -> {
            showLoading(getString(R.string.loading_site));
            errorOverlay.setVisibility(View.GONE);
            webView.reload();
        });

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            loadHome();
        }
    }

    @SuppressLint("ClickableViewAccessibility")
    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setLoadsImagesAutomatically(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);

        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);
        webView.setBackgroundColor(0xFF000000);

        webView.setWebViewClient(new OxidelicWebViewClient());
        webView.setWebChromeClient(new OxidelicChromeClient());
    }

    private void loadHome() {
        showLoading(getString(R.string.loading_site));
        webView.loadUrl(HOME_URL);
    }

    private void showLoading(String message) {
        loadingText.setText(message);
        loadingOverlay.setVisibility(View.VISIBLE);
        progressBar.setVisibility(View.VISIBLE);
    }

    private void hideLoading() {
        swipeRefreshLayout.setRefreshing(false);
        loadingOverlay.setVisibility(View.GONE);
        progressBar.setVisibility(View.GONE);
    }

    private boolean isInternalAppUrl(@Nullable android.net.Uri uri) {
        return uri != null
                && "https".equalsIgnoreCase(uri.getScheme())
                && "appassets.androidplatform.net".equalsIgnoreCase(uri.getHost());
    }

    private void showError() {
        hideLoading();
        errorOverlay.setVisibility(View.VISIBLE);
    }

    // 🔥 UPDATE FUNCTION
    void checkForUpdate() {
        new Thread(() -> {
            try {
                URL url = new URL("https://raw.githubusercontent.com/Mayurraut3231/OxidelicStreamAPK/main/version.json");
                BufferedReader reader = new BufferedReader(new InputStreamReader(url.openStream()));
                StringBuilder json = new StringBuilder();
                String line;

                while ((line = reader.readLine()) != null) {
                    json.append(line);
                }

                JSONObject obj = new JSONObject(json.toString());
                int latestVersion = obj.getInt("version");

                int currentVersion = 2; // 👈 CHANGE THIS WHEN YOU UPDATE APP

                if (latestVersion > currentVersion) {
                    String apkUrl = obj.getString("apk_url");

                    runOnUiThread(() -> {
                        new AlertDialog.Builder(MainActivity.this)
                                .setTitle("Update Available")
                                .setMessage("New version available. Please update.")
                                .setPositiveButton("Update", (d, w) -> {
                                    Intent i = new Intent(Intent.ACTION_VIEW);
                                    i.setData(Uri.parse(apkUrl));
                                    startActivity(i);
                                })
                                .setCancelable(false)
                                .show();
                    });
                }

            } catch (Exception e) {
                e.printStackTrace();
            }
        }).start();
    }

    private void enterFullscreen(View view, WebChromeClient.CustomViewCallback callback) {
        if (customView != null) {
            callback.onCustomViewHidden();
            return;
        }

        customView = view;
        customViewCallback = callback;
        fullscreenContainer.removeAllViews();
        fullscreenContainer.addView(view, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));
        fullscreenContainer.setVisibility(View.VISIBLE);
        swipeRefreshLayout.setVisibility(View.GONE);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }

    private void exitFullscreen() {
        if (customView == null) return;

        fullscreenContainer.removeAllViews();
        fullscreenContainer.setVisibility(View.GONE);
        swipeRefreshLayout.setVisibility(View.VISIBLE);
        customView = null;

        if (customViewCallback != null) {
            customViewCallback.onCustomViewHidden();
            customViewCallback = null;
        }

        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
    }

    @Override
    public void onBackPressed() {
        if (customView != null) {
            exitFullscreen();
            return;
        }
        if (webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }

    private final class OxidelicWebViewClient extends WebViewClientCompat {}
    private final class OxidelicChromeClient extends WebChromeClient {}
}