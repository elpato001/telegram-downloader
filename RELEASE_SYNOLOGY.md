# 📦 Lanzamiento: Versión para Synology DSM (Container Manager)

Esta versión (Asset) está pre-configurada para ser instalada directamente en un NAS Synology a través de **Container Manager** (Docker). 
Incluye modificaciones específicas para adaptar la interfaz web a Linux/DSM y un proxy de seguridad integrado (Caddy) para exponerla de forma segura.

## ✨ Novedades en esta versión
- 🐳 **`Dockerfile` y `docker-compose.yml` listos para usar**: Integración directa con Container Manager y volumen persistente `./data` para base de datos y sesión.
- 🔒 **Protección integrada**: Pantalla de autenticación web protegida por contraseña para evitar accesos no autorizados.
- 📂 **Explorador adaptado**: El selector de carpetas interactivo navega desde la raíz `/` y `/volume1`, permitiendo explorar y crear carpetas en todos los volúmenes del NAS de forma nativa.

---

## 🛠️ Guía de Instalación para Synology DSM

### 1. Subir los archivos
1. Descarga el archivo `.zip` del repositorio o clónalo directamente en tu NAS.
2. Sube todo el contenido a una carpeta de tu NAS (por ejemplo: `/volume1/docker/telegram-downloader`).
3. **Importante:** Asegúrate de que exista la subcarpeta `data` dentro de `/volume1/docker/telegram-downloader/` (si no existe, créala desde File Station). Synology DSM requiere que las carpetas mapeadas existan previamente en el host.

### 2. Levantar el Contenedor
1. Abre **Container Manager** en tu NAS.
2. Ve a **Proyecto** > **Crear**.
3. **Nombre del proyecto:** `telegram-downloader`
4. **Ruta:** Selecciona la carpeta donde subiste los archivos (`/volume1/docker/telegram-downloader`).
5. El sistema detectará automáticamente el archivo `docker-compose.yml`. Dale a Siguiente y Finalizar. El contenedor se construirá y se pondrá en marcha.

> 💡 **Nota sobre las descargas:** Por defecto, el archivo `docker-compose.yml` mapea `/volume1/Descargas Telegram`. Si aún no tienes esa carpeta compartida en tu NAS, créala desde **Panel de control > Carpeta compartida**, o edita `docker-compose.yml` para apuntar a otra carpeta que ya tengas. De lo contrario, Container Manager mostrará un error similar.

---

## 🔐 Configurar el Acceso Seguro (HTTPS) y WebSockets

Para poder usar el certificado seguro de tu NAS (HTTPS) y que los Códigos QR e historial en tiempo real funcionen, debes configurar el **Proxy Inverso de Synology**:

1. Ve a **Panel de control > Portal de inicio de sesión > Avanzado > Proxy inverso**.
2. Dale a **Crear** y configura la regla:
   - **Origen:** Protocolo `HTTPS` | Puerto: `8001` (o el puerto que prefieras).
   - **Destino:** Protocolo `HTTP` | Nombre de host: `localhost` | Puerto: `8000`.
3. Ve a la pestaña superior **Encabezado personalizado** (Custom Header).
4. Dale al desplegable **Crear > WebSocket**. *(Se rellenarán automáticamente los campos `Upgrade` y `Connection`. Esto es VITAL para que la app pueda iniciar sesión vía QR y mostrar el progreso).*
5. Dale a **Guardar**.

### 3. Asignar tu Certificado
1. Ve a **Panel de control > Seguridad > Certificado**.
2. Haz clic en **Configuración**.
3. Busca el servicio `*:8001` (tu proxy inverso) y asígnale el certificado de tu NAS (`synology`). Dale a OK.

---

## 🚀 ¡Todo listo!
Ya puedes acceder desde cualquier navegador escribiendo:
👉 `https://TU_IP_DEL_NAS:8001`

- Al ingresar te solicitará la contraseña de la aplicación. Por defecto es **`admin`**.
- *(Si deseas cambiar la contraseña, puedes modificar `APP_PASSWORD` en `config.py` o agregar la variable de entorno `APP_PASSWORD: "tu_clave"` en `docker-compose.yml`).*
