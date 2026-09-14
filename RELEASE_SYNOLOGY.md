# 📦 Lanzamiento: Versión para Synology DSM (Container Manager)

Esta versión (Asset) está pre-configurada para ser instalada directamente en un NAS Synology a través de **Container Manager** (Docker). 
Incluye modificaciones específicas para adaptar la interfaz web a Linux/DSM y un proxy de seguridad integrado (Caddy) para exponerla de forma segura.

## ✨ Novedades en esta versión
- 🐳 **`Dockerfile` y `docker-compose.yml` listos para usar**: Integración directa con Container Manager.
- 🔒 **Protección nativa**: Configurado con `Caddy` para solicitar un usuario y contraseña antes de permitir el acceso.
- 📂 **Explorador adaptado**: El selector de carpetas ahora navega desde la raíz `/` en lugar de `C:\`, permitiendo explorar todos los volúmenes del NAS de forma nativa.

---

## 🛠️ Guía de Instalación para Synology DSM

### 1. Subir los archivos
1. Descarga el archivo `.zip` de esta versión.
2. Descomprímelo y sube todo el contenido a una carpeta de tu NAS (por ejemplo: `/volume1/docker/telegram-downloader`).

### 2. Levantar el Contenedor
1. Abre **Container Manager** en tu NAS.
2. Ve a **Proyecto** > **Crear**.
3. **Nombre del proyecto:** `telegram-downloader`
4. **Ruta:** Selecciona la carpeta donde subiste los archivos.
5. El sistema detectará automáticamente el archivo `docker-compose.yml`. Dale a Siguiente y Finalizar. El contenedor se construirá y se pondrá en marcha.

*(Por defecto, las descargas irán a la carpeta `/volume1/Descargas Telegram` que puedes cambiar dentro del `docker-compose.yml` si lo prefieres).*

---

## 🔐 Configurar el Acceso Seguro (HTTPS) y WebSockets

Para poder usar el certificado seguro de tu NAS (HTTPS) y que los Códigos QR funcionen, debes configurar el **Proxy Inverso de Synology**:

1. Ve a **Panel de control > Portal de inicio de sesión > Avanzado > Proxy inverso**.
2. Dale a **Crear** y configura la regla:
   - **Origen:** Protocolo `HTTPS` | Puerto: `8001` (o el que gustes).
   - **Destino:** Protocolo `HTTP` | Nombre de host: `localhost` | Puerto: `8000`.
3. Ve a la pestaña superior **Encabezado personalizado** (Custom Header).
4. Dale al desplegable **Crear > WebSocket**. *(Se rellenarán automáticamente los campos `Upgrade` y `Connection`. Esto es VITAL para que la app pueda iniciar sesión).*
5. Dale a **Guardar**.

### 3. Asignar tu Certificado
1. Ve a **Panel de control > Seguridad > Certificado**.
2. Haz clic en **Configuración**.
3. Busca el servicio `*:8001` (tu proxy inverso) y asígnale el certificado de tu NAS (`synology`). Dale a OK.

---

## 🚀 ¡Todo listo!
Ya puedes acceder desde cualquier navegador escribiendo:
👉 `https://TU_IP_DEL_NAS:8001`

- Te pedirá un usuario y contraseña iniciales. Por defecto ambos son **`admin`** y **`admin`**.
- *(Si deseas cambiar la contraseña, puedes seguir las instrucciones dejadas como comentarios dentro del archivo `Caddyfile`).*
