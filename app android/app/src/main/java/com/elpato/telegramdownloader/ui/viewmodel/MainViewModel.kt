package com.elpato.telegramdownloader.ui.viewmodel

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.elpato.telegramdownloader.App
import com.elpato.telegramdownloader.data.api.WebSocketManager
import com.elpato.telegramdownloader.data.model.DownloadItemDto
import com.elpato.telegramdownloader.data.model.DownloadRowItem
import com.elpato.telegramdownloader.data.model.WebSocketEvent
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

enum class ConnectionState {
    CONNECTING,
    CONNECTED,
    DISCONNECTED
}

enum class TabFilter {
    ALL,
    ACTIVE,
    COMPLETED
}

class MainViewModel : ViewModel(), WebSocketManager.WebSocketListener {

    private val apiClient = App.instance.apiClient
    private val wsManager = App.instance.wsManager
    val prefs = App.instance.prefs

    private val _downloads = MutableLiveData<List<DownloadItemDto>>(emptyList())
    val downloads: LiveData<List<DownloadItemDto>> = _downloads

    private val _displayItems = MutableLiveData<List<DownloadRowItem>>(emptyList())
    val displayItems: LiveData<List<DownloadRowItem>> = _displayItems

    private val _connectionState = MutableLiveData(ConnectionState.DISCONNECTED)
    val connectionState: LiveData<ConnectionState> = _connectionState

    private val _isRefreshing = MutableLiveData(false)
    val isRefreshing: LiveData<Boolean> = _isRefreshing

    private val _globalSpeed = MutableLiveData(0.0)
    val globalSpeed: LiveData<Double> = _globalSpeed

    private val _message = MutableLiveData<String?>()
    val message: LiveData<String?> = _message

    private var currentTab = TabFilter.ALL
    private var currentSearchQuery = ""

    private val expandedChannels = mutableSetOf<String>()
    private val initialExpandDone = mutableSetOf<String>()
    private var pollingJob: Job? = null

    init {
        wsManager.addListener(this)
        if (prefs.isConfigured) {
            _connectionState.value = ConnectionState.CONNECTING
            wsManager.connect()
            loadHistory()
        }
        startPeriodicSync()
    }

    override fun onCleared() {
        super.onCleared()
        wsManager.removeListener(this)
        pollingJob?.cancel()
    }

    fun setTabFilter(tab: TabFilter) {
        currentTab = tab
        updateDisplayItems()
    }

    fun setSearchQuery(query: String) {
        currentSearchQuery = query.trim()
        updateDisplayItems()
    }

    fun refresh() {
        if (!prefs.isConfigured) {
            _connectionState.value = ConnectionState.DISCONNECTED
            _isRefreshing.value = false
            return
        }
        _isRefreshing.value = true
        wsManager.connect()
        loadHistory()
    }

    fun loadHistory() {
        viewModelScope.launch {
            val result = apiClient.getHistory()
            _isRefreshing.value = false
            if (result.isSuccess) {
                _connectionState.value = ConnectionState.CONNECTED
                val list = result.getOrNull() ?: emptyList()
                val reversedList = list.reversed() // Más recientes arriba
                _downloads.value = reversedList
                updateGlobalSpeed(reversedList)
                updateDisplayItems(reversedList)
            } else {
                _connectionState.value = ConnectionState.DISCONNECTED
            }
        }
    }

    private fun startPeriodicSync() {
        pollingJob?.cancel()
        pollingJob = viewModelScope.launch {
            while (isActive) {
                delay(6000) // Sincronizar periódicamente como respaldo al WebSocket
                if (prefs.isConfigured) {
                    val result = apiClient.getHistory()
                    if (result.isSuccess) {
                        _connectionState.value = ConnectionState.CONNECTED
                        val list = result.getOrNull() ?: emptyList()
                        val reversedList = list.reversed()
                        _downloads.value = reversedList
                        updateGlobalSpeed(reversedList)
                        updateDisplayItems(reversedList)
                    }
                }
            }
        }
    }

