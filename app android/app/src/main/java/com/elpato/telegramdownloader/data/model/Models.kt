package com.elpato.telegramdownloader.data.model

import com.google.gson.annotations.SerializedName

data class DownloadItemDto(
    @SerializedName("db_id") val dbId: Long,
    @SerializedName("id") val messageId: Long,
    @SerializedName("entity_id") val entityId: String? = null,
    @SerializedName("nombre") val filename: String,
    @SerializedName("tamanio") val totalSize: Long,
    @SerializedName("tamanio_fmt") val totalSizeFmt: String? = null,
    @SerializedName("state") var state: String,
    @SerializedName("downloaded_bytes") var downloadedBytes: Long = 0,
    @SerializedName("file_path") val filePath: String? = null,
    @SerializedName("package_name") val packageName: String? = null,
    @SerializedName("channel_name") val channelName: String? = null,
    @SerializedName("fecha") val date: String? = null,
    var currentSpeedMbps: Double = 0.0
) {
    val progressPercent: Int
        get() = if (totalSize > 0) {
            ((downloadedBytes.toDouble() / totalSize.toDouble()) * 100).toInt().coerceIn(0, 100)
        } else 0
}

sealed class DownloadRowItem {
    data class ChannelHeader(
        val channelName: String,
        val totalFiles: Int,
        val totalSize: Long,
        val downloadedBytes: Long,
        val isExpanded: Boolean,
        val activeDownloadingCount: Int,
        val speedMbps: Double,
        val allDone: Boolean,
        val anyPaused: Boolean
    ) : DownloadRowItem() {
        val progressPercent: Int
            get() = if (totalSize > 0) {
                ((downloadedBytes.toDouble() / totalSize.toDouble()) * 100).toInt().coerceIn(0, 100)
            } else 0
    }

    data class FileItem(
        val item: DownloadItemDto,
        val channelName: String
    ) : DownloadRowItem()
}

data class HistoryResponse(
    @SerializedName("success") val success: Boolean = true,
    @SerializedName("history") val history: List<DownloadItemDto>? = null
)

data class LoginRequest(
    @SerializedName("password") val password: String
)

data class LoginResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("error") val error: String? = null
)

data class StatusResponse(
    @SerializedName("status") val status: String? = null,
    @SerializedName("logged_in") val loggedIn: Boolean? = null,
    @SerializedName("phone") val phone: String? = null
)

data class ScanLinkRequest(
    @SerializedName("link") val link: String
)

data class ScanVideoItem(
    @SerializedName("original_idx") val originalIdx: Int,
    @SerializedName("id") val id: Long,
    @SerializedName("nombre") val name: String,
    @SerializedName("tamanio") val size: Long,
    @SerializedName("tamanio_fmt") val sizeFmt: String? = null,
    @SerializedName("fecha") val date: String? = null,
    @SerializedName("carpeta") val folder: String? = null
)

data class ScanResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("package_id") val packageId: Long? = null,
    @SerializedName("package_name") val packageName: String? = null,
    @SerializedName("channel_name") val channelName: String? = null,
    @SerializedName("videos") val videos: List<ScanVideoItem>? = null,
    @SerializedName("error") val error: String? = null
)

data class DownloadRequestDto(
    @SerializedName("indices") val indices: List<Int>? = null,
    @SerializedName("custom_dir") val customDir: String = "",
    @SerializedName("overwrite") val overwrite: Boolean = false,
    @SerializedName("is_resume") val isResume: Boolean = false
)

data class ActionResponse(
    @SerializedName("success") val success: Boolean? = true,
    @SerializedName("message") val message: String? = null,
    @SerializedName("error") val error: String? = null
)

data class WebSocketEvent(
    @SerializedName("type") val type: String,
    @SerializedName("downloaded") val downloaded: Long? = null,
    @SerializedName("total_size") val totalSize: Long? = null,
    @SerializedName("speed_mbps") val speedMbps: Double? = null,
    @SerializedName("index") val index: Int? = null,
    @SerializedName("db_id") val dbId: Long? = null,
    @SerializedName("state") val state: String? = null,
    @SerializedName("package_name") val packageName: String? = null,
    @SerializedName("channel_name") val channelName: String? = null,
    @SerializedName("file_path") val filePath: String? = null,
    @SerializedName("message") val message: String? = null
)
