import asyncio
import time
import re
import sys
import os
import subprocess
import logging
from datetime import datetime, timezone, time as dt_time
from pathlib import Path
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
import hashlib
from fastapi import Request, Response
from telethon import TelegramClient, events
from telethon.errors import (
    SessionPasswordNeededError, ChannelPrivateError, ChatAdminRequiredError,
    FloodWaitError, AuthKeyDuplicatedError
)
from telethon.tl.types import DocumentAttributeSticker, DocumentAttributeCustomEmoji, PeerChannel, PeerChat, PeerUser
from telethon.tl.functions.updates import GetStateRequest

from config import API_ID, API_HASH, SESSION_NAME, DOWNLOAD_DIR, APP_PASSWORD, DATA_DIR
from downloader import obtener_nombre_archivo, formatear_tamanio, es_video, traducir_error_telegram, extraer_info_archivo, es_tipo_archivo_permitido, clean_filename_for_pack, extraer_nombre_de_texto
import database

# Telegram Downloader App
logger = logging.getLogger("telegram_downloader")

app = FastAPI()
app.mount("/assets", StaticFiles(directory="assets"), name="assets")

@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    # Proteger únicamente rutas HTTP de la API (/api/), excepto /api/login
    # Las conexiones WebSocket (/ws) se autentican en su propio endpoint
    if request.url.path.startswith("/api/") and request.url.path != "/api/login":
        auth_cookie = request.cookies.get("auth_token")
        expected_token = hashlib.sha256(APP_PASSWORD.encode()).hexdigest()
        if not auth_cookie or auth_cookie != expected_token:
            return JSONResponse(status_code=401, content={"detail": "No autorizado"})
    return await call_next(request)

class LoginRequest(BaseModel):
    password: str

@app.post("/api/login")
async def login(data: LoginRequest, response: Response):
    if data.password == APP_PASSWORD:
        token = hashlib.sha256(APP_PASSWORD.encode()).hexdigest()
        response.set_cookie(
            key="auth_token",
            value=token,
            httponly=True,
            samesite="lax",
            max_age=60 * 60 * 24 * 30  # 30 días
        )
        return {"success": True}
    return {"success": False, "error": "Contraseña incorrecta"}

@app.post("/api/logout")
async def logout(response: Response):
    response.delete_cookie("auth_token")
    return {"success": True}
client = TelegramClient(
    SESSION_NAME, API_ID, API_HASH,
    connection_retries=10,       # Reintentar conexión hasta 10 veces
    retry_delay=2,               # Esperar 2 segundos entre reintentos
    auto_reconnect=True,         # Reconexión automática habilitada
    request_retries=5,           # Reintentar peticiones fallidas
)

# Almacenar los videos escaneados temporalmente en memoria para poder descargarlos
current_videos_cache = []
# Caché de mensajes de Telethon indexados por (str(entity_id), message_id)
messages_cache = {}

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
        to_remove = []
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception:
                to_remove.append(connection)
        for dead in to_remove:
            self.disconnect(dead)

manager = ConnectionManager()

# Tarea de keep-alive para mantener la sesión activa
_keepalive_task = None
_previous_app_active_time = None
_pending_auto_downloads = set()
_auto_download_total_queued = 0

async def _keepalive_loop():
    """Envía un ping periódico a Telegram para mantener la sesión viva y registrar actividad."""
    while True:
        try:
            await asyncio.sleep(60)  # Cada 1 minuto
            database.touch_app_active_time()
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

async def resolve_telegram_entity(client, entity_input):
    """Resuelve una entidad de Telegram (canal, grupo, chat) de forma robusta,
    incluso tras reiniciar la aplicación o la sesión."""
    if not entity_input:
        raise ValueError("Entity ID vacío")
    
    await ensure_connected()
    
    candidates = []
    str_val = str(entity_input).strip()

    # Extraer ID de links t.me o t.me/c/...
    import re
    match_msg = re.search(r't\.me/(?:c/)?([^/]+)(?:/\d+)?', str_val)
    if match_msg:
        str_val = match_msg.group(1)
        if str_val.isdigit():
            str_val = "-100" + str_val
    elif isinstance(str_val, str):
        match_chan = re.search(r'(?:https?://)?(?:www\.)?t\.me/([^/?#]+)/?$', str_val)
        if match_chan:
            str_val = match_chan.group(1)

    clean_num = str_val.lstrip("-")
    
    if clean_num.isdigit():
        num = int(str_val)
        candidates.append(num)
        if not str_val.startswith("-100"):
            try:
                candidates.append(int(f"-100{clean_num}"))
            except ValueError:
                pass
        try:
            candidates.append(PeerChannel(int(clean_num)))
            candidates.append(PeerChat(int(clean_num)))
            candidates.append(PeerUser(int(clean_num)))
        except Exception:
            pass
    else:
        candidates.append(str_val)
        if str_val.startswith("@"):
            candidates.append(str_val[1:])
        else:
            candidates.append(f"@{str_val}")

    for cand in candidates:
        try:
            entity = await client.get_entity(cand)
            if entity:
                return entity
        except Exception:
            continue

    # Si no se encontró en la caché local de Telethon, iterar diálogos para sincronizar entidades
    try:
        async for dialog in client.iter_dialogs(limit=None):
            d_id = getattr(dialog.entity, 'id', None)
            if d_id is not None and (str(d_id) == clean_num or str(d_id) == str_val):
                return dialog.entity
    except Exception as e:
        logger.warning(f"Error cargando diálogos para sincronizar entidades: {e}")

    # Reintentar tras sincronizar diálogos
    for cand in candidates:
        try:
            entity = await client.get_entity(cand)
            if entity:
                return entity
        except Exception:
            continue

    raise ValueError(f"No se pudo encontrar la entidad de Telegram para: {entity_input}")

async def auto_download_listener(event):
    if not getattr(event, 'message', None):
        return

    msg = event.message

    # Obtener canales activos
    auto_chans = database.get_auto_channels()
    active_chans = [c for c in auto_chans if c.get('active', 0) == 1]
    if not active_chans:
        return

    # Normalizar IDs para comparación
    chat_id_raw = str(event.chat_id or '')
    if chat_id_raw.startswith('-100'):
        chat_id_clean = chat_id_raw[4:]
    else:
        chat_id_clean = chat_id_raw.lstrip('-')

    matched_chan = None
    for chan in active_chans:
        c_raw = str(chan.get('entity_id') or '')
        if c_raw.startswith('-100'):
            c_clean = c_raw[4:]
        else:
            c_clean = c_raw.lstrip('-')

        if c_clean and c_clean == chat_id_clean:
            matched_chan = chan
            break

    if not matched_chan:
        return

    # Actualizar last_message_id del canal y registrar actividad de la app
    database.update_auto_channel_last_message(matched_chan['id'], msg.id)
    database.touch_app_active_time()

    if not getattr(msg, 'media', None):
        return

    # Extraer información del archivo (nombre, tamaño, objeto media)
    # Extraer información del archivo (nombre, tamaño, objeto media)
    parent_filename = None
    parent_pkg_name = None
    rep_id = getattr(msg, 'reply_to_msg_id', None)
    if rep_id:
        parent_dl = database.get_download_by_message(rep_id, matched_chan['entity_id'])
        if parent_dl:
            parent_filename = parent_dl.get('filename')
            parent_pkg_name = parent_dl.get('package_name')
        else:
            try:
                # Buscar primero en cache
                parent_msg = messages_cache.get((str(matched_chan['entity_id']), rep_id))
                if not parent_msg:
                    parent_msg = await client.get_messages(msg.chat_id, ids=rep_id)
                if parent_msg:
                    parent_filename = obtener_nombre_archivo(parent_msg)
            except Exception:
                pass

    # Extraer modelo/nombre de texto si es un álbum (grouped_id)
    album_model = None
    gid = getattr(msg, 'grouped_id', None)
    if gid:
        if getattr(msg, 'text', None):
            album_model = extraer_nombre_de_texto(msg.text)
        if not album_model:
            # Buscar en mensajes recientes del mismo álbum en caché
            for cached_msg in messages_cache.values():
                if getattr(cached_msg, 'grouped_id', None) == gid and getattr(cached_msg, 'text', None):
                    album_model = extraer_nombre_de_texto(cached_msg.text)
                    if album_model:
                        break

    # Si la foto no tiene reply_to explícito ni texto, verificar si el mensaje adyacente anterior es un documento
    if not parent_filename and getattr(msg, 'photo', None) and not getattr(msg, 'text', None):
        try:
            prev_msg = messages_cache.get((str(matched_chan['entity_id']), msg.id - 1))
            if not prev_msg:
                prev_msgs = await client.get_messages(msg.chat_id, ids=[msg.id - 1])
                prev_msg = prev_msgs[0] if prev_msgs else None
            if prev_msg and getattr(prev_msg, 'document', None):
                prev_fn = obtener_nombre_archivo(prev_msg)
                if prev_fn and re.search(r'\.(rar|zip|7z|tar|gz|cad|brd|bdv|pdf|bin|rom)$', prev_fn, re.I):
                    parent_filename = prev_fn
                    prev_dl = database.get_download_by_message(prev_msg.id, matched_chan['entity_id'])
                    if prev_dl:
                        parent_pkg_name = prev_dl.get('package_name')
        except Exception:
            pass

    effective_parent = parent_filename or album_model

    nombre, tamanio, media_obj = extraer_info_archivo(msg, parent_filename=effective_parent)
    if not nombre or not media_obj:
        return

    # Evitar duplicados si ya está registrado en la base de datos
    existente = database.get_download_by_message(msg.id, matched_chan['entity_id'])
    if existente:
        return

    # Filtrar por tipo de archivo si el canal tiene restricción
    file_types = matched_chan.get('file_types', 'all') or 'all'
    logger.info(f"[Auto-Descarga] Evaluando '{nombre}' contra filtro '{file_types}'")
    if not es_tipo_archivo_permitido(nombre, msg, file_types):
        logger.info(f"[Auto-Descarga] OMITIDO por filtro ({file_types}): {nombre}")
        return

    # Guardar en memoria caché para acceso inmediato de descarga
    messages_cache[(str(matched_chan['entity_id']), msg.id)] = msg

    channel_name = matched_chan.get('channel_name') or "Auto-Descargas"
    sub_mode = matched_chan.get('subfolder_mode') or 'channel_model'
    if sub_mode == 'channel_model':
        if parent_pkg_name and not re.match(r'^(foto|preview|archivo|video|image)(_\d+)?$', str(parent_pkg_name), re.I):
            pkg_name = parent_pkg_name
        else:
            base_pack = clean_filename_for_pack(effective_parent or nombre)
            if base_pack and not re.match(r'^(foto|preview|archivo|video|image)(_\d+)?$', base_pack, re.I):
                pkg_name = base_pack
            else:
                pkg_name = channel_name
    else:
        pkg_name = channel_name

    db_id = database.add_download(
        message_id=msg.id,
        entity_id=matched_chan['entity_id'],
        filename=nombre,
        total_size=tamanio,
        custom_dir=matched_chan.get('custom_dir', ''),
        package_name=pkg_name,
        channel_name=channel_name,
        fecha=msg.date.isoformat() if msg.date else ""
    )

    logger.info(f"[Auto-Descarga] Nuevo archivo detectado en {pkg_name}: {nombre} ({tamanio} bytes). DB ID: {db_id}")

    # Iniciar la descarga usando el bucle principal
    asyncio.create_task(process_downloads([db_id], matched_chan.get('custom_dir', '')))
    
    # Notificar a los clientes conectados
    await manager.send_json({"type": "history_update"})


