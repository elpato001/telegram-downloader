import asyncio
import time
import re
import sys
import os
import subprocess
import logging
from datetime import datetime
from pathlib import Path
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from telethon import TelegramClient
from telethon.errors import (
    SessionPasswordNeededError, ChannelPrivateError, ChatAdminRequiredError,
    FloodWaitError, AuthKeyDuplicatedError
)
from telethon.tl.types import DocumentAttributeSticker, DocumentAttributeCustomEmoji
from telethon.tl.functions.updates import GetStateRequest

from config import API_ID, API_HASH, SESSION_NAME, DOWNLOAD_DIR
# Importar utilidades del downloader original
from downloader import obtener_nombre_archivo, formatear_tamanio, es_video, traducir_error_telegram
import database

logger = logging.getLogger("telegram_downloader")

app = FastAPI()
client = TelegramClient(
    SESSION_NAME, API_ID, API_HASH,
    connection_retries=10,       # Reintentar conexión hasta 10 veces
    retry_delay=2,               # Esperar 2 segundos entre reintentos
    auto_reconnect=True,         # Reconexión automática habilitada
    request_retries=5,           # Reintentar peticiones fallidas
)

# Almacenar los videos escaneados temporalmente en memoria para poder descargarlos
current_videos_cache = []

# Websocket manager para enviar el progreso
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def send_json(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except:
                pass

manager = ConnectionManager()

# Tarea de keep-alive para mantener la sesión activa
_keepalive_task = None

async def _keepalive_loop():
    """Envía un ping periódico a Telegram para mantener la sesión viva.
    Sin esto, la conexión se cierra por inactividad después de unos minutos."""
    while True:
        try:
            await asyncio.sleep(120)  # Cada 2 minutos
            if client.is_connected():
                await client(GetStateRequest())
                logger.debug("Keep-alive ping exitoso")
            else:
                logger.warning("Cliente desconectado, intentando reconectar...")
                await ensure_connected()
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.warning(f"Error en keep-alive (se reintentará): {e}")
            try:
                await ensure_connected()
            except Exception:
                pass

async def ensure_connected():
    """Asegura que el cliente esté conectado. Reconecta si es necesario."""
    if not client.is_connected():
        logger.info("Reconectando cliente de Telegram...")
        await client.connect()
        logger.info("Reconexión exitosa.")

@app.on_event("startup")
async def startup_event():
    global _keepalive_task, client
    database.init_db()
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    try:
        await client.connect()
    except Exception as e:
        # Si el archivo de sesión está corrupto o es de otro usuario, eliminarlo y recrear
        logger.warning(f"Error conectando con sesión existente: {e}. Creando sesión nueva...")
        session_file = f"{SESSION_NAME}.session"
        if os.path.exists(session_file):
            try:
                if client.is_connected():
                    await client.disconnect()
            except Exception:
                pass
            os.remove(session_file)
            logger.info(f"Archivo de sesión corrupto eliminado: {session_file}")
        client = TelegramClient(
            SESSION_NAME, API_ID, API_HASH,
            connection_retries=10, retry_delay=2,
            auto_reconnect=True, request_retries=5,
        )
        await client.connect()
    # Iniciar el loop de keep-alive
    _keepalive_task = asyncio.create_task(_keepalive_loop())
    logger.info("Keep-alive de Telegram iniciado.")

@app.on_event("shutdown")
async def shutdown_event():
    global _keepalive_task
    try:
        qr_login_mgr.cancel()
    except Exception:
        pass
    if _keepalive_task:
        _keepalive_task.cancel()
        try:
            await _keepalive_task
        except asyncio.CancelledError:
            pass
    if client.is_connected():
        await client.disconnect()

# --- Rutas Estáticas ---
@app.get("/")
def get_index():
    return FileResponse("web/index.html")

@app.get("/styles.css")
def get_css():
    return FileResponse("web/styles.css")

@app.get("/script.js")
def get_js():
    return FileResponse("web/script.js")

@app.get("/qrcode.min.js")
def get_qrcode_js():
    return FileResponse("web/qrcode.min.js")

@app.get("/logo.png")
def get_logo():
    return FileResponse("web/logo.png")

# --- Modelos API ---
class PhoneAuth(BaseModel):
    phone: str

class VerifyAuth(BaseModel):
    phone: str
    code: str
    phone_code_hash: str
    password: str = ""

def formatear_nombre_con_fecha(filename: str, fecha_iso: str) -> str:
    """Agrega la fecha y hora de publicación entre paréntesis antes de la extensión del archivo,
    convertida a la hora local (DD-MM-YYYY - HH-MM)."""
    if not fecha_iso:
        return filename
    try:
        dt = datetime.fromisoformat(fecha_iso)
        if dt.tzinfo is not None:
            dt = dt.astimezone()
        fecha_str = dt.strftime("%d-%m-%Y - %H-%M")
    except Exception:
        fecha_str = str(fecha_iso)[:16].replace("T", " ")
    
    if not fecha_str or f"({fecha_str})" in filename:
        return filename
        
    p = Path(filename)
    stem, suffix = p.stem, p.suffix
    if suffix:
        return f"{stem} ({fecha_str}){suffix}"
    else:
        return f"{filename} ({fecha_str})"

class QRPasswordAuth(BaseModel):
    password: str

class ScanLink(BaseModel):
    link: str

class DownloadRequest(BaseModel):
    indices: list[int]
    custom_dir: str = ""
    is_resume: bool = False
    include_date: bool = False

class DownloadControlRequest(BaseModel):
    index: int | str = "all"

class DownloadItem:
    def __init__(self, original_idx: int, filename: str, total_size: int):
        self.original_idx = original_idx
        self.filename = filename
        self.total_size = total_size
        self.state = "pending"  # "pending", "downloading", "paused", "stopped", "done", "error"
        self.pause_event = asyncio.Event()
        self.pause_event.set()
        self.cancelled = False
        self.downloaded_bytes = 0
        self.file_path = ""
        self.db_id = None
        self.message_id = None
        self.entity_id = None
        self.custom_dir = ""


class DownloadManager:
    def __init__(self):
        self.items: dict[int, DownloadItem] = {}
        self.global_pause_event = asyncio.Event()
        self.global_pause_event.set()
        self.global_cancelled = False
        self.active_index: int | None = None
        self.is_running = False

    def setup(self, indices: list[int], videos_cache: list):
        self.global_pause_event = asyncio.Event()
        self.global_pause_event.set()
        self.global_cancelled = False
        self.is_running = True
        for idx in indices:
            if idx < len(videos_cache):
                v = videos_cache[idx]
                self.items[idx] = DownloadItem(idx, v["nombre"], v["tamanio"])

    def pause_item(self, idx: int):
        if idx in self.items:
            self.items[idx].pause_event.clear()
            self.items[idx].state = "paused"

    def resume_item(self, idx: int):
        if idx in self.items:
            self.items[idx].pause_event.set()
            if self.items[idx].state == "paused":
                self.items[idx].state = "downloading" if idx == self.active_index else "pending"

    def stop_item(self, idx: int):
        if idx in self.items:
            self.items[idx].cancelled = True
            self.items[idx].pause_event.set()
            self.items[idx].state = "stopped"

    def pause_all(self):
        self.global_pause_event.clear()
        for item in self.items.values():
            if item.state in ("downloading", "pending"):
                item.state = "paused"

    def resume_all(self):
        self.global_pause_event.set()
        for item in self.items.values():
            item.pause_event.set()
            if item.state == "paused":
                item.state = "downloading" if item.original_idx == self.active_index else "pending"

    def stop_all(self):
        self.global_cancelled = True
        self.global_pause_event.set()
        for item in self.items.values():
            item.cancelled = True
            item.pause_event.set()
            if item.state in ("downloading", "pending", "paused"):
                item.state = "stopped"
        self.is_running = False

download_mgr = DownloadManager()

class FolderSelectRequest(BaseModel):
    current_dir: str = ""

def ask_directory_win(initial_dir: str = "") -> str:
    """Abre el diálogo nativo de Windows para seleccionar carpeta, garantizando que aparezca
    al frente (TopMost) de forma instantánea sin bloquear el servidor."""
    init_dir = initial_dir.strip() if initial_dir and os.path.exists(initial_dir.strip()) else ""
    
    # 1. Intentar con script aislado de Python + Tkinter con ventana transparente TopMost
    # Al correr en proceso independiente, no interfiere con el loop de uvicorn y aparece en < 0.2s al frente.
    tk_code = """
import sys, os, tkinter as tk
from tkinter import filedialog

initial = sys.argv[1] if len(sys.argv) > 1 and os.path.isdir(sys.argv[1]) else None

try:
    root = tk.Tk()
    root.geometry("0x0+-10000+-10000")
    root.attributes("-topmost", True)
    root.lift()
    root.focus_force()
    
    folder = filedialog.askdirectory(
        parent=root,
        title="Seleccionar carpeta de descarga",
        initialdir=initial
    )
    root.destroy()
    if folder:
        print(os.path.normpath(folder))
except Exception:
    sys.exit(1)
"""
    try:
        cmd = [sys.executable, "-c", tk_code]
        if init_dir:
            cmd.append(init_dir)
        res = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=30
        )
        if res.returncode == 0:
            folder = res.stdout.strip()
            if folder:
                return folder
            return ""
    except Exception as e:
        logger.warning(f"Error con selector Tkinter en subproceso: {e}")

    # 2. Fallback con PowerShell -STA y Form TopMost
    try:
        escaped_dir = init_dir.replace("'", "''")
        ps_script = f"""
Add-Type -AssemblyName System.Windows.Forms
$form = New-Object System.Windows.Forms.Form
$form.TopMost = $true
$form.WindowState = [System.Windows.Forms.FormWindowState]::Minimized
$form.Show()
$f = New-Object System.Windows.Forms.FolderBrowserDialog
$f.Description = 'Seleccionar carpeta de descarga'
$f.ShowNewFolderButton = $true
$f.AutoUpgradeEnabled = $true
if ('{escaped_dir}' -ne '' -and (Test-Path '{escaped_dir}')) {{ $f.SelectedPath = '{escaped_dir}' }}
$res = $f.ShowDialog($form)
$form.Close()
if ($res -eq [System.Windows.Forms.DialogResult]::OK) {{ Write-Output $f.SelectedPath }}
"""
        ps_cmd = ["powershell", "-NoProfile", "-STA", "-Command", ps_script]
        res = subprocess.run(ps_cmd, capture_output=True, text=True, timeout=30)
        return res.stdout.strip()
    except Exception as e:
        logger.error(f"Error en selector PowerShell: {e}")
        return ""

