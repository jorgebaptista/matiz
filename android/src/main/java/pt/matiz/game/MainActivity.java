package pt.matiz.game;

import android.app.Activity;
import android.content.Intent;
import android.content.ClipData;
import android.net.Uri;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.IOException;
import java.io.File;
import java.io.FileOutputStream;
import android.util.Base64;
import androidx.core.content.FileProvider;
import org.json.JSONObject;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

public class MainActivity extends Activity {
    private WebView game;
    private static final String ASSET_ROOT = "file:///android_asset/";
    private static final String DEFAULT_GAME = ASSET_ROOT + "index.html";
    private final Set<String> editionUrls = new HashSet<>();
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(247, 245, 237));
        getWindow().setNavigationBarColor(Color.rgb(247, 245, 237));
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        game = new WebView(this);
        game.getSettings().setJavaScriptEnabled(true);
        game.getSettings().setDomStorageEnabled(true);
        game.getSettings().setAllowFileAccess(false);
        game.getSettings().setAllowContentAccess(false);
        editionUrls.add(DEFAULT_GAME);
        try {
            for (String dir : getAssets().list("")) {
                if (dir.matches("[A-Za-z0-9-]+") && Arrays.asList(getAssets().list(dir)).contains("index.html"))
                    editionUrls.add(ASSET_ROOT + dir + "/index.html");
            }
        } catch (IOException e) {
            android.util.Log.w("Matiz", "Could not list bundled editions", e);
        }
        game.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (request.isForMainFrame() && "matiz-share".equals(request.getUrl().getScheme())) {
                    if (view.getUrl() != null && editionUrls.contains(view.getUrl().split("\\?", 2)[0]))
                        view.evaluateJavascript("window.matizSharePayload ? window.matizSharePayload() : null", MainActivity.this::shareImage);
                    return true;
                }
                if (!request.isForMainFrame() || !editionUrls.contains(url)) return true;
                getPreferences(MODE_PRIVATE).edit().putString("edition", url).apply();
                return false;
            }
        });
        setContentView(game);
        game.loadUrl(gameUrl(getIntent()));
    }
    private void shareImage(String payload) {
        try {
            JSONObject result = new JSONObject(payload);
            String image = result.getString("image");
            if (!image.startsWith("data:image/png;base64,") || image.length() > 4_000_000)
                throw new IOException("Invalid result image");
            byte[] png = Base64.decode(image.substring("data:image/png;base64,".length()), Base64.DEFAULT);
            File directory = new File(getCacheDir(), "shares");
            if (!directory.isDirectory() && !directory.mkdirs()) throw new IOException("Could not prepare image cache");
            File[] older = directory.listFiles();
            if (older != null) for (File file : older) {
                if (file.getName().startsWith("matiz-") && file.lastModified() < System.currentTimeMillis() - 86_400_000L)
                    file.delete();
            }
            // Unique files keep an earlier chooser's attachment intact.
            File file = File.createTempFile("matiz-", ".png", directory);
            try (FileOutputStream out = new FileOutputStream(file)) { out.write(png); }
            Uri uri = FileProvider.getUriForFile(this, getPackageName() + ".shares", file);
            Intent share = new Intent(Intent.ACTION_SEND);
            share.setType("image/png");
            share.putExtra(Intent.EXTRA_STREAM, uri);
            share.putExtra(Intent.EXTRA_TEXT, result.getString("text"));
            share.setClipData(ClipData.newUri(getContentResolver(), "Matiz", uri));
            share.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivity(Intent.createChooser(share, null));
        } catch (Exception e) {
            android.util.Log.w("Matiz", "Could not share result image", e);
            game.evaluateJavascript("window.matizShareFailed && window.matizShareFailed()", null);
        }
    }
    private String gameUrl(Intent intent) {
        Uri link = intent.getData();
        if (link != null && "https".equals(link.getScheme()) && BuildConfig.CHALLENGE_HOST.equals(link.getHost()) &&
                link.getPath() != null && link.getPath().startsWith(BuildConfig.CHALLENGE_PATH)) {
            String route = link.getPath().substring(BuildConfig.CHALLENGE_PATH.length());
            String edition = ASSET_ROOT + route + "index.html";
            if (editionUrls.contains(edition)) {
                getPreferences(MODE_PRIVATE).edit().putString("edition", edition).apply();
                return edition + (link.getEncodedQuery() == null ? "" : "?" + link.getEncodedQuery());
            }
        }
        String lastEdition = getPreferences(MODE_PRIVATE).getString("edition", DEFAULT_GAME);
        return editionUrls.contains(lastEdition) ? lastEdition : DEFAULT_GAME;
    }
    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        game.loadUrl(gameUrl(intent));
    }
    @Override public void onBackPressed() {
        game.evaluateJavascript("window.matizBack ? window.matizBack() : false", handled -> {
            if (!"true".equals(handled)) finish();
        });
    }
}