def setup_auto_download_listener(tg_client):
    try:
        tg_client.remove_event_handler(auto_download_listener)
    except Exception:
        pass
    tg_client.add_event_handler(auto_download_listener, events.NewMessage)
    logger.info("Listener de auto-descargas registrado en el cliente Telegram.")


async def scan_and_enqueue_channel(entity, matched_chan, limit=200, only_new=True, download_all_existing=False, since_time=None):
    """
    Escanea un canal y encola para descarga los archivos multimedia que aún no se hayan descargado.
    Agrupa los archivos en paquetes lógicos por modelo/publicación igual que el Capturador de Enlaces.
    """
    try:
        new_db_ids = []
        custom_dir = matched_chan.get('custom_dir', '') or ''
        channel_name = matched_chan.get('channel_name') or getattr(entity, 'title', '') or 'Auto-Descargas'
        entity_id = str(matched_chan.get('entity_id') or entity.id)
        channel_db_id = matched_chan.get('id')

        last_msg_id = int(matched_chan.get('last_message_id') or 0)

        # Si last_msg_id es 0, intentar buscar el max message_id en descargas previas
        if last_msg_id == 0:
            clean_ent = entity_id.replace('-100', '').replace('-', '')
            try:
                conn = database._get_conn()
                max_row = conn.execute(
                    "SELECT MAX(message_id) as max_id FROM downloads WHERE replace(replace(entity_id, '-100', ''), '-', '') = ?",
                    (clean_ent,)
                ).fetchone()
                if max_row and max_row["max_id"]:
                    last_msg_id = int(max_row["max_id"])
            except Exception:
                pass

        # Si no queremos descargar existentes y no tenemos referencia previa de ID ni sesión anterior:
        # tomamos el último mensaje actual del canal como punto de inicio y evitamos descargar historial antiguo
        if only_new and not download_all_existing and last_msg_id == 0 and not since_time:
            try:
                latest_msgs = await client.get_messages(entity, limit=1)
                if latest_msgs:
                    latest_id = latest_msgs[0].id
                    if channel_db_id:
                        database.update_auto_channel_last_message(channel_db_id, latest_id)
                    logger.info(f"[Scan-Canal] Canal '{channel_name}' inicializado en mensaje ID {latest_id}. Se descargarán solo archivos futuros.")
                    return 0
            except Exception as e:
                logger.warning(f"Error obteniendo mensaje inicial para canal '{channel_name}': {e}")

        iter_kwargs = {}
        if only_new and last_msg_id > 0:
            iter_kwargs['min_id'] = last_msg_id
        elif download_all_existing:
            iter_kwargs['limit'] = None  # Escanear todos los mensajes del canal, igual que en el Capturador
        elif limit:
            iter_kwargs['limit'] = limit

        highest_seen_id = last_msg_id
        raw_messages = []

        async for msg in client.iter_messages(entity, **iter_kwargs):
            if not msg:
                continue

            # Si min_id está activo y encontramos un mensaje menor o igual, detener
            if only_new and last_msg_id > 0 and msg.id <= last_msg_id:
                break

            # Rastrear el ID más alto observado
            if msg.id > highest_seen_id:
                highest_seen_id = msg.id

            # Si hay una marca de tiempo 'since_time' (última vez que se usó la app),
            # no descargar mensajes anteriores a esa sesión (con margen de 5 minutos)
            if only_new and since_time and msg.date:
                from datetime import timezone, timedelta
                st_utc = since_time.astimezone(timezone.utc) if since_time.tzinfo else since_time.replace(tzinfo=timezone.utc)
                if msg.date < (st_utc - timedelta(minutes=5)):
                    logger.info(f"[Scan-Canal] Mensaje {msg.id} ({msg.date}) es anterior a la última sesión activa ({st_utc}). Deteniendo escaneo hacia atrás.")
                    break

            if not getattr(msg, 'media', None):
                continue

            # Ignorar stickers y emojis animados
            if getattr(msg, 'document', None):
                attrs = getattr(msg.document, 'attributes', [])
                if any(isinstance(a, (DocumentAttributeSticker, DocumentAttributeCustomEmoji)) for a in attrs):
                    continue

            raw_messages.append(msg)

        # Mapear mensajes por ID para poder resolver nombres de respuestas/fotos
        msgs_map = {m.id: m for m in raw_messages}

        # Mapear textos de álbumes (grouped_id) para propagar el modelo a todas las fotos del álbum
        album_model_names = {}
        for m in raw_messages:
            gid = getattr(m, 'grouped_id', None)
            if gid and getattr(m, 'text', None) and gid not in album_model_names:
                extracted = extraer_nombre_de_texto(m.text)
                if extracted:
                    album_model_names[gid] = extracted

        videos = []
        file_types = matched_chan.get('file_types', 'all') or 'all'

        for message in raw_messages:
            # Verificar si ya existe en la base de datos
            existente = database.get_download_by_message(message.id, entity_id)
            if existente:
                continue

            parent_fn = None
            rep_id = getattr(message, 'reply_to_msg_id', None)
            if rep_id and rep_id in msgs_map:
                parent_fn = obtener_nombre_archivo(msgs_map[rep_id])
            elif rep_id:
                parent_dl = database.get_download_by_message(rep_id, entity_id)
                if parent_dl:
                    parent_fn = parent_dl.get('filename')

            # Si la foto no tiene reply_to explícito ni texto, verificar si el mensaje adyacente en msgs_map es un documento
            if not parent_fn and getattr(message, 'photo', None) and not getattr(message, 'text', None):
                for adj_id in (message.id - 1, message.id + 1):
                    if adj_id in msgs_map and getattr(msgs_map[adj_id], 'document', None):
                        adj_fn = obtener_nombre_archivo(msgs_map[adj_id])
                        if adj_fn and re.search(r'\.(rar|zip|7z|tar|gz|cad|brd|bdv|pdf|bin|rom)$', adj_fn, re.I):
                            parent_fn = adj_fn
                            break

            gid = getattr(message, 'grouped_id', None)
            album_model = album_model_names.get(gid) if gid else None
            effective_parent = parent_fn or album_model

            nombre, tamanio, media_obj = extraer_info_archivo(message, parent_filename=effective_parent)
            if not nombre or not media_obj:
                continue

            # Filtrar por tipo de archivo según configuración del canal
            if not es_tipo_archivo_permitido(nombre, message, file_types):
                logger.info(f"[Scan-Canal] OMITIDO por filtro ({file_types}): {nombre}")
                continue

            videos.append({
                "id": message.id,
                "nombre": nombre,
                "tamanio": tamanio,
                "tamanio_fmt": formatear_tamanio(tamanio),
                "fecha": message.date.isoformat() if message.date else "",
                "carpeta": channel_name,
                "entity_id": str(entity_id),
                "message": message,
                "reply_to_id": rep_id,
                "grouped_id": gid
            })

        # Cachear los objetos message de telethon
        for v in videos:
            messages_cache[(str(entity_id), v["id"])] = v["message"]

        # Agrupar inteligentemente en paquetes por modelo/publicación
        package_list = group_items_into_packages(videos, channel_name, custom_dir, str(entity_id))

        # Registrar descargas organizadas por paquete
        sub_mode = matched_chan.get('subfolder_mode') or 'channel_model'
        for pkg in package_list:
            pkg_name = pkg["name"] if sub_mode == 'channel_model' else channel_name
            for it in pkg["items"]:
                db_id = database.add_download(
                    message_id=it["id"],
                    entity_id=str(entity_id),
                    filename=it["nombre"],
                    total_size=it["tamanio"],
                    custom_dir=custom_dir,
                    file_path="",
                    package_name=pkg_name,
                    channel_name=channel_name,
                    fecha=it.get("fecha", "")
                )
                new_db_ids.append(db_id)

        # Actualizar last_message_id del canal
        if channel_db_id:
            if highest_seen_id > last_msg_id:
                database.update_auto_channel_last_message(channel_db_id, highest_seen_id)
            elif last_msg_id == 0:
                try:
                    latest = await client.get_messages(entity, limit=1)
                    if latest:
                        database.update_auto_channel_last_message(channel_db_id, latest[0].id)
                except Exception:
                    pass

        if new_db_ids:
            new_db_ids.reverse()  # Orden cronológico (más antiguos primero)
            if only_new:
                _pending_auto_downloads.update(new_db_ids)
                _auto_download_total_queued += len(new_db_ids)
            logger.info(f"[Auto-Descargas] Encolados {len(new_db_ids)} archivos nuevos para el canal '{channel_name}' en {len(package_list)} paquete(s)")
            asyncio.create_task(process_downloads(new_db_ids, custom_dir))
            await manager.send_json({"type": "history_update"})

        return len(new_db_ids)
    except Exception as e:
        logger.error(f"Error escaneando canal existente: {e}")
        return 0