# --- Rutas API ---
@app.get("/api/history")
async def get_history():
    history = database.get_all_downloads()
    formatted = []
    for h in history:
        formatted.append({
            "db_id": h["id"],
            "id": h["message_id"],
            "entity_id": h["entity_id"],
            "nombre": h["filename"],
            "tamanio": h["total_size"],
            "tamanio_fmt": formatear_tamanio(h["total_size"]),
            "state": h["state"],
            "downloaded_bytes": h["downloaded_bytes"],
            "file_path": h["file_path"] or ""
        })
        # Registrar en el DownloadManager si no existe
        if h["id"] not in download_mgr.items:
            item = DownloadItem(-1, h["filename"], h["total_size"])
            item.db_id = h["id"]
            item.state = h["state"]
            item.downloaded_bytes = h["downloaded_bytes"]
            item.file_path = h["file_path"] or ""
            item.message_id = h["message_id"]
            item.entity_id = h["entity_id"]
            download_mgr.items[h["id"]] = item
    return {"success": True, "history": formatted}

@app.get("/api/status")
async def status():
    try:
        await ensure_connected()
        authorized = await client.is_user_authorized()
    except Exception:
        authorized = False
    user_data = None
    if authorized:
        try:
            me = await client.get_me()
            user_data = {
                "name": me.first_name,
                "username": me.username,
                "premium": getattr(me, 'premium', False)
            }
        except Exception as e:
            logger.warning(f"Error obteniendo datos del usuario: {e}")
            authorized = False
    return {"authorized": authorized, "user": user_data}