    private fun updateGlobalSpeed(list: List<DownloadItemDto>) {
        val totalSpeed = list.filter { it.state == "downloading" }.sumOf { it.currentSpeedMbps }
        _globalSpeed.value = totalSpeed
    }

    private fun updateDisplayItems(rawList: List<DownloadItemDto> = _downloads.value.orEmpty()) {
        val queryLower = currentSearchQuery.lowercase()

        // 1. Filtrar por pestaña seleccionada
        val tabFiltered = when (currentTab) {
            TabFilter.ALL -> rawList
            TabFilter.ACTIVE -> rawList.filter {
                val st = it.state.lowercase()
                st in listOf("downloading", "pending", "paused")
            }
            TabFilter.COMPLETED -> rawList.filter {
                it.state.lowercase() == "done"
            }
        }

        // 2. Filtrar por búsqueda si existe
        val filteredList = if (queryLower.isBlank()) {
            tabFiltered
        } else {
            tabFiltered.filter {
                it.filename.lowercase().contains(queryLower) ||
                (it.channelName ?: "").lowercase().contains(queryLower) ||
                (it.packageName ?: "").lowercase().contains(queryLower)
            }
        }

        val channelMap = LinkedHashMap<String, MutableList<DownloadItemDto>>()
        for (item in filteredList) {
            val chanName = (item.channelName?.trim()).takeIf { !it.isNullOrBlank() } ?: "Descargas Directas"
            channelMap.getOrPut(chanName) { mutableListOf() }.add(item)
        }

        // Si hay búsqueda activa, auto-expandir los canales encontrados
        if (queryLower.isNotBlank()) {
            expandedChannels.addAll(channelMap.keys)
        } else {
            // Expandir por defecto los nuevos canales que aparezcan
            for (chan in channelMap.keys) {
                if (!initialExpandDone.contains(chan)) {
                    initialExpandDone.add(chan)
                    expandedChannels.add(chan)
                }
            }
        }

        val rows = mutableListOf<DownloadRowItem>()
        for ((chanName, items) in channelMap) {
            val totalFiles = items.size
            val totalSize = items.sumOf { it.totalSize }
            val downloadedBytes = items.sumOf { it.downloadedBytes }
            val activeDownloadingCount = items.count { it.state == "downloading" }
            val speedMbps = items.filter { it.state == "downloading" }.sumOf { it.currentSpeedMbps }
            val allDone = items.isNotEmpty() && items.all { it.state == "done" }
            val anyPaused = items.any { it.state == "paused" }
            val isExpanded = expandedChannels.contains(chanName)

            rows.add(
                DownloadRowItem.ChannelHeader(
                    channelName = chanName,
                    totalFiles = totalFiles,
                    totalSize = totalSize,
                    downloadedBytes = downloadedBytes,
                    isExpanded = isExpanded,
                    activeDownloadingCount = activeDownloadingCount,
                    speedMbps = speedMbps,
                    allDone = allDone,
                    anyPaused = anyPaused
                )
            )

            if (isExpanded) {
                for (it in items) {
                    rows.add(DownloadRowItem.FileItem(item = it, channelName = chanName))
                }
            }
        }
        _displayItems.value = rows
    }

    // WebSocket Callbacks
    override fun onConnected() {
        _connectionState.postValue(ConnectionState.CONNECTED)
        loadHistory()
    }

    override fun onDisconnected() {
        _connectionState.postValue(ConnectionState.DISCONNECTED)
    }