async def sync_all_active_channels_on_startup(limit=200):
    """
    Al iniciar la aplicación o autenticarse, escanea todos los canales activos configurados
    para auto-descargas, detecta archivos publicados mientras la app estuvo cerrada
    (desde la última vez que se utilizó la aplicación) y los encola para descargarse inmediatamente.
    """
    try:
        # Pausa inicial de 2 segundos para dar tiempo a que el bucle de eventos y conexión estén estables
        await asyncio.sleep(2)
        await ensure_connected()
        if not await client.is_user_authorized():
            logger.info("[Auto-Descargas Startup] Sesión no autorizada. Omitiendo verificación inicial.")
            return

        active_channels = [c for c in database.get_auto_channels() if c.get('active', 0) == 1]
        if not active_channels:
            logger.info("[Auto-Descargas Startup] No hay canales de auto-descarga activos configurados.")
            return

        # Esperar hasta 5 segundos a que el navegador se conecte al WebSocket para mostrar las notificaciones
        for _ in range(10):
            if manager.active_connections:
                break
            await asyncio.sleep(0.5)

        # 1. Notificación Toast: Revisando actualizaciones
        await manager.send_json({
            "type": "toast",
            "message": f"Revisando actualizaciones en {len(active_channels)} canal(es) automatizado(s)...",
            "toast_type": "info",
            "duration": 9000,
            "title": "Descargas Automatizadas"
        })

        last_active = _previous_app_active_time
        if last_active:
            logger.info(f"[Auto-Descargas Startup] Verificando archivos nuevos en {len(active_channels)} canal(es) activo(s) publicados desde la última sesión ({last_active.strftime('%Y-%m-%d %H:%M:%S UTC')})...")
        else:
            logger.info(f"[Auto-Descargas Startup] Verificando archivos nuevos en {len(active_channels)} canal(es) activo(s)...")

        total_enqueued = 0

        for chan in active_channels:
            chan_name = chan.get('channel_name') or chan.get('channel_url')
            try:
                target = chan.get('entity_id') or chan.get('channel_url')
                try:
                    entity = await resolve_telegram_entity(client, target)
                except Exception:
                    if chan.get('channel_url'):
                        entity = await resolve_telegram_entity(client, chan['channel_url'])
                    else:
                        raise

                enqueued = await scan_and_enqueue_channel(
                    entity=entity,
                    matched_chan=chan,
                    limit=limit,
                    only_new=True,
                    download_all_existing=False,
                    since_time=last_active
                )
                if enqueued > 0:
                    logger.info(f"[Auto-Descargas Startup] Canal '{chan_name}': {enqueued} archivo(s) nuevo(s) encolado(s) para descarga inmediata.")
                    total_enqueued += enqueued

                    # 2. Notificación Toast: Cuántos archivos nuevos hay en este canal y que comenzaron las descargas
                    await manager.send_json({
                        "type": "toast",
                        "message": f"Canal \"{chan_name}\": Se encontraron {enqueued} archivo(s) nuevo(s). Comenzaron las descargas.",
                        "toast_type": "info",
                        "duration": 10000,
                        "title": "Descargas Iniciadas"
                    })
                else:
                    logger.info(f"[Auto-Descargas Startup] Canal '{chan_name}': al día (sin archivos nuevos pendientes).")
            except Exception as e:
                logger.error(f"[Auto-Descargas Startup] Error al verificar canal '{chan_name}': {e}")

        logger.info(f"[Auto-Descargas Startup] Verificación de inicio finalizada. Total de archivos nuevos encolados: {total_enqueued}")
        
        # Si ningún canal tuvo archivos nuevos, notificar que todo está al día
        if total_enqueued == 0:
            await manager.send_json({
                "type": "toast",
                "message": "Los canales automatizados están al día. No hay archivos nuevos desde la última sesión.",
                "toast_type": "success",
                "duration": 9000,
                "title": "Automatizaciones al Día"
            })
        else:
            await manager.send_json({"type": "history_update"})
    except Exception as e:
        logger.error(f"[Auto-Descargas Startup] Error en proceso de sincronización inicial: {e}")


@app.on_event("startup")
async def startup_event():
    global _keepalive_task, client, _previous_app_active_time

    # Si DATA_DIR está en uso y no es '.', migrar automáticamente archivos existentes de la raíz si existen
    if DATA_DIR and DATA_DIR != ".":
        try:
            os.makedirs(DATA_DIR, exist_ok=True)
            root_db = os.path.join(os.path.dirname(os.path.abspath(__file__)), "downloads.db")
            target_db = os.path.join(DATA_DIR, "downloads.db")
            if os.path.isfile(root_db) and not os.path.exists(target_db):
                import shutil
                shutil.copy2(root_db, target_db)
                logger.info(f"Base de datos migrada a {target_db}")

            root_sess = os.path.join(os.path.dirname(os.path.abspath(__file__)), "mi_sesion.session")
            target_sess = os.path.join(DATA_DIR, "mi_sesion.session")
            if os.path.isfile(root_sess) and not os.path.exists(target_sess):
                import shutil
                shutil.copy2(root_sess, target_sess)
                logger.info(f"Archivo de sesión migrado a {target_sess}")
        except Exception as mig_err:
            logger.warning(f"Aviso en migración de datos: {mig_err}")

    database.init_db()
    # Leer la última vez que la aplicación estuvo activa en la sesión anterior
    _previous_app_active_time = database.get_last_app_active_time()
    database.touch_app_active_time()
    if _previous_app_active_time:
        logger.info(f"Última sesión de la aplicación registrada: {_previous_app_active_time.strftime('%Y-%m-%d %H:%M:%S UTC')}")
    else:
        logger.info("Primera sesión o sin registro previo de cierre de la aplicación.")

    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    try:
        await client.connect()
    except Exception as e:
        err_str = str(e).lower()
        if "locked" in err_str or "database is locked" in err_str:
            logger.error("La sesión 'mi_sesion.session' está en uso por otra instancia de la aplicación. Cierra cualquier otra ventana de la app antes de iniciar.")
            raise RuntimeError("Ya hay otra instancia de la aplicación abierta utilizando 'mi_sesion.session'. Ciérrala antes de continuar.") from e

        logger.warning(f"Error conectando con sesión existente: {e}. Reintentando con sesión limpia...")
        session_file = f"{SESSION_NAME}.session"
        if os.path.exists(session_file):
            try:
                if client.is_connected():
                    await client.disconnect()
            except Exception:
                pass
            try:
                os.remove(session_file)
                logger.info(f"Archivo de sesión corrupto eliminado: {session_file}")
            except Exception as del_err:
                logger.warning(f"No se pudo eliminar el archivo de sesión: {del_err}")

        client = TelegramClient(
            SESSION_NAME, API_ID, API_HASH,
            connection_retries=10, retry_delay=2,
            auto_reconnect=True, request_retries=5,
        )
        await client.connect()

    # Inicializar estado en Telegram para activar recepción de eventos en tiempo real
    try:
        if await client.is_user_authorized():
            me = await client.get_me()
            logger.info(f"Sesión activa de Telegram para: {me.first_name} (ID: {me.id})")
            # Lanzar verificación y descarga automática de archivos subidos mientras la app estuvo cerrada
            asyncio.create_task(sync_all_active_channels_on_startup())
    except Exception as auth_err:
        logger.warning(f"Aviso al verificar autorización en startup: {auth_err}")

    # Registrar el listener de nuevos mensajes de forma idempotente
    setup_auto_download_listener(client)

    # Iniciar el loop de keep-alive
    _keepalive_task = asyncio.create_task(_keepalive_loop())
    logger.info("Keep-alive y auto-descargas de Telegram iniciados.")


@app.on_event("shutdown")
async def shutdown_event():
    global _keepalive_task
    try:
        database.touch_app_active_time()
    except Exception:
        pass
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

def extraer_fecha_carpeta(msg_obj=None, fecha_str: str = "") -> str:
    """Extrae la fecha en formato DD-MM-YYYY para organizar descargas en subcarpetas por fecha."""
    if msg_obj and getattr(msg_obj, 'date', None):
        try:
            dt = msg_obj.date
            if getattr(dt, 'tzinfo', None) is not None:
                dt = dt.astimezone()
            return dt.strftime("%d-%m-%Y")
        except Exception:
            pass
    if fecha_str:
        try:
            # Si ya tiene formato DD-MM-YYYY...
            if len(fecha_str) >= 10 and fecha_str[2] == '-' and fecha_str[5] == '-':
                return fecha_str[:10]
            # Si tiene formato ISO (YYYY-MM-DD...)
            if len(fecha_str) >= 10 and fecha_str[4] == '-' and fecha_str[7] == '-':
                parts = fecha_str[:10].split('-')
                return f"{parts[2]}-{parts[1]}-{parts[0]}"
        except Exception:
            pass
    return datetime.now().strftime("%d-%m-%Y")

def clean_filename_for_pack(fname: str) -> str:
    if not fname:
        return ""
    s = re.sub(r'(?i)\.(part\d+|z\d+|7z\.\d+|\d{3})\.(rar|zip|7z|tar|gz)$', '', fname)
    s = re.sub(r'(?i)\.part\d+\.rar$', '', s)
    s = re.sub(r'(?i)\.(rar|zip|7z|tar|gz|mp4|mkv|avi|mov|iso|bin|rom|hex|cue|chd|cso|exe|pdf|jpg|jpeg|png|webp|cad|bdv|brd|tvw|fz)$', '', s)
    s = re.sub(r'(?i)[._ -]part\d+$', '', s)
    s = re.sub(r'(?i)\.z\d+$', '', s)
    s = re.sub(r'(?i)[._ -](preview|boardview|schematic|foto)$', '', s)
    s = re.sub(r'\s*\(\d+\)$', '', s)
    s = re.sub(r'[<>:"/\\|?*]', '', s).strip()
    return s

