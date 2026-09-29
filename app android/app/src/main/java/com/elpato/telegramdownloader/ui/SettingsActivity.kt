package com.elpato.telegramdownloader.ui

import android.content.res.ColorStateList
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.elpato.telegramdownloader.App
import com.elpato.telegramdownloader.R
import com.elpato.telegramdownloader.databinding.ActivitySettingsBinding
import kotlinx.coroutines.launch
import java.security.MessageDigest

import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import org.json.JSONObject

class SettingsActivity : AppCompatActivity() {

    private lateinit var binding: ActivitySettingsBinding
    private val prefs = App.instance.prefs
    private val apiClient = App.instance.apiClient

    private val qrScannerLauncher = registerForActivityResult(ScanContract()) { result ->
        if (result.contents != null) {
            val content = result.contents.trim()
            parseAndApplyQrContent(content)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivitySettingsBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupToolbar()
        loadPreferences()
        setupListeners()
    }

    private fun setupToolbar() {
        binding.toolbar.setNavigationOnClickListener { finish() }
    }

    private fun loadPreferences() {
        binding.etServerUrl.setText(prefs.serverUrl)
        binding.etPassword.setText(prefs.serverPassword)
    }

    private fun setupListeners() {
        binding.btnScanQr.setOnClickListener {
            val options = ScanOptions().apply {
                setPrompt("Apunta la cámara al código QR de Telegram Downloader")
                setBeepEnabled(true)
                setOrientationLocked(false)
                setDesiredBarcodeFormats(ScanOptions.QR_CODE)
            }
            qrScannerLauncher.launch(options)
        }
        binding.btnTestConnection.setOnClickListener {
            val url = binding.etServerUrl.text?.toString()?.trim().orEmpty()
            val password = binding.etPassword.text?.toString()?.trim().orEmpty()

            if (url.isBlank()) {
                binding.tilServerUrl.error = "Ingresa la dirección del servidor"
                return@setOnClickListener
            }
            binding.tilServerUrl.error = null

            // Guardar temporalmente para probar
            prefs.serverUrl = url
            prefs.serverPassword = password
            if (password.isNotEmpty()) {
                prefs.authToken = sha256(password)
            } else {
                prefs.authToken = ""
            }

            binding.btnTestConnection.isEnabled = false
            binding.tvTestResult.visibility = View.VISIBLE
            binding.tvTestResult.text = getString(R.string.connecting)
            binding.tvTestResult.setTextColor(ContextCompat.getColor(this, R.color.connecting))
            binding.tvTestResult.setBackgroundColor(ContextCompat.getColor(this, R.color.surface_variant))

            lifecycleScope.launch {
                val res = apiClient.testConnection()
                binding.btnTestConnection.isEnabled = true
                if (res.isSuccess) {
                    binding.tvTestResult.text = "✓ " + getString(R.string.test_connection_success)
                    binding.tvTestResult.setTextColor(ContextCompat.getColor(this@SettingsActivity, R.color.status_done))
                    binding.tvTestResult.backgroundTintList = ColorStateList.valueOf(
                        ContextCompat.getColor(this@SettingsActivity, R.color.status_done_bg)
                    )
                } else {
                    val err = res.exceptionOrNull()?.message ?: "Error desconocido"
                    binding.tvTestResult.text = "✗ " + getString(R.string.test_connection_failed) + "\n$err"
                    binding.tvTestResult.setTextColor(ContextCompat.getColor(this@SettingsActivity, R.color.status_error))
                    binding.tvTestResult.backgroundTintList = ColorStateList.valueOf(
                        ContextCompat.getColor(this@SettingsActivity, R.color.status_error_bg)
                    )
                }
            }
        }

        binding.btnSave.setOnClickListener {
            val url = binding.etServerUrl.text?.toString()?.trim().orEmpty()
            val password = binding.etPassword.text?.toString()?.trim().orEmpty()

            if (url.isBlank()) {
                binding.tilServerUrl.error = "Ingresa la dirección del servidor"
                return@setOnClickListener
            }

            prefs.serverUrl = url
            prefs.serverPassword = password
            if (password.isNotEmpty()) {
                prefs.authToken = sha256(password)
            } else {
                prefs.authToken = ""
            }

            Toast.makeText(this, R.string.settings_saved, Toast.LENGTH_SHORT).show()
            finish()
        }
    }

    private fun parseAndApplyQrContent(content: String) {
        var serverUrl = ""
        var serverPassword = ""

        try {
            if (content.startsWith("{") && content.endsWith("}")) {
                val json = JSONObject(content)
                serverUrl = json.optString("url", "")
                serverPassword = json.optString("password", "")
            }
        } catch (_: Exception) {}

        if (serverUrl.isBlank()) {
            serverUrl = content
        }

        if (serverUrl.isNotBlank()) {
            binding.etServerUrl.setText(serverUrl)
            if (serverPassword.isNotBlank()) {
                binding.etPassword.setText(serverPassword)
            }
            Toast.makeText(this, "QR detectado: $serverUrl", Toast.LENGTH_SHORT).show()
            // Probar automáticamente la conexión con el servidor
            binding.btnTestConnection.performClick()
        } else {
            Toast.makeText(this, "No se encontró una URL válida en el código QR", Toast.LENGTH_LONG).show()
        }
    }

    private fun sha256(input: String): String {
        val bytes = MessageDigest.getInstance("SHA-256").digest(input.toByteArray())
        return bytes.joinToString("") { "%02x".format(it) }
    }
}
