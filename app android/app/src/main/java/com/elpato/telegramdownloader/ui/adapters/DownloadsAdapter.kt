package com.elpato.telegramdownloader.ui.adapters

import android.content.res.ColorStateList
import android.view.LayoutInflater
import android.view.MenuItem
import android.view.View
import android.view.ViewGroup
import androidx.appcompat.widget.PopupMenu
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.elpato.telegramdownloader.R
import com.elpato.telegramdownloader.data.model.DownloadItemDto
import com.elpato.telegramdownloader.data.model.DownloadRowItem
import com.elpato.telegramdownloader.databinding.ItemChannelHeaderBinding
import com.elpato.telegramdownloader.databinding.ItemDownloadBinding
import java.text.DecimalFormat

class DownloadsAdapter(
    private val onChannelToggleExpand: (String) -> Unit,
    private val onChannelToggleState: (String) -> Unit,
    private val onChannelDelete: (String) -> Unit,
    private val onPauseResumeClicked: (DownloadItemDto) -> Unit,
    private val onStopClicked: (DownloadItemDto) -> Unit,
    private val onDeleteClicked: (DownloadItemDto) -> Unit
) : ListAdapter<DownloadRowItem, RecyclerView.ViewHolder>(DownloadRowDiffCallback()) {

    companion object {
        private const val VIEW_TYPE_CHANNEL = 0
        private const val VIEW_TYPE_FILE = 1
    }

    override fun getItemViewType(position: Int): Int {
        return when (getItem(position)) {
            is DownloadRowItem.ChannelHeader -> VIEW_TYPE_CHANNEL
            is DownloadRowItem.FileItem -> VIEW_TYPE_FILE
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
        val inflater = LayoutInflater.from(parent.context)
        return when (viewType) {
            VIEW_TYPE_CHANNEL -> {
                val binding = ItemChannelHeaderBinding.inflate(inflater, parent, false)
                ChannelViewHolder(binding)
            }
            else -> {
                val binding = ItemDownloadBinding.inflate(inflater, parent, false)
                FileViewHolder(binding)
            }
        }
    }

    override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
        when (val item = getItem(position)) {
            is DownloadRowItem.ChannelHeader -> (holder as ChannelViewHolder).bind(item)
            is DownloadRowItem.FileItem -> (holder as FileViewHolder).bind(item.item)
        }
    }

    inner class ChannelViewHolder(private val binding: ItemChannelHeaderBinding) :
        RecyclerView.ViewHolder(binding.root) {

        fun bind(header: DownloadRowItem.ChannelHeader) {
            val context = binding.root.context

            // Icono de expandir/contraer
            binding.ivExpandCollapse.setImageResource(
                if (header.isExpanded) R.drawable.ic_expand_less else R.drawable.ic_expand_more
            )

            // Nombre y contador del canal
            binding.tvChannelName.text = header.channelName
            binding.tvChannelCount.text = "(${header.totalFiles} ${if (header.totalFiles == 1) "archivo" else "archivos"})"

            // Barra de progreso del canal
            binding.progressBarChannel.isIndeterminate = false
            binding.progressBarChannel.progress = header.progressPercent
            val progressColor = if (header.allDone) {
                ContextCompat.getColor(context, R.color.status_done)
            } else {
                ContextCompat.getColor(context, R.color.primary)
            }
            binding.progressBarChannel.setIndicatorColor(progressColor)

            // Detalles de progreso (ej: 120 MB / 1.5 GB (8%))
            val dlStr = formatBytes(header.downloadedBytes)
            val totalStr = formatBytes(header.totalSize)
            binding.tvChannelProgressDetails.text = "$dlStr / $totalStr (${header.progressPercent}%)"

            // Velocidad / Estado del canal
            if (header.speedMbps > 0) {
                binding.tvChannelSpeed.visibility = View.VISIBLE
                binding.tvChannelSpeed.text = "${DecimalFormat("#0.0").format(header.speedMbps)} MB/s"
                binding.tvChannelSpeed.setTextColor(ContextCompat.getColor(context, R.color.primary))
            } else if (header.allDone) {
                binding.tvChannelSpeed.visibility = View.VISIBLE
                binding.tvChannelSpeed.text = context.getString(R.string.status_done)
                binding.tvChannelSpeed.setTextColor(ContextCompat.getColor(context, R.color.status_done))
            } else if (header.activeDownloadingCount > 0) {
                binding.tvChannelSpeed.visibility = View.VISIBLE
                binding.tvChannelSpeed.text = "${header.activeDownloadingCount} activo(s)"
                binding.tvChannelSpeed.setTextColor(ContextCompat.getColor(context, R.color.primary))
            } else if (header.anyPaused) {
                binding.tvChannelSpeed.visibility = View.VISIBLE
                binding.tvChannelSpeed.text = context.getString(R.string.status_paused)
                binding.tvChannelSpeed.setTextColor(ContextCompat.getColor(context, R.color.status_paused))
            } else {
                binding.tvChannelSpeed.visibility = View.GONE
            }

            // Botón Pausar/Reanudar todo el canal
            if (header.allDone) {
                binding.btnChannelToggle.visibility = View.GONE
            } else {
                binding.btnChannelToggle.visibility = View.VISIBLE
                if (header.activeDownloadingCount > 0) {
                    binding.btnChannelToggle.setIconResource(R.drawable.ic_pause)
                    binding.btnChannelToggle.iconTint = ColorStateList.valueOf(
                        ContextCompat.getColor(context, R.color.status_paused)
                    )
                } else {
                    binding.btnChannelToggle.setIconResource(R.drawable.ic_play)
                    binding.btnChannelToggle.iconTint = ColorStateList.valueOf(
                        ContextCompat.getColor(context, R.color.primary)
                    )
                }
            }

            // Listeners
            binding.root.setOnClickListener { onChannelToggleExpand(header.channelName) }
            binding.ivExpandCollapse.setOnClickListener { onChannelToggleExpand(header.channelName) }
            binding.btnChannelToggle.setOnClickListener { onChannelToggleState(header.channelName) }
            binding.btnChannelDelete.setOnClickListener { onChannelDelete(header.channelName) }
        }
    }

    inner class FileViewHolder(private val binding: ItemDownloadBinding) :
        RecyclerView.ViewHolder(binding.root) {

        fun bind(item: DownloadItemDto) {
            val context = binding.root.context

            // 1. Nombre de archivo
            binding.tvFilename.text = item.filename

            // 2. Insignia de tipo de archivo con color contextual (estilo FDM)
            val (badgeText, badgeColor) = getExtensionBadge(item.filename)
            binding.tvFileTypeExt.text = badgeText
            binding.layoutFileType.backgroundTintList = ColorStateList.valueOf(badgeColor)

            // 3. Paquete
            val pkg = item.packageName
            binding.tvPackageChannel.text = if (!pkg.isNullOrBlank()) " • $pkg" else ""

            // 4. Estados, velocidad y badge
            when (item.state.lowercase()) {
                "downloading" -> {
                    binding.ivOverlayStatus.setImageResource(R.drawable.ic_pause)
                    binding.ivOverlayStatus.imageTintList = ColorStateList.valueOf(
                        ContextCompat.getColor(context, R.color.status_paused)
                    )
                    binding.ivSpeedArrow.visibility = View.VISIBLE
                    if (item.currentSpeedMbps > 0) {
                        binding.tvSpeed.visibility = View.VISIBLE
                        binding.tvSpeed.text = "${DecimalFormat("#0.0").format(item.currentSpeedMbps)} MB/s"
                    } else {
                        binding.tvSpeed.visibility = View.GONE
                    }
                    binding.tvStatusBadge.text = context.getString(R.string.status_downloading)
                    binding.tvStatusBadge.setTextColor(ContextCompat.getColor(context, R.color.primary))

                    binding.progressBar.isIndeterminate = false
                    binding.progressBar.progress = item.progressPercent
                    binding.progressBar.setIndicatorColor(ContextCompat.getColor(context, R.color.accent))
                }
                "paused" -> {
                    binding.ivOverlayStatus.setImageResource(R.drawable.ic_play)
                    binding.ivOverlayStatus.imageTintList = ColorStateList.valueOf(
                        ContextCompat.getColor(context, R.color.primary)
                    )
                    binding.ivSpeedArrow.visibility = View.GONE
                    binding.tvSpeed.visibility = View.GONE
                    binding.tvStatusBadge.text = context.getString(R.string.status_paused)
                    binding.tvStatusBadge.setTextColor(ContextCompat.getColor(context, R.color.status_paused))

                    binding.progressBar.isIndeterminate = false
                    binding.progressBar.progress = item.progressPercent
                    binding.progressBar.setIndicatorColor(ContextCompat.getColor(context, R.color.status_paused))
                }
                "done" -> {
                    binding.ivOverlayStatus.setImageResource(R.drawable.ic_check)
                    binding.ivOverlayStatus.imageTintList = ColorStateList.valueOf(
                        ContextCompat.getColor(context, R.color.status_done)
                    )
                    binding.ivSpeedArrow.visibility = View.GONE
                    binding.tvSpeed.visibility = View.GONE
                    binding.tvStatusBadge.text = context.getString(R.string.status_download_complete)
                    binding.tvStatusBadge.setTextColor(ContextCompat.getColor(context, R.color.status_done))

                    binding.progressBar.isIndeterminate = false
                    binding.progressBar.progress = 100
                    binding.progressBar.setIndicatorColor(ContextCompat.getColor(context, R.color.status_done))
                }
                "error" -> {
                    binding.ivOverlayStatus.setImageResource(R.drawable.ic_play)
                    binding.ivOverlayStatus.imageTintList = ColorStateList.valueOf(
                        ContextCompat.getColor(context, R.color.primary)
                    )
                    binding.ivSpeedArrow.visibility = View.GONE
                    binding.tvSpeed.visibility = View.GONE
                    binding.tvStatusBadge.text = context.getString(R.string.status_error)
                    binding.tvStatusBadge.setTextColor(ContextCompat.getColor(context, R.color.status_error))

                    binding.progressBar.isIndeterminate = false
                    binding.progressBar.progress = item.progressPercent
                    binding.progressBar.setIndicatorColor(ContextCompat.getColor(context, R.color.status_error))
                }
                else -> { // stopped / pending
                    binding.ivOverlayStatus.setImageResource(R.drawable.ic_play)
                    binding.ivOverlayStatus.imageTintList = ColorStateList.valueOf(
                        ContextCompat.getColor(context, R.color.primary)
                    )
                    binding.ivSpeedArrow.visibility = View.GONE
                    binding.tvSpeed.visibility = View.GONE
                    val label = if (item.state == "pending") context.getString(R.string.status_pending) else context.getString(R.string.status_stopped)
                    binding.tvStatusBadge.text = label
                    binding.tvStatusBadge.setTextColor(ContextCompat.getColor(context, R.color.status_stopped))

                    binding.progressBar.isIndeterminate = false
                    binding.progressBar.progress = item.progressPercent
                    binding.progressBar.setIndicatorColor(ContextCompat.getColor(context, R.color.status_stopped))
                }
            }

            // 5. Tamaños y porcentaje
            val downloadedStr = formatBytes(item.downloadedBytes)
            val totalStr = item.totalSizeFmt ?: formatBytes(item.totalSize)
            binding.tvProgressDetails.text = "$downloadedStr / $totalStr"
            binding.tvPercent.text = "${item.progressPercent}%"

            // 6. Click en el botón de acción rápida superpuesto en el badge
            binding.btnQuickToggle.setOnClickListener {
                if (item.state == "done") {
                    // Si ya está completada, mostrar menú de opciones
                    showItemMenu(binding.btnMore, item)
                } else {
                    onPauseResumeClicked(item)
                }
            }

            // 7. Click en el menú de 3 puntos
            binding.btnMore.setOnClickListener {
                showItemMenu(it, item)
            }
        }

        private fun showItemMenu(anchor: View, item: DownloadItemDto) {
            val popup = PopupMenu(anchor.context, anchor)
            val state = item.state.lowercase()

            if (state == "downloading") {
                popup.menu.add(0, 1, 0, anchor.context.getString(R.string.action_pause))
                popup.menu.add(0, 2, 1, anchor.context.getString(R.string.action_stop))
            } else if (state != "done") {
                popup.menu.add(0, 1, 0, anchor.context.getString(R.string.action_resume))
            }

            popup.menu.add(0, 3, 2, anchor.context.getString(R.string.action_delete))

            popup.setOnMenuItemClickListener { menuItem: MenuItem ->
                when (menuItem.itemId) {
                    1 -> {
                        onPauseResumeClicked(item)
                        true
                    }
                    2 -> {
                        onStopClicked(item)
                        true
                    }
                    3 -> {
                        onDeleteClicked(item)
                        true
                    }
                    else -> false
                }
            }
            popup.show()
        }
    }

    private class DownloadRowDiffCallback : DiffUtil.ItemCallback<DownloadRowItem>() {
        override fun areItemsTheSame(oldItem: DownloadRowItem, newItem: DownloadRowItem): Boolean {
            return when {
                oldItem is DownloadRowItem.ChannelHeader && newItem is DownloadRowItem.ChannelHeader ->
                    oldItem.channelName == newItem.channelName
                oldItem is DownloadRowItem.FileItem && newItem is DownloadRowItem.FileItem ->
                    oldItem.item.dbId == newItem.item.dbId
                else -> false
            }
        }

        override fun areContentsTheSame(oldItem: DownloadRowItem, newItem: DownloadRowItem): Boolean {
            return oldItem == newItem
        }
    }
}

