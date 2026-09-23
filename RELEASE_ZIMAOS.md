# 📦 Guía de Instalación en ZimaOS / CasaOS

Esta guía explica cómo desplegar **Telegram Downloader** en un sistema **ZimaOS** (ZimaBlade, ZimaBoard, ZimaCube o cualquier equipo con CasaOS).

---

## 🚀 Método 1: Instalación rápida por Terminal / SSH (Recomendado)

Dado que la aplicación incluye su propio `Dockerfile` y proxy seguro `Caddy`, compilarla y ejecutarla mediante Docker Compose es directo:

### 1. Conéctate a la terminal de ZimaOS
- Puedes usar **SSH** desde tu PC (`ssh casaos@IP_DE_TU_ZIMAOS`).
- O ingresar a la **Terminal web** de ZimaOS (en *Settings > Terminal & Logs*).

### 2. Clona el repositorio y entra en la carpeta
```bash
cd /DATA/AppData
git clone https://github.com/elpato001/telegram-downloader.git
cd telegram-downloader
```

### 3. Inicia la aplicación con Docker Compose
```bash
docker compose -f docker-compose.zimaos.yml up -d --build
```
*(Docker descargará las dependencias, compilará la imagen y levantará el servicio en segundo plano).*

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
