package com.elpato.telegramdownloader.data.prefs

import android.content.Context
import android.content.SharedPreferences

class PreferencesManager(context: Context) {

    private val prefs: SharedPreferences =
        context.getSharedPreferences("tg_downloader_prefs", Context.MODE_PRIVATE)

    companion object {
        private const val KEY_SERVER_URL = "server_url"
        private const val KEY_SERVER_PASSWORD = "server_password"
        private const val KEY_AUTH_TOKEN = "auth_token"
    }

    var serverUrl: String
        get() = prefs.getString(KEY_SERVER_URL, "") ?: ""
        set(value) {
            val clean = cleanUrl(value)
            prefs.edit().putString(KEY_SERVER_URL, clean).apply()
        }

    var serverPassword: String
        get() = prefs.getString(KEY_SERVER_PASSWORD, "") ?: ""
        set(value) = prefs.edit().putString(KEY_SERVER_PASSWORD, value).apply()

    var authToken: String
        get() = prefs.getString(KEY_AUTH_TOKEN, "") ?: ""
        set(value) = prefs.edit().putString(KEY_AUTH_TOKEN, value).apply()

    val isConfigured: Boolean
        get() = serverUrl.isNotBlank()

    val httpBaseUrl: String
        get() {
            var url = serverUrl.trim()
            if (!url.startsWith("http://") && !url.startsWith("https://")) {
                url = "http://$url"
            }
            return url.removeSuffix("/")
        }

    val wsBaseUrl: String
        get() {
            val http = httpBaseUrl
            return if (http.startsWith("https://")) {
                "wss://" + http.removePrefix("https://") + "/ws"
            } else {
                "ws://" + http.removePrefix("http://") + "/ws"
            }
        }

    private fun cleanUrl(url: String): String {
        var trimmed = url.trim()
        if (trimmed.isNotEmpty() && !trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
            trimmed = "http://$trimmed"
        }
        return trimmed.removeSuffix("/")
    }
}
