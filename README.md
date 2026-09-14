<div align="center">
  <img src="https://raw.githubusercontent.com/elpato001/telegram-downloader/main/assets/logo.png" alt="Telegram Downloader Logo" width="130" />
  <h1>Telegram Media Downloader</h1>
  <p>Una aplicación moderna y completa para descargar juegos, videos, archivos comprimidos y documentos desde canales y grupos de Telegram (públicos o privados), con una interfaz web intuitiva, potente y organizada.</p>
</div>

---

## 📸 Capturas de Pantalla

### 1. Capturador de Enlaces (Link Grabber)
Permite escanear y acumular enlaces de múltiples canales o mensajes de Telegram. Cada escaneo genera un paquete independiente que permanece guardado hasta que decidas descargarlo o borrarlo.

<div align="center">
  <img src="https://raw.githubusercontent.com/elpato001/telegram-downloader/main/assets/screenshot_grabber.png" alt="Capturador de Enlaces" width="900" />
  <p><em>Capturador de Enlaces: árbol desplegable con subniveles indentados, detección inteligente de carpetas contenedoras, distintivos por canal de Telegram y filtros avanzados.</em></p>
</div>

### 2. Gestor de Descargas
Visualiza el progreso de todas tus descargas activas, pausadas o finalizadas, organizadas jerárquicamente por carpetas.

<div align="center">
  <img src="https://raw.githubusercontent.com/elpato001/telegram-downloader/main/assets/screenshot_descargas.png" alt="Pestaña de Descargas" width="900" />
  <p><em>Gestor de Descargas: barras de progreso individuales y globales por paquete, velocidad en MB/s en tiempo real y controles de pausa/reanudación.</em></p>
</div>

### 3. Métodos de Inicio de Sesión
Conéctate de forma segura y sin necesidad de crear aplicaciones o tokens de Telegram:

<div align="center">
  <img src="https://raw.githubusercontent.com/elpato001/telegram-downloader/main/assets/screenshot_qr.png" alt="Inicio de Sesión por QR" width="420" />
  <img src="https://raw.githubusercontent.com/elpato001/telegram-downloader/main/assets/screenshot_phone.png" alt="Inicio de Sesión por Teléfono" width="420" />
  <p><em>Inicio de sesión rápido mediante escaneo de Código QR o mediante Número de Teléfono con selector de país.</em></p>
</div>

---

## 🆕 Novedades de la Versión 2.0.0 (v2.0.0)

- 🤖 **Pestaña "Automatizaciones" (Monitoreo y Auto-Descarga en Tiempo Real):**
  - Añade canales o grupos de Telegram para monitorizarlos continuamente en segundo plano.
  - Los nuevos archivos publicados se capturan y descargan automáticamente sin requerir intervención manual.
  - **Sincronización Offline Inteligente:** Al abrir la aplicación, detecta automáticamente los mensajes o publicaciones realizadas mientras la app estuvo apagada, garantizando cero pérdidas de contenido.
  - **Filtros por Tipo de Archivo:** Elige qué descargar por canal (Solo Videos, Fotos, Multimedia, Música/Audio, Archivos Comprimidos/ISOs, Documentos o extensiones personalizadas).
  - **Organización Flexible de Carpetas:** Modos por `Canal/Fecha`, `Solo Canal` o `Plano` (sin subcarpetas).
  - Descarga opcional del historial existente al agregar un nuevo canal.
  - Notificaciones toast personalizadas al completar lotes de descargas automatizadas.

- 📁 **Explorador de Carpetas Web con Creación Integrada:**
  - Botón **"Nueva carpeta"** directamente dentro del diálogo web para crear directorios de destino al instante.
  - Compatibilidad completa multiplataforma con Windows y Linux / Synology DSM.

- 🐳 **Soporte Oficial para Docker y Synology DSM (Container Manager):**
  - Archivos `Dockerfile`, `docker-compose.yml` y `Caddyfile` listos para desplegar en un solo clic.
  - Autenticación básica segura integrada con Caddy para acceso remoto protegido.
  - Guía detallada paso a paso en [RELEASE_SYNOLOGY.md](RELEASE_SYNOLOGY.md).

- ⚡ **Mejoras de Rendimiento y Estabilidad:**
  - Descarga acelerada por chunks concurrentes para archivos grandes.
  - Keepalive periódico optimizado para mantener la sesión de Telegram siempre activa y sin desconexiones.
  - Corrección de visibilidad de la consola en Windows (`iniciar.bat`).

---

## ✨ Características Principales

- 🗂️ **Sistema de 3 Pestañas Especializadas:**
  - **Pestaña "Capturador de Enlaces":** Escanea enlaces de distintos canales (públicos, privados `t.me/c/...` o mensajes individuales) y organízalos en paquetes antes de descargar.
  - **Pestaña "Descargas":** Administra la cola de descargas activas con control de velocidad en tiempo real, pausas y reanudación.
  - **Pestaña "Automatizaciones":** Monitorea canales en segundo plano y descarga automáticamente nuevos archivos que se publiquen con filtros y modos de organización personalizados.
- 🤖 **Auto-Descarga Autónoma de Canales:**
  - Monitoreo en tiempo real de canales favoritos con filtros de formato y sincronización tras reconectar.
- 📁 **Estructura de Guardado en Dos Niveles:**
  - Guarda automáticamente los archivos organizados en disco en dos subniveles limpios:
    $$\text{Ruta de Descarga} \longrightarrow \text{Canal de Telegram} \longrightarrow \text{Carpeta Contenedora} \longrightarrow \text{archivo.ext}$$