def detect_container_name(filenames: list[str], fallback: str = "Descargas") -> str:
    """Detecta el nombre de la carpeta contenedora para un paquete a partir de sus archivos."""
    if not filenames:
        return fallback
    cleaned = [clean_filename_for_pack(f) for f in filenames if f]
    if not cleaned:
        return fallback
    if len(cleaned) == 1:
        return cleaned[0] or fallback
    prefix = os.path.commonprefix(cleaned).strip()
    prefix = re.sub(r'[\s._-]+$', '', prefix)
    if len(prefix) >= 3:
        return prefix
    return cleaned[0] or fallback


def group_items_into_packages(videos: list[dict], chat_name: str, custom_dir: str, entity_id: str) -> list[dict]:
    """
    Agrupa una lista de archivos/mensajes de Telegram escaneados en paquetes lógicos por modelo/publicación.
    Vincula:
      1. Respuestas directas (reply_to_id) como por ejemplo la foto de vista previa y el archivo .rar.
      2. Álbumes de Telegram (grouped_id).
      3. Archivos multipartes (.part1.rar, .part2.rar).
      4. Archivos individuales con su propio nombre de modelo/esquemático.
    """
    if not videos:
        return []

    by_id = {v["id"]: v for v in videos}

    # Union-Find para agrupar mensajes relacionados
    parent_map = {}
    def find_root(x):
        p = parent_map.get(x, x)
        if p == x:
            return x
        parent_map[x] = find_root(p)
        return parent_map[x]

    def union(a, b):
        ra = find_root(a)
        rb = find_root(b)
        if ra != rb:
            parent_map[rb] = ra

    for v in videos:
        v_id = v["id"]
        if v_id not in parent_map:
            parent_map[v_id] = v_id

    # 1. Unir por reply_to_id (respuesta/cita de mensaje)
    for v in videos:
        rep = v.get("reply_to_id")
        if rep and rep in by_id:
            union(rep, v["id"])

    # 2. Unir por grouped_id (álbumes)
    albums = {}
    for v in videos:
        gid = v.get("grouped_id")
        if gid:
            if gid in albums:
                union(albums[gid], v["id"])
            else:
                albums[gid] = v["id"]

    # 3. Unir por nombre base de modelo / partes (ej: part1, part2, o preview y archivo principal)
    base_names = {}
    for v in videos:
        cleaned = clean_filename_for_pack(v["nombre"])
        if cleaned and len(cleaned) >= 3 and not re.match(r'^(foto|preview|archivo|video|image)(_\d+)?$', cleaned, re.I):
            cleaned_key = cleaned.lower()
            if cleaned_key in base_names:
                union(base_names[cleaned_key], v["id"])
            else:
                base_names[cleaned_key] = v["id"]

    # 4. Construir los grupos resultantes
    groups = {}
    for v in videos:
        r = find_root(v["id"])
        if r not in groups:
            groups[r] = []
        groups[r].append(v)

    # 5. Generar lista de paquetes con nombres limpios y descriptivos
    package_list = []
    for r, group_items in groups.items():
        # Preferir documento/video sobre imagen para dar nombre al paquete
        docs = [it for it in group_items if not it["nombre"].lower().endswith(('.jpg', '.jpeg', '.png', '.webp'))]
        if docs:
            main_item = docs[0]
        else:
            # Si todas son fotos, preferir la foto con nombre descriptivo (evitar 'foto_\d+' o números puros)
            named_photos = [
                it for it in group_items 
                if not re.match(r'^(foto|preview|archivo|image)_\d+\.', it["nombre"], re.I)
                and not re.match(r'^\d+\s*\(\d+\)\.', it["nombre"])
            ]
            main_item = named_photos[0] if named_photos else group_items[0]

        pkg_name = clean_filename_for_pack(main_item["nombre"]) or main_item["nombre"]
        pkg_name = re.sub(r'[<>:"/\\|?*]', '', pkg_name).strip()
        if not pkg_name or re.match(r'^(foto|preview|archivo|image)_\d+$', pkg_name, re.I):
            pkg_name = chat_name

        # Asignar la carpeta al item para compatibilidad
        for it in group_items:
            it["carpeta"] = pkg_name

        package_list.append({
            "name": pkg_name,
            "entity_id": str(entity_id),
            "custom_dir": custom_dir or "",
            "channel_name": chat_name,
            "items": group_items
        })

    return package_list

class QRPasswordAuth(BaseModel):
    password: str

class ScanLink(BaseModel):
    link: str
    custom_dir: str = ""
    date_from: str | None = None
    date_to: str | None = None

class DownloadItemPayload(BaseModel):
    message_id: int
    entity_id: str = ""
    filename: str = ""
    total_size: int = 0
    fecha: str = ""
    custom_dir: str = ""
    package_name: str = "Descargas"
    channel_name: str = ""
    grabber_item_id: int | None = None

class DownloadRequest(BaseModel):
    indices: list[int] = []
    items: list[DownloadItemPayload] = []
    custom_dir: str = ""
    is_resume: bool = False
    include_date: bool = False
    remove_from_grabber: bool = True

class DownloadControlRequest(BaseModel):
    index: int | str = "all"

class GrabberDeleteRequest(BaseModel):
    package_ids: list[int] = []
    item_ids: list[int] = []

class GrabberDirRequest(BaseModel):
    package_id: int
    custom_dir: str

class GrabberRenameRequest(BaseModel):
    package_id: int
    name: str

class DeleteDownloadsRequest(BaseModel):
    db_ids: list[int] = []
    package_names: list[str] = []

class DownloadItem:
    def __init__(self, original_idx: int, filename: str, total_size: int, package_name: str = "Descargas", fecha: str = "", channel_name: str = ""):
        self.original_idx = original_idx
        self.filename = filename
        self.total_size = total_size
        self.package_name = package_name or "Descargas"
        self.channel_name = channel_name or ""
        self.fecha = fecha
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
        self.queue: list[int] = []

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
            self.items[idx].cancelled = False
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
        self.global_cancelled = False
        self.global_pause_event.set()
        for item in self.items.values():
            item.cancelled = False
            item.pause_event.set()
            if item.state == "paused":
                item.state = "downloading" if item.original_idx == self.active_index else "pending"

    def stop_all(self):
        self.global_cancelled = True
        self.queue.clear()
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

class CreateDirRequest(BaseModel):
    parent_dir: str
    folder_name: str

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
        pkg_name = h.get("package_name") or "Descargas"
        channel_name = h.get("channel_name") or ""
        formatted.append({
            "db_id": h["id"],
            "id": h["message_id"],
            "entity_id": h["entity_id"],
            "nombre": h["filename"],
            "tamanio": h["total_size"],
            "tamanio_fmt": formatear_tamanio(h["total_size"]),
            "state": h["state"],
            "downloaded_bytes": h["downloaded_bytes"],
            "file_path": h["file_path"] or "",
            "package_name": pkg_name,
            "channel_name": channel_name,
            "fecha": h.get("fecha") or "",
            "custom_dir": h.get("custom_dir") or ""
        })
        # Registrar en el DownloadManager si no existe
        if h["id"] not in download_mgr.items:
            item = DownloadItem(h["id"], h["filename"], h["total_size"], pkg_name, h.get("fecha") or "", channel_name)
            item.db_id = h["id"]
            item.state = h["state"]
            item.downloaded_bytes = h["downloaded_bytes"]
            item.file_path = h["file_path"] or ""
            item.message_id = h["message_id"]
            item.entity_id = h["entity_id"]
            item.custom_dir = h.get("custom_dir", "")
            download_mgr.items[h["id"]] = item
    return {"success": True, "history": formatted}

@app.post("/api/downloads/delete")
async def delete_downloads(data: DeleteDownloadsRequest):
    if data.db_ids:
        for db_id in data.db_ids:
            if db_id in download_mgr.items:
                download_mgr.items[db_id].cancelled = True
                download_mgr.items[db_id].pause_event.set()
                download_mgr.items.pop(db_id, None)
        database.delete_downloads_batch(data.db_ids)
    if data.package_names:
        for pkg in data.package_names:
            to_remove = [k for k, v in download_mgr.items.items() if getattr(v, 'package_name', '') == pkg]
            for k in to_remove:
                download_mgr.items[k].cancelled = True
                download_mgr.items[k].pause_event.set()
                download_mgr.items.pop(k, None)
            database.delete_package_downloads(pkg)
    return {"success": True}

@app.post("/api/downloads/clear_completed")
async def clear_completed_downloads():
    to_remove = [k for k, v in download_mgr.items.items() if v.state == 'done']
    for k in to_remove:
        download_mgr.items.pop(k, None)
    database.clear_completed_downloads()
    return {"success": True}

# --- Rutas del Capturador de Enlaces (Link Grabber) ---
@app.get("/api/grabber")
async def get_grabber():
    packages = database.get_all_grabber()
    for p in packages:
        total_size = sum(item.get("total_size", 0) for item in p.get("items", []))
        p["total_size"] = total_size
        p["total_size_fmt"] = formatear_tamanio(total_size)
        for item in p.get("items", []):
            item["tamanio_fmt"] = formatear_tamanio(item.get("total_size", 0))
            item["carpeta"] = p["name"]
    return {"success": True, "packages": packages}

@app.post("/api/grabber/delete")
async def delete_grabber(data: GrabberDeleteRequest):
    if data.package_ids:
        for pid in data.package_ids:
            database.delete_grabber_package(pid)
    if data.item_ids:
        database.delete_grabber_items(data.item_ids)
    return {"success": True}

@app.post("/api/grabber/clear")
async def clear_grabber():
    database.clear_grabber()
    return {"success": True}

@app.post("/api/grabber/update_dir")
async def update_grabber_dir(data: GrabberDirRequest):
    database.update_grabber_package_dir(data.package_id, data.custom_dir)
    return {"success": True}

