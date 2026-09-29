package com.elpato.telegramdownloader.ui

import android.content.Context
import android.content.Intent
import android.content.res.ColorStateList
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.inputmethod.InputMethodManager
import android.widget.Toast
import androidx.activity.viewModels
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.widget.doAfterTextChanged
import androidx.recyclerview.widget.LinearLayoutManager
import com.elpato.telegramdownloader.R
import com.elpato.telegramdownloader.databinding.ActivityMainBinding
import com.elpato.telegramdownloader.databinding.DialogAddLinkBinding
import com.elpato.telegramdownloader.databinding.DialogSpeedModeBinding
import com.elpato.telegramdownloader.ui.adapters.DownloadsAdapter
import com.elpato.telegramdownloader.ui.viewmodel.ConnectionState
import com.elpato.telegramdownloader.ui.viewmodel.MainViewModel
import com.elpato.telegramdownloader.ui.viewmodel.TabFilter
import com.google.android.material.snackbar.Snackbar
import com.google.android.material.tabs.TabLayout
import java.text.DecimalFormat

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private val viewModel: MainViewModel by viewModels()
    private lateinit var adapter: DownloadsAdapter

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupRecyclerView()
        setupHeaderAndTabs()
        setupListeners()
        observeViewModel()
    }

    override fun onResume() {
        super.onResume()
        if (!viewModel.prefs.isConfigured) {
            binding.badgeStatusMode.backgroundTintList = ColorStateList.valueOf(0xFFE53935.toInt())
            binding.tvModeLabel.text = getString(R.string.disconnected)
            binding.tvGlobalSpeedHeader.text = " • Sin configurar"

            Snackbar.make(binding.root, R.string.need_configure_server, Snackbar.LENGTH_LONG)
                .setAction(R.string.action_settings) {
                    startActivity(Intent(this, SettingsActivity::class.java))
                }.show()
        } else {
            viewModel.refresh()
        }
    }

    private fun setupRecyclerView() {
        adapter = DownloadsAdapter(
            onChannelToggleExpand = { channelName ->
                viewModel.toggleChannelExpand(channelName)
            },
            onChannelToggleState = { channelName ->
                viewModel.toggleChannelState(channelName)
            },
            onChannelDelete = { channelName ->
                AlertDialog.Builder(this)
                    .setTitle("¿Eliminar canal?")
                    .setMessage("¿Deseas eliminar todo el canal \"$channelName\" y todas sus descargas del historial?")
                    .setPositiveButton(R.string.action_delete) { _, _ ->
                        viewModel.deleteChannel(channelName)
                    }
                    .setNegativeButton(R.string.action_cancel, null)
                    .show()
            },
            onPauseResumeClicked = { item ->
                if (item.state == "downloading") {
                    viewModel.pauseDownload(item)
                } else {
                    viewModel.resumeDownload(item)
                }
            },
            onStopClicked = { item ->
                AlertDialog.Builder(this)
                    .setTitle("¿Detener descarga?")
                    .setMessage(item.filename)
                    .setPositiveButton(R.string.action_stop) { _, _ -> viewModel.stopDownload(item) }
                    .setNegativeButton(R.string.action_cancel, null)
                    .show()
            },
            onDeleteClicked = { item ->
                viewModel.deleteDownload(item)
            }
        )

        binding.rvDownloads.layoutManager = LinearLayoutManager(this)
        binding.rvDownloads.adapter = adapter
    }

    private fun setupHeaderAndTabs() {
        // 1. Pestañas FDM (TODAS | ACTIVAS | COMPLETADAS)
        binding.tabLayout.addOnTabSelectedListener(object : TabLayout.OnTabSelectedListener {
            override fun onTabSelected(tab: TabLayout.Tab?) {
                when (tab?.position) {
                    0 -> viewModel.setTabFilter(TabFilter.ALL)
                    1 -> viewModel.setTabFilter(TabFilter.ACTIVE)
                    2 -> viewModel.setTabFilter(TabFilter.COMPLETED)
                }
            }
            override fun onTabUnselected(tab: TabLayout.Tab?) {}
            override fun onTabReselected(tab: TabLayout.Tab?) {}
        })

        // 2. Búsqueda en tiempo real estilo FDM
        binding.btnToggleSearch.setOnClickListener {
            binding.layoutNormalHeader.visibility = View.GONE
            binding.layoutSearchHeader.visibility = View.VISIBLE
            binding.etSearchQuery.requestFocus()
            val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
            imm.showSoftInput(binding.etSearchQuery, InputMethodManager.SHOW_IMPLICIT)
        }

        binding.btnSearchBack.setOnClickListener {
            closeSearch()
        }

        binding.btnSearchClear.setOnClickListener {
            binding.etSearchQuery.text?.clear()
        }

        binding.etSearchQuery.doAfterTextChanged { text ->
            viewModel.setSearchQuery(text?.toString().orEmpty())
        }

        // 3. Botón de Modo Velocidad / Dialog
        binding.badgeStatusMode.setOnClickListener {
            showSpeedModeDialog()
        }
        binding.btnSpeedDialog.setOnClickListener {
            showSpeedModeDialog()
        }

        // 4. Botón de Configuración
        binding.btnOpenSettings.setOnClickListener {
            startActivity(Intent(this, SettingsActivity::class.java))
        }
    }

    private fun closeSearch() {
        binding.etSearchQuery.text?.clear()
        binding.layoutSearchHeader.visibility = View.GONE
        binding.layoutNormalHeader.visibility = View.VISIBLE
        val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
        imm.hideSoftInputFromWindow(binding.etSearchQuery.windowToken, 0)
    }

    private fun setupListeners() {
        binding.swipeRefresh.setOnRefreshListener {
            viewModel.refresh()
        }

        binding.fabAddLink.setOnClickListener {
            showAddLinkDialog()
        }

        binding.btnEmptyAdd.setOnClickListener {
            showAddLinkDialog()
        }
    }

    private fun observeViewModel() {
        viewModel.connectionState.observe(this) { state ->
            when (state) {
                ConnectionState.CONNECTED -> {
                    binding.badgeStatusMode.backgroundTintList = ColorStateList.valueOf(0xFF00C853.toInt()) // Verde FDM
                    binding.tvModeLabel.text = getString(R.string.speed_fast_mode)
                }
                ConnectionState.CONNECTING -> {
                    binding.badgeStatusMode.backgroundTintList = ColorStateList.valueOf(0xFFFFA000.toInt()) // Ámbar
                    binding.tvModeLabel.text = getString(R.string.connecting)
                }
                ConnectionState.DISCONNECTED, null -> {
                    binding.badgeStatusMode.backgroundTintList = ColorStateList.valueOf(0xFFE53935.toInt()) // Rojo
                    binding.tvModeLabel.text = getString(R.string.disconnected)
                }
            }
        }

        viewModel.globalSpeed.observe(this) { speed ->
            val speedText = "${DecimalFormat("#0.0").format(speed)} MB/s"
            binding.tvGlobalSpeedHeader.text = " • $speedText"
        }

        viewModel.displayItems.observe(this) { list ->
            adapter.submitList(list)
            binding.layoutEmpty.visibility = if (list.isEmpty()) View.VISIBLE else View.GONE
            binding.rvDownloads.visibility = if (list.isEmpty()) View.GONE else View.VISIBLE
        }

        viewModel.isRefreshing.observe(this) { refreshing ->
            binding.swipeRefresh.isRefreshing = refreshing
        }
    }

    private fun showSpeedModeDialog() {
        val dialogBinding = DialogSpeedModeBinding.inflate(layoutInflater)
        val dialog = AlertDialog.Builder(this)
            .setView(dialogBinding.root)
            .create()

        val speed = viewModel.globalSpeed.value ?: 0.0
        dialogBinding.tvDialogCurrentSpeed.text = "${DecimalFormat("#0.0").format(speed)} MB/s"

        val host = viewModel.prefs.serverUrl.ifBlank { "Sin configurar" }
        dialogBinding.tvDialogServerHost.text = host

        val isConnected = viewModel.connectionState.value == ConnectionState.CONNECTED
        dialogBinding.tvDialogServerStatus.text = if (isConnected) "Conectado (WebSocket Activo)" else "Desconectado"
        dialogBinding.tvDialogServerStatus.setTextColor(
            if (isConnected) 0xFF059669.toInt() else 0xFFDC2626.toInt()
        )

        val activeCount = viewModel.downloads.value?.count { it.state == "downloading" } ?: 0
        dialogBinding.tvDialogActiveCount.text = "$activeCount activa(s)"

        dialogBinding.btnDialogClearCompleted.setOnClickListener {
            viewModel.clearCompleted()
            dialog.dismiss()
            Snackbar.make(binding.root, "Descargas completadas eliminadas", Snackbar.LENGTH_SHORT).show()
        }

        dialogBinding.btnDialogSettings.setOnClickListener {
            dialog.dismiss()
            startActivity(Intent(this, SettingsActivity::class.java))
        }

        dialog.show()
    }

    private fun showAddLinkDialog() {
        if (!viewModel.prefs.isConfigured) {
            Snackbar.make(binding.root, R.string.need_configure_server, Snackbar.LENGTH_LONG)
                .setAction(R.string.action_settings) {
                    startActivity(Intent(this, SettingsActivity::class.java))
                }.show()
            return
        }

        val dialogBinding = DialogAddLinkBinding.inflate(LayoutInflater.from(this))
        val dialog = AlertDialog.Builder(this)
            .setView(dialogBinding.root)
            .create()

        dialog.window?.setBackgroundDrawableResource(android.R.color.transparent)

        // Botón Pegar del Portapapeles
        dialogBinding.btnPasteClipboard.setOnClickListener {
            val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as? android.content.ClipboardManager
            val clipData = clipboard?.primaryClip
            if (clipData != null && clipData.itemCount > 0) {
                val text = clipData.getItemAt(0).text?.toString()?.trim().orEmpty()
                if (text.isNotBlank()) {
                    dialogBinding.etLink.setText(text)
                    dialogBinding.etLink.setSelection(text.length)
                    dialogBinding.tilLink.error = null
                } else {
                    Toast.makeText(this, "El portapapeles está vacío", Toast.LENGTH_SHORT).show()
                }
            } else {
                Toast.makeText(this, "El portapapeles está vacío", Toast.LENGTH_SHORT).show()
            }
        }

        // Botón Cancelar
        dialogBinding.btnCancelDialog.setOnClickListener {
            dialog.dismiss()
        }

        // Botón Enviar y Descargar
        dialogBinding.btnSendDialog.setOnClickListener {
            val link = dialogBinding.etLink.text?.toString()?.trim().orEmpty()
            if (link.isBlank()) {
                dialogBinding.tilLink.error = "Ingresa un enlace válido"
                return@setOnClickListener
            }

            dialogBinding.tilLink.error = null
            dialogBinding.btnSendDialog.isEnabled = false
            dialogBinding.etLink.isEnabled = false

            val autoStart = dialogBinding.cbAutoStart.isChecked
            Toast.makeText(this, R.string.scanning_link, Toast.LENGTH_SHORT).show()

            viewModel.addLink(link, autoStart) { _, msg ->
                dialog.dismiss()
                Snackbar.make(binding.root, msg, Snackbar.LENGTH_LONG).show()
            }
        }

        dialog.show()
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (binding.layoutSearchHeader.visibility == View.VISIBLE) {
            closeSearch()
        } else {
            super.onBackPressed()
        }
    }
}