@app.post("/api/auth/send_code")
async def auth_send_code(data: PhoneAuth):
    try:
        await ensure_connected()
        res = await client.send_code_request(data.phone)
        return {"success": True, "phone_code_hash": res.phone_code_hash}
    except FloodWaitError as e:
        secs = getattr(e, 'seconds', 60)
        return {"success": False, "error": f"Telegram pide esperar {secs} segundos antes de volver a enviar un código. Esperá un momento y reintentá.", "retry_after": secs}
    except Exception as e:
        return {"success": False, "error": traducir_error_telegram(e)}

@app.post("/api/auth/verify")
async def auth_verify(data: VerifyAuth):
    try:
        await ensure_connected()
        await client.sign_in(data.phone, data.code, phone_code_hash=data.phone_code_hash)
        return {"success": True}
    except SessionPasswordNeededError:
        if not data.password:
            return {"success": False, "needs_password": True}
        try:
            await client.sign_in(password=data.password)
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": traducir_error_telegram(e)}
    except FloodWaitError as e:
        secs = getattr(e, 'seconds', 60)
        return {"success": False, "error": f"Demasiados intentos. Telegram pide esperar {secs} segundos.", "retry_after": secs}
    except Exception as e:
        return {"success": False, "error": traducir_error_telegram(e)}

@app.post("/api/auth/logout")
async def auth_logout():
    try:
        qr_login_mgr.cancel()
    except Exception:
        pass
    try:
        await client.log_out()
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": traducir_error_telegram(e)}

@app.post("/api/auth/reset")
async def auth_reset():
    """Resetea la sesión completamente. Útil cuando el archivo de sesión
    pertenece a otro usuario o está corrupto."""
    global client
    try:
        qr_login_mgr.cancel()
    except Exception:
        pass
    try:
        if client.is_connected():
            try:
                await client.log_out()
            except Exception:
                pass
            await client.disconnect()
    except Exception:
        pass
    
    session_file = f"{SESSION_NAME}.session"
    if os.path.exists(session_file):
        os.remove(session_file)
        logger.info(f"Archivo de sesión eliminado: {session_file}")
    
    client = TelegramClient(
        SESSION_NAME, API_ID, API_HASH,
        connection_retries=10, retry_delay=2,
        auto_reconnect=True, request_retries=5,
    )
    await client.connect()
    return {"success": True, "message": "Sesión reseteada. Podés iniciar sesión con un nuevo número."}

