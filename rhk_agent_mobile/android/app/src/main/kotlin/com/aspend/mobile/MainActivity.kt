package com.aspend.mobile

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import io.flutter.FlutterInjector
import android.os.Bundle
import androidx.core.view.WindowCompat
import android.media.MediaPlayer
import android.content.res.AssetFileDescriptor

class MainActivity : FlutterActivity() {
    private val CHANNEL = "com.aspend.mobile/sound"
    private var mediaPlayer: MediaPlayer? = null
    private var confirmPlayer: MediaPlayer? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL).setMethodCallHandler { call, result ->
            when (call.method) {
                "playIntroSound" -> {
                    try {
                        mediaPlayer?.release()
                        mediaPlayer = null

                        val loader = FlutterInjector.instance().flutterLoader()
                        val assetKey = loader.getLookupKeyForAsset("assets/sounds/assistant_intro.mp3")
                        val afd: AssetFileDescriptor = try {
                            assets.openFd(assetKey)
                        } catch (_: Exception) {
                            assets.openFd("flutter_assets/assets/sounds/assistant_intro.mp3")
                        }

                        mediaPlayer = MediaPlayer().apply {
                            setDataSource(afd.fileDescriptor, afd.startOffset, afd.length)
                            afd.close()
                            isLooping = false
                            setVolume(1.0f, 1.0f)
                            prepare()
                            start()
                        }
                        result.success(true)
                    } catch (e: Exception) {
                        result.success(false)
                    }
                }
                "playConfirmSound" -> {
                    try {
                        confirmPlayer?.release()
                        confirmPlayer = null

                        val loader = FlutterInjector.instance().flutterLoader()
                        val assetKey = loader.getLookupKeyForAsset("assets/sounds/confirm_chime.mp3")
                        val afd: AssetFileDescriptor = try {
                            assets.openFd(assetKey)
                        } catch (_: Exception) {
                            assets.openFd("flutter_assets/assets/sounds/confirm_chime.mp3")
                        }

                        confirmPlayer = MediaPlayer().apply {
                            setDataSource(afd.fileDescriptor, afd.startOffset, afd.length)
                            afd.close()
                            isLooping = false
                            setVolume(0.9f, 0.9f)
                            prepare()
                            start()
                        }
                        result.success(true)
                    } catch (e: Exception) {
                        result.success(false)
                    }
                }
                "stopSound" -> {
                    try {
                        mediaPlayer?.stop()
                        mediaPlayer?.release()
                        mediaPlayer = null

                        confirmPlayer?.stop()
                        confirmPlayer?.release()
                        confirmPlayer = null
                        result.success(true)
                    } catch (e: Exception) {
                        result.success(false)
                    }
                }
                else -> result.notImplemented()
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        try {
            mediaPlayer?.release()
            mediaPlayer = null
            confirmPlayer?.release()
            confirmPlayer = null
        } catch (_: Exception) {}
    }
}
