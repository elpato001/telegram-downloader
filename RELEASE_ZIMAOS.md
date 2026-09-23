# 📦 Guía de Instalación en ZimaOS / CasaOS

Esta guía explica cómo desplegar **Telegram Downloader** en un sistema **ZimaOS** (ZimaBlade, ZimaBoard, ZimaCube o cualquier equipo con CasaOS).

---

## 🖥️ Método 1: Instalación 100% Gráfica desde la interfaz de ZimaOS (Recomendado)

No necesitas usar SSH ni abrir ninguna terminal:

1. En el Dashboard de ZimaOS, haz clic en el botón **`+`** (arriba a la derecha) y selecciona **"Install a customised app"** (o en la *App Store* ➔ *Custom Install*).
2. En la esquina superior derecha de la ventana, haz clic en el icono **"Import"** (icono de documento con flecha).
3. Pega el contenido de `docker-compose.zimaos.yml`:

```yaml
name: telegram-downloader
services:
  telegram-downloader:
    image: ghcr.io/elpato001/telegram-downloader:latest
    container_name: telegram-downloader
    restart: unless-stopped
    ports:
      - "8000:8000"
    volumes:
      - /DATA:/DATA
      - /media:/media
      - /DATA/AppData/telegram-downloader/data:/app/data
      - /DATA/AppData/telegram-downloader/descargas:/app/descargas
    environment:
      - DATA_DIR=/app/data
      - TZ=America/Argentina/Buenos_Aires
```

4. Haz clic en **Submit**. ZimaOS cargará automáticamente el nombre, icono, puertos y volúmenes.
5. Haz clic en **Install** y ZimaOS lo descargará y dejará listo con su icono en el escritorio.

---

## 🚀 Método 2: Instalación por Terminal / SSH

### 4. Acceder a la aplicación
Abre tu navegador e ingresa a:
👉 `http://IP_DE_TU_ZIMAOS:8000`

- Contraseña por defecto: **`admin`**

---

## 🖥️ Agregar el acceso directo en el Dashboard de ZimaOS / CasaOS

Una vez levantado el contenedor:
1. En el panel principal de ZimaOS, haz clic en el botón **`+`** (arriba a la derecha del listado de apps).
2. Selecciona **"Add an external link / Agregar enlace"** o **"Custom Install"**.
3. Configura:
   - **Nombre:** Telegram Downloader
   - **URL / IP:** `http://IP_DE_TU_ZIMAOS:8000`
   - **Icono:** `https://raw.githubusercontent.com/elpato001/telegram-downloader/main/assets/logo.png`
4. Guarda los cambios. Ahora tendrás el icono listo en tu escritorio de ZimaOS.

---

## 📂 Almacenamiento y Carpetas en ZimaOS

El archivo `docker-compose.zimaos.yml` viene adaptado con los siguientes montajes:
- `/DATA:/DATA`: Acceso a todo el almacenamiento interno de ZimaOS (Media, AppData, etc.).
- `/media:/media`: Acceso a discos duros externos o particiones adicionales montadas.
- `./descargas:/app/descargas`: Carpeta local del proyecto por defecto.
- `./data:/app/data`: Persistencia de tu sesión de Telegram y base de datos SQLite.

Desde el selector de carpetas dentro de la interfaz web podrás navegar y seleccionar directamente `/DATA/Media/...` o cualquier disco para guardar tus descargas.
