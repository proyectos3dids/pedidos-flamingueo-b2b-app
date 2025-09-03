# Backend para Shopify App - Completar Draft Orders

Este backend en Node.js/Express maneja las peticiones para completar draft orders desde la extensión de Shopify Admin.

## Configuración

### 1. Variables de Entorno

Copia `.env.example` a `.env` y configura las siguientes variables:

```bash
cp .env.example .env
```

Edita `.env` con tus valores:

```env
SHOPIFY_STORE_URL=tu-tienda.myshopify.com
SHOPIFY_ACCESS_TOKEN=tu-access-token-aqui
PORT=3000
NODE_ENV=development
```

### 2. Obtener Access Token de Shopify

1. Ve a tu app en el Partner Dashboard
2. Instala la app en tu tienda de desarrollo
3. Obtén el access token desde la configuración de la app
4. Asegúrate de que la app tenga los permisos necesarios:
   - `read_draft_orders`
   - `write_draft_orders`
   - `read_orders`
   - `write_orders`

## Instalación y Ejecución Local

```bash
# Instalar dependencias
npm install

# Ejecutar en modo desarrollo
npm run dev

# O ejecutar en producción
npm start
```

El servidor estará disponible en `http://localhost:3000`

## Endpoints

### Health Check
```
GET /health
```
Verifica que el servidor esté funcionando.

### Completar Draft Order
```
POST /api/complete-draft-order
Content-Type: application/json

{
  "draftOrderId": "gid://shopify/DraftOrder/123456789"
}
```

### Obtener Detalles de Draft Order
```
GET /api/draft-order/:id
```

## Despliegue en Render

### 1. Preparar el Repositorio

1. Sube tu código a GitHub
2. Asegúrate de que `.env` esté en `.gitignore`

### 2. Configurar en Render

1. Ve a [Render.com](https://render.com)
2. Crea un nuevo "Web Service"
3. Conecta tu repositorio de GitHub
4. Configura:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Node Version**: 18 o superior

### 3. Variables de Entorno en Render

En la configuración del servicio, agrega:
- `SHOPIFY_STORE_URL`
- `SHOPIFY_ACCESS_TOKEN`
- `NODE_ENV=production`

### 4. Actualizar la Extensión

Una vez desplegado, actualiza la URL en tu extensión de Shopify para apuntar a tu servidor de Render:

```javascript
// En ActionExtension.jsx, reemplaza la llamada local por:
const response = await fetch('https://tu-app.onrender.com/api/complete-draft-order', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    draftOrderId: data.selected[0].id
  })
});
```

## Estructura del Proyecto

```
.
├── server.js              # Servidor principal
├── package.json           # Dependencias y scripts
├── .env                   # Variables de entorno (no subir a git)
├── .env.example          # Ejemplo de variables de entorno
├── .gitignore            # Archivos a ignorar en git
└── backend-README.md     # Este archivo
```

## Seguridad

- Nunca subas el archivo `.env` al repositorio
- Usa HTTPS en producción
- Valida siempre los datos de entrada
- Mantén actualizado el access token de Shopify

## Troubleshooting

### Error: "Shopify configuration is missing"
- Verifica que las variables `SHOPIFY_STORE_URL` y `SHOPIFY_ACCESS_TOKEN` estén configuradas

### Error: "Permission denied"
- Verifica que tu app tenga los permisos necesarios para draft orders

### Error de CORS
- El middleware CORS está configurado para permitir todas las origins en desarrollo
- En producción, considera restringir las origins permitidas