# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Comandos

El entorno y las dependencias se gestionan con [uv](https://docs.astral.sh/uv/) (Python 3.12, ver `.python-version`). No usar `pip`/`venv` directamente: ejecutar todo con `uv run ...` o activar `.venv`.

```bash
uv sync                                  # instala/sincroniza dependencias (crea .venv si no existe)
uv add <paquete>                         # añadir una dependencia nueva

uv run python manage.py runserver        # levantar el servidor de desarrollo
uv run python manage.py migrate          # aplicar migraciones
uv run python manage.py makemigrations   # generar migraciones tras cambiar models.py
uv run python manage.py createsuperuser
uv run python manage.py check            # comprobación de errores de configuración
uv run python manage.py test             # ejecutar toda la suite de tests
uv run python manage.py test mudanzas.tests.NombreDelTest   # ejecutar un test concreto
```

## Qué es este proyecto

Aplicación de gestión de mudanzas para una empresa ("La Selva Mudanzas"):
- **Backend**: Django 6 sobre Python 3.12, con SQLite3 como base de datos (`db.sqlite3`, sin versionar).
- **Frontend**: HTML + JavaScript vanilla con HTMX y Alpine.js, vendorizados en `static/js/` (sin build step, sin Node).
- **Offline-first**: Service Worker + IndexedDB para poder rellenar y guardar el formulario sin conexión y sincronizarlo después.

## Arquitectura

- `config/` — settings, urls, wsgi/asgi del proyecto. `config/urls.py` sirve `mudanzas.views.service_worker` en `/service-worker.js` (fuera de `/static/`, a propósito: así el Service Worker tiene scope sobre toda la app y no solo sobre `/static/js/`) e incluye `mudanzas.urls` en la raíz.
- `mudanzas/` — única app Django. Contiene:
  - `models.py` — modelo `Mudanza` (datos de cliente, direcciones de origen/destino, fecha, inventario, observaciones, conformidad/firma, `estado` con choices, y `client_uuid` — UUID generado en el cliente que identifica de forma estable un registro creado offline para poder sincronizarlo sin duplicarlo).
  - `forms.py` — `MudanzaForm` (ModelForm), usado tanto por las vistas HTML como por `api_sync` para validar el JSON entrante.
  - `views.py` — `mudanza_list`, `mudanza_create`, `mudanza_edit`, `mudanza_print` (vistas HTML clásicas, function-based) y `api_sync` (endpoint JSON que hace *upsert* por `client_uuid`).
  - `urls.py` — `""` listado, `"nueva/"` alta, `"<id>/editar/"`, `"<id>/imprimir/"`, `"api/sync/"`.
  - `templates/mudanzas/` — `base.html` (carga htmx/alpine/offline.js, indicador de conexión), `list.html`, `form.html` (compartida por alta y edición), `print.html` (independiente de `base.html`, con su propio CSS de impresión).
- `static/js/offline.js` — toda la lógica offline del cliente: registra el Service Worker, envuelve IndexedDB (base `mudanzas-offline`, store `pendientes`, key `client_uuid`), intercepta el `submit` de los formularios con `data-offline-form` (si `navigator.onLine` es `false`, guarda en IndexedDB en vez de enviar), y sincroniza (`flush()`) contra `/api/sync/` cuando vuelve la conexión. Expone `window.mudanzasOffline.listPending()` que usa `list.html` (vía Alpine) para mostrar los pendientes sin sincronizar.
- `static/js/service-worker.js` — cachea el "app shell" (listado, `/nueva/`, estáticos) en la instalación; estrategia network-first-con-fallback-a-caché para navegaciones, y cache-first-con-revalidación para el resto de peticiones `GET` same-origin. No intercepta peticiones `POST` (esas las gestiona `offline.js`).

### Cómo se relacionan estas piezas (offline)

1. El Service Worker cachea el shell y las páginas visitadas.
2. Si el usuario envía el formulario sin conexión, `offline.js` lo guarda en IndexedDB con un `client_uuid` propio en vez de dejar que el navegador lo envíe.
3. Al recuperar conexión, `offline.js` hace `POST /api/sync/` por cada pendiente; `api_sync` (en `views.py`) busca por `client_uuid` y crea o actualiza el `Mudanza` correspondiente, así que reintentar un envío nunca duplica el registro.
4. El listado combina lo que ya está en la base de datos (renderizado por Django) con lo que sigue en IndexedDB sin sincronizar (leído en el cliente con JS/Alpine).

Si se toca cualquiera de estas piezas (modelo, `MudanzaForm`, `api_sync`, o el formato del objeto que arma `formToObject` en `offline.js`), hay que mantener sincronizados los nombres de campo entre el HTML del formulario, el JSON que se guarda en IndexedDB y lo que `MudanzaForm`/`api_sync` esperan recibir.
