# App Orders

Aquí tienes instrucciones detalladas para crear un sistema que agregue una opción "Crear pedido final" en el Admin de Shopify (y que pueda incrustarse en POS), que al pulsar comunique con tu servidor (por ejemplo, desplegado en Render) y complete el pedido draft usando la API de Shopify.
* * *
## 1\. Pre-requisitos
*   Cuenta de [Shopify Partner](https://partners.shopify.com/).
*   Una tienda de desarrollo.
*   [Shopify CLI](https://shopify.dev/docs/apps/tools/cli/installation) instalado.
*   Node.js 18+.
*   Cuenta en [Render](https://render.com/) para desplegar tu backend.
* * *
## 2\. Crea tu app de Shopify

```bash
shopify app init
cd tu-app-name
```

* * *
## 3\. Genera una extensión de acción para el Admin
Esto agregará el botón en el Admin de Shopify (en la página de pedidos draft):

```bash
shopify app generate extension --type=admin_action --name=crear-pedido-final
```

Configura el target en el archivo `shopify.extension.toml` para que la acción aparezca en el contexto de Draft Orders. Ejemplo:

```verilog
[[extensions.targeting]]
target = "admin.draft-order.action.render"
module = "./src/ActionExtension.jsx"
```

* * *
## 4\. Implementa la extensión (botón + toast)
En `extensions/crear-pedido-final/src/ActionExtension.jsx`:

```javascript
import {extend, render, Button, useSessionToken, useToast, useData} from '@shopify/admin-ui-extensions-react';

function CrearPedidoFinal() {
  const {getSessionToken} = useSessionToken();
  const {show: showToast} = useToast();
  const data = useData(); // Aquí tendrás el draftOrderId

  const handleClick = async () => {
    const token = await getSessionToken();
    const response = await fetch('https://TU-APP-RENDER.onrender.com/crear-pedido-final', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({draftOrderId: data.draftOrderId})
    });
    if (response.ok) {
      showToast('Pedido final creado correctamente');
    } else {
      showToast('Error al crear el pedido final', {error: true});
    }
  };

  return <Button onPress={handleClick}>Crear pedido final</Button>;
}

extend('Admin::DraftOrder::Action', render(() => <CrearPedidoFinal />));
```

* * *
## 5\. Backend en Render
Crea un backend sencillo en Node.js/Express que reciba la petición y complete el pedido draft usando la API GraphQL de Shopify.
Ejemplo básico de endpoint:

```javascript
const express = require('express');
const fetch = require('node-fetch');
const app = express();
app.use(express.json());

app.post('/crear-pedido-final', async (req, res) => {
  const {draftOrderId} = req.body;
  const shop = req.headers['x-shopify-shop-domain'];
  const accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN; // Guarda tu token seguro

  const query = `
    mutation {
      draftOrderComplete(id: "${draftOrderId}") {
        draftOrder { id }
        userErrors { field message }
      }
    }
  `;

  const response = await fetch(`https://${shop}/admin/api/2024-04/graphql.json`, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({query})
  });

  const data = await response.json();
  if (data.data.draftOrderComplete.userErrors.length === 0) {
    res.status(200).json({ok: true});
  } else {
    res.status(400).json({error: data.data.draftOrderComplete.userErrors});
  }
});

app.listen(process.env.PORT || 3000);
```

Despliega este backend en Render siguiendo su guía de despliegue para Node.js.
* * *
## 6\. Habilita tu app para POS (opcional)
Para que tu app pueda incrustarse en Shopify POS:
*   Ve a tu app en el [Partner Dashboard](https://partners.shopify.com/).
*   En la configuración, activa la opción **Embed app in Shopify POS**.
*   Si quieres una acción en POS, deberás crear una [POS UI Extension](https://shopify.dev/docs/api/pos-ui-extensions) específica, ya que las extensiones de Admin no aparecen automáticamente en POS. Si solo necesitas la funcionalidad en el Admin, este paso es opcional.
* * *
## 7\. Prueba y despliega
*   Usa `shopify app dev` para probar localmente.
*   Usa `shopify app deploy` para desplegar la extensión.
*   Instala la app en tu tienda de desarrollo y verifica que el botón aparece en los pedidos draft.
* * *
## 8\. Seguridad y autenticación
*   Usa session tokens para autenticar las llamadas desde la extensión a tu backend.
*   Valida el token en tu backend antes de ejecutar la mutación.
* * *
### Recursos útiles
*   [Admin Action Extensions](https://shopify.dev/docs/apps/build/admin/actions-blocks/build-admin-action?extension=react)
*   [draftOrderComplete mutation](https://shopify.dev/docs/api/admin-graphql/latest/mutations/draftOrderComplete)
*   [Embed app in Shopify POS](https://shopify.dev/docs/apps/build/pos/embed-app-in-pos)
*   [Shopify CLI](https://shopify.dev/docs/apps/tools/cli)
*   [Node.js](https://nodejs.org/)
*   [Render](https://render.com/)# Force redeploy Wed Sep  3 04:54:26 CEST 2025
