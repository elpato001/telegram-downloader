"""
Descargador de Series de Telegram
===================================
Descarga videos de canales/grupos privados de Telegram
aprovechando las ventajas de la cuenta Premium.

Uso: python downloader.py
"""

import os
import sys
import asyncio
import time
from pathlib import Path

# Configurar la consola de Windows para soportar emojis y caracteres especiales
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

from telethon import TelegramClient
from telethon.errors import (
    SessionPasswordNeededError,
    ChannelPrivateError,
    FloodWaitError,
    ChatAdminRequiredError,
    PhoneNumberInvalidError,
    PhoneNumberUnoccupiedError,
    PhoneNumberBannedError,
    PhoneCodeInvalidError,
    PhoneCodeExpiredError,
    PasswordHashInvalidError,
    ApiIdInvalidError,
    ApiIdPublishedFloodError,
    AuthKeyDuplicatedError,
    UserDeactivatedError,
)
from telethon.tl.types import (
    DocumentAttributeFilename,
    DocumentAttributeVideo,
    DocumentAttributeSticker,
    DocumentAttributeCustomEmoji,
)
from tqdm import tqdm

from config import (
    API_ID,
    API_HASH,
    DOWNLOAD_DIR,
    SESSION_NAME,
    VIDEO_EXTENSIONS,
)


# ─── Utilidades ───────────────────────────────────────────────────────

def traducir_error_telegram(e: Exception) -> str:
    """Traduce excepciones y mensajes de error de Telegram al español de forma clara."""
    err_str = str(e)
    err_type = type(e).__name__

    if isinstance(e, FloodWaitError) or "FloodWaitError" in err_type:
        secs = getattr(e, 'seconds', None)
        if secs:
            return f"Telegram solicita esperar {secs} segundos antes de volver a intentar (protección anti-flood/spam)."
        return "Telegram solicita esperar unos momentos antes de volver a intentar (protección anti-flood)."

    if isinstance(e, PhoneNumberInvalidError) or "PhoneNumberInvalid" in err_type or "phone number is invalid" in err_str.lower():
        return "El número de teléfono es inválido o no está registrado en Telegram. Verificá que tenga el formato correcto y que la cuenta exista en la app oficial de Telegram."

    if isinstance(e, PhoneNumberUnoccupiedError) or "PhoneNumberUnoccupied" in err_type or "phone number is not occupied" in err_str.lower():
        return "El número telefónico no está registrado en Telegram. Creá la cuenta primero desde la aplicación oficial de Telegram."

    if isinstance(e, PhoneNumberBannedError) or "PhoneNumberBanned" in err_type or "banned" in err_str.lower():
        return "Este número de teléfono ha sido bloqueado o suspendido por Telegram."

    if isinstance(e, PhoneCodeInvalidError) or "PhoneCodeInvalid" in err_type or "code used was invalid" in err_str.lower():
        return "El código de verificación ingresado es incorrecto. Verificalo en tu aplicación de Telegram."

    if isinstance(e, PhoneCodeExpiredError) or "PhoneCodeExpired" in err_type or "code has expired" in err_str.lower():
        return "El código de verificación ha expirado. Por favor, solicitá un código nuevo."

    if isinstance(e, PasswordHashInvalidError) or "PasswordHashInvalid" in err_type or "password you entered is incorrect" in err_str.lower():
        return "La contraseña de verificación en 2 pasos es incorrecta."

    if isinstance(e, SessionPasswordNeededError) or "SessionPasswordNeeded" in err_type:
        return "Tu cuenta requiere verificación en 2 pasos (2FA). Ingresá tu contraseña de Telegram."

    if isinstance(e, (ApiIdInvalidError, ApiIdPublishedFloodError)) or "ApiIdInvalid" in err_type or "api_id" in err_str.lower():
        return "Las credenciales API_ID o API_HASH en config.py no son válidas o están revocadas. Obtené tus credenciales en https://my.telegram.org"

    if isinstance(e, ChannelPrivateError) or "ChannelPrivate" in err_type or "channel is private" in err_str.lower():
        return "No tenés acceso a este canal o grupo privado. Asegurate de haberte unido previamente con tu cuenta de Telegram."

    if isinstance(e, ChatAdminRequiredError) or "ChatAdminRequired" in err_type:
        return "Se requieren permisos de administrador en este grupo/canal para acceder a los mensajes y archivos."

    if isinstance(e, UserDeactivatedError) or "UserDeactivated" in err_type:
        return "La cuenta de Telegram ha sido desactivada."

    if isinstance(e, AuthKeyDuplicatedError) or "AuthKeyDuplicated" in err_type:
        return "La clave de sesión está duplicada. Eliminá el archivo mi_sesion.session y volvé a iniciar sesión."

    if "connection" in err_str.lower() or "timeout" in err_str.lower() or "timed out" in err_str.lower():
        return "Error de conexión con los servidores de Telegram. Comprobá tu conexión a internet."

    # Traducciones auxiliares de términos comunes
    traducido = err_str
    reemplazos = [
        ("The phone number is invalid (caused by SendCodeRequest)", "El número de teléfono es inválido o no está registrado en Telegram."),
        ("The numeric code used was invalid (caused by SignInRequest)", "El código ingresado es incorrecto."),
        ("The confirmation code has expired (caused by SignInRequest)", "El código de verificación ha expirado."),
        ("The password you entered is incorrect (caused by CheckPasswordRequest)", "La contraseña ingresada es incorrecta."),
        ("Cannot cast", "No se pudo procesar"),
        ("Could not find the input entity for", "No se pudo encontrar el canal o chat:"),
        ("The key is not registered in the system", "La clave de sesión no está registrada en el sistema."),
        ("No user has", "No se encontró ningún usuario con"),
        ("SendCodeRequest", "Solicitud de código"),
        ("SignInRequest", "Inicio de sesión"),
        ("caused by", "originado por"),
    ]
    for orig, rep in reemplazos:
        traducido = traducido.replace(orig, rep)

    return traducido

