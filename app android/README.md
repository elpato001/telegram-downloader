# 📱 Telegram Downloader Remote (App Android)

Aplicación nativa para Android (Kotlin + Material Design 3) diseñada como cliente de control remoto para **Telegram Downloader**.

> **Nota:** Esta app no descarga los archivos a la memoria de tu teléfono ni busca reemplazar la app original. Su objetivo es permitirte **enviar enlaces de Telegram a tu servidor NAS o PC** (directamente usando el botón *"Compartir"* de Telegram o pegando el enlace) y **monitorear en tiempo real la velocidad y porcentaje de descarga** mientras estás en tu casa o conectado a la red.

---

## 🚀 Características Principales

1. **Integración con el Menú Compartir de Telegram (Share Intent):**
   - Navega por cualquier canal o chat en la app oficial de Telegram en tu teléfono.
   - Pulsa en **"Compartir" (Share)** en cualquier mensaje o archivo multimedia.
   - Selecciona **TG Downloader Remote**: la app escaneará el mensaje al instante y te mostrará el nombre del archivo y tamaño.
   - Con un solo toque en **"Enviar y Descargar"**, la descarga empezará de inmediato en tu servidor/NAS.

2. **Monitoreo en Tiempo Real (WebSockets + API):**
   - Visualiza la velocidad actual en **MB/s**.
   - Barra de progreso interactiva con porcentaje (0 a 100%) y megabytes descargados.
   - Estados con distintivos visuales claros (*Descargando*, *Pausada*, *Detenida*, *Completada*, *Error*).

3. **Gestión Remota:**
   - **Pausar** y **Reanudar** descargas en curso desde el teléfono.
   - **Detener / Cancelar** descargas problemáticas.
   - **Limpiar completadas** con un toque en la barra superior.
   - Botón flotante (**FAB**) para pegar cualquier enlace de Telegram manualmente (`t.me/...` o enlace privado `t.me/c/...`).

4. **Soporte de Redes Locales (HTTP Cleartext):**
   - Configurado para conectarse sin problemas a direcciones IP locales de tu red privada (ej: `http://192.168.1.50:8000`), dominios DDNS o túneles seguros.

---

## 🛠️ Cómo abrir el proyecto en Android Studio y compilar el APK

### 1. Abrir el proyecto
1. Abre **Android Studio** en tu computadora.
2. Selecciona **Open** (o *File > Open...*).
3. Selecciona la carpeta:
   ```
   c:\Users\Casa\Downloads\telegram-downloader-main (2)\telegram-downloader-main\app android
   ```
4. Espera a que Gradle termine de sincronizar las dependencias (OkHttp, Material 3, Gson, Coroutines).

### 2. Generar el archivo instalable (APK)
1. En el menú superior de Android Studio, haz clic en **Build**.
2. Selecciona **Build Bundle(s) / APK(s)** > **Build APK(s)**.
3. Al finalizar la compilación (unos segundos), aparecerá una notificación abajo a la derecha:
   - Haz clic en **locate** para abrir la carpeta donde se generó el APK:
   - Ruta habitual: `app/build/outputs/apk/debug/app-debug.apk`.

### 3. Instalar en tu teléfono Android
- Envía el archivo `app-debug.apk` a tu teléfono (por WhatsApp, Telegram o cable USB) e instálalo permitiendo la instalación de fuentes desconocidas.

---

## ⚙️ Configuración Inicial en la App

1. Abre la aplicación **TG Downloader Remote** en tu teléfono.
2. Toca el icono de **Ajustes** (o el banner superior de estado).
3. En **Dirección del Servidor**, ingresa la IP local y puerto donde corre Telegram Downloader en tu NAS o PC:
   - Ejemplo: `http://192.168.1.50:8000` (o tu dominio web si tienes configurado acceso externo).
4. Si configuraste contraseña en el archivo de configuración del servidor, escríbela en el campo de contraseña.
5. Pulsa en **"Probar Conexión"**:
   - Deberás ver `✓ ¡Conexión exitosa con el servidor!`.
6. Pulsa en **"Guardar"**. ¡Listo! El indicador pasará a color verde (**Conectado**).

---

## 📁 Estructura del Código Fuente

```
app android/
├── app/
│   ├── src/main/
│   │   ├── AndroidManifest.xml          # Permisos, Activities y filtro Share Intent
│   │   ├── java/com/elpato/telegramdownloader/
│   │   │   ├── App.kt                   # Inicialización y singletons
│   │   │   ├── data/
│   │   │   │   ├── api/
│   │   │   │   │   ├── ApiClient.kt     # Peticiones REST HTTP (OkHttp + Cookies)
│   │   │   │   │   └── WebSocketManager.kt # Conexión en vivo con /ws
│   │   │   │   ├── model/
│   │   │   │   │   └── Models.kt        # Modelos de datos DTO y eventos WS
│   │   │   │   └── prefs/
│   │   │   │       └── PreferencesManager.kt # Almacenamiento local de IP y clave
│   │   │   └── ui/
│   │   │       ├── MainActivity.kt      # Pantalla principal con lista y monitoreo
│   │   │       ├── SettingsActivity.kt  # Pantalla para configurar la IP del servidor
│   │   │       ├── ShareActivity.kt     # Ventana rápida al compartir desde Telegram
│   │   │       ├── adapters/
│   │   │       │   └── DownloadsAdapter.kt # Renderizado de tarjetas de descarga
│   │   │       └── viewmodel/
│   │   │           └── MainViewModel.kt # Lógica reactiva de la UI
│   │   └── res/                         # Diseños XML (Layouts, Drawables, Colores, Temas)
│   └── build.gradle                     # Configuración del módulo de la app
├── build.gradle                         # Configuración Gradle raíz
├── settings.gradle                      # Módulos del proyecto
├── local.properties                     # Ruta al Android SDK
└── README.md                            # Este documento
```