# --- Gestor y Rutas de Inicio por QR ---
class QRLoginManager:
    def __init__(self):
        self.qr_obj = None
        self.wait_task: asyncio.Task | None = None
        self.status = "idle"  # idle, waiting, success, needs_password, expired, error
        self.token_url = ""
        self.expires = None
        self.error = None
        self.user_data = None
        self.recreate_count = 0

    def cancel(self):
        if self.wait_task and not self.wait_task.done():
            self.wait_task.cancel()
        self.wait_task = None
        if self.status == "waiting":
            self.status = "idle"
        self.error = None

    async def start(self):
        await ensure_connected()
        self.cancel()

        # Si ya está autorizado, no iniciar flujo QR
        try:
            if await client.is_user_authorized():
                me = await client.get_me()
                self.status = "success"
                self.user_data = {
                    "name": me.first_name,
                    "username": me.username,
                    "premium": getattr(me, 'premium', False)
                }
                return {"success": True, "already_authorized": True, "user": self.user_data}
        except Exception:
            pass

        self.status = "waiting"
        self.error = None
        self.user_data = None
        self.recreate_count = 0

        try:
            self.qr_obj = await client.qr_login()
            self.token_url = self.qr_obj.url
            self.expires = self.qr_obj.expires.isoformat() if getattr(self.qr_obj, 'expires', None) else None
            self.wait_task = asyncio.create_task(self._wait_loop())
            return {
                "success": True,
                "token_url": self.token_url,
                "expires": self.expires
            }
        except Exception as e:
            logger.warning(f"Error en primer intento de QR: {e}. Reconectando cliente de Telegram...")
            try:
                if client.is_connected():
                    await client.disconnect()
                await client.connect()
                self.qr_obj = await client.qr_login()
                self.token_url = self.qr_obj.url
                self.expires = self.qr_obj.expires.isoformat() if getattr(self.qr_obj, 'expires', None) else None
                self.wait_task = asyncio.create_task(self._wait_loop())
                return {
                    "success": True,
                    "token_url": self.token_url,
                    "expires": self.expires
                }
            except Exception as e2:
                self.status = "error"
                self.error = traducir_error_telegram(e2)
                logger.error(f"Error iniciando login QR: {e2}")
                return {"success": False, "error": self.error}

    async def _wait_loop(self):
        while self.status == "waiting":
            try:
                user = await self.qr_obj.wait()
                self.status = "success"
                self.user_data = {
                    "name": user.first_name,
                    "username": user.username,
                    "premium": getattr(user, 'premium', False)
                }
                await manager.send_json({
                    "type": "qr_success",
                    "user": self.user_data
                })
                break
            except SessionPasswordNeededError:
                self.status = "needs_password"
                await manager.send_json({
                    "type": "qr_needs_password"
                })
                break
            except asyncio.TimeoutError:
                self.recreate_count += 1
                if self.recreate_count >= 5:
                    self.status = "expired"
                    await manager.send_json({"type": "qr_expired"})
                    break
                try:
                    await self.qr_obj.recreate()
                    self.token_url = self.qr_obj.url
                    self.expires = self.qr_obj.expires.isoformat() if getattr(self.qr_obj, 'expires', None) else None
                    await manager.send_json({
                        "type": "qr_update",
                        "token_url": self.token_url,
                        "expires": self.expires
                    })
                except Exception as rec_err:
                    logger.warning(f"Error recreando token QR: {rec_err}")
                    self.status = "expired"
                    await manager.send_json({"type": "qr_expired"})
                    break
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error durante espera de QR: {e}")
                self.status = "error"
                self.error = traducir_error_telegram(e)
                await manager.send_json({
                    "type": "qr_error",
                    "error": self.error
                })
                break

    async def submit_password(self, password: str):
        if self.status != "needs_password":
            return {"success": False, "error": "No se requiere contraseña en este momento."}
        try:
            await ensure_connected()
            await client.sign_in(password=password)
            me = await client.get_me()
            self.status = "success"
            self.user_data = {
                "name": me.first_name,
                "username": me.username,
                "premium": getattr(me, 'premium', False)
            }
            await manager.send_json({
                "type": "qr_success",
                "user": self.user_data
            })
            return {"success": True, "user": self.user_data}
        except Exception as e:
            return {"success": False, "error": traducir_error_telegram(e)}

qr_login_mgr = QRLoginManager()

@app.post("/api/auth/qr/start")
async def auth_qr_start():
    return await qr_login_mgr.start()

@app.get("/api/auth/qr/status")
async def auth_qr_status():
    return {
        "status": qr_login_mgr.status,
        "token_url": qr_login_mgr.token_url,
        "expires": qr_login_mgr.expires,
        "user": qr_login_mgr.user_data,
        "error": qr_login_mgr.error
    }

@app.post("/api/auth/qr/password")
async def auth_qr_password(data: QRPasswordAuth):
    return await qr_login_mgr.submit_password(data.password)

@app.post("/api/auth/qr/cancel")
async def auth_qr_cancel():
    qr_login_mgr.cancel()
    return {"success": True}

def get_network_shares():
    shares = []
    if sys.platform != 'win32':
        return shares
    try:
        res = subprocess.run(['net', 'use'], capture_output=True, text=True, timeout=3)
        for line in res.stdout.splitlines():
            m = re.search(r'([A-Z]:)\s+(\\\\[^\s]+)', line)
            if m:
                drv = m.group(1) + '\\'
                unc = m.group(2)
                short_name = unc.rstrip('\\').split('\\')[-1]
                shares.append({"drive": drv, "remote": unc, "name": f"{m.group(1)} ({short_name})"})
            else:
                m_unc = re.search(r'(\\\\[^\s]+)', line)
                if m_unc and not line.strip().startswith('Local') and not line.strip().startswith('Nombre'):
                    unc = m_unc.group(1)
                    short_name = unc.rstrip('\\').split('\\')[-1]
                    shares.append({"drive": unc, "remote": unc, "name": short_name or unc})
    except Exception:
        pass
    return shares

