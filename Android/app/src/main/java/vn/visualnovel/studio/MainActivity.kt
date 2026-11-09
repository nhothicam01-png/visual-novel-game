package vn.visualnovel.studio

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast

class MainActivity : Activity() {
    private lateinit var webView: WebView

    inner class RenderBridge {
        @JavascriptInterface
        fun startRenderKeepAlive() {
            runOnUiThread {
                val intent = Intent(this@MainActivity, RenderKeepAliveService::class.java)
                    .setAction(RenderKeepAliveService.ACTION_START)
                startForegroundService(intent)
            }
        }

        @JavascriptInterface
        fun stopRenderKeepAlive() {
            runOnUiThread {
                stopService(Intent(this@MainActivity, RenderKeepAliveService::class.java))
            }
        }

        @JavascriptInterface
        fun showNativeMessage(message: String) {
            runOnUiThread {
                Toast.makeText(this@MainActivity, message.take(160), Toast.LENGTH_SHORT).show()
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            settings.allowFileAccess = false
            settings.allowContentAccess = true
            addJavascriptInterface(RenderBridge(), "AndroidRender")
            webChromeClient = WebChromeClient()
            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView, url: String) {
                    super.onPageFinished(view, url)
                    installRenderHooks()
                }
            }
        }
        setContentView(webView)
        if (savedInstanceState == null) webView.loadUrl(BuildConfig.WEB_APP_URL)
        else webView.restoreState(savedInstanceState)
    }

    private fun installRenderHooks() {
        val script = """
            (() => {
              if (window.__androidRenderHooksInstalled) return;
              window.__androidRenderHooksInstalled = true;
              const bridge = window.AndroidRender;
              const start = () => bridge && bridge.startRenderKeepAlive();
              const stop = () => bridge && bridge.stopRenderKeepAlive();
              const button = document.getElementById('export-video');
              if (button) button.addEventListener('click', start, true);
              const status = document.getElementById('export-status');
              if (status && window.MutationObserver) {
                new MutationObserver(() => {
                  const value = (status.textContent || '').toLowerCase();
                  if (/hoàn tất|thành công|lỗi|thất bại|đã hủy|đã dừng/.test(value)) stop();
                }).observe(status, { childList: true, characterData: true, subtree: true });
              }
              document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible' && status) {
                  const value = (status.textContent || '').toLowerCase();
                  if (/sẵn sàng|hoàn tất|lỗi|thất bại|đã hủy|đã dừng/.test(value)) stop();
                }
              });
            })();
        """.trimIndent()
        webView.evaluateJavascript(script, null)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        webView.saveState(outState)
        super.onSaveInstanceState(outState)
    }

    @Deprecated("Deprecated in Android API")
    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    override fun onDestroy() {
        webView.removeJavascriptInterface("AndroidRender")
        webView.destroy()
        super.onDestroy()
    }
}
