package com.lumeaplay.tv

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView
import androidx.annotation.OptIn
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DefaultDataSource
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.exoplayer.upstream.DefaultBandwidthMeter
import androidx.media3.exoplayer.upstream.DefaultLoadErrorHandlingPolicy
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import org.json.JSONObject
import java.text.NumberFormat
import java.util.Locale

/**
 * Player com sistema anti-travamento:
 *  - buffer configurável (Normal / Alto / Máximo)
 *  - reconexão automática com espera progressiva quando o sinal cai
 *  - volta ao ponto ao vivo quando a transmissão "fica para trás"
 *  - vigia: se a imagem congela ou fica carregando tempo demais, recarrega sozinho
 *  - mostra a velocidade (kbps) e a resolução enquanto carrega
 */
@OptIn(UnstableApi::class)
class PlayerActivity : Activity() {

    private var player: ExoPlayer? = null
    private lateinit var view: PlayerView
    private lateinit var osd: LinearLayout
    private lateinit var osdNum: TextView
    private lateinit var osdTitle: TextView
    private lateinit var osdSub: TextView
    private lateinit var err: TextView
    private lateinit var net: TextView
    private lateinit var bufTxt: TextView
    private lateinit var meter: DefaultBandwidthMeter
    private val ui = Handler(Looper.getMainLooper())
    private val nf: NumberFormat = NumberFormat.getIntegerInstance(Locale("pt", "BR"))

    private var id = ""
    private var type = "vod"
    private var title = ""
    private var sub = ""
    private var url = ""
    private var buf = "alto"
    private var index = 0
    private var startMs = 0L
    private var retries = 0
    private var reconnecting = false
    private var bufferingSince = 0L
    private var lastPos = -1L
    private var frozenMs = 0L
    private var osdUntil = 0L

    private val reconnect = Runnable { reconnecting = false; reload() }
    private val tick = object : Runnable {
        override fun run() { watchdog(); ui.postDelayed(this, 1000) }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility = (View.SYSTEM_UI_FLAG_FULLSCREEN or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY)
        setContentView(R.layout.activity_player)
        view = findViewById(R.id.pv)
        osd = findViewById(R.id.osd)
        osdNum = findViewById(R.id.osdNum)
        osdTitle = findViewById(R.id.osdTitle)
        osdSub = findViewById(R.id.osdSub)
        err = findViewById(R.id.err)
        net = findViewById(R.id.net)
        bufTxt = findViewById(R.id.bufTxt)
        meter = DefaultBandwidthMeter.getSingletonInstance(this)

        val p = JSONObject(intent.getStringExtra("p") ?: "{}")
        id = p.optString("id"); type = p.optString("type", "vod"); title = p.optString("title")
        sub = p.optString("sub"); url = p.optString("url"); index = p.optInt("index", 0)
        startMs = p.optLong("start", 0); buf = p.optString("buf", "alto")

        view.setShowBuffering(PlayerView.SHOW_BUFFERING_ALWAYS)
        view.controllerShowTimeoutMs = 3500
        view.setShowNextButton(false)
        view.setShowPreviousButton(false)
        view.resizeMode = when (p.optString("resize", "fit")) {
            "fill" -> AspectRatioFrameLayout.RESIZE_MODE_ZOOM
            "zoom" -> AspectRatioFrameLayout.RESIZE_MODE_FILL
            else -> AspectRatioFrameLayout.RESIZE_MODE_FIT
        }
        if (type == "live") { view.setShowFastForwardButton(false); view.setShowRewindButton(false) }
    }

    override fun onStart() {
        super.onStart()
        if (player == null) initPlayer()
        ui.removeCallbacks(tick); ui.post(tick)
    }

