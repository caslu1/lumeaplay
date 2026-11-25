package com.lumeaplay.tv

import android.app.Activity
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Typeface
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Base64
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import androidx.annotation.OptIn
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.TrackSelectionOverride
import androidx.media3.common.Tracks
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DefaultDataSource
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.exoplayer.trackselection.DefaultTrackSelector
import androidx.media3.exoplayer.upstream.DefaultBandwidthMeter
import androidx.media3.exoplayer.upstream.DefaultLoadErrorHandlingPolicy
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Player do LumeaPlay.
 *
 * Visual: painel próprio, igual em todo o app
 *  - Ao vivo: logo, número e nome do canal, programa atual com barra de progresso e o próximo
 *  - Filmes, séries e Playback: título, barra de tempo, ⏪ ⏯ ⏩ e tempo restante
 *  - topo: tipo (AO VIVO / FILME / SÉRIE / PLAYBACK), relógio e qualidade atual
 *
 * Anti-travamento:
 *  - buffer configurável (Normal / Alto / Máximo)
 *  - reconexão automática com espera progressiva quando o sinal cai
 *  - volta ao ponto ao vivo quando a transmissão "fica para trás"
 *  - vigia: se a imagem congela ou fica carregando tempo demais, recarrega sozinho
 *
 * Qualidade de imagem:
 *  - sem limite de resolução pelo tamanho da tela; começa em qualidade alta (8 Mbps estimados)
 *  - "Automática" troca sozinha conforme a internet; "Máxima" trava na maior qualidade do canal
 *  - tecla Menu / Info / vermelha troca a qualidade manualmente
 *  - decodificação por hardware, com troca automática de decodificador se um falhar
 *  - SurfaceView (padrão do PlayerView): o desentrelaçamento de canais 1080i fica a cargo do hardware
 */
@OptIn(UnstableApi::class)
class PlayerActivity : Activity() {

    private var player: ExoPlayer? = null
    private lateinit var view: PlayerView
    private lateinit var meter: DefaultBandwidthMeter
    private var selector: DefaultTrackSelector? = null
    private val ui = Handler(Looper.getMainLooper())
    private val nf: NumberFormat = NumberFormat.getIntegerInstance(Locale("pt", "BR"))

    // painel
    private lateinit var panel: FrameLayout
    private lateinit var kindTxt: TextView
    private lateinit var qualTxt: TextView
    private lateinit var topTitle: TextView
    private lateinit var topSub: TextView
    private lateinit var clock: TextView
    private lateinit var net: TextView
    private lateinit var livePane: LinearLayout
    private lateinit var logo: ImageView
    private lateinit var logoTxt: TextView
    private lateinit var chNum: TextView
    private lateinit var chName: TextView
    private lateinit var nowTxt: TextView
    private lateinit var nowBar: ProgressBar
    private lateinit var nextTxt: TextView
    private lateinit var vodPane: LinearLayout
    private lateinit var seek: ProgressBar
    private lateinit var seekWrap: FrameLayout
    private lateinit var knob: View
    private lateinit var posTxt: TextView
    private lateinit var durTxt: TextView
    private lateinit var bPlay: ImageView
    private lateinit var bigState: ImageView
    private lateinit var hints: TextView
    private lateinit var err: TextView
    private lateinit var bufTxt: TextView

    private var id = ""
    private var type = "vod"
    private var kind = "movie" // live | movie | ep | pb
    private var title = ""
    private var sub = ""
    private var url = ""
    private var logoUrl = ""
    private var lang = "pt"
    private var buf = "alto"
    private var quality = "auto"
    private var manualH = 0 // 0 = automática; senão altura escolhida (ex.: 1080)
    private var index = 0
    private var startMs = 0L
    private var retries = 0
    private var reconnecting = false
    private var bufferingSince = 0L
    private var lastPos = -1L
    private var frozenMs = 0L
    private var panelUntil = 0L
    private var flashUntil = 0L
    private var seekTarget = -1L
    private var epgFor = ""
    private var epg: List<Prog> = emptyList()

    private data class Prog(val t: String, val s: Long, val e: Long)

