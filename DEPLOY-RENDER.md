# Deploy del Servidor a Render

Este documento contiene las instrucciones para hacer deploy del servidor backend a Render.

## Preparación

### 1. Archivos necesarios
- `server.js` - Servidor principal
- `package.json` - Dependencias y scripts
- `render.yaml` - Configuración de Render
- `.env.example` - Variables de entorno de ejemplo

### 2. Variables de entorno requeridas

En Render, debes configurar las siguientes variables de entorno:

```
NODE_ENV=production
SHOPIFY_STORE_URL=tu-tienda.myshopify.com
SHOPIFY_ACCESS_TOKEN=tu-access-token-aqui
PORT=10000
```

## Pasos para el Deploy

### 1. Conectar repositorio
1. Ve a [Render Dashboard](https://dashboard.render.com/)
2. Haz clic en "New +" > "Web Service"
3. Conecta tu repositorio de GitHub
4. Selecciona la rama principal

### 2. Configuración del servicio
- **Name**: `apporders-server`
- **Environment**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Plan**: `Free` (o el que prefieras)

### 3. Variables de entorno
En la sección "Environment Variables", agrega:
- `NODE_ENV`: `production`
- `SHOPIFY_STORE_URL`: Tu URL de tienda Shopify
- `SHOPIFY_ACCESS_TOKEN`: Tu token de acceso

### 4. Health Check
Render usará automáticamente el endpoint `/health` para verificar que el servidor esté funcionando.

## Endpoints disponibles

- `GET /health` - Health check
- `GET /api/test` - Test de conectividad
- `POST /api/verify-draft-order` - Verificar draft order
- `POST /api/complete-draft-order` - Completar draft order
- `POST /api/add-recargo-equivalencia` - Agregar recargo de equivalencia
- `GET /api/draft-order/:id` - Obtener draft order por ID

## Verificación

Una vez desplegado, puedes verificar que funciona visitando:
- `https://tu-servicio.onrender.com/health`
- `https://tu-servicio.onrender.com/api/test`

## Notas importantes

1. **Tiempo de arranque**: Los servicios gratuitos de Render pueden tardar hasta 30 segundos en arrancar después de inactividad.
2. **HTTPS**: Render proporciona HTTPS automáticamente.
3. **Logs**: Puedes ver los logs en tiempo real desde el dashboard de Render.
4. **Actualizaciones**: Render redesplegará automáticamente cuando hagas push a la rama conectada.