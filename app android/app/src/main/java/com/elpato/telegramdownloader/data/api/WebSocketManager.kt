package com.elpato.telegramdownloader.data.api

import android.os.Handler
import android.os.Looper
import android.util.Log
import com.elpato.telegramdownloader.data.model.WebSocketEvent
import com.elpato.telegramdownloader.data.prefs.PreferencesManager
import com.google.gson.Gson
import okhttp3.*

class WebSocketManager(
    private val client: OkHttpClient,
    private val prefs: PreferencesManager
) {

    private val gson = Gson()
    private var webSocket: WebSocket? = null
    private var isConnected = false
    private var isConnecting = false
    private var shouldReconnect = true
    private val mainHandler = Handler(Looper.getMainLooper())

    interface WebSocketListener {
        fun onConnected()
        fun onDisconnected()
        fun onEventReceived(event: WebSocketEvent)
    }

    private val listeners = mutableListOf<WebSocketListener>()

    fun addListener(listener: WebSocketListener) {
        if (!listeners.contains(listener)) {
            listeners.add(listener)
        }
    }

    fun removeListener(listener: WebSocketListener) {
        listeners.remove(listener)
    }

    @Synchronized
    fun connect() {
        if (isConnected || isConnecting) return
        val wsUrl = prefs.wsBaseUrl
        if (wsUrl.isBlank()) return

        shouldReconnect = true
        isConnecting = true

        val requestBuilder = Request.Builder().url(wsUrl)
        if (prefs.authToken.isNotEmpty()) {
            requestBuilder.addHeader("Cookie", "auth_token=${prefs.authToken}")
        }

        webSocket = client.newWebSocket(requestBuilder.build(), object : okhttp3.WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                isConnecting = false
                isConnected = true
                Log.d("WebSocketManager", "Connected to $wsUrl")
                mainHandler.post {
                    listeners.forEach { it.onConnected() }
                }
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                try {
                    val event = gson.fromJson(text, WebSocketEvent::class.java)
                    mainHandler.post {
                        listeners.forEach { it.onEventReceived(event) }
                    }
                } catch (e: Exception) {
                    Log.e("WebSocketManager", "Error parsing WS message: $text", e)
                }
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                webSocket.close(1000, null)
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                isConnecting = false
                isConnected = false
                Log.d("WebSocketManager", "Closed ($code): $reason")
                mainHandler.post {
                    listeners.forEach { it.onDisconnected() }
                }
                scheduleReconnect()
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                isConnecting = false
                isConnected = false
                Log.w("WebSocketManager", "WebSocket failure: ${t.message}")
                mainHandler.post {
                    listeners.forEach { it.onDisconnected() }
                }
                scheduleReconnect()
            }
        })
    }

    @Synchronized
    fun disconnect() {
        shouldReconnect = false
        isConnecting = false
        isConnected = false
        webSocket?.close(1000, "Normal closure")
        webSocket = null
    }

    private fun scheduleReconnect() {
        if (!shouldReconnect) return
        mainHandler.postDelayed({
            if (shouldReconnect && !isConnected && !isConnecting) {
                connect()
            }
        }, 4000)
    }
}
