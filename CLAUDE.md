# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Estado del repositorio

Proyecto Django ya inicializado (settings, app `mudanzas`, base de datos migrada). Lo que **falta por implementar** es la lógica de negocio: el modelo `Mudanza`, las vistas de listado/alta/edición/impresión, y el frontend HTMX/Alpine con soporte offline. `mudanzas/models.py`, `views.py` y `templates/` están todavía en su forma por defecto de `startapp` (vacíos/placeholder).

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
- **Frontend**: HTML + JavaScript vanilla con HTMX y/o Alpine.js — sin build step ni framework SPA, sin dependencias de Node/webpack; los assets se sirven como estáticos desde Django (`static/js`, `static/css`, vía `STATICFILES_DIRS`).
- **Offline-first**: la app debe poder usarse sin conexión en el punto de recogida de la mudanza (pendiente de implementar).

## Arquitectura

- `config/` — settings, urls, wsgi/asgi del proyecto Django. `config/urls.py` incluye las URLs de la app `mudanzas` en la raíz (`path("", include("mudanzas.urls"))`).
- `mudanzas/` — única app Django del proyecto. Aquí vivirán el modelo `Mudanza` (cliente, direcciones de origen/destino, inventario, estado), las vistas de listado/alta/edición/detalle-impresión, y los templates HTML con HTMX/Alpine en `mudanzas/templates/mudanzas/`.
- `static/js/` — JS vanilla, `htmx.min.js`, `alpine.min.js` y el `service-worker.js` para el modo offline (por añadir).

### Flujo offline previsto

1. Un Service Worker cachea el HTML/CSS/JS al cargar la app para poder trabajar sin conexión.
2. Los formularios rellenados sin conexión se guardan en IndexedDB/localStorage con un id temporal y estado `pendiente de sincronizar`.
3. Al recuperar conexión, la app envía los formularios pendientes al backend Django (vía `fetch`/HTMX), que los persiste y confirma la sincronización.
4. El listado combina los formularios ya sincronizados (servidor) con los pendientes en local, indicando su estado.

### Funcionalidades clave (por implementar)

- Formulario de mudanza (datos del cliente, origen/destino, fecha, inventario, observaciones, firma/conformidad).
- Listado de todos los formularios con filtros básicos (fecha, cliente, estado).
- Alta y edición de formularios.
- Vista imprimible de cada formulario (PDF o `window.print()`).