@app.post("/api/grabber/rename")
async def rename_grabber_pkg(data: GrabberRenameRequest):
    database.rename_grabber_package(data.package_id, data.name)
    return {"success": True}

@app.post("/api/grabber/reorganize")
async def reorganize_grabber():
    """Reorganiza todos los archivos del capturador en paquetes individuales por modelo."""
    try:
        count = database.reorganize_grabber_packages()
        packages = database.get_all_grabber()
        for p in packages:
            total_size = sum(item.get("total_size", 0) for item in p.get("items", []))
            p["total_size"] = total_size
            p["total_size_fmt"] = formatear_tamanio(total_size)
            for item in p.get("items", []):
                item["tamanio_fmt"] = formatear_tamanio(item.get("total_size", 0))
                item["carpeta"] = p["name"]
        return {"success": True, "packages_count": count, "packages": packages}
    except Exception as e:
        logger.error(f"Error reorganizando capturador: {e}")
        return {"success": False, "error": str(e)}

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
        setup_auto_download_listener(client)
        asyncio.create_task(sync_all_active_channels_on_startup())
        return {"success": True}
    except SessionPasswordNeededError:
        if not data.password:
            return {"success": False, "needs_password": True}
        try:
            await client.sign_in(password=data.password)
            setup_auto_download_listener(client)
            asyncio.create_task(sync_all_active_channels_on_startup())
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
        download_mgr.pause_all()
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
    setup_auto_download_listener(client)
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
                setup_auto_download_listener(client)
                asyncio.create_task(sync_all_active_channels_on_startup())
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
            setup_auto_download_listener(client)
            asyncio.create_task(sync_all_active_channels_on_startup())
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
    is_win = sys.platform == 'win32'

    if is_win:
        common_folders = [
            {"name": "Descargas", "path": str(home / "Downloads"), "icon": "fa-download"},
            {"name": "Escritorio", "path": str(home / "Desktop"), "icon": "fa-desktop"},
            {"name": "Documentos", "path": str(home / "Documents"), "icon": "fa-file-lines"},
            {"name": "Videos", "path": str(home / "Videos"), "icon": "fa-film"},
            {"name": "Carpeta del Proyecto", "path": str(Path(DOWNLOAD_DIR).resolve()), "icon": "fa-box-archive"},
        ]
        common_folders = [f for f in common_folders if os.path.exists(f["path"])]

        drives = []
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
    else:
        # En Linux / Synology DSM / ZimaOS / CasaOS
        common_folders = [
            {"name": "Raíz del Sistema (/)", "path": "/", "icon": "fa-server"}
        ]
        if os.path.exists("/volume1"):
            common_folders.append({"name": "Volumen 1 (/volume1)", "path": "/volume1", "icon": "fa-hard-drive"})
        if os.path.exists("/volume1/Descargas Telegram"):
            common_folders.append({"name": "Descargas Telegram", "path": "/volume1/Descargas Telegram", "icon": "fa-download"})
        if os.path.exists("/DATA"):
            common_folders.append({"name": "Almacenamiento (/DATA)", "path": "/DATA", "icon": "fa-hard-drive"})
        if os.path.exists("/media"):
            common_folders.append({"name": "Medios (/media)", "path": "/media", "icon": "fa-photo-film"})
        if os.path.exists(DOWNLOAD_DIR):
            common_folders.append({"name": "Carpeta Descargas", "path": str(Path(DOWNLOAD_DIR).resolve()), "icon": "fa-box-archive"})
        common_folders = [f for f in common_folders if os.path.exists(f["path"])]

        drives = ["/"]
        for v in range(1, 10):
            vol_path = f"/volume{v}"
            if os.path.exists(vol_path):
                drives.append(vol_path)
        if os.path.exists("/DATA"):
            drives.append("/DATA")
        if os.path.exists("/media"):
            drives.append("/media")

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
        if is_win:
            downloads = home / "Downloads"
            if downloads.exists():
                target = downloads
            elif drives:
                target = Path(drives[0])
            else:
                target = home
        else:
            if os.path.exists("/volume1"):
                target = Path("/volume1")
            elif os.path.exists("/DATA"):
                target = Path("/DATA")
            elif os.path.exists(DOWNLOAD_DIR):
                target = Path(DOWNLOAD_DIR).resolve()
            else:
                target = Path("/")

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
        "error": error_msg,
        "is_win": is_win
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

@app.post("/api/create_dir")
async def create_directory(data: CreateDirRequest):
    parent_str = data.parent_dir.strip() if data.parent_dir else ""
    if not parent_str:
        return {"success": False, "error": "Ruta de carpeta padre no proporcionada."}
    
    parent = Path(parent_str)
    if not parent.exists() or not parent.is_dir():
        return {"success": False, "error": f"La carpeta actual no existe: {parent_str}"}

    name = data.folder_name.strip()
    if not name:
        return {"success": False, "error": "El nombre de la carpeta no puede estar vacío."}

    # Caracteres prohibidos en Windows
    if re.search(r'[<>:"/\\|?*]', name):
        return {"success": False, "error": 'El nombre no puede contener los siguientes caracteres: < > : " / \\ | ? *'}

    target_dir = parent / name
    try:
        if target_dir.exists():
            return {"success": False, "error": f"Ya existe una carpeta o archivo llamado '{name}' en esta ubicación."}
        target_dir.mkdir(parents=True, exist_ok=False)
        return {
            "success": True,
            "path": str(target_dir),
            "parent": str(parent),
            "name": name,
            "message": f"Carpeta '{name}' creada correctamente."
        }
    except PermissionError:
        return {"success": False, "error": "Permiso denegado al crear la carpeta en este directorio."}
    except Exception as e:
        return {"success": False, "error": f"Error al crear la carpeta: {str(e)}"}

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
        partes = canal_input.rsplit("_", 1)
        if len(partes) == 2 and partes[1].isdigit():
            canal_input = partes[0]
            thread_id = int(partes[1])
    
    if isinstance(canal_input, str):
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
        is_direct_message = False
        if mensaje_id:
            message = await client.get_messages(entity, ids=mensaje_id)
            if not message:
                return {"success": False, "error": "El mensaje no existe o fue eliminado."}
                
            if not getattr(message, 'media', None):
                try:
                    replies = await client.get_messages(entity, reply_to=mensaje_id, limit=1)
                    if replies:
                        thread_id = mensaje_id
                        mensaje_id = None
                    else:
                        return {"success": False, "error": "El enlace directo no contiene un archivo o imagen descargable y tampoco es un tema del foro."}
                except Exception:
                    return {"success": False, "error": "El enlace directo no contiene un archivo o imagen descargable."}
            else:
                is_direct_message = True

        if is_direct_message:
            messages_to_download = [message]
            # Si el mensaje actual responde a otro (ej: foto a archivo RAR), buscar el mensaje padre
            rep_parent_id = getattr(message, 'reply_to_msg_id', None)
            if rep_parent_id:
                try:
                    parent_msg = await client.get_messages(entity, ids=rep_parent_id)
                    if parent_msg and getattr(parent_msg, 'media', None) and parent_msg.id not in [m.id for m in messages_to_download]:
                        messages_to_download.append(parent_msg)
                except Exception:
                    pass

            # Buscar respuestas y mensajes del mismo álbum alrededor
            try:
                surrounding = await client.get_messages(entity, limit=20, offset_id=message.id + 10)
                for msg in surrounding:
                    if not msg or msg.id == message.id:
                        continue
                    if getattr(message, 'grouped_id', None) and getattr(msg, 'grouped_id', None) == message.grouped_id:
                        if getattr(msg, 'media', None) and msg.id not in [m.id for m in messages_to_download]:
                            messages_to_download.append(msg)
                    elif getattr(msg, 'reply_to_msg_id', None) == message.id:
                        if getattr(msg, 'media', None) and msg.id not in [m.id for m in messages_to_download]:
                            messages_to_download.append(msg)
            except Exception:
                pass
            
            messages_to_download.sort(key=lambda x: x.id)
            msgs_map = {m.id: m for m in messages_to_download}
            
            for msg in messages_to_download:
                parent_fn = None
                rep_id = getattr(msg, 'reply_to_msg_id', None)
                if rep_id and rep_id in msgs_map:
                    parent_fn = obtener_nombre_archivo(msgs_map[rep_id])

                nombre, tamanio, media_obj = extraer_info_archivo(msg, parent_filename=parent_fn)
                if not nombre:
                    continue

                videos.append({
                    "id": msg.id, "nombre": nombre, "tamanio": tamanio,
                    "tamanio_fmt": formatear_tamanio(tamanio), "fecha": msg.date.isoformat() if msg.date else "",
                    "carpeta": chat_name,
                    "entity_id": str(entity.id),
                    "message": msg,
                    "reply_to_id": rep_id,
                    "grouped_id": getattr(msg, 'grouped_id', None)
                })
        else:
            # Procesar rango de fechas si fue especificado
            dt_from = None
            if getattr(data, 'date_from', None):
                try:
                    d_p = datetime.strptime(data.date_from.strip(), "%Y-%m-%d")
                    dt_from = datetime.combine(d_p.date(), dt_time.min, tzinfo=timezone.utc)
                except Exception as ex:
                    logger.warning(f"Error parseando date_from '{data.date_from}': {ex}")

            dt_to = None
            if getattr(data, 'date_to', None):
                try:
                    d_p = datetime.strptime(data.date_to.strip(), "%Y-%m-%d")
                    dt_to = datetime.combine(d_p.date(), dt_time.max, tzinfo=timezone.utc)
                except Exception as ex:
                    logger.warning(f"Error parseando date_to '{data.date_to}': {ex}")

            kwargs = {"limit": None}
            if thread_id is not None:
                kwargs["reply_to"] = thread_id
            if dt_to:
                kwargs["offset_date"] = dt_to
            
            mensajes_revisados = 0
            raw_messages = []
            async for message in client.iter_messages(entity, **kwargs):
                mensajes_revisados += 1
                
                # Reportar progreso cada 100 mensajes revisados
                if mensajes_revisados % 100 == 0:
                    await manager.send_json({
                        "type": "scan_progress", 
                        "scanned": mensajes_revisados,
                        "found": len(raw_messages)
                    })

                # Si el mensaje es posterior a date_to, saltarlo
                if dt_to and message.date and message.date > dt_to:
                    continue

                # Si el mensaje es anterior a date_from, como Telegram devuelve en orden descendente,
                # todos los mensajes siguientes serán aún más antiguos: detener escaneo inmediatamente
                if dt_from and message.date and message.date < dt_from:
                    logger.info(f"[Scan] Mensaje {message.id} ({message.date}) es anterior a date_from ({dt_from}). Deteniendo escaneo hacia atrás.")
                    break

                if not getattr(message, 'media', None):
                    continue

                # Ignorar stickers y emojis animados
                if getattr(message, 'document', None):
                    attrs = getattr(message.document, 'attributes', [])
                    if any(isinstance(a, (DocumentAttributeSticker, DocumentAttributeCustomEmoji)) for a in attrs):
                        continue

                raw_messages.append(message)

            # Mapear mensajes por ID para poder resolver nombres de respuestas/fotos
            msgs_map = {m.id: m for m in raw_messages}

            # Mapear textos de álbumes (grouped_id) para propagar el modelo a todas las fotos del álbum
            album_model_names = {}
            for m in raw_messages:
                gid = getattr(m, 'grouped_id', None)
                if gid and getattr(m, 'text', None) and gid not in album_model_names:
                    extracted = extraer_nombre_de_texto(m.text)
                    if extracted:
                        album_model_names[gid] = extracted

            for message in raw_messages:
                parent_fn = None
                rep_id = getattr(message, 'reply_to_msg_id', None)
                if rep_id and rep_id in msgs_map:
                    parent_fn = obtener_nombre_archivo(msgs_map[rep_id])

                gid = getattr(message, 'grouped_id', None)
                album_model = album_model_names.get(gid) if gid else None
                effective_parent = parent_fn or album_model

                nombre, tamanio, media_obj = extraer_info_archivo(message, parent_filename=effective_parent)
                if not nombre or not media_obj:
                    continue

                videos.append({
                    "id": message.id, "nombre": nombre, "tamanio": tamanio,
                    "tamanio_fmt": formatear_tamanio(tamanio), "fecha": message.date.isoformat() if message.date else "",
                    "carpeta": chat_name,
                    "entity_id": str(entity.id),
                    "message": message,
                    "reply_to_id": rep_id,
                    "grouped_id": gid
                })
    except Exception as e:
        return {"success": False, "error": traducir_error_telegram(e)}

    # Cachear los objetos message de telethon
    for v in videos:
        messages_cache[(str(entity.id), v["id"])] = v["message"]

    # Guardar en memoria para cuando pidan descargar
    current_videos_cache = videos

    # Agrupar inteligentemente en paquetes por modelo/archivo
    package_list = group_items_into_packages(videos, chat_name, data.custom_dir, str(entity.id))

    # Guardar paquetes masivamente en la base de datos en una sola transacción
    created_pkg_ids = database.add_grabber_packages_batch(package_list)

    # Obtener lista actualizada de paquetes del capturador
    packages = database.get_all_grabber()
    for p in packages:
        total_size = sum(item.get("total_size", 0) for item in p.get("items", []))
        p["total_size"] = total_size
        p["total_size_fmt"] = formatear_tamanio(total_size)
        p_chan = p.get("channel_name") or chat_name
        p["channel_name"] = p_chan
        for item in p.get("items", []):
            item["tamanio_fmt"] = formatear_tamanio(item.get("total_size", 0))
            item["carpeta"] = p["name"]
            item["channel_name"] = p_chan
    
    first_pkg_id = created_pkg_ids[0] if created_pkg_ids else None
    first_pkg_name = package_list[0]["name"] if package_list else chat_name

    # Preparar respuesta sin el objeto de telethon
    response_videos = [{"original_idx": i, "id": v["id"], "nombre": v["nombre"], "tamanio": v["tamanio"], "tamanio_fmt": v["tamanio_fmt"], "fecha": v.get("fecha", ""), "carpeta": v.get("carpeta", chat_name), "channel_name": chat_name} for i, v in enumerate(videos)]
    return {
        "success": True, 
        "package_id": first_pkg_id, 
        "package_name": first_pkg_name,
        "channel_name": chat_name,
        "packages_count": len(package_list),
        "videos": response_videos,
        "packages": packages
    }


