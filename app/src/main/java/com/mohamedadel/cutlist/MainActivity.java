package com.mohamedadel.cutlist;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ContentValues;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.KeyEvent;
import android.webkit.JavascriptInterface;
import android.webkit.JsResult;
import android.webkit.MimeTypeMap;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.Toast;

import androidx.webkit.WebViewAssetLoader;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

public class MainActivity extends Activity {

    private static final String HOST = "appassets.androidplatform.net";
    private static final String START_URL = "https://" + HOST + "/assets/www/index.html";
    private static final int REQ_FILE_CHOOSER = 1001;
    private static final int REQ_SAVE_DOC = 1002;

    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private byte[] pendingSaveBytes;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#1C1C1C"));
        root.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);
        if (savedInstanceState == null) {
            showPhotoSplash(root);
        }

        final WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .setDomain(HOST)
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setBuiltInZoomControls(false);
        s.setSupportZoom(false);
        s.setMediaPlaybackRequiresUserGesture(true);

        webView.addJavascriptInterface(new NativeSaver(), "NativeSaver");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (HOST.equals(uri.getHost())) {
                    return false; // صفحات التطبيق نفسه
                }
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (Exception ignored) { }
                return true;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onJsAlert(WebView view, String url, String message, final JsResult result) {
                new AlertDialog.Builder(MainActivity.this)
                        .setMessage(message)
                        .setPositiveButton(android.R.string.ok, (d, w) -> result.confirm())
                        .setOnCancelListener(d -> result.confirm())
                        .show();
                return true;
            }

            @Override
            public boolean onJsConfirm(WebView view, String url, String message, final JsResult result) {
                new AlertDialog.Builder(MainActivity.this)
                        .setMessage(message)
                        .setPositiveButton(android.R.string.ok, (d, w) -> result.confirm())
                        .setNegativeButton(android.R.string.cancel, (d, w) -> result.cancel())
                        .setOnCancelListener(d -> result.cancel())
                        .show();
                return true;
            }

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (filePathCallback != null) {
                    filePathCallback.onReceiveValue(null);
                }
                filePathCallback = callback;
                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*"); // الملفات (csv/txt/json) أنواعها مش موحّدة على أندرويد
                try {
                    startActivityForResult(Intent.createChooser(intent, "اختر ملف"), REQ_FILE_CHOOSER);
                } catch (Exception e) {
                    filePathCallback = null;
                    callback.onReceiveValue(null);
                    return false;
                }
                return true;
            }
        });

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            webView.loadUrl(START_URL);
        }
    }

    // شاشة البداية: صورة محمد بكامل الشاشة (تقرب وتبعد) وبعدها تختفي
    @SuppressWarnings("deprecation")
    private void showPhotoSplash(final FrameLayout root) {
        try {
            Bitmap bmp;
            try (java.io.InputStream is = getAssets().open("www/mohamed.jpg")) {
                bmp = BitmapFactory.decodeStream(is);
            }
            if (bmp == null) return;

            final FrameLayout splash = new FrameLayout(this);
            splash.setBackgroundColor(Color.parseColor("#1C1C1C"));

            ImageView bg = new ImageView(this);   // خلفية مالية الشاشة (نفس الصورة معتّمة)
            bg.setImageBitmap(bmp);
            bg.setScaleType(ImageView.ScaleType.CENTER_CROP);
            bg.setAlpha(0.45f);
            splash.addView(bg, new FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

            final ImageView fg = new ImageView(this);   // الصورة نفسها بعرض الشاشة
            fg.setImageBitmap(bmp);
            fg.setScaleType(ImageView.ScaleType.FIT_CENTER);
            splash.addView(fg, new FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

            root.addView(splash, new FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

            final View decor = getWindow().getDecorView();
            decor.setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);

            final Runnable done = () -> {
                decor.setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);
                root.removeView(splash);
            };

            // تقريب ثم تبعيد ثم اختفاء
            fg.animate().scaleX(1.18f).scaleY(1.18f).setDuration(750).withEndAction(() ->
                    fg.animate().scaleX(1f).scaleY(1f).setDuration(650).withEndAction(() ->
                            splash.animate().alpha(0f).setDuration(350).withEndAction(done).start()
                    ).start()
            ).start();
        } catch (Exception ignored) { }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @Override
    @SuppressWarnings("deprecation")
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_SAVE_DOC) {
            byte[] bytes = pendingSaveBytes;
            pendingSaveBytes = null;
            if (resultCode == RESULT_OK && data != null && data.getData() != null && bytes != null) {
                try (OutputStream os = getContentResolver().openOutputStream(data.getData(), "wt")) {
                    os.write(bytes);
                    Toast.makeText(this, "تم حفظ الملف بنجاح", Toast.LENGTH_LONG).show();
                } catch (Exception e) {
                    Toast.makeText(this, "تعذّر حفظ الملف", Toast.LENGTH_LONG).show();
                }
            } else {
                Toast.makeText(this, "تم إلغاء الحفظ", Toast.LENGTH_SHORT).show();
            }
            return;
        }
        if (requestCode == REQ_FILE_CHOOSER && filePathCallback != null) {
            Uri[] results = null;
            if (resultCode == RESULT_OK && data != null && data.getData() != null) {
                results = new Uri[]{data.getData()};
            }
            filePathCallback.onReceiveValue(results);
            filePathCallback = null;
        }
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            // 1) لو في نافذة (modal) مفتوحة اقفلها
            webView.evaluateJavascript(
                    "(function(){try{var m=window.jQuery&&jQuery('.modal.in');"
                            + "if(m&&m.length){m.modal('hide');return 'closed';}}catch(e){}return 'none';})()",
                    value -> {
                        if (value != null && value.contains("closed")) {
                            return;
                        }
                        String url = webView.getUrl();
                        boolean onMainPage = url == null || url.contains("/index.html");
                        if (!onMainPage && webView.canGoBack()) {
                            webView.goBack();
                        } else {
                            finish();
                        }
                    });
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.removeJavascriptInterface("NativeSaver");
            webView.destroy();
        }
        super.onDestroy();
    }

    /** حفظ الملفات (PDF / صورة / CSV / مشروع) في مجلد التنزيلات. */
    public class NativeSaver {

        @JavascriptInterface
        public void saveText(String content, String filename, String mime) {
            save(content.getBytes(StandardCharsets.UTF_8), filename, mime);
        }

        @JavascriptInterface
        public void saveDataUrl(String dataUrl, String filename, String mime) {
            try {
                int comma = dataUrl.indexOf(',');
                String header = dataUrl.substring(0, comma);
                String body = dataUrl.substring(comma + 1);
                byte[] bytes;
                if (header.contains(";base64")) {
                    bytes = Base64.decode(body, Base64.DEFAULT);
                } else {
                    bytes = Uri.decode(body).getBytes(StandardCharsets.UTF_8);
                }
                if (mime == null || mime.isEmpty()) {
                    int semi = header.indexOf(';');
                    mime = header.substring(5, semi > 0 ? semi : header.length());
                }
                save(bytes, filename, mime);
            } catch (Exception e) {
                toast("تعذّر حفظ الملف");
            }
        }

        /** يفتح مدير الملفات (Save As) عشان المستخدم يختار مكان الحفظ. */
        @JavascriptInterface
        public void pickSaveText(String content, String filename, String mime) {
            pick(content.getBytes(StandardCharsets.UTF_8), filename, mime);
        }

        @JavascriptInterface
        public void pickSaveDataUrl(String dataUrl, String filename, String mime) {
            try {
                int comma = dataUrl.indexOf(',');
                String header = dataUrl.substring(0, comma);
                String body = dataUrl.substring(comma + 1);
                byte[] bytes = header.contains(";base64")
                        ? Base64.decode(body, Base64.DEFAULT)
                        : Uri.decode(body).getBytes(StandardCharsets.UTF_8);
                pick(bytes, filename, mime);
            } catch (Exception e) {
                toast("تعذّر تجهيز الملف للحفظ");
            }
        }

        private void pick(final byte[] bytes, final String filename, final String mime) {
            runOnUiThread(() -> {
                try {
                    pendingSaveBytes = bytes;
                    Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType(mime == null || mime.isEmpty() ? "application/json" : mime);
                    intent.putExtra(Intent.EXTRA_TITLE, filename.replaceAll("[\\\\/:*?\"<>|]", "_"));
                    startActivityForResult(intent, REQ_SAVE_DOC);
                } catch (Exception e) {
                    pendingSaveBytes = null;
                    toast("تعذّر فتح مدير الملفات");
                }
            });
        }

        private void save(byte[] bytes, String filename, String mime) {
            try {
                filename = filename.replaceAll("[\\\\/:*?\"<>|]", "_");
                if (mime == null || mime.isEmpty()) {
                    String ext = MimeTypeMap.getFileExtensionFromUrl(filename);
                    mime = ext.isEmpty() ? null : MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);
                    if (mime == null) mime = "application/octet-stream";
                }
                String where;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues v = new ContentValues();
                    v.put(MediaStore.Downloads.DISPLAY_NAME, filename);
                    v.put(MediaStore.Downloads.MIME_TYPE, mime);
                    v.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                    Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                    if (uri == null) throw new IllegalStateException("insert failed");
                    try (OutputStream os = getContentResolver().openOutputStream(uri)) {
                        os.write(bytes);
                    }
                    where = "التنزيلات";
                } else {
                    File dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                    if (dir == null) dir = getFilesDir();
                    File f = new File(dir, filename);
                    try (FileOutputStream os = new FileOutputStream(f)) {
                        os.write(bytes);
                    }
                    where = f.getParent();
                }
                toast("تم الحفظ في " + where + ": " + filename);
            } catch (Exception e) {
                toast("تعذّر حفظ الملف");
            }
        }

        private void toast(final String msg) {
            runOnUiThread(() -> Toast.makeText(MainActivity.this, msg, Toast.LENGTH_LONG).show());
        }
    }
}