@app.get("/api/list_dirs")
async def list_directories(path: str = ""):
    home = Path.home()
    common_folders = [
        {"name": "Descargas", "path": str(home / "Downloads"), "icon": "fa-download"},
        {"name": "Escritorio", "path": str(home / "Desktop"), "icon": "fa-desktop"},
        {"name": "Documentos", "path": str(home / "Documents"), "icon": "fa-file-lines"},
        {"name": "Videos", "path": str(home / "Videos"), "icon": "fa-film"},
        {"name": "Carpeta del Proyecto", "path": str(Path(DOWNLOAD_DIR).resolve()), "icon": "fa-box-archive"},
    ]
    common_folders = [f for f in common_folders if os.path.exists(f["path"])]

    drives = []
    if sys.platform == 'win32':
        import string
        from ctypes import windll
        bitmask = windll.kernel32.GetLogicalDrives()
        for letter in string.ascii_uppercase:
            if bitmask & 1:
                dp = f"{letter}:\\"
                if os.path.exists(dp):
                    drives.append(dp)
            bitmask >>= 1
    if not drives:
        drives = ["C:\\"]

    # Detectar unidades y carpetas de red compartidas (NAS, Samba, etc.)
    network_shares = get_network_shares()

    target = None
    if path and path.strip():
        cand = Path(path.strip())
        try:
            if cand.exists() and cand.is_dir():
                target = cand
        except Exception:
            pass

    if not target:
        downloads = home / "Downloads"
        if downloads.exists():
            target = downloads
        elif drives:
            target = Path(drives[0])
        else:
            target = home

    parent_path = str(target.parent) if str(target.parent) != str(target) else None
    
    subdirs = []
    error_msg = None
    try:
        with os.scandir(target) as it:
            for entry in it:
                try:
                    if entry.is_dir(follow_symlinks=False):
                        if not entry.name.startswith('$') and not entry.name.startswith('.'):
                            subdirs.append(entry.name)
                except (PermissionError, OSError):
                    pass
        subdirs.sort(key=lambda s: s.lower())
    except PermissionError:
        error_msg = "Acceso denegado (requiere permisos de red o administrador)."
    except OSError as e:
        error_msg = f"No se pudo acceder a la ruta: {e}"
    except Exception as e:
        error_msg = str(e)

    return {
        "common": common_folders,
        "drives": drives,
        "network_shares": network_shares,
        "current": str(target),
        "parent": parent_path,
        "subdirs": subdirs[:150],
        "error": error_msg
    }

@app.post("/api/select_folder")
async def select_folder(data: FolderSelectRequest = None):
    curr = data.current_dir if data else ""
    folder = await asyncio.to_thread(ask_directory_win, curr)
    return {"path": folder}

@app.get("/api/select_folder")
async def select_folder_get():
    folder = await asyncio.to_thread(ask_directory_win, "")
    return {"path": folder}

