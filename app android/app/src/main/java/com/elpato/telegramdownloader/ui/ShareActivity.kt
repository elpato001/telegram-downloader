package com.elpato.telegramdownloader.ui

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.elpato.telegramdownloader.App
import com.elpato.telegramdownloader.R
import com.elpato.telegramdownloader.data.model.ScanVideoItem
import com.elpato.telegramdownloader.databinding.ActivityShareBinding
import kotlinx.coroutines.launch
import java.util.regex.Pattern

class ShareActivity : AppCompatActivity() {

    private lateinit var binding: ActivityShareBinding
    private val prefs = App.instance.prefs
    private val apiClient = App.instance.apiClient

    private var foundVideos: List<ScanVideoItem> = emptyList()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityShareBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.btnCancel.setOnClickListener { finish() }

        if (!prefs.isConfigured) {
            Toast.makeText(this, R.string.need_configure_server, Toast.LENGTH_LONG).show()
            startActivity(Intent(this, SettingsActivity::class.java))
            finish()
            return
        }

        handleShareIntent()
    }

    private fun handleShareIntent() {
        val intent = intent ?: run {
            finish()
            return
        }

        if (Intent.ACTION_SEND == intent.action && intent.type == "text/plain") {
            val sharedText = intent.getStringExtra(Intent.EXTRA_TEXT).orEmpty()
            val telegramUrl = extractTelegramUrl(sharedText)

            if (telegramUrl != null) {
                binding.tvDetectedLink.text = telegramUrl
                scanUrl(telegramUrl)
            } else {
                showError("No se detectó un enlace válido de Telegram en el texto compartido:\n\n$sharedText")
            }
        } else {
            finish()
        }
    }

    private fun extractTelegramUrl(text: String): String? {
        val pattern = Pattern.compile("(https?://t\\.me/[\\w/\\-\\+\\?\\=\\&]+|t\\.me/[\\w/\\-\\+\\?\\=\\&]+)")
        val matcher = pattern.matcher(text)
        return if (matcher.find()) {
            var url = matcher.group(1) ?: ""
            if (!url.startsWith("http://") && !url.startsWith("https://")) {
                url = "https://$url"
            }
            url
        } else {
            null
        }
    }

    private fun scanUrl(url: String) {
        binding.layoutLoading.visibility = View.VISIBLE
        binding.layoutResult.visibility = View.GONE
        binding.layoutError.visibility = View.GONE

        lifecycleScope.launch {
            val result = apiClient.scanLink(url)
            binding.layoutLoading.visibility = View.GONE

            if (result.isSuccess) {
                val data = result.getOrNull()
                val videos = data?.videos.orEmpty()
                if (videos.isNotEmpty()) {
                    foundVideos = videos
                    showResult(data?.channelName, videos)
                } else {
                    showError("No se encontraron archivos multimedia descargables en este enlace.")
                }
            } else {
                val err = result.exceptionOrNull()?.message ?: "Error al escanear"
                showError(err)
            }
        }
    }

    private fun showResult(channelName: String?, videos: List<ScanVideoItem>) {
        binding.layoutResult.visibility = View.VISIBLE
        binding.layoutError.visibility = View.GONE

        val countText = if (videos.size == 1) "1 archivo encontrado" else "${videos.size} archivos encontrados"
        val chan = if (!channelName.isNullOrBlank()) " • $channelName" else ""
        binding.tvResultTitle.text = "$countText$chan"

        if (videos.size == 1) {
            val v = videos[0]
            binding.tvResultDetails.text = "${v.name}\n${v.sizeFmt ?: ""}"
        } else {
            val sample = videos.take(2).joinToString("\n") { "• ${it.name}" }
            binding.tvResultDetails.text = "$sample\n… y ${videos.size - 2} más"
        }

        binding.btnDownloadNow.setOnClickListener {
            startDownloadNow()
        }
    }

    private fun showError(message: String) {
        binding.layoutError.visibility = View.VISIBLE
        binding.tvErrorMessage.text = message
        binding.layoutResult.visibility = View.GONE
    }

    private fun startDownloadNow() {
        binding.btnDownloadNow.isEnabled = false
        binding.btnDownloadNow.text = "Iniciando descarga en el servidor…"

        lifecycleScope.launch {
            val indices = foundVideos.map { it.originalIdx }
            val res = apiClient.startDownload(indices)
            if (res.isSuccess) {
                Toast.makeText(this@ShareActivity, R.string.download_sent_success, Toast.LENGTH_SHORT).show()
                // Abrir la app principal para ver el progreso en vivo
                val mainIntent = Intent(this@ShareActivity, MainActivity::class.java)
                mainIntent.flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
                startActivity(mainIntent)
                finish()
            } else {
                binding.btnDownloadNow.isEnabled = true
                binding.btnDownloadNow.text = getString(R.string.action_send_download)
                val err = res.exceptionOrNull()?.message ?: "Error al enviar la descarga"
                showError(err)
            }
        }
    }
}
