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
- **Offline-first**: Service Worker + almacenamiento local (IndexedDB / localStorage) para cachear la app y encolar los formularios pendientes de sincronizar (pendiente de implementar).
- **Sin dependencias de compilación**: no se requiere Node/webpack para el frontend; los assets se sirven directamente desde Django (estáticos).

## Estructura del proyecto

```
mudanceslaselva/
├── manage.py
├── pyproject.toml          # dependencias gestionadas con uv
├── uv.lock
├── db.sqlite3               # base de datos SQLite (no versionada)
├── config/                  # settings, urls, wsgi/asgi del proyecto Django
├── mudanzas/                 # app Django: modelos, vistas, formularios, API
│   ├── models.py             # (pendiente) modelo Mudanza (cliente, direcciones, inventario, estado...)
│   ├── views.py               # (pendiente) listado, alta, edición, detalle/impresión
│   ├── urls.py
│   └── templates/mudanzas/    # templates HTML con HTMX/Alpine (pendiente)
├── static/
│   ├── js/                    # JS vanilla, htmx.min.js, alpine.min.js, service-worker.js (pendiente)
│   └── css/
└── README.md
```

> El proyecto Django y el entorno ya están inicializados. El modelo `Mudanza`, las vistas de listado/alta/edición/impresión y el frontend HTMX/Alpine todavía están por implementar.

## Puesta en marcha

```bash
uv sync                        # instala Python 3.12 y las dependencias (Django 6, etc.)
uv run python manage.py migrate
uv run python manage.py createsuperuser
uv run python manage.py runserver
```

## Flujo offline (previsto)

1. Al cargar la app, un Service Worker cachea el HTML/CSS/JS necesarios para trabajar sin conexión.
2. Los formularios rellenados sin conexión se guardan en IndexedDB/localStorage con un identificador temporal y un estado `pendiente de sincronizar`.
3. Al recuperar la conexión, la app envía (vía `fetch`/HTMX) los formularios pendientes al backend Django, que los persiste y confirma la sincronización.
4. El listado de formularios combina los datos ya sincronizados (desde el servidor) con los que aún están pendientes en local, indicando su estado.