@app.post("/api/scan")
async def scan_channel(data: ScanLink):
    global current_videos_cache
    canal_input = data.link.strip()
    thread_id = None
    mensaje_id = None

    match_msg = re.search(r't\.me/(?:c/)?([^/]+)/(\d+)', canal_input)
    if match_msg:
        canal_input = match_msg.group(1)
        if canal_input.isdigit():
            canal_input = int("-100" + canal_input)
        mensaje_id = int(match_msg.group(2))
    elif "_" in canal_input:
        partes = canal_input.split("_", 1)
        canal_input = partes[0]
        try:
            thread_id = int(partes[1])
        except ValueError:
            pass
    elif isinstance(canal_input, str):
        match_chan = re.search(r'(?:https?://)?(?:www\.)?t\.me/([^/?#]+)/?$', canal_input)
        if match_chan:
            canal_input = match_chan.group(1)

    if str(canal_input).lstrip("-").isdigit():
        canal_input = int(canal_input)

    try:
        await ensure_connected()
        entity = await client.get_entity(canal_input)
    except ValueError:
        try:
            # Buscar en caché
            async for dialog in client.iter_dialogs(limit=None):
                pass
            entity = await client.get_entity(canal_input)
        except Exception:
            return {"success": False, "error": "Canal o grupo no encontrado. Asegurate de estar unido previamente si es privado."}
    except Exception as e:
        return {"success": False, "error": traducir_error_telegram(e)}

    # Determinar nombre de carpeta en base al canal
    chat_name = getattr(entity, 'title', getattr(entity, 'username', str(entity.id)))
    chat_name = re.sub(r'[<>:"/\\|?*]', '', str(chat_name)).strip()
    if not chat_name:
        chat_name = "Descargas_Telegram"

    # Listar archivos (videos, juegos, comprimidos, documentos, etc.)
    videos = []
    try:
        if mensaje_id:
            message = await client.get_messages(entity, ids=mensaje_id)
            if not message or (not getattr(message, 'document', None) and not getattr(message, 'video', None)):
                return {"success": False, "error": "El enlace directo no contiene un archivo descargable."}
            
            messages_to_download = [message]
            if getattr(message, 'grouped_id', None):
                surrounding = await client.get_messages(entity, limit=20, offset_id=message.id + 10)
                for msg in surrounding:
                    if msg.id != message.id and getattr(msg, 'grouped_id', None) == message.grouped_id:
                        if getattr(msg, 'document', None) or getattr(msg, 'video', None):
                            messages_to_download.append(msg)
            
            messages_to_download.sort(key=lambda x: x.id)
            
            for msg in messages_to_download:
                nombre = obtener_nombre_archivo(msg) or f"archivo_desconocido_{msg.id}"
                tamanio = msg.document.size if getattr(msg, 'document', None) else getattr(msg.video, 'size', 0)
                videos.append({
                    "id": msg.id, "nombre": nombre, "tamanio": tamanio,
                    "tamanio_fmt": formatear_tamanio(tamanio), "fecha": msg.date.isoformat() if msg.date else "",
                    "carpeta": chat_name,
                    "entity_id": str(entity.id),
                    "message": msg
                })
        else:
            kwargs = {"limit": None}
            if thread_id is not None:
                kwargs["reply_to"] = thread_id
            
            mensajes_revisados = 0
            async for message in client.iter_messages(entity, **kwargs):
                mensajes_revisados += 1
                
                # Reportar progreso cada 100 mensajes revisados
                if mensajes_revisados % 100 == 0:
                    await manager.send_json({
                        "type": "scan_progress", 
                        "scanned": mensajes_revisados,
                        "found": len(videos)
                    })

                if message.document or getattr(message, 'video', None):
                    # Ignorar stickers y emojis animados
                    if message.document:
                        attrs = getattr(message.document, 'attributes', [])
                        if any(isinstance(a, (DocumentAttributeSticker, DocumentAttributeCustomEmoji)) for a in attrs):
                            continue

                    nombre = obtener_nombre_archivo(message)
                    if not nombre:
                        if getattr(message, 'video', None):
                            nombre = f"video_{message.id}.mp4"
                        elif message.document:
                            nombre = f"archivo_{message.id}"
                    
                    if nombre:
                        tamanio = message.document.size if getattr(message, 'document', None) else getattr(message.video, 'size', 0)
                        videos.append({
                            "id": message.id, "nombre": nombre, "tamanio": tamanio,
                            "tamanio_fmt": formatear_tamanio(tamanio), "fecha": message.date.isoformat() if message.date else "",
                            "carpeta": chat_name,
                            "entity_id": str(entity.id),
                            "message": message
                        })
    except Exception as e:
        return {"success": False, "error": traducir_error_telegram(e)}

    # Guardar en memoria para cuando pidan descargar
    current_videos_cache = videos
    
    # Preparar respuesta sin el objeto de telethon
    response_videos = [{"original_idx": i, "id": v["id"], "nombre": v["nombre"], "tamanio": v["tamanio"], "tamanio_fmt": v["tamanio_fmt"], "fecha": v.get("fecha", "")} for i, v in enumerate(videos)]
    return {"success": True, "videos": response_videos}


@app.post("/api/download")
async def trigger_download(data: DownloadRequest):
    if not data.is_resume:
        db_ids = []
        for idx in data.indices:
            video = current_videos_cache[idx]
            filename = video["nombre"]
            if data.include_date and video.get("fecha"):
                filename = formatear_nombre_con_fecha(filename, video["fecha"])

            db_id = database.add_download(
                message_id=video["id"],
                entity_id=video.get("entity_id", str(video.get("carpeta", ""))),
                filename=filename,
                total_size=video["tamanio"],
                custom_dir=data.custom_dir,
                file_path=""
            )
            item = DownloadItem(idx, filename, video["tamanio"])
            item.db_id = db_id
            item.message_id = video["id"]
            item.entity_id = video.get("entity_id")
            item.custom_dir = data.custom_dir
            download_mgr.items[db_id] = item
            db_ids.append(db_id)
        
        asyncio.create_task(process_downloads(db_ids, data.custom_dir))
        return {"success": True, "db_ids": db_ids}
    else:
        for db_id in data.indices:
            if db_id in download_mgr.items:
                download_mgr.items[db_id].state = "pending"
                download_mgr.items[db_id].cancelled = False
                download_mgr.items[db_id].pause_event.set()
                database.update_download_state(db_id, "pending")
        asyncio.create_task(process_downloads(data.indices, data.custom_dir))
        return {"success": True}