private fun getExtensionBadge(filename: String): Pair<String, Int> {
    val ext = filename.substringAfterLast('.', "").uppercase()
    return when (ext) {
        "MP4", "MKV", "AVI", "MOV", "WEBM" -> Pair(if (ext.length <= 4) ext else "VID", 0xFF1E3A8A.toInt()) // Deep Blue
        "MP3", "M4A", "FLAC", "WAV", "OGG" -> Pair(if (ext.length <= 4) ext else "AUD", 0xFF0284C7.toInt()) // Sky Blue
        "ZIP", "RAR", "7Z", "TAR", "GZ" -> Pair(if (ext.length <= 4) ext else "ZIP", 0xFF0D9488.toInt()) // Teal
        "APK" -> Pair("APK", 0xFF059669.toInt()) // Green
        "ISO", "IMG" -> Pair("ISO", 0xFF0369A1.toInt()) // Deep Cyan
        "PDF", "DOC", "DOCX" -> Pair(if (ext.length <= 4) ext else "DOC", 0xFFDC2626.toInt()) // Red
        else -> Pair(if (ext.length in 1..4) ext else "FILE", 0xFF0288D1.toInt())
    }
}

private fun formatBytes(bytes: Long): String {
    if (bytes <= 0) return "0 B"
    val units = arrayOf("B", "KB", "MB", "GB", "TB")
    val digitGroups = (Math.log10(bytes.toDouble()) / Math.log10(1024.0)).toInt().coerceIn(0, units.size - 1)
    val df = DecimalFormat("#,##0.#")
    return "${df.format(bytes / Math.pow(1024.0, digitGroups.toDouble()))} ${units[digitGroups]}"
}
