# Configuración de Webhook para Recargo de Equivalencia

## ¿Por qué usar Webhooks en lugar de Shopify Flow?

La acción "Send HTTP request" de Shopify Flow solo está disponible en planes **Shopify Plus**. Los webhooks son una alternativa que funciona en **todos los planes de Shopify** y proporciona la misma funcionalidad automática.

## Configuración en Shopify Admin

### 1. Acceder a la configuración de Webhooks
1. Ve a **Settings** → **Notifications**
2. Desplázate hasta la sección **Webhooks**
3. Haz clic en **Create webhook**

### 2. Configurar el Webhook
- **Event**: `Order payment`
- **Format**: `JSON`
- **URL**: `https://pedido-flamingueo-b2b.onrender.com/api/webhook/order-paid`
- **API version**: `2023-10` (o la más reciente disponible)

### 3. Configurar el Secret (Opcional pero Recomendado)
Para mayor seguridad, configura un webhook secret:
1. En la configuración del webhook, añade un **Webhook signature secret**
2. Añade esta variable de entorno en tu servidor:
   ```
   SHOPIFY_WEBHOOK_SECRET=tu_secret_aqui
   ```

## ¿Cómo Funciona?

1. **Trigger**: Cuando un pedido es pagado en Shopify
2. **Verificación**: El webhook verifica la autenticidad de la petición
3. **Verificación de Cliente**: Comprueba si el cliente tiene al menos un tag "RE"
   - Si NO tiene el tag "RE": El webhook termina sin procesar (respuesta 200)
   - Si SÍ tiene el tag "RE": Continúa con el procesamiento
4. **Procesamiento**: 
   - Llama al endpoint existente `/api/add-recargo-equivalencia-order`
   - Este endpoint calcula el subtotal y aplica el 5.2% de recargo
   - Añade una nueva línea al pedido con el recargo
5. **Resultado**: Solo los clientes con tag "RE" ven el recargo añadido automáticamente

## Lógica de Tags del Cliente

El webhook verifica los tags del cliente de la siguiente manera:
- Obtiene los tags del campo `order.customer.tags`
- Divide los tags por comas y los normaliza (trim + uppercase)
- Busca si existe el tag "RE" exactamente
- Si no encuentra "RE", termina el procesamiento con código 200

**Ejemplo de tags válidos:**
- `"RE"` ✅
- `"re"` ✅ (se normaliza a mayúsculas)
- `"cliente-vip, RE, descuento"` ✅
- `" RE "` ✅ (se eliminan espacios)

**Ejemplo de tags que NO activan el recargo:**
- `"cliente-vip"` ❌
- `"RECARGO"` ❌ (debe ser exactamente "RE")
- `""` ❌ (sin tags)

## Códigos de Respuesta HTTP

El webhook utiliza códigos de respuesta específicos para el manejo correcto de Shopify:

- **200**: SIEMPRE se devuelve código 200 para evitar que Shopify deshabilite el webhook
  - Cliente sin tag "RE" (procesamiento completado correctamente)
  - Pedido ya tiene recargo (procesamiento completado correctamente)
  - Recargo añadido exitosamente
  - Signature del webhook inválida (se registra el error pero se devuelve 200)
  - Errores del endpoint interno (se registra el error pero se devuelve 200)
  - Errores inesperados del servidor (se registra el error pero se devuelve 200)

**⚠️ IMPORTANTE**: Shopify puede deshabilitar automáticamente los webhooks que devuelven códigos de error (4xx, 5xx) de forma repetida. Por esta razón, SIEMPRE devolvemos código 200, incluso para errores, y registramos los problemas en los logs para debugging.

## Ventajas de los Webhooks

- ✅ **Compatible con todos los planes de Shopify**
- ✅ **Procesamiento automático e inmediato**
- ✅ **Verificación de seguridad incluida**
- ✅ **Filtrado por tags de cliente**
- ✅ **Reutiliza lógica existente del endpoint**
- ✅ **Manejo correcto de respuestas HTTP**
- ✅ **Logs detallados para debugging**
- ✅ **Sin coste adicional**

## Verificación y Logs

El servidor registra toda la actividad del webhook:
- Recepción de webhooks
- Verificación de signatures
- Verificación de tags del cliente
- Llamadas al endpoint interno
- Procesamiento de pedidos
- Errores y éxitos

Puedes monitorear estos logs para asegurar que todo funciona correctamente.

## Troubleshooting

### El webhook no se ejecuta
- Verifica que la URL esté correcta y accesible
- Comprueba que el evento seleccionado sea "Order payment"
- Revisa los logs del servidor para errores

### Errores de signature
- Asegúrate de que `SHOPIFY_WEBHOOK_SECRET` esté configurado correctamente
- Verifica que el secret en Shopify coincida con el del servidor

### El recargo no se añade a clientes con tag "RE"
- Verifica que el cliente tenga exactamente el tag "RE" (mayúsculas/minúsculas no importan)
- Comprueba que el pedido no tenga ya un recargo de equivalencia
- Revisa los logs para ver si el endpoint interno devuelve errores
- Verifica los permisos de la API de Shopify

### Shopify reintenta el webhook constantemente
- ~~Este problema ya no debería ocurrir~~ - Ahora SIEMPRE devolvemos código 200
- Si ves reintentos constantes, verifica los logs para identificar errores recurrentes
- Todos los errores se registran en los logs pero devuelven código 200 para mantener el webhook activo

## Variables de Entorno Necesarias

```env
SHOPIFY_STORE_URL=tu-tienda.myshopify.com
SHOPIFY_ACCESS_TOKEN=tu_access_token
SHOPIFY_WEBHOOK_SECRET=tu_webhook_secret (opcional)
```

## Flujo Completo

1. Cliente completa el pago → Shopify envía webhook
2. Servidor recibe y verifica el webhook
3. **Verificación de tag "RE"**: Si el cliente NO tiene tag "RE", termina aquí
4. Si tiene tag "RE": Llama al endpoint `/api/add-recargo-equivalencia-order`
5. El endpoint calcula el recargo del 5.2% sobre el subtotal
6. Se añade la línea de recargo al pedido
7. Solo clientes con tag "RE" ven el recargo en su pedido actualizado