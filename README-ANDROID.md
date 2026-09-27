# MyCompanion v0.3 — guía desde Android

Esta versión está pensada para que la interfaz funcione muy bien en el teléfono.

## Importante

El teléfono puede abrir y administrar la página, pero el servidor de IA y la generación local de imágenes normalmente necesitan un PC/servidor. Esta carpeta deja preparada la aplicación; no se puede alojar un modelo grande dentro de un Android normal simplemente subiendo el ZIP.

## Qué incluye

- Chat con memoria persistente (SQLite)
- Personajes personalizados
- Personalidad y descripción visual
- Generación de imágenes mediante ComfyUI
- Botón de lectura por voz usando el navegador
- Diseño móvil/PWA

## Si quieres usarla sin instalar nada en el teléfono

Necesitarás un servidor donde ejecutar Node.js. Puedes desplegar el proyecto en un servicio compatible con Node y configurar las variables de entorno.

Para chat:
- `AI_BASE_URL`
- `AI_API_KEY`
- `AI_MODEL`

Para imágenes locales:
- `COMFY_URL`
- `COMFY_WORKFLOW`
- `COMFY_POSITIVE_NODE`
- `COMFY_NEGATIVE_NODE`

## ComfyUI

El archivo `comfyui-workflow.example.json` es solamente un ejemplo. Los IDs de nodos cambian según el workflow/modelo que instales.

Para una identidad visual más consistente, después podemos añadir un workflow con referencia de personaje (por ejemplo IP-Adapter/LoRA) y guardar esa referencia con cada personaje.

## Ejecutar en un PC

1. Instala Node.js.
2. Descomprime el proyecto.
3. Abre una terminal dentro de la carpeta.
4. Ejecuta:
   `npm install`
5. Copia `.env.example` como `.env` y completa la configuración.
6. Ejecuta:
   `npm start`
7. Desde el teléfono y estando en la misma red Wi-Fi, abre:
   `http://IP-DEL-PC:3000`

## Seguridad

No publiques una instancia con claves API sin autenticación. Antes de hacerla pública, conviene añadir cuentas de usuario, límites de uso y protección de las claves.
