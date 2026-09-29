package com.elpato.telegramdownloader.data.api

import com.elpato.telegramdownloader.data.model.*
import com.elpato.telegramdownloader.data.prefs.PreferencesManager
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.concurrent.TimeUnit

class ApiClient(private val prefs: PreferencesManager) {

    private val gson = Gson()
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    // In-memory cookie jar to store session auth_token
    private val cookieJar = object : CookieJar {
        private val cookieStore = mutableListOf<Cookie>()

        override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
            cookieStore.removeAll { oldCookie ->
                cookies.any { it.name == oldCookie.name && it.domain == oldCookie.domain }
            }
            cookieStore.addAll(cookies)
        }

        override fun loadForRequest(url: HttpUrl): List<Cookie> {
            val list = cookieStore.filter { it.matches(url) }.toMutableList()
            if (prefs.authToken.isNotEmpty() && list.none { it.name == "auth_token" }) {
                // Agregar cookie de autenticación si está guardada
                list.add(
                    Cookie.Builder()
                        .name("auth_token")
                        .value(prefs.authToken)
                        .domain(url.host)
                        .path("/")
                        .build()
                )
            }
            return list
        }
    }

    val okHttpClient: OkHttpClient = OkHttpClient.Builder()
        .cookieJar(cookieJar)
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    suspend fun login(password: String): Result<Boolean> = withContext(Dispatchers.IO) {
        try {
            val baseUrl = prefs.httpBaseUrl
            if (baseUrl.isBlank()) return@withContext Result.failure(Exception("URL del servidor no configurada"))

            val body = gson.toJson(LoginRequest(password)).toRequestBody(jsonMediaType)
            val request = Request.Builder()
                .url("$baseUrl/api/login")
                .post(body)
                .build()

            val response = okHttpClient.newCall(request).execute()
            val respBody = response.body?.string().orEmpty()
            if (response.isSuccessful) {
                val loginResp = gson.fromJson(respBody, LoginResponse::class.java)
                if (loginResp.success) {
                    Result.success(true)
                } else {
                    Result.failure(Exception(loginResp.error ?: "Contraseña incorrecta"))
                }
            } else {
                Result.failure(Exception("Error HTTP ${response.code}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun testConnection(): Result<Boolean> = withContext(Dispatchers.IO) {
        try {
            val baseUrl = prefs.httpBaseUrl
            if (baseUrl.isBlank()) return@withContext Result.failure(Exception("URL no configurada"))

            // Si hay contraseña guardada, intentar login primero
            if (prefs.serverPassword.isNotBlank()) {
                val loginRes = login(prefs.serverPassword)
                if (loginRes.isFailure) return@withContext loginRes
            }

            val request = Request.Builder()
                .url("$baseUrl/api/status")
                .get()
                .build()

            val response = okHttpClient.newCall(request).execute()
            if (response.isSuccessful) {
                Result.success(true)
            } else {
                Result.failure(Exception("El servidor respondió con código HTTP ${response.code}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getHistory(): Result<List<DownloadItemDto>> = withContext(Dispatchers.IO) {
        try {
            val baseUrl = prefs.httpBaseUrl
            if (baseUrl.isBlank()) return@withContext Result.failure(Exception("URL no configurada"))

            val request = Request.Builder()
                .url("$baseUrl/api/history")
                .get()
                .build()

            val response = okHttpClient.newCall(request).execute()
            if (!response.isSuccessful) {
                return@withContext Result.failure(Exception("HTTP ${response.code}"))
            }

            val body = response.body?.string().orEmpty()
            val list: List<DownloadItemDto> = if (body.trim().startsWith("[")) {
                val type = object : TypeToken<List<DownloadItemDto>>() {}.type
                gson.fromJson(body, type) ?: emptyList()
            } else {
                val historyResp = gson.fromJson(body, HistoryResponse::class.java)
                historyResp.history ?: emptyList()
            }
            Result.success(list)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun scanLink(link: String): Result<ScanResponse> = withContext(Dispatchers.IO) {
        try {
            val baseUrl = prefs.httpBaseUrl
            if (baseUrl.isBlank()) return@withContext Result.failure(Exception("URL no configurada"))

            val body = gson.toJson(ScanLinkRequest(link)).toRequestBody(jsonMediaType)
            val request = Request.Builder()
                .url("$baseUrl/api/scan")
                .post(body)
                .build()

            val response = okHttpClient.newCall(request).execute()
            val respBody = response.body?.string().orEmpty()
            if (response.isSuccessful) {
                val scanResp = gson.fromJson(respBody, ScanResponse::class.java)
                if (scanResp.success) {
                    Result.success(scanResp)
                } else {
                    Result.failure(Exception(scanResp.error ?: "Error al escanear"))
                }
            } else {
                Result.failure(Exception("HTTP ${response.code}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun startDownload(indices: List<Int>, customDir: String = "", overwrite: Boolean = false): Result<Boolean> =
        withContext(Dispatchers.IO) {
            try {
                val baseUrl = prefs.httpBaseUrl
                val req = DownloadRequestDto(indices = indices, customDir = customDir, overwrite = overwrite)
                val body = gson.toJson(req).toRequestBody(jsonMediaType)
                val request = Request.Builder()
                    .url("$baseUrl/api/download")
                    .post(body)
                    .build()

                val response = okHttpClient.newCall(request).execute()
                if (response.isSuccessful) {
                    Result.success(true)
                } else {
                    Result.failure(Exception("HTTP ${response.code}"))
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }

    suspend fun pauseDownload(id: Long): Result<Boolean> = withContext(Dispatchers.IO) {
        postJson("/api/download/pause", mapOf("index" to id))
    }

    suspend fun resumeDownload(id: Long): Result<Boolean> = withContext(Dispatchers.IO) {
        postJson("/api/download/resume", mapOf("index" to id))
    }

    suspend fun stopDownload(id: Long): Result<Boolean> = withContext(Dispatchers.IO) {
        postJson("/api/download/stop", mapOf("index" to id))
    }

    suspend fun clearCompleted(): Result<Boolean> = withContext(Dispatchers.IO) {
        postJson("/api/downloads/clear_completed", emptyMap<String, Any>())
    }

    suspend fun deleteDownload(id: Long): Result<Boolean> = withContext(Dispatchers.IO) {
        postJson("/api/downloads/delete", mapOf("db_ids" to listOf(id), "index" to id))
    }

    suspend fun deleteChannel(channelName: String): Result<Boolean> = withContext(Dispatchers.IO) {
        postJson("/api/downloads/delete", mapOf("channel_name" to channelName))
    }

    suspend fun resumeChannel(ids: List<Long>): Result<Boolean> = withContext(Dispatchers.IO) {
        try {
            ids.forEach { resumeDownload(it) }
            Result.success(true)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun pauseChannel(ids: List<Long>): Result<Boolean> = withContext(Dispatchers.IO) {
        try {
            ids.forEach { pauseDownload(it) }
            Result.success(true)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private fun postJson(path: String, payload: Any): Result<Boolean> {
        return try {
            val baseUrl = prefs.httpBaseUrl
            val body = gson.toJson(payload).toRequestBody(jsonMediaType)
            val request = Request.Builder()
                .url("$baseUrl$path")
                .post(body)
                .build()

            val response = okHttpClient.newCall(request).execute()
            if (response.isSuccessful) {
                Result.success(true)
            } else {
                Result.failure(Exception("HTTP ${response.code}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