def formatear_tamanio(bytes_size: int) -> str:
    """Convierte bytes a formato legible (KB, MB, GB)."""
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if bytes_size < 1024:
            return f"{bytes_size:.2f} {unit}"
        bytes_size /= 1024
    return f"{bytes_size:.2f} PB"


def obtener_nombre_archivo(message) -> str | None:
    """Extrae el nombre del archivo de un mensaje de Telegram."""
    if not message.document:
        return None
        
    # 1. Intentar obtener el nombre del archivo si fue subido como tal
    for attr in message.document.attributes:
        if isinstance(attr, DocumentAttributeFilename):
            return attr.file_name
            
    # 2. Si es un video nativo sin nombre, generar uno basado en el texto del mensaje
    if getattr(message, 'video', None):
        if message.text:
            # Limpiar el texto para que sea un nombre de archivo válido
            caracteres_validos = " -_()[]"
            nombre_limpio = "".join(c for c in message.text if c.isalnum() or c in caracteres_validos).strip()
            if nombre_limpio:
                # Acortar si es muy largo y agregar el ID para evitar duplicados
                nombre_limpio = nombre_limpio[:80]
                return f"{nombre_limpio} ({message.id}).mp4"
        
        # 3. Fallback genérico si no tiene texto
        return f"video_telegram_{message.id}.mp4"
        
    return None


def es_video(nombre_archivo: str) -> bool:
    """Verifica si un archivo es un video basándose en su extensión."""
    if not nombre_archivo:
        return False
    ext = Path(nombre_archivo).suffix.lower()
    return ext in VIDEO_EXTENSIONS


def limpiar_pantalla():
    """Limpia la pantalla de la consola."""
    os.system("cls" if os.name == "nt" else "clear")


# ─── Barra de Progreso ───────────────────────────────────────────────

class BarraProgreso:
    """Callback para mostrar progreso de descarga con tqdm."""

    def __init__(self, total: int, nombre: str):
        self.barra = tqdm(
            total=total,
            unit="B",
            unit_scale=True,
            unit_divisor=1024,
            desc=nombre[:50],
            bar_format="{l_bar}{bar:30}{r_bar}",
            colour="green",
        )
        self._ultimo = 0

    def __call__(self, actual: int, total: int):
        incremento = actual - self._ultimo
        self.barra.update(incremento)
        self._ultimo = actual

    def cerrar(self):
        self.barra.close()


# ─── Clase Principal ─────────────────────────────────────────────────