@app.post("/api/download/pause")
async def pause_download(data: DownloadControlRequest):
    if str(data.index).lower() == "all":
        download_mgr.pause_all()
        await manager.send_json({"type": "global_status", "state": "paused"})
        for idx in download_mgr.items:
            if download_mgr.items[idx].state == "paused":
                await manager.send_json({"type": "status_change", "index": idx, "state": "paused", "speed_mbps": 0})
    else:
        try:
            idx = int(data.index)
            download_mgr.pause_item(idx)
            database.update_download_state(idx, "paused")
            await manager.send_json({"type": "status_change", "index": idx, "state": "paused", "speed_mbps": 0})
        except ValueError:
            pass
    return {"success": True}

@app.post("/api/download/resume")
async def resume_download(data: DownloadControlRequest):
    if str(data.index).lower() == "all":
        download_mgr.resume_all()
        await manager.send_json({"type": "global_status", "state": "resumed"})
        for idx in download_mgr.items:
            item = download_mgr.items[idx]
            if item.state in ("downloading", "pending"):
                await manager.send_json({"type": "status_change", "index": idx, "state": item.state})
    else:
        try:
            idx = int(data.index)
            download_mgr.resume_item(idx)
            state = download_mgr.items[idx].state if idx in download_mgr.items else "downloading"
            if state in ("downloading", "pending"):
                database.update_download_state(idx, state)
            await manager.send_json({"type": "status_change", "index": idx, "state": state})
        except ValueError:
            pass
    return {"success": True}

@app.post("/api/download/stop")
async def stop_download(data: DownloadControlRequest):
    if str(data.index).lower() == "all":
        download_mgr.stop_all()
        await manager.send_json({"type": "global_status", "state": "stopped"})
        for idx in download_mgr.items:
            await manager.send_json({"type": "status_change", "index": idx, "state": "stopped", "speed_mbps": 0})
    else:
        try:
            idx = int(data.index)
            download_mgr.stop_item(idx)
            database.update_download_state(idx, "stopped")
            await manager.send_json({"type": "status_change", "index": idx, "state": "stopped", "speed_mbps": 0})
        except ValueError:
            pass
    return {"success": True}

