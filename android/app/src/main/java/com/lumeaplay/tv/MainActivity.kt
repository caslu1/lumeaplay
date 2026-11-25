package com.lumeaplay.tv

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.WebViewAssetLoader
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.File
import java.io.FileInputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

/** Lista de canais atual, usada pelo player para trocar de canal (cima/baixo). */
object Playlist {
    data class Item(val url: String, val name: String, val logo: String, val id: String, val num: Int)
    @Volatile var items: List<Item> = emptyList()
}

class MainActivity : Activity() {

    private lateinit var web: WebView
    private lateinit var loader: WebViewAssetLoader

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        hideSystemUi()

        loader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        web = WebView(this)
        web.setBackgroundColor(Color.parseColor("#0A0C10"))
        web.setLayerType(View.LAYER_TYPE_HARDWARE, null)
        web.isFocusable = true
        web.isFocusableInTouchMode = true
        web.isVerticalScrollBarEnabled = false
        web.isHorizontalScrollBarEnabled = false
        with(web.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            cacheMode = WebSettings.LOAD_DEFAULT
            useWideViewPort = true
            loadWithOverviewMode = true
            textZoom = 100
            allowFileAccess = false
        }
        web.addJavascriptInterface(Bridge(), "LumeaNative")
        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                val u = request.url
                if (u.host == HOST && (u.path ?: "").startsWith("/proxy")) return proxy(u)
                if (u.host == HOST && u.path == "/img") return image(u)
                return loader.shouldInterceptRequest(u)
            }

            @Deprecated("Deprecated in Java")
            override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean = !url.startsWith("https://$HOST/")
        }
        setContentView(web)
        trimImages()
        web.loadUrl("https://$HOST/assets/index.html")
        web.requestFocus()
    }

    private fun hideSystemUi() {
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility = (View.SYSTEM_UI_FLAG_FULLSCREEN or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN)
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) { hideSystemUi(); web.requestFocus() }
    }

    override fun onResume() {
        super.onResume()
        js("window.LP&&LP.onResume()")
    }

    private fun js(code: String) { if (::web.isInitialized) web.evaluateJavascript(code, null) }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        val code = event.keyCode
        if (code == KeyEvent.KEYCODE_BACK || code == KeyEvent.KEYCODE_ESCAPE) {
            if (event.action == KeyEvent.ACTION_UP) {
                web.evaluateJavascript("(window.LP?LP.back():false)") { r -> if (r != "true") finish() }
            }
            return true
        }
        val name = when (code) {
            KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_NUMPAD_ENTER, KeyEvent.KEYCODE_BUTTON_A -> "ok"
            KeyEvent.KEYCODE_CHANNEL_UP, KeyEvent.KEYCODE_PAGE_UP -> "chup"
            KeyEvent.KEYCODE_CHANNEL_DOWN, KeyEvent.KEYCODE_PAGE_DOWN -> "chdown"
            else -> null
        }
        if (name != null) {
            if (event.action == KeyEvent.ACTION_DOWN) js("window.LP&&LP.key('$name')")
            return true
        }
        return super.dispatchKeyEvent(event)
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        @Suppress("DEPRECATION")
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == REQ_PLAYER) {
            val r = data?.getStringExtra("r") ?: return
            js("window.LP&&LP.onPlayerResult(" + JSONObject.quote(r) + ")")
        }
    }

    /** Baixa a lista M3U pelo app (evita bloqueio de CORS) e guarda uma cópia para abrir rápido. */
    private fun proxy(u: Uri): WebResourceResponse {
        val target = u.getQueryParameter("url") ?: return text(400, "sem url")
        if (u.getQueryParameter("mem") == "1") {
            return try {
                WebResourceResponse("application/json", "utf-8", ByteArrayInputStream(fetchSmall(target)))
            } catch (e: Exception) { text(502, e.message ?: "erro") }
        }
        val useCache = u.getQueryParameter("cache") == "1"
        val file = File(cacheDir, "m3u_" + sha1(target))
        if (useCache && file.exists() && System.currentTimeMillis() - file.lastModified() < 6 * 3600_000L) {
            return WebResourceResponse("text/plain", "utf-8", FileInputStream(file))
        }
        return try {
            val tmp = File(cacheDir, file.name + ".tmp")
            download(target, tmp)
            tmp.renameTo(file)
            WebResourceResponse("text/plain", "utf-8", FileInputStream(file))
        } catch (e: Exception) {
            if (file.exists()) WebResourceResponse("text/plain", "utf-8", FileInputStream(file))
            else text(502, e.message ?: "erro")
        }
    }

    /**
     * Logos e pôsteres: o app baixa a imagem com cabeçalhos de navegador e sem Referer
     * (muitos servidores bloqueiam imagens pedidas de dentro de apps), segue redirecionamentos
     * http↔https e guarda em disco por 7 dias, para as listas abrirem rápido nas próximas vezes.
     */
    private fun image(u: Uri): WebResourceResponse {
        val target = u.getQueryParameter("url") ?: return text(400, "sem url")
        val dir = File(cacheDir, "img").apply { mkdirs() }
        val file = File(dir, sha1(target))
        val headers = mapOf("Cache-Control" to "max-age=604800", "Access-Control-Allow-Origin" to "*")
        if (file.exists() && file.length() > 0 && System.currentTimeMillis() - file.lastModified() < 7 * 86400_000L) {
            return WebResourceResponse(sniff(file), null, 200, "OK", headers, FileInputStream(file))
        }
        return try {
            var url = target
            var conn: HttpURLConnection? = null
            for (i in 0 until 6) {
                val c = URL(url).openConnection() as HttpURLConnection
                c.instanceFollowRedirects = false
                c.connectTimeout = 8000
                c.readTimeout = 12000
                c.setRequestProperty("User-Agent", IMG_UA)
                c.setRequestProperty("Accept", "image/avif,image/webp,image/apng,image/*,*/*;q=0.8")
                val code = c.responseCode
                if (code in 300..399) {
                    val loc = c.getHeaderField("Location") ?: throw Exception("redirect")
                    url = URL(URL(url), loc).toString(); c.disconnect(); continue
                }
                if (code != 200) { c.disconnect(); throw Exception("HTTP $code") }
                conn = c; break
            }
            val c = conn ?: throw Exception("muitos redirecionamentos")
            val tmp = File(dir, file.name + ".tmp")
            c.inputStream.use { inp ->
                tmp.outputStream().use { o ->
                    val buf = ByteArray(16 * 1024); var total = 0
                    while (true) {
                        val n = inp.read(buf); if (n < 0) break
                        total += n; if (total > 4 * 1024 * 1024) throw Exception("grande demais")
                        o.write(buf, 0, n)
                    }
                }
            }
            c.disconnect()
            tmp.renameTo(file)
            WebResourceResponse(sniff(file), null, 200, "OK", headers, FileInputStream(file))
        } catch (e: Exception) {
            if (file.exists()) WebResourceResponse(sniff(file), null, 200, "OK", headers, FileInputStream(file))
            else text(502, e.message ?: "erro")
        }
    }

    /** Descobre o tipo da imagem pelos primeiros bytes (muitos servidores mandam o tipo errado). */
    private fun sniff(f: File): String {
        val b = ByteArray(12)
        val n = try { FileInputStream(f).use { it.read(b) } } catch (e: Exception) { 0 }
        if (n >= 4 && b[0] == 0x89.toByte() && b[1] == 'P'.code.toByte()) return "image/png"
        if (n >= 3 && b[0] == 0xFF.toByte() && b[1] == 0xD8.toByte()) return "image/jpeg"
        if (n >= 4 && b[0] == 'G'.code.toByte() && b[1] == 'I'.code.toByte()) return "image/gif"
        if (n >= 12 && b[8] == 'W'.code.toByte() && b[9] == 'E'.code.toByte()) return "image/webp"
        if (n >= 1 && (b[0] == '<'.code.toByte() || b[0] == ' '.code.toByte())) return "image/svg+xml"
        return "image/jpeg"
    }

    /** Limpa o cache de imagens quando passa de ~150 MB (apaga as mais antigas). */
    private fun trimImages() {
        Thread {
            try {
                val fs = File(cacheDir, "img").listFiles() ?: return@Thread
                var total = fs.sumOf { it.length() }
                if (total < 150L * 1024 * 1024) return@Thread
                for (f in fs.sortedBy { it.lastModified() }) { total -= f.length(); f.delete(); if (total < 100L * 1024 * 1024) break }
            } catch (e: Exception) { }
        }.start()
    }

    private fun download(start: String, out: File) {
        var url = start
        for (i in 0 until 6) {
            val c = URL(url).openConnection() as HttpURLConnection
            c.instanceFollowRedirects = false
            c.connectTimeout = 20000
            c.readTimeout = 60000
            c.setRequestProperty("User-Agent", UA)
            c.setRequestProperty("Accept", "*/*")
            val code = c.responseCode
            if (code in 300..399) {
                val loc = c.getHeaderField("Location") ?: throw Exception("redirect sem destino")
                url = URL(URL(url), loc).toString(); c.disconnect(); continue
            }
            if (code != 200) { c.disconnect(); throw Exception("HTTP $code") }
            c.inputStream.use { inp -> out.outputStream().use { o -> inp.copyTo(o, 64 * 1024) } }
            c.disconnect()
            return
        }
        throw Exception("muitos redirecionamentos")
    }

    /** Busca pequena (guia de programação), direto na memória, com limite de 3 MB. */
    private fun fetchSmall(start: String): ByteArray {
        var url = start
        for (i in 0 until 5) {
            val c = URL(url).openConnection() as HttpURLConnection
            c.instanceFollowRedirects = false
            c.connectTimeout = 8000
            c.readTimeout = 10000
            c.setRequestProperty("User-Agent", UA)
            val code = c.responseCode
            if (code in 300..399) {
                val loc = c.getHeaderField("Location") ?: throw Exception("redirect")
                url = URL(URL(url), loc).toString(); c.disconnect(); continue
            }
            if (code != 200) { c.disconnect(); throw Exception("HTTP $code") }
            val out = java.io.ByteArrayOutputStream()
            c.inputStream.use { inp ->
                val buf = ByteArray(16 * 1024)
                while (true) {
                    val n = inp.read(buf); if (n < 0) break
                    out.write(buf, 0, n)
                    if (out.size() > 3 * 1024 * 1024) throw Exception("grande demais")
                }
            }
            c.disconnect()
            return out.toByteArray()
        }
        throw Exception("muitos redirecionamentos")
    }

    private fun text(status: Int, msg: String) = WebResourceResponse(
        "text/plain", "utf-8", status, if (status == 400) "Bad Request" else "Bad Gateway",
        mapOf("Cache-Control" to "no-store"), ByteArrayInputStream(msg.toByteArray())
    )

    private fun sha1(s: String): String =
        MessageDigest.getInstance("SHA-1").digest(s.toByteArray()).joinToString("") { "%02x".format(it) }

    inner class Bridge {
        @JavascriptInterface
        fun getDeviceId(): String {
            @SuppressLint("HardwareIds")
            val raw = Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID) ?: "lumea"
            val d = MessageDigest.getInstance("SHA-256").digest((raw + packageName).toByteArray())
            return (0 until 6).joinToString(":") { "%02X".format(d[it]) }
        }

        @JavascriptInterface
        fun getDeviceModel(): String = (Build.MANUFACTURER + " " + Build.MODEL).trim()

        @JavascriptInterface
        fun setPlaylist(json: String) {
            try {
                val a = JSONArray(json)
                Playlist.items = (0 until a.length()).map {
                    val o = a.getJSONObject(it)
                    Playlist.Item(o.optString("u"), o.optString("n"), o.optString("l"), o.optString("id"), o.optInt("num"))
                }
            } catch (e: Exception) { Playlist.items = emptyList() }
        }

        @JavascriptInterface
        fun play(json: String) {
            runOnUiThread {
                @Suppress("DEPRECATION")
                startActivityForResult(Intent(this@MainActivity, PlayerActivity::class.java).putExtra("p", json), REQ_PLAYER)
            }
        }

        @JavascriptInterface
        fun exitApp() { runOnUiThread { finishAffinity() } }
    }

    companion object {
        const val HOST = "appassets.androidplatform.net"
        const val UA = "LumeaPlay/1.0 (Linux; Android)"
        const val IMG_UA = "Mozilla/5.0 (Linux; Android 10; TV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
        const val REQ_PLAYER = 77
    }
}
