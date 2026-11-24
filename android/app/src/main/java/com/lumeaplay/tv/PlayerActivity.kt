package com.lumeaplay.tv

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
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
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import org.json.JSONObject

@OptIn(UnstableApi::class)
class PlayerActivity : Activity() {

    private var player: ExoPlayer? = null
    private lateinit var view: PlayerView
    private lateinit var osd: LinearLayout
    private lateinit var osdNum: TextView
    private lateinit var osdTitle: TextView
    private lateinit var osdSub: TextView
    private lateinit var err: TextView
    private val ui = Handler(Looper.getMainLooper())

    private var id = ""
    private var type = "vod"
    private var title = ""
    private var sub = ""
    private var url = ""
    private var index = 0
    private var startMs = 0L
    private var retries = 0
    private var resultSet = false

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

        val p = JSONObject(intent.getStringExtra("p") ?: "{}")
        id = p.optString("id"); type = p.optString("type", "vod"); title = p.optString("title")
        sub = p.optString("sub"); url = p.optString("url"); index = p.optInt("index", 0); startMs = p.optLong("start", 0)

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
    }

    override fun onStop() {
        super.onStop()
        saveResult()
        player?.release(); player = null
    }

    private fun initPlayer() {
        val http = DefaultHttpDataSource.Factory()
            .setUserAgent(MainActivity.UA)
            .setAllowCrossProtocolRedirects(true)
            .setConnectTimeoutMs(15000)
            .setReadTimeoutMs(20000)
        val load = DefaultLoadControl.Builder()
            .setBufferDurationsMs(15000, 60000, 1500, 3000)
            .build()
        val p = ExoPlayer.Builder(this)
            .setMediaSourceFactory(DefaultMediaSourceFactory(DefaultDataSource.Factory(this, http)))
            .setLoadControl(load)
            .build()
        p.addListener(object : Player.Listener {
            override fun onPlayerError(error: PlaybackException) {
                if (type == "live" && retries < 3) {
                    retries++
                    ui.postDelayed({ load(url, 0) }, 1500)
                } else {
                    err.text = "Não foi possível reproduzir este conteúdo agora.\nTente outro canal ou volte mais tarde."
                    err.visibility = View.VISIBLE
                }
            }

            override fun onPlaybackStateChanged(state: Int) {
                if (state == Player.STATE_READY) { retries = 0; err.visibility = View.GONE }
                if (state == Player.STATE_ENDED && type == "vod") finish()
            }
        })
        player = p
        view.player = p
        load(url, startMs)
        showOsd(if (type == "live" && index < Playlist.items.size) Playlist.items[index].num else 0, title, sub)
    }

    private fun load(u: String, start: Long) {
        val p = player ?: return
        val b = MediaItem.Builder().setUri(Uri.parse(u))
        val low = u.lowercase()
        if (low.contains(".m3u8")) b.setMimeType(MimeTypes.APPLICATION_M3U8)
        p.setMediaItem(b.build(), if (start > 0) start else C.TIME_UNSET)
        p.prepare()
        p.playWhenReady = true
    }

    private fun showOsd(num: Int, t: String, s: String) {
        osdNum.visibility = if (num > 0) View.VISIBLE else View.GONE
        osdNum.text = num.toString()
        osdTitle.text = t
        osdSub.text = s
        osd.visibility = View.VISIBLE
        ui.removeCallbacksAndMessages("osd")
        ui.postAtTime({ osd.visibility = View.GONE }, "osd", android.os.SystemClock.uptimeMillis() + 4000)
    }

    private fun zap(d: Int) {
        val list = Playlist.items
        if (list.size < 2) return
        index = (index + d + list.size) % list.size
        val it = list[index]
        url = it.url; id = it.id; title = it.name; retries = 0
        err.visibility = View.GONE
        load(url, 0)
        showOsd(it.num, it.name, sub)
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (type == "live" && event.action == KeyEvent.ACTION_DOWN && !view.isControllerFullyVisible) {
            when (event.keyCode) {
                KeyEvent.KEYCODE_DPAD_UP, KeyEvent.KEYCODE_CHANNEL_UP, KeyEvent.KEYCODE_PAGE_UP -> { zap(-1); return true }
                KeyEvent.KEYCODE_DPAD_DOWN, KeyEvent.KEYCODE_CHANNEL_DOWN, KeyEvent.KEYCODE_PAGE_DOWN -> { zap(1); return true }
                KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER -> { showOsd(if (index < Playlist.items.size) Playlist.items[index].num else 0, title, sub); view.showController(); return true }
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
        resultSet = true
    }

    override fun finish() {
        if (player != null) saveResult()
        super.finish()
    }
}