async def process_downloads(db_ids, custom_dir=""):
    global current_videos_cache, download_mgr
    
    base_dir = custom_dir.strip() if custom_dir.strip() else DOWNLOAD_DIR
    download_dir = Path(base_dir)
    download_dir.mkdir(parents=True, exist_ok=True)
    
    await manager.send_json({"type": "global_status", "state": "downloading"})
    download_mgr.is_running = True
    
    for i, db_id in enumerate(db_ids):
        item = download_mgr.items.get(db_id)
        if not item:
            continue
            
        target_idx = item.original_idx if item.original_idx >= 0 else db_id

        if download_mgr.global_cancelled or item.cancelled:
            item.state = "stopped"
            database.update_download_state(db_id, "stopped")
            await manager.send_json({"type": "status_change", "index": target_idx, "state": "stopped"})
            continue

        # Esperar si hay pausa global
        await download_mgr.global_pause_event.wait()
        # Esperar si este item particular está pausado
        await item.pause_event.wait()
        
        if download_mgr.global_cancelled or item.cancelled:
            item.state = "stopped"
            database.update_download_state(db_id, "stopped")
            await manager.send_json({"type": "status_change", "index": target_idx, "state": "stopped"})
            continue

        download_mgr.active_index = db_id
        item.state = "downloading"
        database.update_download_state(db_id, "downloading")
        
        nombre = item.filename
        tamanio = item.total_size
        carpeta = "Descargas_Telegram"
        
        # Obtener el mensaje de Telegram si no está en caché (por ejemplo si viene del historial)
        msg_obj = None
        for v in current_videos_cache:
            if v["id"] == item.message_id:
                msg_obj = v["message"]
                break
        
        if not msg_obj:
            try:
                await ensure_connected()
                entity_input = item.entity_id
                if str(entity_input).lstrip("-").isdigit():
                    entity_input = int(entity_input)
                entity = await client.get_entity(entity_input)
                msg_obj = await client.get_messages(entity, ids=item.message_id)
            except Exception as e:
                item.state = "error"
                database.update_download_state(db_id, "error")
                await manager.send_json({"type": "error", "message": f"No se pudo acceder al mensaje en Telegram: {e}", "index": target_idx})
                await manager.send_json({"type": "status_change", "index": target_idx, "state": "error"})
                continue
        
        download_dir = Path(base_dir) / carpeta
        download_dir.mkdir(parents=True, exist_ok=True)
        
        ruta_destino = download_dir / nombre
        item.file_path = str(ruta_destino.resolve())
        
        await manager.send_json({
            "type": "start",
            "current": i + 1,
            "total": len(db_ids),
            "filename": nombre,
            "index": target_idx
        })
        await manager.send_json({"type": "status_change", "index": target_idx, "state": "downloading"})

        if ruta_destino.exists() and ruta_destino.stat().st_size == tamanio and tamanio > 0:
            item.state = "done"
            item.downloaded_bytes = tamanio
            database.update_download_state(db_id, "done")
            database.update_download_progress(db_id, tamanio, str(ruta_destino.resolve()))
            await manager.send_json({"type": "done", "index": target_idx, "file_path": str(ruta_destino.resolve())})
            await manager.send_json({"type": "status_change", "index": target_idx, "state": "done", "file_path": str(ruta_destino.resolve())})
            continue
            
        try:
            CHUNK_SIZE = 1024 * 1024
            if not ruta_destino.exists() or ruta_destino.stat().st_size != tamanio:
                with open(ruta_destino, 'wb') as f:
                    if tamanio > 0:
                        f.seek(tamanio - 1)
                        f.write(b'\0')

            descargados_total = 0
            sem = asyncio.Semaphore(4)  # Reducido de 10 a 4 para evitar saturar la sesión
            
            last_time = time.time()
            last_bytes = 0
            
            async def descargar_chunk(offset, chunk_size_bytes):
                nonlocal descargados_total, last_time, last_bytes
                
                if download_mgr.global_cancelled or item.cancelled:
                    return
                await download_mgr.global_pause_event.wait()
                await item.pause_event.wait()
                if download_mgr.global_cancelled or item.cancelled:
                    return

                async with sem:
                    if download_mgr.global_cancelled or item.cancelled:
                        return
                    await download_mgr.global_pause_event.wait()
                    await item.pause_event.wait()
                    if download_mgr.global_cancelled or item.cancelled:
                        return

                    chunk_data = bytearray()
                    bytes_leidos = 0
                    await ensure_connected()
                    async for chunk in client.iter_download(
                        msg_obj.document if msg_obj.document else msg_obj.video, 
                        offset=offset, 
                        request_size=1024*1024
                    ):
                        if download_mgr.global_cancelled or item.cancelled:
                            return
                        await download_mgr.global_pause_event.wait()
                        await item.pause_event.wait()
                        if download_mgr.global_cancelled or item.cancelled:
                            return

                        faltan = chunk_size_bytes - bytes_leidos
                        if len(chunk) > faltan:
                            chunk = chunk[:faltan]
                            
                        chunk_data.extend(chunk)
                        bytes_leidos += len(chunk)
                        descargados_total += len(chunk)
                        item.downloaded_bytes = descargados_total
                        
                        current_time = time.time()
                        if current_time - last_time > 0.2:
                            speed = (descargados_total - last_bytes) / (current_time - last_time) / (1024*1024)
                            database.update_download_progress(db_id, descargados_total)
                            await manager.send_json({
                                "type": "progress",
                                "downloaded": descargados_total,
                                "total_size": tamanio,
                                "speed_mbps": round(max(0, speed), 1),
                                "index": target_idx,
                                "state": item.state
                            })
                            last_time = current_time
                            last_bytes = descargados_total
                        
                        if bytes_leidos >= chunk_size_bytes:
                            break
                        
                    if not (download_mgr.global_cancelled or item.cancelled):
                        with open(ruta_destino, 'r+b') as f:
                            f.seek(offset)
                            f.write(chunk_data)

            tareas = []
            for offset in range(0, tamanio, CHUNK_SIZE):
                limit = min(CHUNK_SIZE, tamanio - offset)
                tareas.append(descargar_chunk(offset, limit))
            
            await asyncio.gather(*tareas)
            
            if download_mgr.global_cancelled or item.cancelled:
                item.state = "stopped"
                database.update_download_state(db_id, "stopped")
                database.update_download_progress(db_id, descargados_total, item.file_path)
                await manager.send_json({
                    "type": "progress", "downloaded": descargados_total, "total_size": tamanio, "speed_mbps": 0, "index": target_idx, "state": "stopped"
                })
                await manager.send_json({"type": "status_change", "index": target_idx, "state": "stopped"})
            else:
                item.state = "done"
                item.downloaded_bytes = tamanio
                database.update_download_state(db_id, "done")
                database.update_download_progress(db_id, tamanio, item.file_path)
                await manager.send_json({
                    "type": "progress", "downloaded": tamanio, "total_size": tamanio, "speed_mbps": 0, "index": target_idx, "state": "done"
                })
                await manager.send_json({"type": "done", "index": target_idx, "file_path": item.file_path})
                await manager.send_json({"type": "status_change", "index": target_idx, "state": "done", "file_path": item.file_path})
                
        except (ConnectionError, OSError) as e:
            # Error de conexión — intentar reconectar y reportar
            logger.warning(f"Error de conexión descargando {nombre}: {e}")
            try:
                await ensure_connected()
            except Exception:
                pass
            item.state = "error"
            database.update_download_state(db_id, "error")
            await manager.send_json({"type": "error", "message": f"Error de conexión: {traducir_error_telegram(e)}. La sesión se reconectó automáticamente.", "index": target_idx})
            await manager.send_json({"type": "status_change", "index": target_idx, "state": "error"})
        except Exception as e:
            item.state = "error"
            database.update_download_state(db_id, "error")
            await manager.send_json({"type": "error", "message": traducir_error_telegram(e), "index": target_idx})
            await manager.send_json({"type": "status_change", "index": target_idx, "state": "error"})

    download_mgr.is_running = False
    download_mgr.active_index = None
    await manager.send_json({"type": "finish_all"})
    await manager.send_json({"type": "global_status", "state": "idle"})


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