class DescargadorTelegram:
    """Descargador de videos desde canales de Telegram."""

    def __init__(self):
        self.client: TelegramClient | None = None
        self.download_dir = Path(DOWNLOAD_DIR)
        self.download_dir.mkdir(parents=True, exist_ok=True)

    async def iniciar_sesion(self):
        """Inicia sesión en Telegram. Pide credenciales la primera vez."""
        print("\n╔══════════════════════════════════════════════════╗")
        print("║     📥 Descargador de Series de Telegram        ║")
        print("╚══════════════════════════════════════════════════╝\n")

        # Verificar que las credenciales estén configuradas
        if API_ID == 0 or not API_HASH:
            print("❌ Error: Necesitás configurar tus credenciales de API.")
            print("   Abrí el archivo 'config.py' y completá API_ID y API_HASH.")
            print("   Podés obtenerlos en: https://my.telegram.org\n")
            sys.exit(1)

        self.client = TelegramClient(SESSION_NAME, API_ID, API_HASH)
        await self.client.connect()

        if not await self.client.is_user_authorized():
            print("🔐 Primera vez: necesito verificar tu cuenta de Telegram.\n")
            telefono = input("📱 Tu número de teléfono (con código de país, ej: +5491112345678): ").strip()

            await self.client.send_code_request(telefono)
            codigo = input("✉️  Código de verificación que recibiste en Telegram: ").strip()

            try:
                await self.client.sign_in(telefono, codigo)
            except SessionPasswordNeededError:
                password = input("🔑 Tu cuenta tiene verificación en 2 pasos. Ingresá tu contraseña: ").strip()
                await self.client.sign_in(password=password)

        me = await self.client.get_me()
        print(f"\n✅ Sesión iniciada como: {me.first_name} (@{me.username or 'sin username'})")
        print(f"   {'⭐ Cuenta Premium' if getattr(me, 'premium', False) else '👤 Cuenta estándar'}\n")

    async def obtener_canal(self):
        """Pide al usuario el canal/grupo y verifica acceso."""
        print("─" * 50)
        print("Ingresá el canal o grupo del que querés descargar.")
        print("Puede ser:")
        print("  • Un link: https://t.me/nombre_canal")
        print("  • Un link de invitación: https://t.me/+AbCdEf123")
        print("  • El ID numérico: -1001714800123")
        print("  • Un Tema/Hilo: -1001714800123_2693")
        print("─" * 50)

        canal_input = input("\n📌 Canal/Grupo/Enlace: ").strip()
        thread_id = None
        mensaje_id = None

        # Soportar links directos a mensajes (ej: https://t.me/RetroParaTodosPSX/349 o t.me/c/123/456)
        import re
        match_msg = re.search(r't\.me/(?:c/)?([^/]+)/(\d+)', canal_input)
        if match_msg:
            canal_input = match_msg.group(1)
            # Si es un número (formato t.me/c/12345/67), agregar el prefijo -100
            if canal_input.isdigit():
                canal_input = int("-100" + canal_input)
            mensaje_id = int(match_msg.group(2))
            print(f"   (Detectado enlace a archivo específico: {mensaje_id})")
        # Soportar formato ID_THREAD (ej: -1002172483151_2693)
        elif "_" in canal_input:
            partes = canal_input.split("_", 1)
            canal_input = partes[0]
            try:
                thread_id = int(partes[1])
                print(f"   (Detectado sub-tema o hilo: {thread_id})")
            except ValueError:
                pass
        elif isinstance(canal_input, str):
            match_chan = re.search(r'(?:https?://)?(?:www\.)?t\.me/([^/?#]+)/?$', canal_input)
            if match_chan:
                canal_input = match_chan.group(1)

        # Si el input parece un número (incluso negativo), convertirlo a entero
        if str(canal_input).lstrip("-").isdigit():
            canal_input = int(canal_input)

        try:
            entity = await self.client.get_entity(canal_input)
            titulo = getattr(entity, "title", str(entity.id))
            print(f"\n✅ Canal encontrado: {titulo}")
            return entity, thread_id, mensaje_id
        except ValueError:
            # Si no lo encuentra, forzamos una actualización de los chats (popula el caché)
            print("   (Actualizando lista de chats, esto puede tardar un poco la primera vez...)")
            try:
                # iter_dialogs descarga los chats recientes. Sin límite para asegurar que encuentre canales viejos
                async for dialog in self.client.iter_dialogs(limit=None):
                    pass
                
                entity = await self.client.get_entity(canal_input)
                titulo = getattr(entity, "title", str(entity.id))
                print(f"\n✅ Canal encontrado: {titulo}")
                return entity, thread_id, mensaje_id
            except Exception:
                print("\n❌ No se pudo encontrar el canal incluso después de buscar en todos tus chats.")
                print("   Asegurate de estar unido al canal con esta cuenta.")
                return None, None, None
        except ChannelPrivateError:
            print("\n❌ No tenés acceso a este canal/grupo privado.")
            return None, None, None
        except ChatAdminRequiredError:
            print("\n❌ Se requieren permisos de administrador para acceder a este chat.")
            return None, None, None
        except Exception as e:
            print(f"\n❌ Error al acceder al canal: {e}")
            return None, None, None

    async def listar_videos(self, entity, thread_id=None, mensaje_id=None) -> list:
        """Escanea el canal y lista todos los videos disponibles."""
        videos = []
        
        # Si se proveyó un enlace directo a un archivo/mensaje, buscar solo ese
        if mensaje_id:
            print(f"\n🔍 Obteniendo el archivo del enlace directo (ID: {mensaje_id})...\n")
            message = await self.client.get_messages(entity, ids=mensaje_id)
            if not message or (not getattr(message, 'document', None) and not getattr(message, 'video', None)):
                print("❌ Error: El enlace que pasaste no contiene un archivo descargable.")
                return []
                
            messages_to_download = [message]
            
            # Si el mensaje es parte de un álbum (grupo visual de archivos), buscar los demás
            if getattr(message, 'grouped_id', None):
                print(f"   (📦 El archivo es parte de un paquete/álbum. Buscando las demás partes...)")
                # Los álbumes tienen un máximo de 10 archivos. Buscamos un poco hacia arriba y abajo.
                surrounding = await self.client.get_messages(entity, limit=20, offset_id=message.id + 10)
                for msg in surrounding:
                    if msg.id != message.id and getattr(msg, 'grouped_id', None) == message.grouped_id:
                        if getattr(msg, 'document', None) or getattr(msg, 'video', None):
                            messages_to_download.append(msg)
                            
            # Ordenar por ID para que queden en orden (ej: part1, part2, etc.)
            messages_to_download.sort(key=lambda x: x.id)
            
            for msg in messages_to_download:
                nombre = obtener_nombre_archivo(msg) or f"archivo_desconocido_{msg.id}"
                tamanio = msg.document.size if getattr(msg, 'document', None) else getattr(msg.video, 'size', 0)
                
                videos.append({
                    "id": msg.id,
                    "nombre": nombre,
                    "tamanio": tamanio,
                    "tamanio_fmt": formatear_tamanio(tamanio),
                    "fecha": msg.date,
                    "message": msg,
                })
            return videos

        if thread_id:
            print(f"\n🔍 Escaneando mensajes del tema/hilo {thread_id}... (puede tomar un momento)\n")
        else:
            print("\n🔍 Escaneando mensajes del canal... (puede tomar un momento)\n")

        videos = []
        contador = 0

        # Si hay thread_id, buscamos los mensajes que responden a ese hilo (foros/temas)
        kwargs = {"limit": None}
        if thread_id is not None:
            kwargs["reply_to"] = thread_id

        async for message in self.client.iter_messages(entity, **kwargs):
            contador += 1
            if contador % 500 == 0:
                print(f"   Mensajes escaneados: {contador}...", end="\r")

            if not message.document and not getattr(message, 'video', None):
                continue

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
                    "id": message.id,
                    "nombre": nombre,
                    "tamanio": tamanio,
                    "tamanio_fmt": formatear_tamanio(tamanio),
                    "fecha": message.date,
                    "message": message,
                })

        print(f"\n📊 Escaneados {contador} mensajes. Encontrados {len(videos)} archivos.\n")

        # Ordenar por nombre
        videos.sort(key=lambda v: v["nombre"].lower())
        return videos

    def mostrar_videos(self, videos: list):
        """Muestra la lista de videos encontrados."""
        print("─" * 70)
        print(f"  {'#':<5} {'Nombre':<45} {'Tamaño':>10}")
        print("─" * 70)

        tamanio_total = 0
        for i, v in enumerate(videos, 1):
            nombre_corto = v["nombre"][:43]
            print(f"  {i:<5} {nombre_corto:<45} {v['tamanio_fmt']:>10}")
            tamanio_total += v["tamanio"]

        print("─" * 70)
        print(f"  Total: {len(videos)} videos - {formatear_tamanio(tamanio_total)}")
        print("─" * 70)

    def filtrar_videos(self, videos: list) -> list | None:
        """Permite al usuario filtrar los videos por nombre."""
        print("\nOpciones:")
        print("  [1] Descargar TODOS los archivos")
        print("  [2] Filtrar por texto (ej: 'S01' para temporada 1)")
        print("  [3] Seleccionar por números (ej: '1,3,5-10')")
        print("  [9] 🔙 Volver atrás / Ingresar otro enlace")
        print("  [0] Salir\n")

        opcion = input("Elegí una opción: ").strip()

        if opcion == "0":
            print("\n👋 ¡Hasta luego!")
            sys.exit(0)
            
        if opcion == "9":
            return None

        if opcion == "1":
            return videos

        if opcion == "2":
            filtro = input("🔎 Texto para filtrar: ").strip().lower()
            filtrados = [v for v in videos if filtro in v["nombre"].lower()]
            print(f"\n   Encontrados {len(filtrados)} videos que coinciden con '{filtro}'")
            if not filtrados:
                print("   No se encontraron coincidencias. Mostrando todos.")
                return videos
            self.mostrar_videos(filtrados)
            confirmar = input("\n¿Descargar estos videos? (s/n): ").strip().lower()
            if confirmar in ("s", "si", "sí", "y", "yes"):
                return filtrados
            return self.filtrar_videos(videos)

        if opcion == "3":
            seleccion = input("📝 Números (ej: 1,3,5-10): ").strip()
            indices = self._parsear_seleccion(seleccion, len(videos))
            if not indices:
                print("   Selección inválida.")
                return self.filtrar_videos(videos)
            seleccionados = [videos[i] for i in indices]
            self.mostrar_videos(seleccionados)
            confirmar = input("\n¿Descargar estos videos? (s/n): ").strip().lower()
            if confirmar in ("s", "si", "sí", "y", "yes"):
                return seleccionados
            return self.filtrar_videos(videos)

        print("   Opción inválida.")
        return self.filtrar_videos(videos)

    def _parsear_seleccion(self, texto: str, maximo: int) -> list[int]:
        """Parsea una selección como '1,3,5-10' a una lista de índices."""
        indices = []
        try:
            partes = texto.replace(" ", "").split(",")
            for parte in partes:
                if "-" in parte:
                    inicio, fin = parte.split("-", 1)
                    for i in range(int(inicio), int(fin) + 1):
                        if 1 <= i <= maximo:
                            indices.append(i - 1)
                else:
                    i = int(parte)
                    if 1 <= i <= maximo:
                        indices.append(i - 1)
        except ValueError:
            return []
        return sorted(set(indices))

    async def descargar_videos(self, videos: list):
        """Descarga la lista de videos con progreso."""
        total = len(videos)
        tamanio_total = sum(v["tamanio"] for v in videos)
        descargados = 0
        errores = []

        print(f"\n{'═' * 60}")
        print(f"  📥 Iniciando descarga de {total} videos ({formatear_tamanio(tamanio_total)})")
        print(f"{'═' * 60}\n")

        tiempo_inicio = time.time()

        for i, video in enumerate(videos, 1):
            nombre = video["nombre"]
            ruta_destino = self.download_dir / nombre

            # Verificar si ya existe (reanudación)
            if ruta_destino.exists():
                tamanio_existente = ruta_destino.stat().st_size
                if tamanio_existente == video["tamanio"]:
                    print(f"  ⏭️  [{i}/{total}] Ya descargado: {nombre}")
                    descargados += 1
                    continue
                else:
                    # Archivo incompleto, descargar de nuevo
                    print(f"  🔄 [{i}/{total}] Archivo incompleto, re-descargando: {nombre}")
                    ruta_destino.unlink()

            print(f"\n  📥 [{i}/{total}] Descargando: {nombre} ({video['tamanio_fmt']})")

            barra = BarraProgreso(video["tamanio"], nombre)
            try:
                # Descarga Paralela Personalizada
                CHUNK_SIZE = 1024 * 1024  # 1MB por chunk (debe ser multiplo de 512KB)
                tamanio = video["tamanio"]
                
                # Pre-asignar espacio en disco
                with open(ruta_destino, 'wb') as f:
                    if tamanio > 0:
                        f.seek(tamanio - 1)
                        f.write(b'\0')

                descargados_total = 0
                # Usar semáforo para no saturar la conexión (10 conexiones concurrentes a la vez)
                sem = asyncio.Semaphore(10)
                
                async def descargar_chunk(offset, chunk_size_bytes):
                    nonlocal descargados_total
                    async with sem:
                        chunk_data = bytearray()
                        bytes_leidos = 0
                        # limit en iter_download es cantidad de pedidos, no bytes. 
                        # Lo manejamos manualmente cortando el loop.
                        async for chunk in self.client.iter_download(
                            video["message"].document, 
                            offset=offset, 
                            request_size=1024*1024
                        ):
                            faltan = chunk_size_bytes - bytes_leidos
                            if len(chunk) > faltan:
                                chunk = chunk[:faltan]
                                
                            chunk_data.extend(chunk)
                            bytes_leidos += len(chunk)
                            descargados_total += len(chunk)
                            barra(descargados_total, tamanio)
                            
                            if bytes_leidos >= chunk_size_bytes:
                                break
                            
                        # Escribir en la posición correcta del archivo
                        with open(ruta_destino, 'r+b') as f:
                            f.seek(offset)
                            f.write(chunk_data)

                # Crear las tareas para cada bloque de 1MB
                tareas = []
                for offset in range(0, tamanio, CHUNK_SIZE):
                    limit = min(CHUNK_SIZE, tamanio - offset)
                    tareas.append(descargar_chunk(offset, limit))
                
                # Ejecutar todas las descargas en paralelo
                await asyncio.gather(*tareas)

                barra.cerrar()
                descargados_total_final = descargados_total
                descargados += 1
                print(f"  ✅ Completado: {nombre}")
            except FloodWaitError as e:
                barra.cerrar()
                print(f"\n  ⚠️  Telegram pide esperar {e.seconds} segundos (protección anti-flood).")
                print(f"      Esperando automáticamente...")
                await asyncio.sleep(e.seconds + 1)
                # Reintentar
                try:
                    barra2 = BarraProgreso(video["tamanio"], nombre)
                    await self.client.download_media(
                        video["message"],
                        file=str(ruta_destino),
                        progress_callback=barra2,
                    )
                    barra2.cerrar()
                    descargados += 1
                    print(f"  ✅ Completado (reintento): {nombre}")
                except Exception as e2:
                    barra2.cerrar()
                    print(f"  ❌ Error en reintento: {e2}")
                    errores.append((nombre, str(e2)))
            except Exception as e:
                barra.cerrar()
                print(f"  ❌ Error descargando {nombre}: {e}")
                errores.append((nombre, str(e)))

        # Resumen final
        tiempo_total = time.time() - tiempo_inicio
        minutos = int(tiempo_total // 60)
        segundos = int(tiempo_total % 60)

        print(f"\n{'═' * 60}")
        print(f"  📊 Resumen de descarga")
        print(f"{'═' * 60}")
        print(f"  ✅ Descargados: {descargados}/{total}")
        print(f"  ⏱️  Tiempo total: {minutos}m {segundos}s")
        print(f"  📁 Carpeta: {self.download_dir.resolve()}")

        if errores:
            print(f"\n  ❌ Errores ({len(errores)}):")
            for nombre, error in errores:
                print(f"     • {nombre}: {error}")

        print(f"{'═' * 60}\n")

    async def ejecutar(self):
        """Flujo principal del descargador."""
        try:
            await self.iniciar_sesion()
            while True:
                resultado = await self.obtener_canal()
                if resultado[0] is None:
                    continue
                entity, thread_id, mensaje_id = resultado
                
                videos = await self.listar_videos(entity, thread_id, mensaje_id)
                if not videos:
                    print("😕 No se encontraron archivos para descargar en este enlace.")
                    continue
                    
                self.mostrar_videos(videos)
                videos_seleccionados = self.filtrar_videos(videos)
                
                if videos_seleccionados is None:
                    continue  # Volver al inicio
                    
                if videos_seleccionados:
                    await self.descargar_videos(videos_seleccionados)
                    
                print("\n" + "═" * 60)
                otra = input("¿Querés descargar otra cosa? (s/n): ").strip().lower()
                if otra not in ('s', 'si', 'sí', 'y', 'yes'):
                    break
                    
        except (KeyboardInterrupt, asyncio.CancelledError):
            print("\n\n⛔ Descarga cancelada por el usuario.")
        finally:
            if self.client and self.client.is_connected():
                await self.client.disconnect()
                print("🔌 Sesión desconectada.")


# ─── Punto de Entrada ────────────────────────────────────────────────

def main():
    """Punto de entrada del programa."""
    descargador = DescargadorTelegram()
    try:
        if sys.platform == 'win32':
            asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
        asyncio.run(descargador.ejecutar())
    except (KeyboardInterrupt, asyncio.CancelledError):
        pass # Salida silenciosa en caso de que el error suba hasta el main
    except Exception as e:
        print(f"\n❌ Error inesperado: {e}")

if __name__ == "__main__":
    main()