    private val reconnect = Runnable { reconnecting = false; reload() }
    private val tick = object : Runnable {
        override fun run() { watchdog(); refreshPanel(); ui.postDelayed(this, 500) }
    }
    private val doSeek = Runnable {
        val p = player
        if (p != null && seekTarget >= 0) p.seekTo(seekTarget)
        seekTarget = -1
    }

    private fun t(pt: String, en: String) = if (lang == "en") en else pt

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility = (View.SYSTEM_UI_FLAG_FULLSCREEN or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY)
        setContentView(R.layout.activity_player)
        view = findViewById(R.id.pv)
        panel = findViewById(R.id.ui)
        kindTxt = findViewById(R.id.kind); qualTxt = findViewById(R.id.qual)
        topTitle = findViewById(R.id.topTitle); topSub = findViewById(R.id.topSub)
        clock = findViewById(R.id.clock); net = findViewById(R.id.net)
        livePane = findViewById(R.id.livePane); logo = findViewById(R.id.logo); logoTxt = findViewById(R.id.logoTxt)
        chNum = findViewById(R.id.chNum); chName = findViewById(R.id.chName)
        nowTxt = findViewById(R.id.nowTxt); nowBar = findViewById(R.id.nowBar); nextTxt = findViewById(R.id.nextTxt)
        vodPane = findViewById(R.id.vodPane); seek = findViewById(R.id.seek); seekWrap = findViewById(R.id.seekWrap)
        knob = findViewById(R.id.knob); posTxt = findViewById(R.id.posTxt); durTxt = findViewById(R.id.durTxt)
        bPlay = findViewById(R.id.bPlay); bigState = findViewById(R.id.bigState); hints = findViewById(R.id.hints)
        err = findViewById(R.id.err); bufTxt = findViewById(R.id.bufTxt)
        meter = sharedMeter(this)
        applyFonts()

        val p = JSONObject(intent.getStringExtra("p") ?: "{}")
        id = p.optString("id"); type = p.optString("type", "vod"); title = p.optString("title")
        sub = p.optString("sub"); url = p.optString("url"); index = p.optInt("index", 0)
        startMs = p.optLong("start", 0); buf = p.optString("buf", "alto"); quality = p.optString("q", "auto")
        kind = p.optString("kind", if (type == "live") "live" else "movie"); logoUrl = p.optString("logo")
        lang = p.optString("lang", "pt")
        p.optJSONArray("epg")?.let { a ->
            val l = ArrayList<Prog>()
            for (i in 0 until a.length()) a.optJSONObject(i)?.let { o -> l.add(Prog(o.optString("t"), o.optLong("s"), o.optLong("e"))) }
            epg = l; epgFor = url
        }

