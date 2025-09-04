# Configuración de Modo Desarrollo vs Producción

Este sistema permite cambiar fácilmente entre URLs locales (con ngrok) y la URL de producción (Render) para el desarrollo y testing de la extensión POS.

## 🔧 Configuración Inicial

### 1. Variables de Entorno

Copia el archivo `.env.example` a `.env` y configura las variables:

```bash
cp .env.example .env
```

Edita el archivo `.env`:

```env
# Shopify Configuration
SHOPIFY_STORE_URL=tu-tienda.myshopify.com
SHOPIFY_ACCESS_TOKEN=tu-access-token

# Server Configuration
PORT=3000

# Environment
NODE_ENV=development
DEV_MODE=true

# API URLs
# For development with ngrok (local tunnel)
DEV_API_URL=https://tu-url-ngrok.ngrok.io
# For production (Render)
PROD_API_URL=https://pedido-flamingueo-b2b.onrender.com
```

### 2. Configurar ngrok (para desarrollo local)

1. Instala ngrok: https://ngrok.com/download
2. Ejecuta tu servidor local:
   ```bash
   npm run dev
   ```
3. En otra terminal, expone el puerto con ngrok:
   ```bash
   ngrok http 3000
   ```
4. Copia la URL HTTPS que te proporciona ngrok (ej: `https://abc123.ngrok.io`)

## 🚀 Uso de Scripts

### Cambiar a Modo Desarrollo

```bash
# Cambiar a modo desarrollo con URL de ngrok
npm run set-ngrok https://tu-url-ngrok.ngrok.io

# O usar el script directamente
node scripts/toggle-dev-mode.js dev https://tu-url-ngrok.ngrok.io
```

### Cambiar a Modo Producción

```bash
# Cambiar a modo producción (usa Render)
npm run prod-mode

# O usar el script directamente
node scripts/toggle-dev-mode.js prod
```

## 📁 Archivos de Configuración

### `/config.js`
Configuración principal del servidor backend.

### `/crear-pedido-final/extensions/pos-recargo-equivalencia/src/config.js`
Configuración específica para la extensión POS que maneja las URLs de los endpoints.

### `/scripts/toggle-dev-mode.js`
Script utilitario para cambiar entre modos de desarrollo y producción.

## 🔄 Flujo de Trabajo Recomendado

### Para Desarrollo Local:

1. **Inicia el servidor local:**
   ```bash
   npm run dev
   ```

2. **Expone el servidor con ngrok:**
   ```bash
   ngrok http 3000
   ```

3. **Configura el modo desarrollo:**
   ```bash
   npm run set-ngrok https://tu-nueva-url-ngrok.ngrok.io
   ```

4. **Reinicia el servidor de desarrollo de Shopify:**
   ```bash
   cd crear-pedido-final
   shopify app dev
   ```

### Para Producción:

1. **Cambia a modo producción:**
   ```bash
   npm run prod-mode
   ```

2. **Reinicia el servidor de desarrollo de Shopify:**
   ```bash
   cd crear-pedido-final
   shopify app dev
   ```

## 🐛 Troubleshooting

### La extensión muestra "No disponible"
- Verifica que el servidor esté ejecutándose
- Confirma que la URL de ngrok esté actualizada y activa
- Revisa los logs del servidor para errores
- Asegúrate de haber reiniciado el servidor de desarrollo después de cambiar la configuración

### Error de CORS
- Verifica que el servidor tenga configurado CORS correctamente
- Confirma que la URL de ngrok sea HTTPS

### ngrok se desconecta frecuentemente
- Considera usar una cuenta de ngrok de pago para URLs estables
- O usa un servicio alternativo como localtunnel

## 📝 Notas Importantes

- **Siempre usa HTTPS** con ngrok para evitar problemas de CORS
- **Reinicia el servidor de desarrollo** de Shopify después de cambiar la configuración
- **Las URLs de ngrok cambian** cada vez que reinicias ngrok (a menos que tengas una cuenta de pago)
- **En producción**, asegúrate de estar en modo producción para usar la URL de Render

## 🔍 Verificación de Configuración

Puedes verificar la configuración actual revisando los logs al iniciar el servidor:

```
🔧 Configuration loaded:
   Mode: Development
   API URL: https://tu-url-ngrok.ngrok.io
   Port: 3000
```

Y en la extensión POS:

```
🔧 POS Extension Configuration:
   Mode: Development
   API URL: https://tu-url-ngrok.ngrok.io
```