    override fun onEventReceived(event: WebSocketEvent) {
        when (event.type) {
            "progress" -> {
                val targetId = event.dbId ?: return
                val current = _downloads.value?.toMutableList() ?: return
                val index = current.indexOfFirst { it.dbId == targetId }
                if (index != -1) {
                    val item = current[index].copy(
                        downloadedBytes = event.downloaded ?: current[index].downloadedBytes,
                        state = event.state ?: current[index].state,
                        currentSpeedMbps = event.speedMbps ?: 0.0
                    )
                    current[index] = item
                    _downloads.value = current
                    updateGlobalSpeed(current)
                    updateDisplayItems(current)
                }
            }
            "status_change" -> {
                val targetId = event.dbId ?: return
                val current = _downloads.value?.toMutableList() ?: return
                val index = current.indexOfFirst { it.dbId == targetId }
                if (index != -1) {
                    val newState = event.state ?: current[index].state
                    val item = current[index].copy(
                        state = newState,
                        currentSpeedMbps = if (newState == "downloading") current[index].currentSpeedMbps else 0.0
                    )
                    current[index] = item
                    _downloads.value = current
                    updateGlobalSpeed(current)
                    updateDisplayItems(current)
                } else {
                    loadHistory()
                }
            }
            "history_update", "finish_all" -> {
                loadHistory()
            }
        }
    }

    // Channel Actions
    fun toggleChannelExpand(channelName: String) {
        if (expandedChannels.contains(channelName)) {
            expandedChannels.remove(channelName)
        } else {
            expandedChannels.add(channelName)
        }
        updateDisplayItems()
    }

    fun toggleChannelState(channelName: String) {
        val items = _downloads.value.orEmpty().filter {
            val cName = (it.channelName?.trim()).takeIf { !it.isNullOrBlank() } ?: "Descargas Directas"
            cName == channelName
        }
        if (items.isEmpty()) return

        val isAnyDownloading = items.any { it.state == "downloading" }
        viewModelScope.launch {
            if (isAnyDownloading) {
                apiClient.pauseChannel(items.filter { it.state == "downloading" }.map { it.dbId })
            } else {
                apiClient.resumeChannel(items.filter { it.state != "done" }.map { it.dbId })
            }
            loadHistory()
        }
    }

    fun deleteChannel(channelName: String) {
        viewModelScope.launch {
            apiClient.deleteChannel(channelName)
            loadHistory()
        }
    }

    // User Actions for individual items
    fun pauseDownload(item: DownloadItemDto) {
        viewModelScope.launch {
            apiClient.pauseDownload(item.dbId)
            loadHistory()
        }
    }

    fun resumeDownload(item: DownloadItemDto) {
        viewModelScope.launch {
            apiClient.resumeDownload(item.dbId)
            loadHistory()
        }
    }

    fun stopDownload(item: DownloadItemDto) {
        viewModelScope.launch {
            apiClient.stopDownload(item.dbId)
            loadHistory()
        }
    }

    fun deleteDownload(item: DownloadItemDto) {
        viewModelScope.launch {
            apiClient.deleteDownload(item.dbId)
            loadHistory()
        }
    }

    fun clearCompleted() {
        viewModelScope.launch {
            apiClient.clearCompleted()
            loadHistory()
        }
    }

    fun addLink(link: String, autoStart: Boolean, onResult: (Boolean, String) -> Unit) {
        viewModelScope.launch {
            val scanRes = apiClient.scanLink(link)
            if (scanRes.isFailure) {
                onResult(false, scanRes.exceptionOrNull()?.message ?: "Error al escanear")
                return@launch
            }

            val data = scanRes.getOrNull()
            val videos = data?.videos
            if (videos.isNullOrEmpty()) {
                onResult(false, "No se encontraron archivos en este enlace")
                return@launch
            }

            if (autoStart) {
                val indices = videos.map { it.originalIdx }
                val startRes = apiClient.startDownload(indices)
                if (startRes.isSuccess) {
                    onResult(true, "Se iniciaron ${videos.size} descarga(s)")
                    loadHistory()
                } else {
                    onResult(false, "Error al iniciar descargas: ${startRes.exceptionOrNull()?.message}")
                }
            } else {
                onResult(true, "Se encontraron ${videos.size} archivos (guardados en capturador)")
            }
        }
    }
}
