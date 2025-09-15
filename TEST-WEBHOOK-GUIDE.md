# Guía de Testing del Webhook - Recargo de Equivalencia

## 🚀 Configuración Rápida

### 1. Iniciar el Servidor Local
```bash
npm start
```
El servidor se ejecutará en `http://localhost:3000`

### 2. Ejecutar Pruebas del Webhook
```bash
# Ejecutar todas las pruebas
node test-webhook.js

# Ejecutar prueba específica
node test-webhook.js with-re      # Cliente CON tag "RE"
node test-webhook.js without-re   # Cliente SIN tag "RE"  
node test-webhook.js with-recargo # Cliente con recargo existente
```

## 🧪 Escenarios de Prueba

### ✅ Escenario 1: Cliente CON tag "RE"
**Expectativa**: Debería llamar al endpoint `/api/add-recargo-equivalencia-order`

**Datos de prueba**:
- Cliente: "Cliente Con RE"
- Tags: `"cliente-vip, RE, descuento-especial"`
- Subtotal: €80.00

**Resultado esperado**: 
- ✅ Webhook procesa el pedido
- ✅ Llama al endpoint interno
- ⚠️ Puede fallar si el endpoint interno no encuentra el pedido en Shopify (normal en testing)

### ✅ Escenario 2: Cliente SIN tag "RE"
**Expectativa**: Debería terminar sin procesar

**Datos de prueba**:
- Cliente: "Cliente Sin RE"
- Tags: `"cliente-vip, descuento-normal"`
- Subtotal: €50.00

**Resultado esperado**:
```json
{
  "message": "Customer does not have RE tag - skipping recargo",
  "customerTags": "cliente-vip, descuento-normal"
}
```

### ✅ Escenario 3: Cliente con Recargo Existente
**Expectativa**: Debería detectar recargo existente y no duplicar

**Datos de prueba**:
- Cliente: "Cliente Con RE y Recargo"
- Tags: `"RE"`
- Line items incluyen: "Recargo de Equivalencia (5.2%)"

**Resultado esperado**:
```json
{
  "message": "Order already has recargo equivalencia"
}
```

## 🔍 Interpretación de Resultados

### ✅ Respuestas Exitosas (Código 200)

1. **Cliente sin tag "RE"**:
   ```json
   {
     "message": "Customer does not have RE tag - skipping recargo",
     "customerTags": "..."
   }
   ```

2. **Pedido ya tiene recargo**:
   ```json
   {
     "message": "Order already has recargo equivalencia"
   }
   ```

3. **Recargo añadido exitosamente**:
   ```json
   {
     "success": true,
     "message": "Recargo de equivalencia added successfully",
     "orderId": 12345,
     "orderName": "#TEST-001",
     "details": {...}
   }
   ```

### ⚠️ Errores Esperados en Testing Local

1. **Error 404 del endpoint interno**:
   ```json
   {
     "error": "Failed to add recargo",
     "message": "Request failed with status code 404"
   }
   ```
   **Causa**: El pedido mock no existe en Shopify real
   **Solución**: Normal en testing, indica que el webhook funciona correctamente

2. **Signature inválida**:
   ```json
   {
     "error": "Unauthorized - Invalid signature"
   }
   ```
   **Causa**: `SHOPIFY_WEBHOOK_SECRET` no configurado o incorrecto
   **Solución**: Configurar la variable de entorno o usar sin signature para testing

## 🔧 Configuración de Variables de Entorno

### Para Testing Local (Opcional)
```bash
# .env
SHOPIFY_WEBHOOK_SECRET=test-secret
```

### Para Testing sin Signature
Si no configuras `SHOPIFY_WEBHOOK_SECRET`, el webhook funcionará sin verificación de signature (útil para testing local).

## 📊 Logs del Servidor

Mientras ejecutas las pruebas, revisa los logs del servidor para ver el procesamiento detallado:

```
📦 Webhook recibido - Pedido pagado
✅ Webhook signature verificada
🔍 Procesando pedido: #TEST-001
✅ Cliente tiene tag "RE". Procediendo con recargo.
🔄 Llamando a add-recargo-equivalencia-order...
❌ Error llamando a add-recargo-equivalencia-order: Request failed with status code 404
```

## 🛠️ Personalizar Pruebas

### Modificar Datos de Prueba
Edita <mcfile name="test-webhook.js" path="/Users/davidavilagallardo/Documents/EXPORTACIONES FLAMINGUEO/AppOrders/test-webhook.js"></mcfile> para cambiar:
- IDs de pedidos
- Información del cliente
- Tags del cliente
- Line items
- Precios

### Añadir Nuevos Escenarios
```javascript
const nuevoEscenario = {
  id: 12345678904,
  name: "#TEST-004",
  customer: {
    tags: "tu-tag-personalizado, RE"
  },
  // ... más datos
};

await sendTestWebhook(nuevoEscenario, 'Mi Escenario Personalizado');
```

## 🔄 Testing con Datos Reales

### Opción 1: Usar ngrok para Exponer Puerto Local
```bash
# Instalar ngrok
npm install -g ngrok

# Exponer puerto 3000
ngrok http 3000

# Usar la URL de ngrok en la configuración del webhook de Shopify
```

### Opción 2: Testing en Shopify Development Store
1. Crear una tienda de desarrollo
2. Configurar el webhook apuntando a tu servidor local (con ngrok)
3. Realizar pedidos reales de prueba

## 🚨 Troubleshooting

### El servidor no responde
- Verifica que `npm start` esté ejecutándose
- Comprueba que el puerto 3000 esté libre
- Revisa los logs del servidor para errores

### Las pruebas fallan
- Verifica que el servidor esté ejecutándose en puerto 3000
- Comprueba la configuración de variables de entorno
- Revisa los logs del servidor para más detalles

### Signature errors
- Configura `SHOPIFY_WEBHOOK_SECRET` en tu `.env`
- O comenta la verificación de signature para testing local

## 📝 Comandos Útiles

```bash
# Iniciar servidor
npm start

# Ejecutar todas las pruebas
node test-webhook.js

# Ejecutar prueba específica
node test-webhook.js with-re

# Ver logs en tiempo real (en otra terminal)
tail -f logs/server.log  # Si tienes logging a archivo

# Verificar que el servidor responde
curl http://localhost:3000/health
```