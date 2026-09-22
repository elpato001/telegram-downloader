"""
Módulo de base de datos para el historial de descargas y el capturador de enlaces.
Usa SQLite para persistir el estado de las descargas y los paquetes escaneados.
"""
import sqlite3
import os
import threading

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "downloads.db")

_local = threading.local()


def _get_conn():
    """Obtiene una conexión SQLite por hilo (thread-local)."""
    if not hasattr(_local, "conn") or _local.conn is None:
        _local.conn = sqlite3.connect(DB_PATH, check_same_thread=False)
        _local.conn.row_factory = sqlite3.Row
    return _local.conn


def init_db():
    """Inicializa la base de datos creando tablas y aplicando migraciones si es necesario."""
    conn = _get_conn()
    conn.execute("PRAGMA foreign_keys = ON")
    
    # 1. Tabla de descargas activas e historial
    conn.execute("""
        CREATE TABLE IF NOT EXISTS downloads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            message_id INTEGER NOT NULL,
            entity_id TEXT NOT NULL DEFAULT '',
            filename TEXT NOT NULL DEFAULT '',
            total_size INTEGER NOT NULL DEFAULT 0,
            downloaded_bytes INTEGER NOT NULL DEFAULT 0,
            state TEXT NOT NULL DEFAULT 'pending',
            file_path TEXT NOT NULL DEFAULT '',
            custom_dir TEXT NOT NULL DEFAULT '',
            package_name TEXT NOT NULL DEFAULT 'Descargas',
            channel_name TEXT NOT NULL DEFAULT '',
            fecha TEXT NOT NULL DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Migraciones en caso de bases existentes
    try:
        conn.execute("ALTER TABLE downloads ADD COLUMN package_name TEXT NOT NULL DEFAULT 'Descargas'")
    except sqlite3.OperationalError:
        pass

    try:
        conn.execute("ALTER TABLE downloads ADD COLUMN channel_name TEXT NOT NULL DEFAULT ''")
    except sqlite3.OperationalError:
        pass

    try:
        conn.execute("ALTER TABLE downloads ADD COLUMN fecha TEXT NOT NULL DEFAULT ''")
    except sqlite3.OperationalError:
        pass

    # 2. Tablas para el Capturador de Enlaces (Link Grabber)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS grabber_packages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            entity_id TEXT NOT NULL DEFAULT '',
            custom_dir TEXT NOT NULL DEFAULT '',
            channel_name TEXT NOT NULL DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    try:
        conn.execute("ALTER TABLE grabber_packages ADD COLUMN channel_name TEXT NOT NULL DEFAULT ''")
    except sqlite3.OperationalError:
        pass

    conn.execute("""
        CREATE TABLE IF NOT EXISTS grabber_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            package_id INTEGER NOT NULL,
            message_id INTEGER NOT NULL,
            entity_id TEXT NOT NULL DEFAULT '',
            filename TEXT NOT NULL DEFAULT '',
            total_size INTEGER NOT NULL DEFAULT 0,
            fecha TEXT NOT NULL DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(package_id) REFERENCES grabber_packages(id) ON DELETE CASCADE
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_grabber_items_pkg ON grabber_items(package_id)")

    # Migración de paquetes existentes en grabber_packages que no tengan channel_name
    try:
        import re
        rows = conn.execute("SELECT id, name, channel_name FROM grabber_packages WHERE channel_name = '' OR channel_name IS NULL").fetchall()
        for r in rows:
            pkg_id = r["id"]
            old_name = r["name"]
            items = conn.execute("SELECT filename FROM grabber_items WHERE package_id = ?", (pkg_id,)).fetchall()
            filenames = [it["filename"] for it in items if it["filename"]]
            container_name = old_name
            if filenames:
                cleaned = []
                for fn in filenames:
                    s = re.sub(r'(?i)\.(part\d+|z\d+|7z\.\d+|\d{3})\.(rar|zip|7z|tar|gz)$', '', fn)
                    s = re.sub(r'(?i)\.part\d+\.rar$', '', s)
                    s = re.sub(r'(?i)\.(rar|zip|7z|tar|gz|mp4|mkv|avi|mov|iso|bin|cue|chd|cso|exe|pdf)$', '', s)
                    s = re.sub(r'(?i)[._ -]part\d+$', '', s)
                    s = re.sub(r'(?i)\.z\d+$', '', s)
                    cleaned.append(s.strip())
                if cleaned:
                    import os
                    prefix = os.path.commonprefix(cleaned).strip()
                    prefix = re.sub(r'[\s._-]+$', '', prefix)
                    if len(prefix) >= 3:
                        container_name = prefix
            conn.execute(
                "UPDATE grabber_packages SET channel_name = ?, name = ? WHERE id = ?",
                (old_name, container_name, pkg_id)
            )
    except Exception as mig_err:
        pass

    # 3. Tabla para Auto-Descargas (canales automatizados)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS auto_channels (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            channel_url TEXT NOT NULL,
            entity_id TEXT NOT NULL DEFAULT '',
            channel_name TEXT NOT NULL DEFAULT '',
            custom_dir TEXT NOT NULL DEFAULT '',
            file_types TEXT NOT NULL DEFAULT 'all',
            subfolder_mode TEXT NOT NULL DEFAULT 'channel_date',
            last_message_id INTEGER NOT NULL DEFAULT 0,
            last_checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            active INTEGER NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Migración: Agregar columna file_types a auto_channels si no existe
    try:
        conn.execute("ALTER TABLE auto_channels ADD COLUMN file_types TEXT NOT NULL DEFAULT 'all'")
    except Exception:
        pass

    # Migración: Agregar columna subfolder_mode a auto_channels si no existe
    try:
        conn.execute("ALTER TABLE auto_channels ADD COLUMN subfolder_mode TEXT NOT NULL DEFAULT 'channel_date'")
    except Exception:
        pass

    # Migración: Agregar columna last_message_id a auto_channels si no existe
    try:
        conn.execute("ALTER TABLE auto_channels ADD COLUMN last_message_id INTEGER NOT NULL DEFAULT 0")
    except Exception:
        pass

    # Migración: Agregar columna last_checked_at a auto_channels si no existe
    try:
        conn.execute("ALTER TABLE auto_channels ADD COLUMN last_checked_at TIMESTAMP")
    except Exception:
        pass

    # Inicializar last_message_id para canales existentes si ya tienen descargas previas
    try:
        rows = conn.execute("SELECT id, entity_id FROM auto_channels WHERE last_message_id = 0").fetchall()
        for r in rows:
            cid = r["id"]
            ent = str(r["entity_id"] or "")
            clean_ent = ent.replace("-100", "").replace("-", "")
            if clean_ent:
                max_row = conn.execute(
                    "SELECT MAX(message_id) as max_id FROM downloads WHERE replace(replace(entity_id, '-100', ''), '-', '') = ?",
                    (clean_ent,)
                ).fetchone()
                if max_row and max_row["max_id"]:
                    conn.execute("UPDATE auto_channels SET last_message_id = ?, last_checked_at = CURRENT_TIMESTAMP WHERE id = ?", (max_row["max_id"], cid))
    except Exception:
        pass

    # 4. Tabla para configuraciones del sistema (última sesión activa, etc.)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Resetear cualquier descarga que haya quedado en 'downloading' tras cerrar la app a 'paused'
    try:
        conn.execute("UPDATE downloads SET state = 'paused' WHERE state = 'downloading'")
    except Exception:
        pass

    conn.commit()


def fix_interrupted_downloads():
    """Si el servidor se cerró abruptamente mientras descargaba, pasar esas descargas a 'paused'."""
    conn = _get_conn()
    conn.execute("UPDATE downloads SET state = 'paused' WHERE state = 'downloading'")
    conn.commit()


# ─── Métodos para Descargas (Pestaña "Descargas") ──────────────────────

def add_download(message_id, entity_id="", filename="", total_size=0, custom_dir="", file_path="", package_name="Descargas", fecha="", channel_name=""):
    """Agrega una nueva descarga al historial y retorna su ID."""
    conn = _get_conn()
    cursor = conn.execute(
        """INSERT INTO downloads (message_id, entity_id, filename, total_size, custom_dir, file_path, package_name, channel_name, fecha, state)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')""",
        (message_id, str(entity_id), filename, total_size, custom_dir, file_path, package_name or "Descargas", channel_name or "", fecha)
    )
    conn.commit()
    return cursor.lastrowid


def update_download_state(download_id, state):
    """Actualiza el estado de una descarga (pending, downloading, paused, stopped, done, error)."""
    conn = _get_conn()
    conn.execute(
        "UPDATE downloads SET state = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (state, download_id)
    )
    conn.commit()


def update_download_progress(download_id, downloaded_bytes, file_path=None):
    """Actualiza los bytes descargados y opcionalmente la ruta del archivo."""
    conn = _get_conn()
    if file_path is not None:
        conn.execute(
            "UPDATE downloads SET downloaded_bytes = ?, file_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (downloaded_bytes, file_path, download_id)
        )
    else:
        conn.execute(
            "UPDATE downloads SET downloaded_bytes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (downloaded_bytes, download_id)
        )
    conn.commit()


def get_all_downloads():
    """Retorna todas las descargas ordenadas por paquete y fecha."""
    conn = _get_conn()
    rows = conn.execute("SELECT * FROM downloads ORDER BY package_name ASC, created_at DESC").fetchall()
    return [dict(row) for row in rows]


def get_download(download_id):
    """Retorna una descarga por su ID."""
    conn = _get_conn()
    row = conn.execute("SELECT * FROM downloads WHERE id = ?", (download_id,)).fetchone()
    return dict(row) if row else None


def get_download_by_message(message_id, entity_id=""):
    """Busca una descarga por el ID de mensaje y opcionalmente entidad de Telegram."""
    conn = _get_conn()
    clean_id = str(entity_id).replace("-100", "").replace("-", "")
    if clean_id:
        row = conn.execute(
            "SELECT * FROM downloads WHERE message_id = ? AND replace(replace(entity_id, '-100', ''), '-', '') = ?",
            (message_id, clean_id)
        ).fetchone()
    else:
        row = conn.execute("SELECT * FROM downloads WHERE message_id = ?", (message_id,)).fetchone()
    return dict(row) if row else None


def delete_download(download_id):
    """Elimina una descarga del historial."""
    conn = _get_conn()
    conn.execute("DELETE FROM downloads WHERE id = ?", (download_id,))
    conn.commit()


def delete_downloads_batch(download_ids):
    """Elimina múltiples descargas por sus IDs."""
    if not download_ids:
        return
    conn = _get_conn()
    placeholders = ",".join("?" for _ in download_ids)
    conn.execute(f"DELETE FROM downloads WHERE id IN ({placeholders})", download_ids)
    conn.commit()


def delete_package_downloads(package_name):
    """Elimina todas las descargas que pertenezcan a un paquete específico."""
    conn = _get_conn()
    conn.execute("DELETE FROM downloads WHERE package_name = ?", (package_name,))
    conn.commit()


def clear_completed_downloads():
    """Elimina las descargas que estén en estado 'done' del historial."""
    conn = _get_conn()
    conn.execute("DELETE FROM downloads WHERE state = 'done'")
    conn.commit()


# ─── Métodos para Capturador de Enlaces (Pestaña "Capturador de Enlaces") ──

def add_grabber_package(name, entity_id="", custom_dir="", channel_name=""):
    """Crea un paquete en el capturador de enlaces y retorna su ID."""
    conn = _get_conn()
    cursor = conn.execute(
        "INSERT INTO grabber_packages (name, entity_id, custom_dir, channel_name) VALUES (?, ?, ?, ?)",
        (name.strip() or "Paquete sin nombre", str(entity_id), custom_dir.strip(), channel_name.strip())
    )
    conn.commit()
    return cursor.lastrowid


def rename_grabber_package(package_id, new_name):
    """Renombra un paquete (carpeta contenedora) en el capturador de enlaces."""
    conn = _get_conn()
    conn.execute("UPDATE grabber_packages SET name = ? WHERE id = ?", (new_name.strip(), package_id))
    conn.commit()


def add_grabber_items(package_id, items):
    """Agrega una lista de archivos a un paquete del capturador."""
    if not items:
        return
    conn = _get_conn()
    data = [
        (
            package_id,
            item.get("id") or item.get("message_id") or 0,
            str(item.get("entity_id", "")),
            item.get("nombre") or item.get("filename") or "",
            item.get("tamanio") or item.get("total_size") or 0,
            item.get("fecha", "")
        )
        for item in items
    ]
    conn.executemany(
        """INSERT INTO grabber_items (package_id, message_id, entity_id, filename, total_size, fecha)
           VALUES (?, ?, ?, ?, ?, ?)""",
        data
    )
    conn.commit()


def add_grabber_packages_batch(package_list):
    """
    Inserta múltiples paquetes y sus respectivos items en una sola transacción SQLite.
    package_list: lista de dicts con:
      - name: str
      - entity_id: str
      - custom_dir: str
      - channel_name: str
      - items: list de dicts con id/message_id, nombre/filename, tamanio/total_size, fecha
    Retorna la lista de IDs de paquetes creados.
    """
    if not package_list:
        return []
    conn = _get_conn()
    created_pkg_ids = []
    for pkg_data in package_list:
        cur = conn.execute(
            "INSERT INTO grabber_packages (name, entity_id, custom_dir, channel_name) VALUES (?, ?, ?, ?)",
            (
                pkg_data.get("name", "Paquete").strip(),
                str(pkg_data.get("entity_id", "")),
                pkg_data.get("custom_dir", "").strip(),
                pkg_data.get("channel_name", "").strip()
            )
        )
        pkg_id = cur.lastrowid
        created_pkg_ids.append(pkg_id)

        items = pkg_data.get("items", [])
        if items:
            item_rows = [
                (
                    pkg_id,
                    it.get("id") or it.get("message_id") or 0,
                    str(it.get("entity_id", pkg_data.get("entity_id", ""))),
                    it.get("nombre") or it.get("filename") or "",
                    it.get("tamanio") or it.get("total_size") or 0,
                    it.get("fecha", "")
                )
                for it in items
            ]
            conn.executemany(
                "INSERT INTO grabber_items (package_id, message_id, entity_id, filename, total_size, fecha) VALUES (?, ?, ?, ?, ?, ?)",
                item_rows
            )
    conn.commit()
    return created_pkg_ids


def clean_filename_for_pack_db(fname: str) -> str:
    import re
    s = re.sub(r'(?i)\.(part\d+|z\d+|7z\.\d+|\d{3})\.(rar|zip|7z|tar|gz)$', '', fname)
    s = re.sub(r'(?i)\.part\d+\.rar$', '', s)
    s = re.sub(r'(?i)\.(rar|zip|7z|tar|gz|mp4|mkv|avi|mov|iso|bin|cue|chd|cso|exe|pdf|jpg|jpeg|png|webp|cad|bdv|brd|tvw|fz)$', '', s)
    s = re.sub(r'(?i)[._ -]part\d+$', '', s)
    s = re.sub(r'(?i)\.z\d+$', '', s)
    s = re.sub(r'(?i)[._ -](preview|boardview|schematic|foto)$', '', s)
    s = re.sub(r'\s*\(\d+\)$', '', s)
    return s.strip()


def get_all_grabber():
    """Retorna todos los paquetes y sus archivos en el Capturador de Enlaces de forma ultra rápida (1 sola consulta para items)."""
    conn = _get_conn()
    packages_rows = conn.execute("SELECT * FROM grabber_packages ORDER BY created_at DESC, id DESC").fetchall()
    if not packages_rows:
        return []

    items_rows = conn.execute(
        "SELECT id, package_id, message_id, entity_id, filename, total_size, fecha FROM grabber_items ORDER BY package_id, id ASC"
    ).fetchall()

    items_by_pkg = {}
    for i_row in items_rows:
        pid = i_row["package_id"]
        if pid not in items_by_pkg:
            items_by_pkg[pid] = []
        items_by_pkg[pid].append(dict(i_row))

    packages = []
    for p_row in packages_rows:
        p = dict(p_row)
        p["items"] = items_by_pkg.get(p["id"], [])
        packages.append(p)

    return packages


def reorganize_grabber_packages():
    """
    Reorganiza los items del capturador en paquetes individuales según su modelo/archivo.
    Agrupa archivos que pertenecen al mismo modelo, partes o esquemático+foto.
    Retorna la cantidad de paquetes resultantes.
    """
    conn = _get_conn()
    all_packages = conn.execute("SELECT * FROM grabber_packages").fetchall()
    if not all_packages:
        return 0

    all_items = conn.execute("SELECT * FROM grabber_items ORDER BY package_id, id ASC").fetchall()
    if not all_items:
        return 0

    pkg_map = {p["id"]: dict(p) for p in all_packages}

    # Agrupar items por (entity_id, channel_name, custom_dir, clean_model)
    groups = {}
    for it in all_items:
        p_info = pkg_map.get(it["package_id"], {})
        entity_id = p_info.get("entity_id") or it["entity_id"] or ""
        channel_name = p_info.get("channel_name") or ""
        custom_dir = p_info.get("custom_dir") or ""
        fn = it["filename"]
        clean_model = clean_filename_for_pack_db(fn) or fn or "Paquete"

        key = (str(entity_id), str(channel_name), str(custom_dir), clean_model)
        if key not in groups:
            groups[key] = []
        groups[key].append(dict(it))

    # Reemplazar los paquetes existentes de forma atómica
    conn.execute("DELETE FROM grabber_items")
    conn.execute("DELETE FROM grabber_packages")

    for (entity_id, channel_name, custom_dir, clean_model), items in groups.items():
        cur = conn.execute(
            "INSERT INTO grabber_packages (name, entity_id, custom_dir, channel_name) VALUES (?, ?, ?, ?)",
            (clean_model, entity_id, custom_dir, channel_name)
        )
        new_pkg_id = cur.lastrowid
        item_rows = [
            (new_pkg_id, item.get("message_id", 0), item.get("entity_id", entity_id), item.get("filename", ""), item.get("total_size", 0), item.get("fecha", ""))
            for item in items
        ]
        conn.executemany(
            "INSERT INTO grabber_items (package_id, message_id, entity_id, filename, total_size, fecha) VALUES (?, ?, ?, ?, ?, ?)",
            item_rows
        )

    conn.commit()
    return len(groups)


def delete_grabber_package(package_id):
    """Elimina un paquete completo y sus archivos del capturador."""
    conn = _get_conn()
    conn.execute("DELETE FROM grabber_items WHERE package_id = ?", (package_id,))
    conn.execute("DELETE FROM grabber_packages WHERE id = ?", (package_id,))
    conn.commit()


def delete_grabber_items(item_ids):
    """Elimina archivos específicos del capturador y limpia paquetes que hayan quedado vacíos."""
    if not item_ids:
        return
    conn = _get_conn()
    placeholders = ",".join("?" for _ in item_ids)
    conn.execute(f"DELETE FROM grabber_items WHERE id IN ({placeholders})", item_ids)
    # Limpiar paquetes huérfanos que ya no tienen ningún item
    conn.execute("""
        DELETE FROM grabber_packages 
        WHERE id NOT IN (SELECT DISTINCT package_id FROM grabber_items)
    """)
    conn.commit()


def update_grabber_package_dir(package_id, custom_dir):
    """Actualiza la carpeta de destino de un paquete en el capturador."""
    conn = _get_conn()
    conn.execute("UPDATE grabber_packages SET custom_dir = ? WHERE id = ?", (custom_dir.strip(), package_id))
    conn.commit()


def clear_grabber():
    """Vacía por completo el capturador de enlaces."""
    conn = _get_conn()
    conn.execute("DELETE FROM grabber_items")
    conn.execute("DELETE FROM grabber_packages")
    conn.commit()


# ─── Métodos para Auto-Descargas (Pestaña "Automatizaciones") ──────────────

def get_auto_channels():
    """Retorna todos los canales automatizados."""
    conn = _get_conn()
    rows = conn.execute("SELECT * FROM auto_channels ORDER BY created_at DESC").fetchall()
    return [dict(row) for row in rows]

def get_auto_channel(channel_id):
    """Retorna un canal automatizado por su ID."""
    conn = _get_conn()
    row = conn.execute("SELECT * FROM auto_channels WHERE id = ?", (channel_id,)).fetchone()
    return dict(row) if row else None

def add_auto_channel(channel_url, entity_id, channel_name, custom_dir, file_types="all", subfolder_mode="channel_date", last_message_id=0):
    """Agrega un nuevo canal a la lista de auto-descargas."""
    conn = _get_conn()
    cursor = conn.execute(
        "INSERT INTO auto_channels (channel_url, entity_id, channel_name, custom_dir, file_types, subfolder_mode, last_message_id, last_checked_at, active) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 1)",
        (channel_url.strip(), str(entity_id), channel_name.strip(), custom_dir.strip(), (file_types or "all").strip(), (subfolder_mode or "channel_date").strip(), int(last_message_id or 0))
    )
    conn.commit()
    return cursor.lastrowid

def toggle_auto_channel(channel_id, active):
    """Activa o desactiva la automatización para un canal."""
    conn = _get_conn()
    conn.execute("UPDATE auto_channels SET active = ? WHERE id = ?", (int(active), channel_id))
    conn.commit()

def delete_auto_channel(channel_id):
    """Elimina un canal de la lista de auto-descargas."""
    conn = _get_conn()
    conn.execute("DELETE FROM auto_channels WHERE id = ?", (channel_id,))
    conn.commit()

def update_auto_channel_dir(channel_id, custom_dir):
    """Actualiza la carpeta de destino de un canal automatizado."""
    conn = _get_conn()
    conn.execute("UPDATE auto_channels SET custom_dir = ? WHERE id = ?", (custom_dir.strip(), channel_id))
    conn.commit()

def update_auto_channel_types(channel_id, file_types):
    """Actualiza el tipo de archivos permitidos para un canal automatizado."""
    conn = _get_conn()
    conn.execute("UPDATE auto_channels SET file_types = ? WHERE id = ?", ((file_types or "all").strip(), channel_id))
    conn.commit()

def update_auto_channel_subfolder_mode(channel_id, subfolder_mode):
    """Actualiza el modo de organización de subcarpetas de un canal automatizado."""
    conn = _get_conn()
    conn.execute("UPDATE auto_channels SET subfolder_mode = ? WHERE id = ?", ((subfolder_mode or "channel_date").strip(), channel_id))
    conn.commit()

def update_auto_channel_last_message(channel_id, last_message_id):
    """Actualiza el último ID de mensaje procesado y la fecha de verificación del canal."""
    if not channel_id or not last_message_id:
        return
    conn = _get_conn()
    conn.execute(
        "UPDATE auto_channels SET last_message_id = MAX(last_message_id, ?), last_checked_at = CURRENT_TIMESTAMP WHERE id = ?",
        (int(last_message_id), channel_id)
    )
    conn.commit()

def update_auto_channel_last_message_by_entity(entity_id, last_message_id):
    """Actualiza el último ID de mensaje procesado buscando por entity_id."""
    clean_ent = str(entity_id or '').replace("-100", "").replace("-", "")
    if not clean_ent or not last_message_id:
        return
    conn = _get_conn()
    conn.execute(
        "UPDATE auto_channels SET last_message_id = MAX(last_message_id, ?), last_checked_at = CURRENT_TIMESTAMP "
        "WHERE replace(replace(entity_id, '-100', ''), '-', '') = ?",
        (int(last_message_id), clean_ent)
    )
    conn.commit()


# ─── Métodos para Configuración Global y Estado de Sesión ─────────────────

def get_setting(key, default=None):
    """Obtiene el valor de una configuración global."""
    conn = _get_conn()
    row = conn.execute("SELECT value FROM app_settings WHERE key = ?", (key,)).fetchone()
    return row["value"] if row else default

def set_setting(key, value):
    """Guarda o actualiza una configuración global."""
    conn = _get_conn()
    conn.execute(
        "INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) "
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP",
        (str(key), str(value))
    )
    conn.commit()

def touch_app_active_time():
    """Actualiza la marca de tiempo de actividad de la aplicación (UTC ISO)."""
    from datetime import datetime, timezone
    now_iso = datetime.now(timezone.utc).isoformat()
    set_setting("last_app_active_at", now_iso)

def get_last_app_active_time():
    """Retorna la fecha/hora UTC (datetime) de la última actividad de la aplicación registrada."""
    from datetime import datetime
    val = get_setting("last_app_active_at")
    if not val:
        return None
    try:
        return datetime.fromisoformat(val)
    except Exception:
        return None



