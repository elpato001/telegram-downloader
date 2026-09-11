"""
Módulo de base de datos para el historial de descargas.
Usa SQLite para persistir el estado de las descargas.
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
    """Inicializa la base de datos creando la tabla si no existe."""
    conn = _get_conn()
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
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()


def add_download(message_id, entity_id="", filename="", total_size=0, custom_dir="", file_path=""):
    """Agrega una nueva descarga al historial y retorna su ID."""
    conn = _get_conn()
    cursor = conn.execute(
        """INSERT INTO downloads (message_id, entity_id, filename, total_size, custom_dir, file_path, state)
           VALUES (?, ?, ?, ?, ?, ?, 'pending')""",
        (message_id, str(entity_id), filename, total_size, custom_dir, file_path)
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
    """Retorna todas las descargas como lista de diccionarios."""
    conn = _get_conn()
    rows = conn.execute("SELECT * FROM downloads ORDER BY created_at DESC").fetchall()
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
