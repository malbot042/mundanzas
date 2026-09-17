# La Selva Mudanzas

Aplicación web para la gestión de mudanzas: backend en Django (API + persistencia) y frontend en JavaScript vanilla con [HTMX](https://htmx.org/) y/o [Alpine.js](https://alpinejs.dev/), pensado para funcionar **offline** en el punto de recogida (sin conexión estable a internet).

## Objetivo

Permitir al equipo de campo rellenar el formulario de una mudanza (datos del cliente, origen/destino, inventario, condiciones, etc.), guardarlo aunque no haya conexión, y sincronizarlo con el servidor Django cuando la vuelva a haber. Desde el backend se puede listar, crear, editar e imprimir cada formulario.

## Funcionalidades principales

- **Formulario de mudanza**: captura de datos del cliente, direcciones de origen y destino, fecha, inventario/objetos a mover, observaciones y firma/conformidad.
- **Listado de formularios**: vista de todas las mudanzas registradas, con filtros básicos (fecha, cliente, estado).
- **Alta y edición**: crear un formulario nuevo o modificar uno existente.
- **Impresión**: generar una vista imprimible (PDF o directamente `window.print()`) de cada formulario, para entregar al cliente o archivar en papel.
- **Funcionamiento offline**: el formulario debe poder rellenarse y guardarse localmente sin conexión, sincronizando con el backend en cuanto haya red disponible.

## Stack tecnológico

- **Backend**: Django 6, Python 3.12, gestionado con [uv](https://docs.astral.sh/uv/).
- **Base de datos**: SQLite3 (por defecto de Django, archivo `db.sqlite3`).
- **Frontend**: HTML + JavaScript vanilla, usando HTMX para las interacciones con el servidor (sin build step ni frameworks SPA) y/o Alpine.js para estado e interactividad en el cliente.
- **Offline-first**: Service Worker (`static/js/service-worker.js`, servido en `/service-worker.js`) + IndexedDB (`static/js/offline.js`) para cachear la app y encolar los formularios pendientes de sincronizar.
- **Sin dependencias de compilación**: no se requiere Node/webpack para el frontend; `htmx.min.js` y `alpine.min.js` están vendorizados en `static/js/` y se sirven directamente desde Django.

## Estructura del proyecto

```
mudanceslaselva/
├── manage.py
├── pyproject.toml          # dependencias gestionadas con uv
├── uv.lock
├── db.sqlite3               # base de datos SQLite (no versionada)
├── config/                  # settings, urls, wsgi/asgi; sirve /service-worker.js en la raíz
├── mudanzas/                 # app Django: modelo, vistas, formularios, API de sincronización
│   ├── models.py              # modelo Mudanza (cliente, direcciones, inventario, estado, client_uuid)
│   ├── forms.py                # MudanzaForm
│   ├── views.py                 # listado, alta, edición, impresión, api_sync
│   ├── urls.py
│   └── templates/mudanzas/      # base.html, list.html, form.html, print.html
├── static/
│   ├── js/                     # htmx.min.js, alpine.min.js, offline.js, service-worker.js
│   ├── css/                    # base.css, print.css
│   └── manifest.webmanifest
└── README.md
```

## Puesta en marcha

```bash
uv sync                        # instala Python 3.12 y las dependencias (Django 6, etc.)
uv run python manage.py migrate
uv run python manage.py createsuperuser
uv run python manage.py runserver
```

Abre `http://127.0.0.1:8000/` para ver el listado, `/nueva/` para dar de alta una mudanza, `/<id>/editar/` para editarla y `/<id>/imprimir/` para la vista imprimible.

## Flujo offline

1. Al cargar la app, el Service Worker (`/service-worker.js`, con scope en toda la raíz) cachea el listado, el formulario de alta y los estáticos (`base.css`, `htmx.min.js`, `alpine.min.js`, `offline.js`); las páginas de edición/impresión se van cacheando a medida que se visitan.
2. Los formularios de alta/edición tienen el atributo `data-offline-form`. Si al enviarlos `navigator.onLine` es `false`, `offline.js` evita el envío normal, guarda los datos en IndexedDB (base `mudanzas-offline`, con un `client_uuid` generado en el cliente) y redirige al listado mostrando un aviso local. Si hay conexión, el formulario se envía de forma normal contra `mudanzas:create` / `mudanzas:edit`.
3. Al recuperar la conexión (evento `online` del navegador, o al cargar cualquier página), `offline.js` sincroniza cada mudanza pendiente contra `POST /api/sync/`, que crea o actualiza el registro por `client_uuid` (evitando duplicados si se reintenta).
4. El listado (`list.html`) muestra los registros ya sincronizados (renderizados por Django) y, debajo, una sección "Pendientes de sincronizar" que lee directamente de IndexedDB mediante Alpine.js; al sincronizar con éxito se recarga la página.