@app.post("/api/download")
async def trigger_download(data: DownloadRequest):
    if not data.is_resume:
        db_ids = []
        grabber_ids_to_remove = []

        if data.items:
            # Viene de la selección del Capturador de Enlaces
            for itm in data.items:
                filename = itm.filename
                if data.include_date and itm.fecha:
                    filename = formatear_nombre_con_fecha(filename, itm.fecha)
                
                target_dir = itm.custom_dir.strip() or data.custom_dir.strip()
                package_name = itm.package_name or "Descargas"
                channel_name = getattr(itm, 'channel_name', '') or ""

                db_id = database.add_download(
                    message_id=itm.message_id,
                    entity_id=itm.entity_id,
                    filename=filename,
                    total_size=itm.total_size,
                    custom_dir=target_dir,
                    file_path="",
                    package_name=package_name,
                    channel_name=channel_name,
                    fecha=itm.fecha
                )
                item = DownloadItem(db_id, filename, itm.total_size, package_name, itm.fecha, channel_name)
                item.db_id = db_id
                item.message_id = itm.message_id
                item.entity_id = itm.entity_id
                item.custom_dir = target_dir
                download_mgr.items[db_id] = item
                db_ids.append(db_id)

                if itm.grabber_item_id:
                    grabber_ids_to_remove.append(itm.grabber_item_id)

            if data.remove_from_grabber and grabber_ids_to_remove:
                database.delete_grabber_items(grabber_ids_to_remove)

        elif data.indices:
            # Compatibilidad con índices directos de scan
            for idx in data.indices:
                if idx < len(current_videos_cache):
                    video = current_videos_cache[idx]
                    filename = video["nombre"]
                    if data.include_date and video.get("fecha"):
                        filename = formatear_nombre_con_fecha(filename, video["fecha"])

                    package_name = video.get("carpeta") or "Descargas"
                    channel_name = video.get("channel_name") or ""
                    db_id = database.add_download(
                        message_id=video["id"],
                        entity_id=video.get("entity_id", str(video.get("carpeta", ""))),
                        filename=filename,
                        total_size=video["tamanio"],
                        custom_dir=data.custom_dir,
                        file_path="",
                        package_name=package_name,
                        channel_name=channel_name,
                        fecha=video.get("fecha", "")
                    )
                    item = DownloadItem(db_id, filename, video["tamanio"], package_name, video.get("fecha", ""), channel_name)
                    item.db_id = db_id
                    item.message_id = video["id"]
                    item.entity_id = video.get("entity_id")
                    item.custom_dir = data.custom_dir
                    download_mgr.items[db_id] = item
                    db_ids.append(db_id)

        if db_ids:
            asyncio.create_task(process_downloads(db_ids, data.custom_dir))
        return {"success": True, "db_ids": db_ids}
    else:
        # Reanudar descargas existentes por su ID en la base de datos
        to_run = []
        for db_id in data.indices:
            dl = database.get_download(db_id)
            if dl:
                database.update_download_state(db_id, "pending")
                to_run.append(db_id)
            if db_id in download_mgr.items:
                download_mgr.items[db_id].state = "pending"
                download_mgr.items[db_id].cancelled = False
                download_mgr.items[db_id].pause_event.set()

        if to_run:
            asyncio.create_task(process_downloads(to_run, data.custom_dir))
        return {"success": True}

@app.post("/api/download/pause")
async def pause_download(data: DownloadControlRequest):
    if str(data.index).lower() == "all":
        download_mgr.pause_all()
        await manager.send_json({"type": "global_status", "state": "paused"})
        for idx in download_mgr.items:
            if download_mgr.items[idx].state == "paused":
                database.update_download_state(idx, "paused")
                await manager.send_json({"type": "status_change", "index": idx, "db_id": idx, "state": "paused", "speed_mbps": 0})
    else:
        try:
            idx = int(data.index)
            download_mgr.pause_item(idx)
            database.update_download_state(idx, "paused")
            await manager.send_json({"type": "status_change", "index": idx, "db_id": idx, "state": "paused", "speed_mbps": 0})
        except ValueError:
            pass
    return {"success": True}

@app.post("/api/download/resume")
async def resume_download(data: DownloadControlRequest):
    if str(data.index).lower() == "all":
        all_dls = database.get_all_downloads()
        to_resume_ids = []
        for dl in all_dls:
            if dl["state"] in ("paused", "pending", "stopped"):
                to_resume_ids.append(dl["id"])
                database.update_download_state(dl["id"], "pending")
                if dl["id"] in download_mgr.items:
                    download_mgr.items[dl["id"]].state = "pending"
                    download_mgr.items[dl["id"]].cancelled = False
                    download_mgr.items[dl["id"]].pause_event.set()
        
        download_mgr.resume_all()
        await manager.send_json({"type": "global_status", "state": "resumed"})

        if to_resume_ids:
            asyncio.create_task(process_downloads(to_resume_ids))
        else:
            for idx in download_mgr.items:
                item = download_mgr.items[idx]
                if item.state in ("downloading", "pending"):
                    await manager.send_json({"type": "status_change", "index": idx, "db_id": idx, "state": item.state})
    else:
        try:
            idx = int(data.index)
            dl = database.get_download(idx)
            if dl:
                database.update_download_state(idx, "pending")
            
            if idx in download_mgr.items:
                download_mgr.resume_item(idx)
            
            asyncio.create_task(process_downloads([idx]))
        except ValueError:
            pass
    return {"success": True}

