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


def get_all_grabber():
    """Retorna todos los paquetes y sus archivos en el Capturador de Enlaces."""
    conn = _get_conn()
    packages_rows = conn.execute("SELECT * FROM grabber_packages ORDER BY created_at DESC").fetchall()
    packages = []
    
    for p_row in packages_rows:
        p = dict(p_row)
        items_rows = conn.execute(
            "SELECT * FROM grabber_items WHERE package_id = ? ORDER BY id ASC",
            (p["id"],)
        ).fetchall()
        p["items"] = [dict(i) for i in items_rows]
        packages.append(p)
        
    return packages


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