    override fun onStop() {
        super.onStop()
        ui.removeCallbacks(tick); ui.removeCallbacks(reconnect)
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
            "normal" -> intArrayOf(15000, 50000, 1500, 3000)
            "max" -> intArrayOf(50000, 180000, 4000, 8000)
            else -> intArrayOf(30000, 90000, 2500, 5000)
        }
        val load = DefaultLoadControl.Builder()
            .setBufferDurationsMs(b[0], b[1], b[2], b[3])
            .setPrioritizeTimeOverSizeThresholds(true)
            .build()
        val sources = DefaultMediaSourceFactory(DefaultDataSource.Factory(this, http))
            .setLoadErrorHandlingPolicy(DefaultLoadErrorHandlingPolicy(8))
        val p = ExoPlayer.Builder(this)
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
        showOsd(currentNum(), title, sub)
    }

    private fun currentNum() = if (type == "live" && index < Playlist.items.size) Playlist.items[index].num else 0

    private fun load(u: String, start: Long) {
        val p = player ?: return
        val b = MediaItem.Builder().setUri(Uri.parse(u))
        if (u.lowercase().contains(".m3u8")) b.setMimeType(MimeTypes.APPLICATION_M3U8)
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
            err.text = "Não foi possível reproduzir este conteúdo agora.\nVerifique a internet ou tente mais tarde."
            err.visibility = View.VISIBLE
            return
        }
        retries++
        reconnecting = true
        val delay = minOf(8000L, 1000L shl minOf(retries - 1, 3))
        err.text = if (type == "live") "Sinal instável. Reconectando… (tentativa $retries)" else "Reconectando…"
        err.visibility = View.VISIBLE
        ui.removeCallbacks(reconnect)
        ui.postDelayed(reconnect, delay)
    }

    /** Roda a cada segundo: mostra kbps e destrava a reprodução se precisar. */
    private fun watchdog() {
        val p = player ?: return
        val now = SystemClock.uptimeMillis()
        val kbps = meter.bitrateEstimate / 1000
        val h = p.videoFormat?.height ?: 0
        val speed = (if (h > 0) "${h}p  ·  " else "") + nf.format(kbps) + " kbps"
        val buffering = p.playbackState == Player.STATE_BUFFERING

        if (buffering && p.playWhenReady) {
            bufTxt.text = "Carregando…  " + nf.format(kbps) + " kbps"
            bufTxt.visibility = View.VISIBLE
            val limit = if (type == "live") 12000 else 25000
            if (bufferingSince > 0 && now - bufferingSince > limit && !reconnecting) {
                bufferingSince = now
                retries++
                reload()
            }
        } else bufTxt.visibility = View.GONE

        net.text = speed
        net.visibility = if (buffering || now < osdUntil || view.isControllerFullyVisible) View.VISIBLE else View.GONE

        // imagem congelada no ao vivo: posição não anda por 8 s
        if (type == "live" && p.playbackState == Player.STATE_READY && p.playWhenReady) {
            val pos = p.currentPosition
            if (pos == lastPos) {
                frozenMs += 1000
                if (frozenMs >= 8000) { frozenMs = 0; reload() }
            } else { frozenMs = 0; lastPos = pos }
        } else frozenMs = 0
    }

    private fun showOsd(num: Int, t: String, s: String) {
        osdNum.visibility = if (num > 0) View.VISIBLE else View.GONE
        osdNum.text = num.toString()
        osdTitle.text = t
        osdSub.text = s
        osd.visibility = View.VISIBLE
        osdUntil = SystemClock.uptimeMillis() + 4000
        ui.removeCallbacksAndMessages("osd")
        ui.postAtTime({ osd.visibility = View.GONE }, "osd", osdUntil)
    }

    private fun zap(d: Int) {
        val list = Playlist.items
        if (list.size < 2) return
        index = (index + d + list.size) % list.size
        val it = list[index]
        url = it.url; id = it.id; title = it.name; retries = 0
        reconnecting = false; ui.removeCallbacks(reconnect)
        err.visibility = View.GONE
        load(url, 0)
        showOsd(it.num, it.name, sub)
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (type == "live" && event.action == KeyEvent.ACTION_DOWN && !view.isControllerFullyVisible) {
            when (event.keyCode) {
                KeyEvent.KEYCODE_DPAD_UP, KeyEvent.KEYCODE_CHANNEL_UP, KeyEvent.KEYCODE_PAGE_UP -> { zap(-1); return true }
                KeyEvent.KEYCODE_DPAD_DOWN, KeyEvent.KEYCODE_CHANNEL_DOWN, KeyEvent.KEYCODE_PAGE_DOWN -> { zap(1); return true }
                KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER -> { showOsd(currentNum(), title, sub); view.showController(); return true }
            }
        }
        if (type == "vod" && event.action == KeyEvent.ACTION_DOWN && !view.isControllerFullyVisible) {
            val p = player
            when (event.keyCode) {
                KeyEvent.KEYCODE_DPAD_LEFT -> { p?.seekTo(maxOf(0, p.currentPosition - 10000)); view.showController(); return true }
                KeyEvent.KEYCODE_DPAD_RIGHT -> { p?.seekTo(p.currentPosition + 10000); view.showController(); return true }
            }
        }
        if (event.keyCode == KeyEvent.KEYCODE_BACK && event.action == KeyEvent.ACTION_UP && view.isControllerFullyVisible) {
            view.hideController(); return true
        }
        return view.dispatchKeyEvent(event) || super.dispatchKeyEvent(event)
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

    override fun finish() {
        if (player != null) saveResult()
        super.finish()
    }
}