@app.post("/api/download/stop")
async def stop_download(data: DownloadControlRequest):
    if str(data.index).lower() == "all":
        download_mgr.stop_all()
        # Actualizar en BD las descargas que estaban activas
        all_dls = database.get_all_downloads()
        for dl in all_dls:
            if dl["state"] in ("downloading", "pending", "paused"):
                database.update_download_state(dl["id"], "stopped")
        await manager.send_json({"type": "global_status", "state": "stopped"})
        for idx in download_mgr.items:
            await manager.send_json({"type": "status_change", "index": idx, "db_id": idx, "state": "stopped", "speed_mbps": 0})
    else:
        try:
            idx = int(data.index)
            download_mgr.stop_item(idx)
            database.update_download_state(idx, "stopped")
            await manager.send_json({"type": "status_change", "index": idx, "db_id": idx, "state": "stopped", "speed_mbps": 0})
        except ValueError:
            pass
    return {"success": True}

class AutoChannelReq(BaseModel):
    url: str
    custom_dir: str = ""
    download_existing: bool = True
    file_types: str = "all"
    subfolder_mode: str = "channel_model"

@app.get("/api/autochannels")
async def api_get_autochannels():
    return {"status": "ok", "channels": database.get_auto_channels()}

@app.post("/api/autochannels/add")
async def api_add_autochannel(req: AutoChannelReq):
    try:
        await ensure_connected()
        entity = await resolve_telegram_entity(client, req.url)
        channel_name = getattr(entity, 'title', '') or getattr(entity, 'username', '') or req.url
        entity_id = str(entity.id)
        
        row_id = database.add_auto_channel(req.url, entity_id, channel_name, req.custom_dir, req.file_types, req.subfolder_mode)
        matched_chan = {
            "id": row_id,
            "channel_url": req.url,
            "entity_id": entity_id,
            "channel_name": channel_name,
            "custom_dir": req.custom_dir,
            "file_types": req.file_types,
            "subfolder_mode": req.subfolder_mode,
            "last_message_id": 0
        }

        enqueued_count = 0
        if req.download_existing:
            enqueued_count = await scan_and_enqueue_channel(entity, matched_chan, only_new=False, download_all_existing=True)
        else:
            try:
                latest = await client.get_messages(entity, limit=1)
                latest_id = latest[0].id if latest else 0
                if latest_id:
                    database.update_auto_channel_last_message(row_id, latest_id)
            except Exception as e:
                logger.warning(f"No se pudo registrar último mensaje al añadir canal '{channel_name}': {e}")

        return {"status": "ok", "enqueued": enqueued_count}
    except Exception as e:
        import traceback
        logger.error(f"Error en api_add_autochannel: {traceback.format_exc()}")
        return {"status": "error", "message": f"{type(e).__name__}: {str(e)}"}

@app.post("/api/autochannels/sync")
async def api_sync_autochannel(req: dict):
    channel_id = req.get("id")
    if not channel_id:
        return {"status": "error", "message": "ID de canal no proporcionado"}
    chan = database.get_auto_channel(channel_id)
    if not chan:
        return {"status": "error", "message": "Canal no encontrado"}
    try:
        await ensure_connected()
        entity = await resolve_telegram_entity(client, chan["entity_id"] or chan["channel_url"])
        count = await scan_and_enqueue_channel(entity, chan, only_new=True, download_all_existing=False)
        return {"status": "ok", "enqueued": count}
    except Exception as e:
        import traceback
        logger.error(f"Error sincronizando canal: {traceback.format_exc()}")
        return {"status": "error", "message": f"{type(e).__name__}: {str(e)}"}

@app.post("/api/autochannels/toggle")
async def api_toggle_autochannel(req: dict):
    channel_id = req.get("id")
    active = req.get("active", 1)
    if channel_id is not None:
        database.toggle_auto_channel(channel_id, active)
    return {"status": "ok"}

@app.post("/api/autochannels/delete")
async def api_delete_autochannel(req: dict):
    channel_id = req.get("id")
    if channel_id is not None:
        database.delete_auto_channel(channel_id)
    return {"status": "ok"}

@app.post("/api/autochannels/update_dir")
async def api_update_autochannel_dir(req: dict):
    channel_id = req.get("id")
    custom_dir = req.get("custom_dir", "")
    if channel_id is not None:
        database.update_auto_channel_dir(channel_id, custom_dir)
        return {"status": "ok"}
    return {"status": "error", "message": "ID no proporcionado"}

@app.post("/api/autochannels/update_types")
async def api_update_autochannel_types(req: dict):
    channel_id = req.get("id")
    file_types = req.get("file_types", "all")
    if channel_id is not None:
        database.update_auto_channel_types(channel_id, file_types)
        return {"status": "ok"}
    return {"status": "error", "message": "ID no proporcionado"}

@app.post("/api/autochannels/update_subfolder_mode")
async def api_update_autochannel_subfolder_mode(req: dict):
    channel_id = req.get("id")
    mode = req.get("subfolder_mode", "channel_model")
    if channel_id is not None:
        database.update_auto_channel_subfolder_mode(channel_id, mode)
        return {"status": "ok"}
    return {"status": "error", "message": "ID no proporcionado"}


# ─── Bucle de Descargas Secuencial ─────────────────────────────────────────

