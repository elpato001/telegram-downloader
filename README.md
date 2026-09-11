<div align="center">
  <img src="https://raw.githubusercontent.com/elpato001/telegram-downloader/main/assets/logo.png" alt="Telegram Downloader Logo" width="130" />
  <h1>Telegram Media Downloader</h1>
  <p>Una aplicación moderna y sencilla para descargar juegos, videos, archivos comprimidos y documentos desde canales y grupos de Telegram (públicos o privados) mediante una interfaz web intuitiva.</p>
</div>

---

## 📸 Capturas de Pantalla

<div align="center">
  <img src="https://raw.githubusercontent.com/elpato001/telegram-downloader/main/assets/screenshot_main.png" alt="Interfaz Principal" width="800" />
  <p><em>Interfaz principal y gestión de descargas.</em></p>
  
  <br/>
  
  <img src="https://raw.githubusercontent.com/elpato001/telegram-downloader/main/assets/screenshot_qr.png" alt="Inicio de Sesión por QR" width="400" />
  <img src="https://raw.githubusercontent.com/elpato001/telegram-downloader/main/assets/screenshot_phone.png" alt="Inicio de Sesión por Teléfono" width="400" />
  <p><em>Múltiples métodos de inicio de sesión: Código QR y Número de Teléfono.</em></p>
</div>

---

## 🚀 ¿Cómo usar la aplicación?

Solo necesitas seguir estos 3 pasos (no requiere comandos ni configuraciones complejas):

1. **Descargar el proyecto:**
   - Haz clic en el botón verde **Code** (arriba a la derecha en GitHub) y selecciona **[Download ZIP](https://github.com/elpato001/telegram-downloader/archive/refs/heads/main.zip)**.
2. **Descomprimir el archivo `.zip`:**
   - Extrae el contenido en cualquier carpeta de tu equipo.
3. **Ejecutar `iniciar.bat`:**
   - Haz doble clic en el archivo **`iniciar.bat`**. 
   - Listo. El programa verificará lo necesario y abrirá automáticamente la aplicación en tu navegador web (`http://localhost:8000`).

---

## 📱 Uso de la Aplicación

1. **Conectar tu cuenta:**
   - Selecciona tu **país** en el desplegable (se colocará el código de país automáticamente).
   - Escribe tu **número de teléfono** y pulsa **Siguiente**.
   - Ingresa el código de confirmación recibido en tu Telegram (no requiere crear aplicaciones ni ingresar claves API).
2. **Escanear:**
   - Pega el enlace del canal o grupo (ej: `https://t.me/nombre_canal`) y haz clic en **Escanear**.
3. **Elegir carpeta de descarga:**
   - Haz clic en el botón **Examinar...** para seleccionar la carpeta donde se guardarán los archivos (soporta discos locales y carpetas compartidas en red).
4. **Descargar:**
   - Marca los archivos o pulsa **Seleccionar todo** y haz clic en **Descargar**.

---

## 📋 Requisitos Previos

- Tener instalado **Python 3.10 o superior** en Windows ([Descargar Python](https://www.python.org/downloads/)).
  *(Asegúrate de tildar la opción **"Add Python to PATH"** durante la instalación).*

---

## ✨ Características

- ⏯️ **Control total de descargas:** Botones para **Pausar, Reanudar y Detener** tanto de forma global (todas las descargas desde la barra superior) como de manera individual por archivo en la tabla.
- 🎮 **Soporte para todo tipo de archivos:** Juegos y ROMs (`.chd`, `.iso`, `.bin`), archivos comprimidos (`.7z`, `.rar`, `.zip`), videos (`.mkv`, `.mp4`), documentos, etc.
- 📁 **Explorador de carpetas integrado:** Navega por carpetas locales y en red con diálogo modal nativo.
- 📂 **Organización automática:** Agrupa las descargas creando subcarpetas con el nombre de cada canal.
- ⚡ **Descarga concurrente acelerada:** Múltiples conexiones por bloques para maximizar tu velocidad.
- 📊 **Monitoreo en vivo:** Progreso por porcentaje, velocidad en MB/s y estado en tiempo real.
- 🔒 **100% Seguro y Privado:** Tu sesión se guarda únicamente en tu propia máquina y nunca se comparte.

---

## 📄 Licencia

Distribuido bajo la Licencia MIT.