        view.useController = false
        view.setShowBuffering(PlayerView.SHOW_BUFFERING_WHEN_PLAYING)
        view.resizeMode = when (p.optString("resize", "fit")) {
            "fill" -> AspectRatioFrameLayout.RESIZE_MODE_ZOOM
            "zoom" -> AspectRatioFrameLayout.RESIZE_MODE_FILL
            else -> AspectRatioFrameLayout.RESIZE_MODE_FIT
        }
        setupPanel()
    }

    /** Mesma fonte do app (Inter). Se não achar, fica a do sistema. */
    private fun applyFonts() {
        fun tf(f: String): Typeface? = try { Typeface.createFromAsset(assets, "fonts/$f") } catch (e: Exception) { null }
        val bold = tf("Inter-Bold.otf"); val semi = tf("Inter-SemiBold.otf") ?: bold; val reg = tf("Inter-Regular.otf")
        for (v in listOf(topTitle, chName, chNum, clock)) bold?.let { v.typeface = it }
        for (v in listOf(kindTxt, qualTxt, net, posTxt, durTxt, nowTxt, logoTxt, bufTxt)) semi?.let { v.typeface = it }
        for (v in listOf(topSub, nextTxt, hints, err)) reg?.let { v.typeface = it }
    }

    private fun setupPanel() {
        val live = type == "live"
        livePane.visibility = if (live) View.VISIBLE else View.GONE
        vodPane.visibility = if (live) View.GONE else View.VISIBLE
        kindTxt.text = when (kind) {
            "live" -> t("● AO VIVO", "● LIVE")
            "ep" -> t("SÉRIE", "SERIES")
            "pb" -> t("● PLAYBACK", "● PLAYBACK")
            else -> t("FILME", "MOVIE")
        }
        kindTxt.setBackgroundResource(if (live) R.drawable.badge_live else R.drawable.badge_dim)
        hints.text = if (live)
            t("▲ ▼  Trocar canal        OK  Informações        MENU  Qualidade        VOLTAR  Sair",
              "▲ ▼  Change channel        OK  Info        MENU  Quality        BACK  Exit")
        else
            t("◀ ▶  Voltar / avançar 10 s        OK  Pausar / continuar        MENU  Qualidade        VOLTAR  Sair",
              "◀ ▶  Back / forward 10 s        OK  Pause / play        MENU  Quality        BACK  Exit")
        showChannel()
    }

    /** Dados do canal / título no painel. */
    private fun showChannel() {
        if (type == "live") {
            val it = if (index < Playlist.items.size) Playlist.items[index] else null
            val name = it?.name ?: title
            val num = it?.num ?: 0
            chNum.text = if (num > 0) num.toString() else ""
            chNum.visibility = if (num > 0) View.VISIBLE else View.GONE
            chName.text = cleanName(name)
            topTitle.text = cleanName(name)
            topSub.text = sub
            setQualityBadge(name)
            loadLogo(it?.logo ?: logoUrl, name)
            if (epgFor != url) { epg = emptyList(); epgFor = url; fetchEpg(url) }
            drawEpg()
        } else {
            topTitle.text = title
            topSub.text = sub
            setQualityBadge("")
        }
    }

    private fun setQualityBadge(name: String) {
        val q = qualityOf(name)
        qualTxt.text = q
        qualTxt.visibility = if (q.isEmpty()) View.GONE else View.VISIBLE
    }

    override fun onStart() {
        super.onStart()
        if (player == null) initPlayer()
        ui.removeCallbacks(tick); ui.post(tick)
        showPanel(5000)
    }

    override fun onStop() {
        super.onStop()
        ui.removeCallbacks(tick); ui.removeCallbacks(reconnect); ui.removeCallbacks(doSeek)
        saveResult()
        player?.release(); player = null
    }

    private fun initPlayer() {
        val http = DefaultHttpDataSource.Factory()
            .setUserAgent(MainActivity.UA)
            .setAllowCrossProtocolRedirects(true)
            .setKeepPostFor302Redirects(true)
            .setConnectTimeoutMs(12000)
            .setReadTimeoutMs(15000)
        val b = when (buf) {
            "normal" -> intArrayOf(15000, 50000, 2500, 5000)
            "max" -> intArrayOf(50000, 180000, 4000, 8000)
            else -> intArrayOf(30000, 90000, 2500, 5000)
        }
        val load = DefaultLoadControl.Builder()
            .setBufferDurationsMs(b[0], b[1], b[2], b[3])
            .setPrioritizeTimeOverSizeThresholds(true)
            .build()
        val sources = DefaultMediaSourceFactory(DefaultDataSource.Factory(this, http))
            .setLoadErrorHandlingPolicy(DefaultLoadErrorHandlingPolicy(8))
        // sem limite pelo tamanho da tela; "Máxima" força o maior bitrate que o aparelho suporta
        val sel = DefaultTrackSelector(this)
        sel.setParameters(
            sel.buildUponParameters()
                .clearViewportSizeConstraints()
                .setMaxVideoSize(Int.MAX_VALUE, Int.MAX_VALUE)
                .setMaxVideoBitrate(Int.MAX_VALUE)
                .setForceHighestSupportedBitrate(quality == "max")
        )
        selector = sel
        // decodificador de hardware primeiro; se falhar, tenta o próximo disponível
        val renderers = DefaultRenderersFactory(this)
            .setEnableDecoderFallback(true)
            .setExtensionRendererMode(DefaultRenderersFactory.EXTENSION_RENDERER_MODE_OFF)
        val p = ExoPlayer.Builder(this, renderers)
            .setTrackSelector(sel)
            .setMediaSourceFactory(sources)
            .setLoadControl(load)
            .setBandwidthMeter(meter)
            .build()
        p.addListener(object : Player.Listener {
            override fun onPlayerError(error: PlaybackException) {
                if (error.errorCode == PlaybackException.ERROR_CODE_BEHIND_LIVE_WINDOW) {
                    p.seekToDefaultPosition(); p.prepare(); return
                }
                scheduleReconnect()
            }

            override fun onTracksChanged(tracks: Tracks) {
                if (manualH > 0) applyQuality()
            }

            override fun onIsPlayingChanged(isPlaying: Boolean) { refreshPanel() }

            override fun onPlaybackStateChanged(state: Int) {
                when (state) {
                    Player.STATE_READY -> {
                        retries = 0; bufferingSince = 0; err.visibility = View.GONE; bufTxt.visibility = View.GONE
                    }
                    Player.STATE_BUFFERING -> if (bufferingSince == 0L) bufferingSince = SystemClock.uptimeMillis()
                    Player.STATE_ENDED -> if (type == "vod") finish() else scheduleReconnect()
                    else -> {}
                }
            }
        })
        player = p
        view.player = p
        load(url, startMs)
    }

    private fun load(u: String, start: Long) {
        val p = player ?: return
        val b = MediaItem.Builder().setUri(Uri.parse(u))
        if (u.lowercase().contains(".m3u8")) b.setMimeType(MimeTypes.APPLICATION_M3U8)
        // ao vivo: pode acelerar/atrasar levemente para ficar perto do sinal, sem ficar muito atrasado
        if (type == "live") b.setLiveConfiguration(
            MediaItem.LiveConfiguration.Builder().setMinPlaybackSpeed(0.97f).setMaxPlaybackSpeed(1.04f).build()
        )
        p.setMediaItem(b.build(), if (start > 0) start else C.TIME_UNSET)
        p.prepare()
        p.playWhenReady = true
        bufferingSince = SystemClock.uptimeMillis(); lastPos = -1; frozenMs = 0
    }

    private fun reload() {
        val p = player ?: return
        load(url, if (type == "vod") p.currentPosition else 0)
    }

    private fun scheduleReconnect() {
        if (reconnecting) return
        if (type == "vod" && retries >= 5) {
            err.text = t("Não foi possível reproduzir este conteúdo agora.\nVerifique a internet ou tente mais tarde.",
                "This content can't be played right now.\nCheck your internet or try again later.")
            err.visibility = View.VISIBLE
            return
        }
        retries++
        reconnecting = true
        val delay = minOf(8000L, 1000L shl minOf(retries - 1, 3))
        err.text = if (type == "live") t("Sinal instável. Reconectando… (tentativa $retries)", "Unstable signal. Reconnecting… (attempt $retries)")
        else t("Reconectando…", "Reconnecting…")
        err.visibility = View.VISIBLE
        ui.removeCallbacks(reconnect)
        ui.postDelayed(reconnect, delay)
    }

    /** Roda a cada meio segundo: velocidade/qualidade e destrava a reprodução se precisar. */
    private var lastWatch = 0L
    private fun watchdog() {
        val p = player ?: return
        val now = SystemClock.uptimeMillis()
        val kbps = meter.bitrateEstimate / 1000
        val h = p.videoFormat?.height ?: 0
        val n = videoHeights().size
        val mode = if (manualH > 0) "Manual" else if (quality == "max") t("Máxima", "Maximum") else t("Automática", "Auto")
        net.text = (if (h > 0) "${h}p  ·  " else "") + mode + "  ·  " +
            (if (n > 1) t("$n qualidades", "$n qualities") else t("qualidade única", "single quality")) + "  ·  " + nf.format(kbps) + " kbps"

        val buffering = p.playbackState == Player.STATE_BUFFERING
        if (buffering && p.playWhenReady) {
            bufTxt.text = t("Carregando…  ", "Loading…  ") + nf.format(kbps) + " kbps"
            bufTxt.visibility = View.VISIBLE
        } else if (now >= flashUntil) bufTxt.visibility = View.GONE

        if (now - lastWatch < 1000) return
        lastWatch = now
        if (buffering && p.playWhenReady) {
            val limit = if (type == "live") 12000 else 25000
            if (bufferingSince > 0 && now - bufferingSince > limit && !reconnecting) {
                bufferingSince = now
                retries++
                reload()
            }
        }
        // imagem congelada no ao vivo: posição não anda por 8 s
        if (type == "live" && p.playbackState == Player.STATE_READY && p.playWhenReady) {
            val pos = p.currentPosition
            if (pos == lastPos) {
                frozenMs += 1000
                if (frozenMs >= 8000) { frozenMs = 0; reload() }
            } else { frozenMs = 0; lastPos = pos }
        } else frozenMs = 0
    }

    /* ---------------- painel ---------------- */

    private fun showPanel(ms: Long) {
        panelUntil = SystemClock.uptimeMillis() + ms
        panel.visibility = View.VISIBLE
        refreshPanel()
    }

    private fun hidePanel() { panelUntil = 0; panel.visibility = View.GONE }

    private fun refreshPanel() {
        val p = player
        val now = SystemClock.uptimeMillis()
        val paused = p != null && !p.playWhenReady
        bigState.visibility = if (type != "live" && paused) View.VISIBLE else View.GONE
        if (panel.visibility == View.VISIBLE && !paused && now > panelUntil) { panel.visibility = View.GONE; return }
        if (panel.visibility != View.VISIBLE) return
        clock.text = SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date())
        if (type == "live") drawEpg()
        else if (p != null) {
            val dur = p.duration.let { if (it == C.TIME_UNSET || it <= 0) 0L else it }
            val pos = if (seekTarget >= 0) seekTarget else p.currentPosition
            val buf = p.bufferedPosition
            seek.progress = if (dur > 0) (pos * 1000 / dur).toInt() else 0
            seek.secondaryProgress = if (dur > 0) (buf * 1000 / dur).toInt() else 0
            val w = seekWrap.width - knob.width
            knob.translationX = if (dur > 0 && w > 0) (w * pos.toFloat() / dur) else 0f
            posTxt.text = fmt(pos)
            durTxt.text = if (dur > 0) "-" + fmt(dur - pos) + "   /   " + fmt(dur) else ""
            bPlay.setImageResource(if (paused) R.drawable.ic_play else R.drawable.ic_pause)
        }
    }

    private fun drawEpg() {
        val now = System.currentTimeMillis()
        val cur = epg.firstOrNull { it.s <= now && it.e > now }
        val next = epg.firstOrNull { it.s >= (cur?.e ?: now) - 1000 && it !== cur }
        if (cur != null) {
            nowTxt.text = t("Agora:  ", "Now:  ") + cur.t + "      " + hm(cur.s) + " – " + hm(cur.e)
            nowBar.visibility = View.VISIBLE
            nowBar.progress = ((now - cur.s) * 1000 / maxOf(1L, cur.e - cur.s)).toInt()
        } else {
            nowTxt.text = sub
            nowBar.visibility = View.GONE
        }
        nextTxt.text = if (next != null) t("A seguir:  ", "Next:  ") + next.t + "  ·  " + hm(next.s) else ""
        nextTxt.visibility = if (next != null) View.VISIBLE else View.GONE
        if (cur != null) topSub.text = cur.t + "  ·  " + sub
    }

    private fun hm(ms: Long) = SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(ms))

    private fun fmt(ms: Long): String {
        val s = maxOf(0L, ms / 1000); val h = s / 3600; val m = (s % 3600) / 60; val sec = s % 60
        return if (h > 0) String.format(Locale.US, "%d:%02d:%02d", h, m, sec) else String.format(Locale.US, "%d:%02d", m, sec)
    }

    /* ---------------- guia (Xtream get_short_epg) ---------------- */

    private val xtRe = Regex("^(https?://[^/?#]+)/(?:live/)?([^/?#]+)/([^/?#]+)/(\\d+)(?:\\.[A-Za-z0-9]+)?(?:[?#].*)?$")

    private fun fetchEpg(u: String) {
        val m = xtRe.find(u) ?: return
        val (base, user, pass, sid) = m.destructured
        val api = "$base/player_api.php?username=${Uri.encode(user)}&password=${Uri.encode(pass)}&action=get_short_epg&stream_id=$sid&limit=4"
        Thread {
            try {
                val c = URL(api).openConnection() as HttpURLConnection
                c.connectTimeout = 6000; c.readTimeout = 8000
                c.setRequestProperty("User-Agent", MainActivity.UA)
                val txt = c.inputStream.bufferedReader().use { it.readText() }
                c.disconnect()
                val arr = JSONObject(txt).optJSONArray("epg_listings")
                val l = ArrayList<Prog>()
                if (arr != null) for (i in 0 until arr.length()) {
                    val o = arr.optJSONObject(i) ?: continue
                    val title = b64(o.optString("title"))
                    val s = o.optString("start_timestamp").toLongOrNull() ?: continue
                    val e = o.optString("stop_timestamp").toLongOrNull() ?: continue
                    if (title.isNotBlank()) l.add(Prog(title, s * 1000, e * 1000))
                }
                l.sortBy { it.s }
                ui.post { if (u == url) { epg = l; drawEpg() } }
            } catch (e: Exception) { }
        }.start()
    }

    private fun b64(s: String): String = try { String(Base64.decode(s, Base64.DEFAULT), Charsets.UTF_8) } catch (e: Exception) { s }

    /* ---------------- logo do canal (usa o mesmo cache de imagens do app) ---------------- */

    private var logoReq = ""
    private fun loadLogo(u: String, name: String) {
        logoReq = u
        logo.setImageDrawable(null)
        logoTxt.text = initials(name)
        logoTxt.visibility = View.VISIBLE
        if (!u.startsWith("http")) return
        Thread {
            try {
                val f = File(File(cacheDir, "img").apply { mkdirs() }, sha1(u))
                if (!f.exists() || f.length() == 0L) {
                    var url = u
                    for (i in 0 until 5) {
                        val c = URL(url).openConnection() as HttpURLConnection
                        c.instanceFollowRedirects = false; c.connectTimeout = 6000; c.readTimeout = 8000
                        c.setRequestProperty("User-Agent", MainActivity.IMG_UA)
                        val code = c.responseCode
                        if (code in 300..399) { url = URL(URL(url), c.getHeaderField("Location") ?: break).toString(); c.disconnect(); continue }
                        if (code == 200) c.inputStream.use { inp -> f.outputStream().use { inp.copyTo(it) } }
                        c.disconnect(); break
                    }
                }
                val o = BitmapFactory.Options().apply { inJustDecodeBounds = true }
                BitmapFactory.decodeFile(f.path, o)
                var sample = 1
                while (o.outWidth / sample > 480 || o.outHeight / sample > 300) sample *= 2
                val bmp: Bitmap? = BitmapFactory.decodeFile(f.path, BitmapFactory.Options().apply { inSampleSize = sample })
                if (bmp != null) ui.post { if (logoReq == u) { logo.setImageBitmap(bmp); logoTxt.visibility = View.GONE } }
            } catch (e: Exception) { }
        }.start()
    }

    private fun sha1(s: String): String =
        MessageDigest.getInstance("SHA-1").digest(s.toByteArray()).joinToString("") { "%02x".format(it) }

    private fun initials(n: String): String {
        val w = cleanName(n).split(Regex("\\s+")).filter { it.isNotEmpty() && it[0].isLetterOrDigit() }
        return when { w.isEmpty() -> "TV"; w.size == 1 -> w[0].take(2).uppercase(); else -> (w[0].take(1) + w[1].take(1)).uppercase() }
    }

    private val qRe = Regex("[\\[(|]?\\s*\\b(?:SD|HD|FHD|UHD|4K|8K|HDR|HEVC|H\\.?265|H\\.?264|1080[pi]?|720p?|2160p?|480p?)\\b\\s*[\\])|]?", RegexOption.IGNORE_CASE)
    private fun cleanName(n: String): String {
        val c = n.replace(Regex("[ᴴᴰ²³]+"), " ").replace(qRe, " ").replace(Regex("\\s*[-|:]\\s*$"), "").replace(Regex("\\s{2,}"), " ").trim()
        return c.ifEmpty { n }
    }

    private fun qualityOf(n: String): String = when {
        Regex("\\b(4k|uhd|2160p?)\\b", RegexOption.IGNORE_CASE).containsMatchIn(n) -> "4K"
        Regex("\\b(fhd|1080p?)\\b", RegexOption.IGNORE_CASE).containsMatchIn(n) -> "FHD"
        Regex("\\b(hd|720p?)\\b", RegexOption.IGNORE_CASE).containsMatchIn(n) -> "HD"
        Regex("\\bsd\\b", RegexOption.IGNORE_CASE).containsMatchIn(n) -> "SD"
        else -> ""
    }

    /* ---------------- qualidade ---------------- */

    /** Alturas de vídeo disponíveis no canal atual (maior → menor). */
    private fun videoHeights(): List<Int> {
        val p = player ?: return emptyList()
        val hs = HashSet<Int>()
        for (g in p.currentTracks.groups) {
            if (g.type != C.TRACK_TYPE_VIDEO) continue
            for (i in 0 until g.length) if (g.isTrackSupported(i)) { val h = g.getTrackFormat(i).height; if (h > 0) hs.add(h) }
        }
        return hs.sortedDescending()
    }

    /** Aplica a qualidade escolhida (manual) ou volta para a automática/máxima. */
    private fun applyQuality() {
        val p = player ?: return
        val b = p.trackSelectionParameters.buildUpon().clearOverridesOfType(C.TRACK_TYPE_VIDEO)
        if (manualH > 0) {
            loop@ for (g in p.currentTracks.groups) {
                if (g.type != C.TRACK_TYPE_VIDEO) continue
                for (i in 0 until g.length) {
                    if (g.isTrackSupported(i) && g.getTrackFormat(i).height == manualH) {
                        if (g.isTrackSelected(i)) return
                        b.addOverride(TrackSelectionOverride(g.mediaTrackGroup, i)); break@loop
                    }
                }
            }
        }
        p.trackSelectionParameters = b.build()
    }

    /** Menu / Info / vermelha: Automática → maior → … → menor → Automática. */
    private fun cycleQuality() {
        val hs = videoHeights()
        if (hs.size < 2) { flash(t("Este canal tem uma qualidade só.", "This channel has only one quality.")); return }
        val i = hs.indexOf(manualH)
        manualH = if (manualH == 0) hs[0] else if (i >= 0 && i < hs.size - 1) hs[i + 1] else 0
        applyQuality()
        flash(t("Qualidade: ", "Quality: ") + if (manualH == 0) (if (quality == "max") t("Máxima", "Maximum") else t("Automática", "Auto")) else "${manualH}p")
    }

    private fun flash(msg: String) {
        bufTxt.text = msg; bufTxt.visibility = View.VISIBLE
        flashUntil = SystemClock.uptimeMillis() + 3000
        showPanel(3000)
    }

    /* ---------------- teclas ---------------- */

    private fun zap(d: Int) {
        val list = Playlist.items
        if (list.size < 2) return
        index = (index + d + list.size) % list.size
        val it = list[index]
        url = it.url; id = it.id; title = it.name; retries = 0; manualH = 0
        player?.let { pl -> pl.trackSelectionParameters = pl.trackSelectionParameters.buildUpon().clearOverridesOfType(C.TRACK_TYPE_VIDEO).build() }
        reconnecting = false; ui.removeCallbacks(reconnect)
        err.visibility = View.GONE
        load(url, 0)
        showChannel()
        showPanel(5000)
    }

    private fun seekBy(ms: Long) {
        val p = player ?: return
        val dur = p.duration.let { if (it == C.TIME_UNSET) Long.MAX_VALUE else it }
        val base = if (seekTarget >= 0) seekTarget else p.currentPosition
        seekTarget = (base + ms).coerceIn(0L, maxOf(0L, dur - 1000))
        ui.removeCallbacks(doSeek)
        ui.postDelayed(doSeek, 450) // junta vários toques seguidos num pulo só
        showPanel(5000)
    }

    private fun togglePause() {
        val p = player ?: return
        p.playWhenReady = !p.playWhenReady
        showPanel(5000)
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        val code = event.keyCode
        if (code in QUALITY_KEYS) { if (event.action == KeyEvent.ACTION_DOWN && event.repeatCount == 0) cycleQuality(); return true }
        if (code == KeyEvent.KEYCODE_BACK || code == KeyEvent.KEYCODE_ESCAPE) {
            if (event.action == KeyEvent.ACTION_UP) finish()
            return true
        }
        if (event.action != KeyEvent.ACTION_DOWN) return super.dispatchKeyEvent(event)
        val rep = event.repeatCount
        if (type == "live") {
            when (code) {
                KeyEvent.KEYCODE_DPAD_UP, KeyEvent.KEYCODE_CHANNEL_UP, KeyEvent.KEYCODE_PAGE_UP -> { zap(-1); return true }
                KeyEvent.KEYCODE_DPAD_DOWN, KeyEvent.KEYCODE_CHANNEL_DOWN, KeyEvent.KEYCODE_PAGE_DOWN -> { zap(1); return true }
                KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER, KeyEvent.KEYCODE_NUMPAD_ENTER -> {
                    if (panel.visibility == View.VISIBLE && rep == 0) hidePanel() else showPanel(6000); return true
                }
                KeyEvent.KEYCODE_DPAD_LEFT, KeyEvent.KEYCODE_DPAD_RIGHT -> { showPanel(5000); return true }
            }
        } else {
            when (code) {
                KeyEvent.KEYCODE_DPAD_LEFT, KeyEvent.KEYCODE_MEDIA_REWIND -> { seekBy(if (rep > 3) -60000 else -10000); return true }
                KeyEvent.KEYCODE_DPAD_RIGHT, KeyEvent.KEYCODE_MEDIA_FAST_FORWARD -> { seekBy(if (rep > 3) 60000 else 10000); return true }
                KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER, KeyEvent.KEYCODE_NUMPAD_ENTER,
                KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE, KeyEvent.KEYCODE_SPACE -> { if (rep == 0) togglePause(); return true }
                KeyEvent.KEYCODE_MEDIA_PLAY -> { player?.playWhenReady = true; showPanel(5000); return true }
                KeyEvent.KEYCODE_MEDIA_PAUSE -> { player?.playWhenReady = false; showPanel(5000); return true }
                KeyEvent.KEYCODE_DPAD_UP, KeyEvent.KEYCODE_DPAD_DOWN -> { showPanel(5000); return true }
            }
        }
        return super.dispatchKeyEvent(event)
    }

    private fun saveResult() {
        val p = player
        val dur = p?.duration ?: 0L
        val r = JSONObject()
            .put("id", id).put("type", type).put("index", index)
            .put("pos", p?.currentPosition ?: 0L)
            .put("dur", if (dur == C.TIME_UNSET) 0L else dur)
        setResult(RESULT_OK, Intent().putExtra("r", r.toString()))
    }

    companion object {
        private val QUALITY_KEYS = setOf(KeyEvent.KEYCODE_MENU, KeyEvent.KEYCODE_INFO, KeyEvent.KEYCODE_PROG_RED, KeyEvent.KEYCODE_SETTINGS)
        private var meterInstance: DefaultBandwidthMeter? = null

        /** Um medidor só para o app todo: a velocidade medida num canal já vale para o próximo. Começa em 8 Mbps. */
        fun sharedMeter(ctx: android.content.Context): DefaultBandwidthMeter =
            meterInstance ?: DefaultBandwidthMeter.Builder(ctx.applicationContext)
                .setInitialBitrateEstimate(8_000_000L)
                .build().also { meterInstance = it }
    }

    override fun finish() {
        if (player != null) saveResult()
        super.finish()
    }
}