async def process_downloads(db_ids, custom_dir=""):
    global current_videos_cache, download_mgr, messages_cache, _pending_auto_downloads, _auto_download_total_queued
    
    # Encolar los identificadores solicitados evitando duplicados en la cola
    for db_id in db_ids:
        if db_id not in download_mgr.queue:
            download_mgr.queue.append(db_id)
            
    # Si ya hay un worker en ejecución, los elementos encolados se procesarán secuencialmente
    if download_mgr.is_running:
        return
        
    download_mgr.is_running = True
    download_mgr.global_cancelled = False
    download_mgr.global_pause_event.set()
    await manager.send_json({"type": "global_status", "state": "downloading"})
    
    base_dir = custom_dir.strip() if custom_dir and custom_dir.strip() else DOWNLOAD_DIR
    
    try:
        while download_mgr.queue:
            if download_mgr.global_cancelled:
                break
                
            db_id = download_mgr.queue.pop(0)
            
            # Recuperar o reconstruir el item de descarga desde la BD si se reinició el servidor
            item = download_mgr.items.get(db_id)
            if not item:
                dl_data = database.get_download(db_id)
                if not dl_data:
                    continue
                item = DownloadItem(
                    original_idx=db_id,
                    filename=dl_data["filename"],
                    total_size=dl_data["total_size"],
                    package_name=dl_data.get("package_name") or "Descargas",
                    fecha=dl_data.get("fecha") or "",
                    channel_name=dl_data.get("channel_name") or ""
                )
                item.db_id = db_id
                item.message_id = dl_data["message_id"]
                item.entity_id = dl_data["entity_id"]
                item.custom_dir = dl_data["custom_dir"]
                item.downloaded_bytes = dl_data.get("downloaded_bytes", 0)
                item.file_path = dl_data.get("file_path", "")
                item.state = dl_data.get("state", "pending")
                download_mgr.items[db_id] = item
                
            target_idx = db_id

            if download_mgr.global_cancelled or item.cancelled:
                item.state = "stopped"
                database.update_download_state(db_id, "stopped")
                await manager.send_json({"type": "status_change", "index": target_idx, "db_id": db_id, "package_name": item.package_name, "state": "stopped"})
                continue

            # Esperar si hay pausa global
            await download_mgr.global_pause_event.wait()
            # Esperar si este item particular está pausado
            await item.pause_event.wait()
            
            if download_mgr.global_cancelled or item.cancelled:
                item.state = "stopped"
                database.update_download_state(db_id, "stopped")
                await manager.send_json({"type": "status_change", "index": target_idx, "db_id": db_id, "package_name": item.package_name, "state": "stopped"})
                continue

            download_mgr.active_index = db_id
            item.state = "downloading"
            database.update_download_state(db_id, "downloading")
            
            nombre = item.filename
            tamanio = item.total_size
            
            # Obtener el mensaje de Telegram desde la caché en memoria o consultando a Telegram
            msg_obj = messages_cache.get((str(item.entity_id), item.message_id))
            if not msg_obj:
                for v in current_videos_cache:
                    if v["id"] == item.message_id:
                        msg_obj = v.get("message")
                        break
            
            if not msg_obj:
                try:
                    await ensure_connected()
                    entity = await resolve_telegram_entity(client, item.entity_id)
                    msg_obj = await client.get_messages(entity, ids=int(item.message_id))
                    if not msg_obj or not (getattr(msg_obj, 'media', None) or getattr(msg_obj, 'document', None) or getattr(msg_obj, 'video', None) or getattr(msg_obj, 'photo', None)):
                        raise ValueError(f"El mensaje #{item.message_id} no contiene un archivo disponible en Telegram")
                except Exception as e:
                    item.state = "error"
                    database.update_download_state(db_id, "error")
                    await manager.send_json({"type": "error", "message": f"No se pudo acceder al mensaje en Telegram: {e}", "index": target_idx, "db_id": db_id, "package_name": item.package_name})
                    await manager.send_json({"type": "status_change", "index": target_idx, "db_id": db_id, "package_name": item.package_name, "state": "error"})
                    continue
            
            canal = re.sub(r'[<>:"/\\|?*]', '', str(getattr(item, 'channel_name', '') or "")).strip()
            carpeta = re.sub(r'[<>:"/\\|?*]', '', str(getattr(item, 'package_name', '') or "Descargas")).strip() or "Descargas"
            dest_root = item.custom_dir.strip() if getattr(item, 'custom_dir', None) and item.custom_dir.strip() else base_dir
            
            # Determinar si pertenece a un canal automatizado y su modo de subcarpetas
            subfolder_mode = "channel_model"
            is_auto_channel = False
            auto_chans = database.get_auto_channels()
            clean_item_entity = str(item.entity_id or '').lstrip('-')
            if clean_item_entity.startswith('100'):
                clean_item_entity = clean_item_entity[3:]

            for ac in auto_chans:
                ac_entity = str(ac.get('entity_id') or '').lstrip('-')
                if ac_entity.startswith('100'):
                    ac_entity = ac_entity[3:]
                if ac_entity and ac_entity == clean_item_entity:
                    is_auto_channel = True
                    subfolder_mode = ac.get('subfolder_mode') or 'channel_model'
                    if not canal and ac.get('channel_name'):
                        canal = re.sub(r'[<>:"/\\|?*]', '', str(ac.get('channel_name'))).strip()
                    break

            if is_auto_channel:
                fecha_folder = extraer_fecha_carpeta(msg_obj, getattr(item, 'fecha', ''))
                if subfolder_mode == 'channel_date':
                    if canal:
                        download_dir = Path(dest_root) / canal / fecha_folder
                    else:
                        download_dir = Path(dest_root) / fecha_folder
                elif subfolder_mode == 'channel_model':
                    model_folder = re.sub(r'[<>:"/\\|?*]', '', carpeta or clean_filename_for_pack(nombre) or "General").strip()
                    if canal and model_folder and canal.lower() != model_folder.lower() and model_folder.lower() != "descargas":
                        download_dir = Path(dest_root) / canal / model_folder
                    elif canal:
                        download_dir = Path(dest_root) / canal
                    else:
                        download_dir = Path(dest_root) / model_folder
                elif subfolder_mode == 'channel_only':
                    if canal:
                        download_dir = Path(dest_root) / canal
                    else:
                        download_dir = Path(dest_root)
                else:  # 'flat'
                    download_dir = Path(dest_root)
            else:
                # Descargas normales (Capturador de Enlaces o escaneo manual)
                if canal and carpeta and canal.lower() != carpeta.lower() and carpeta.lower() != "descargas":
                    download_dir = Path(dest_root) / canal / carpeta
                elif canal:
                    download_dir = Path(dest_root) / canal
                else:
                    download_dir = Path(dest_root) / carpeta

            download_dir.mkdir(parents=True, exist_ok=True)
            
            ruta_destino = download_dir / nombre
            ruta_temp = download_dir / f"{nombre}.tdl"
            item.file_path = str(ruta_temp.resolve())
            
            await manager.send_json({
                "type": "start",
                "filename": nombre,
                "index": target_idx,
                "db_id": db_id,
                "package_name": item.package_name
            })
            await manager.send_json({"type": "status_change", "index": target_idx, "db_id": db_id, "package_name": item.package_name, "state": "downloading"})

            if ruta_destino.exists() and ruta_destino.stat().st_size == tamanio and tamanio > 0:
                item.state = "done"
                item.downloaded_bytes = tamanio
                item.file_path = str(ruta_destino.resolve())
                database.update_download_state(db_id, "done")
                database.update_download_progress(db_id, tamanio, str(ruta_destino.resolve()))
                await manager.send_json({"type": "done", "index": target_idx, "db_id": db_id, "package_name": item.package_name, "file_path": str(ruta_destino.resolve())})
                await manager.send_json({"type": "status_change", "index": target_idx, "db_id": db_id, "package_name": item.package_name, "state": "done", "file_path": str(ruta_destino.resolve())})
                _pending_auto_downloads.discard(db_id)
                if _auto_download_total_queued > 0 and len(_pending_auto_downloads) == 0:
                    completed_count = _auto_download_total_queued
                    _auto_download_total_queued = 0
                    await manager.send_json({
                        "type": "toast",
                        "message": f"Las descargas automatizadas han finalizado ({completed_count} archivo(s) procesados).",
                        "toast_type": "success",
                        "duration": 10000,
                        "title": "Descargas Finalizadas"
                    })
                continue
                
            try:
                CHUNK_SIZE = 1024 * 1024
                media_to_download = getattr(msg_obj, 'document', None) or getattr(msg_obj, 'photo', None) or getattr(msg_obj, 'video', None) or getattr(msg_obj, 'media', None)
                
                descargados_total = 0
                last_time = time.time()
                last_bytes = 0

                # Para fotos o archivos pequeños (<= 1MB), descarga secuencial directa
                if getattr(msg_obj, 'photo', None) or tamanio <= CHUNK_SIZE:
                    with open(ruta_temp, 'wb') as f:
                        await ensure_connected()
                        async for chunk in client.iter_download(media_to_download, request_size=CHUNK_SIZE):
                            if download_mgr.global_cancelled or item.cancelled:
                                break
                            await download_mgr.global_pause_event.wait()
                            await item.pause_event.wait()
                            if download_mgr.global_cancelled or item.cancelled:
                                break

                            f.write(chunk)
                            descargados_total += len(chunk)
                            item.downloaded_bytes = descargados_total

                            current_time = time.time()
                            if current_time - last_time > 0.2:
                                speed = (descargados_total - last_bytes) / (current_time - last_time) / (1024*1024)
                                database.update_download_progress(db_id, descargados_total)
                                await manager.send_json({
                                    "type": "progress",
                                    "downloaded": descargados_total,
                                    "total_size": tamanio or descargados_total,
                                    "speed_mbps": round(max(0, speed), 1),
                                    "index": target_idx,
                                    "db_id": db_id,
                                    "package_name": item.package_name,
                                    "state": item.state
                                })
                                last_time = current_time
                                last_bytes = descargados_total

                    if (tamanio == 0 or tamanio != descargados_total) and descargados_total > 0:
                        tamanio = descargados_total
                        item.total_size = descargados_total
                else:
                    # Para archivos grandes (> 1MB), descarga paralela por chunks de 1MB
                    if not ruta_temp.exists() or ruta_temp.stat().st_size != tamanio:
                        with open(ruta_temp, 'wb') as f:
                            if tamanio > 0:
                                f.seek(tamanio - 1)
                                f.write(b'\0')

                    sem = asyncio.Semaphore(4)

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
                                media_to_download, 
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
                                        "db_id": db_id,
                                        "package_name": item.package_name,
                                        "state": item.state
                                    })
                                    last_time = current_time
                                    last_bytes = descargados_total

                                if bytes_leidos >= chunk_size_bytes:
                                    break

                            if not (download_mgr.global_cancelled or item.cancelled):
                                with open(ruta_temp, 'r+b') as f:
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
                    database.update_download_progress(db_id, descargados_total, str(ruta_temp.resolve()))
                    await manager.send_json({
                        "type": "progress", "downloaded": descargados_total, "total_size": tamanio, "speed_mbps": 0, "index": target_idx, "db_id": db_id, "package_name": item.package_name, "state": "stopped"
                    })
                    await manager.send_json({"type": "status_change", "index": target_idx, "db_id": db_id, "package_name": item.package_name, "state": "stopped"})
                else:
                    # Al completar el 100%, eliminar la extensión temporal .tdl (archivo.rar.tdl -> archivo.rar)
                    if ruta_temp.exists():
                        os.replace(ruta_temp, ruta_destino)

                    item.state = "done"
                    item.downloaded_bytes = descargados_total
                    item.file_path = str(ruta_destino.resolve())
                    database.update_download_state(db_id, "done")
                    database.update_download_progress(db_id, descargados_total, str(ruta_destino.resolve()))
                    await manager.send_json({
                        "type": "progress", "downloaded": descargados_total, "total_size": tamanio, "speed_mbps": 0, "index": target_idx, "db_id": db_id, "package_name": item.package_name, "state": "done"
                    })
                    await manager.send_json({"type": "done", "index": target_idx, "db_id": db_id, "package_name": item.package_name, "file_path": str(ruta_destino.resolve())})

                    await manager.send_json({"type": "status_change", "index": target_idx, "db_id": db_id, "package_name": item.package_name, "state": "done", "file_path": str(ruta_destino.resolve())})
                    
            except (ConnectionError, OSError) as e:
                logger.warning(f"Error de conexión descargando {nombre}: {e}")
                try:
                    await ensure_connected()
                except Exception:
                    pass
                item.state = "error"
                database.update_download_state(db_id, "error")
                await manager.send_json({"type": "error", "message": f"Error de conexión: {traducir_error_telegram(e)}. La sesión se reconectó automáticamente.", "index": target_idx, "db_id": db_id, "package_name": item.package_name})
                await manager.send_json({"type": "status_change", "index": target_idx, "db_id": db_id, "package_name": item.package_name, "state": "error"})
            except Exception as e:
                item.state = "error"
                database.update_download_state(db_id, "error")
                await manager.send_json({"type": "error", "message": traducir_error_telegram(e), "index": target_idx, "db_id": db_id, "package_name": item.package_name})
                await manager.send_json({"type": "status_change", "index": target_idx, "db_id": db_id, "package_name": item.package_name, "state": "error"})
            finally:
                _pending_auto_downloads.discard(db_id)
                if _auto_download_total_queued > 0 and len(_pending_auto_downloads) == 0:
                    completed_count = _auto_download_total_queued
                    _auto_download_total_queued = 0
                    await manager.send_json({
                        "type": "toast",
                        "message": f"Las descargas automatizadas han finalizado correctamente ({completed_count} archivo(s) procesados).",
                        "toast_type": "success",
                        "duration": 10000,
                        "title": "Descargas Finalizadas"
                    })

    finally:
        download_mgr.is_running = False
        download_mgr.active_index = None
        await manager.send_json({"type": "finish_all"})
        await manager.send_json({"type": "global_status", "state": "idle"})
        
        # Salvaguarda final por si quedó algún ID pendiente en este lote
        for did in db_ids:
            _pending_auto_downloads.discard(did)
        if _auto_download_total_queued > 0 and len(_pending_auto_downloads) == 0:
            completed_count = _auto_download_total_queued
            _auto_download_total_queued = 0
            await manager.send_json({
                "type": "toast",
                "message": f"Las descargas automatizadas han finalizado correctamente ({completed_count} archivo(s) procesados).",
                "toast_type": "success",
                "duration": 10000,
                "title": "Descargas Finalizadas"
            })


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    # Validar autenticación si existe contraseña configurada
    if APP_PASSWORD:
        auth_cookie = websocket.cookies.get("auth_token")
        expected_token = hashlib.sha256(APP_PASSWORD.encode()).hexdigest()
        if auth_cookie and auth_cookie != expected_token:
            await websocket.close(code=1008)
            return

    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except (WebSocketDisconnect, Exception):
        manager.disconnect(websocket)
