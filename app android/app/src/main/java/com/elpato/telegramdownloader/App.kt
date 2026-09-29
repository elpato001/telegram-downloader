package com.elpato.telegramdownloader

import android.app.Application
import com.elpato.telegramdownloader.data.api.ApiClient
import com.elpato.telegramdownloader.data.api.WebSocketManager
import com.elpato.telegramdownloader.data.prefs.PreferencesManager

class App : Application() {

    lateinit var prefs: PreferencesManager
        private set

    lateinit var apiClient: ApiClient
        private set

    lateinit var wsManager: WebSocketManager
        private set

    override fun onCreate() {
        super.onCreate()
        instance = this
        prefs = PreferencesManager(this)
        apiClient = ApiClient(prefs)
        wsManager = WebSocketManager(apiClient.okHttpClient, prefs)
    }

    companion object {
        lateinit var instance: App
            private set
    }
}
