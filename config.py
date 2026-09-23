import os

# Configuración del Descargador de Telegram
# ==========================================
# Completá estos valores con tus credenciales de https://my.telegram.org

API_ID = 2040
API_HASH = "b18441a1ff607e10a989891a5462e627"

# Carpeta de datos persistentes (base de datos y sesión)
DATA_DIR = os.environ.get("DATA_DIR", ".")
if DATA_DIR and DATA_DIR != ".":
    os.makedirs(DATA_DIR, exist_ok=True)

# Carpeta donde se guardarán las descargas
DOWNLOAD_DIR = os.environ.get("DOWNLOAD_DIR", "./descargas")

# Nombre o ruta del archivo de sesión (se crea automáticamente)
SESSION_NAME = os.path.join(DATA_DIR, "mi_sesion") if DATA_DIR and DATA_DIR != "." else "mi_sesion"

# Contraseña para acceder a la interfaz web (por defecto: admin)
APP_PASSWORD = os.environ.get("APP_PASSWORD", "admin")

# Extensiones de video reconocidas
VIDEO_EXTENSIONS = (
    ".mkv", ".mp4", ".avi", ".mov", ".webm",
    ".flv", ".wmv", ".m4v", ".ts", ".mpg", ".mpeg"
)

# Extensiones de subtítulos (se descargan junto a los videos si existen)
SUBTITLE_EXTENSIONS = (
    ".srt", ".ass", ".ssa", ".sub", ".vtt"
)