- 🏷️ **Detección Inteligente de Paquetes / Carpetas Contenedoras:**
  - Detecta automáticamente el nombre del juego, pack o película a partir de archivos multipartes (`.part1.rar`, `.part2.rar`, `.z01`, etc.) o prefijos compartidos.
  - Incluye botón de lápiz (`✏️`) para renombrar la carpeta contenedora con un solo clic si deseas personalizarla.
- ⚡ **Extensión Temporal `.tdl`:**
  - Los archivos en curso de descarga llevan la extensión temporal `.tdl` (`archivo.rar.tdl`).
  - Al completarse la descarga al 100%, se renombra de manera automática e instantánea a su nombre original (`archivo.rar`).
- 🌲 **Vista de Árbol Jerárquica (`[+] / [-]`):**
  - Filas de paquete expandibles y contraíbles.
  - Las casillas de selección de archivos se alinean directamente en el subnivel guiado por líneas de árbol (`└──`).
- ⏯️ **Control Total de Descargas:**
  - Botones globales: **Reanudar Todo (`Play`)**, **Pausar Todo (`Pause`)**, **Detener Todo (`Stop`)** y **Limpiar Completadas**.
  - Control individual por archivo y por paquete.
- 🎯 **Filtro de Formatos Personalizable:**
  - Categorías predefinidas para **Juegos/ROMs** (`.chd`, `.iso`, `.bin`, `.pkg`, `.cso`, etc.), **Comprimidos** (`.rar`, `.7z`, `.zip`), **Videos** (`.mp4`, `.mkv`), **Audio** y **Documentos**.
  - Editor interactivo para activar o desactivar extensiones según tus necesidades.
- 📅 **Inclusión Opcional de Fecha:**
  - Agrega la fecha y hora de publicación de Telegram al nombre del archivo (`DD-MM-YYYY - HH-MM`).
- 💾 **Persistencia Completa con SQLite:**
  - Tus enlaces escaneados, configuraciones, automatizaciones e historial de descargas se guardan en una base de datos local (`downloads.db`), manteniéndose intactos incluso si cierras la app o reinicias tu equipo.
- 🚀 **Descarga Paralela Acelerada:**
  - Descarga simultánea por bloques para maximizar el ancho de banda de tu conexión.
- 🔒 **100% Privado y Seguro:**
  - Tu sesión se guarda únicamente en tu máquina local (`mi_sesion.session`) y nunca se comparte con terceros.

---

## 🚀 ¿Cómo usar la aplicación?

### Opción A: Ejecución en Windows (Recomendada para PC)

1. **Descargar el proyecto:**
   - Haz clic en el botón verde **Code** (arriba a la derecha en GitHub) y selecciona **[Download ZIP](https://github.com/elpato001/telegram-downloader/archive/refs/heads/main.zip)**, o clona el repositorio con:
     ```bash
     git clone https://github.com/elpato001/telegram-downloader.git
     ```
2. **Descomprimir el archivo `.zip`:**
   - Extrae el contenido en cualquier carpeta de tu equipo.
3. **Ejecutar `iniciar.bat`:**
   - Haz doble clic en el archivo **`iniciar.bat`**. 
   - El script verificará las dependencias necesarias y abrirá automáticamente la aplicación en tu navegador (`http://localhost:8000`).

### Opción B: Despliegue en Synology DSM / Servidores Docker

Para ejecutar en un NAS Synology o servidor con Docker:
- Consulta la guía detallada: **[Guía de Instalación para Synology DSM (Container Manager)](RELEASE_SYNOLOGY.md)**.
- Incluye `docker-compose.yml` y configuración con proxy inverso `Caddy` protegida por contraseña.

---

## 📱 Guía Rápida de Uso

1. **Conectar tu cuenta:**
   - Abre la aplicación y elige iniciar sesión con **Código QR** (escaneándolo desde la app de Telegram en tu teléfono) o mediante **Número de Teléfono** (ingresando el código recibido en Telegram).
2. **Capturar Enlaces:**
   - En la pestaña **Capturador de Enlaces**, pega el enlace del canal, grupo o mensaje (ej: `https://t.me/nombre_canal` o `https://t.me/c/12345678/90`) y haz clic en **Escanear Enlace**.
   - Puedes escanear varios canales o enlaces y todos quedarán organizados en paquetes.
3. **Configurar Destino y Formatos:**
   - En la barra inferior, haz clic en **Examinar...** para seleccionar o crear la carpeta donde deseas descargar.
   - Ajusta los formatos permitidos haciendo clic en **[Editar]** si solo deseas descargar extensiones específicas.
4. **Automatizaciones (Opcional):**
   - Ve a la pestaña **Automatizaciones**, ingresa el enlace de un canal que quieras monitorizar continuamente, define la carpeta de destino, filtros de formato y haz clic en **Añadir Canal**.
5. **Iniciar Descargas:**
   - Selecciona las casillas de los archivos que desees y pulsa **Iniciar Descargas**.
   - La aplicación pasará automáticamente a la pestaña **Descargas** donde verás el avance en tiempo real.

---

## 📋 Requisitos Previos

- **Windows 10 / 11** o **Linux / Docker (Synology NAS)**
- **Python 3.10 o superior** instalado ([Descargar Python](https://www.python.org/downloads/)).
  *(En Windows, asegúrate de marcar la casilla **"Add Python to PATH"** durante la instalación).*

---

## 📄 Licencia

Distribuido bajo la Licencia MIT.
