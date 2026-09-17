# Cómo funciona el modo offline

Este documento explica el mecanismo que permite rellenar y guardar el formulario de una
mudanza sin conexión, y cómo se sincroniza con el backend cuando vuelve la red.

Hay dos piezas independientes, con responsabilidades separadas:

- **Service Worker** (`static/js/service-worker.js`) — que la propia *app* (HTML/CSS/JS)
  cargue sin internet.
- **IndexedDB + `client_uuid`** (`static/js/offline.js`) — que los datos capturados sin
  internet no se pierdan y se sincronicen sin duplicarse en cuanto vuelva la conexión.

## 1. Almacenamiento en el navegador: IndexedDB

`static/js/offline.js` abre una base de datos IndexedDB propia de la app:

```js
const DB_NAME = "mudanzas-offline";
const STORE_NAME = "pendientes";   // object store con keyPath: "client_uuid"
```

Cada mudanza guardada sin conexión es un registro JSON (nombre, teléfono, direcciones,
fecha, etc.) dentro de ese *object store*, indexado por `client_uuid`. Se usa IndexedDB en
vez de `localStorage` porque:

- guarda objetos estructurados sin serializar/deserializar strings a mano,
- persiste entre cierres de pestaña/navegador,
- no tiene el límite de ~5MB por dominio típico de `localStorage`,
- las operaciones son asíncronas y no bloquean el hilo principal.

## 2. El `client_uuid`: por qué existe y cómo se usa

Cada `Mudanza` tiene un campo `client_uuid`, generado **en el navegador**, no en el
servidor:

```js
if (!data.client_uuid) {
    data.client_uuid = crypto.randomUUID();
}
```

- En el formulario de **alta** (`mudanzas/templates/mudanzas/form.html`), el campo oculto
  `client_uuid` se rellena con un UUID nuevo en cuanto carga la página
  (`registrarFormularios()` en `offline.js`).
- En el formulario de **edición**, ese campo oculto ya trae el `client_uuid` real de la
  mudanza (definido en el modelo, `mudanzas/models.py`, con `default=uuid.uuid4`).

Ese mismo valor viaja tanto al guardarse en IndexedDB como, más tarde, al servidor. Así,
el backend (`api_sync` en `mudanzas/views.py`) puede hacer *upsert*:

```python
try:
    mudanza = Mudanza.objects.get(client_uuid=client_uuid)
    form = MudanzaForm(form_fields, instance=mudanza)  # actualiza
except Mudanza.DoesNotExist:
    form = MudanzaForm(form_fields)                    # crea
```

Esto es lo que hace segura la sincronización: si el envío se reintenta (la conexión se
corta a mitad de sincronizar, o el usuario reabre la app y `flush()` se ejecuta dos
veces), el `client_uuid` es el mismo, así que el servidor **actualiza el mismo registro
en vez de crear uno duplicado**.

## 3. Flujo completo, paso a paso

1. **Envío del formulario.** Al hacer submit, `offline.js` comprueba `navigator.onLine`:
   - **Con conexión** → deja que el formulario se envíe de forma normal (POST clásico a
     Django, sin intervención de JS).
   - **Sin conexión** → `event.preventDefault()`, convierte el `FormData` a un objeto
     plano y lo guarda en IndexedDB con `savePending(data)`. Luego redirige al listado
     mostrando un aviso ("guardado sin conexión") pasado por `sessionStorage`.

2. **Listado.** `list.html` renderiza desde Django los registros que ya están en la base
   de datos, y además tiene un bloque Alpine.js que al cargar llama a
   `window.mudanzasOffline.listPending()` — lee directamente el object store de IndexedDB
   y muestra esas mudanzas como "Pendientes de sincronizar", separadas de las que ya
   están guardadas en el servidor.

3. **Sincronización (`flush()`).** Se dispara en tres momentos: al cargar cualquier
   página, al detectar el evento `online` del navegador, y por tanto cada vez que el
   usuario visita el listado tras recuperar red. Recorre todos los pendientes en
   IndexedDB y por cada uno hace:

   ```js
   fetch("/api/sync/", {
       method: "POST",
       headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") },
       body: JSON.stringify(item),
   });
   ```

   Si el servidor responde OK, borra ese registro de IndexedDB (`removePending`) y
   dispara un evento `mudanzas:sync` que hace recargar el listado.

4. **Service Worker.** Servido en `/service-worker.js` (fuera de `/static/`, a propósito,
   para que su *scope* cubra toda la app y no solo `/static/js/`). Cachea el "app shell"
   (listado, `/nueva/`, y los estáticos) desde la instalación, y va cacheando cualquier
   otra página que se visite (edición, impresión) con una estrategia network-first y
   fallback a caché. Solo intercepta peticiones `GET`; los `POST` los deja pasar de largo,
   porque esos los gestiona `offline.js` con la lógica de los puntos 1–3.

## Resumen

| Pieza | Responsabilidad |
|---|---|
| Service Worker | Que la app (HTML/CSS/JS) cargue sin conexión |
| IndexedDB | Guardar en el navegador las mudanzas creadas/editadas sin conexión |
| `client_uuid` | Identificar cada mudanza de forma estable entre cliente y servidor, para que sincronizar no duplique registros |
| `api_sync` (backend) | Crear o actualizar (`upsert`) la `Mudanza` correspondiente a un `client_uuid` |

## Limitaciones conocidas

- `navigator.onLine` es una señal heurística del navegador: puede dar `true` aunque no
  haya salida real a internet (por ejemplo, conectado a una red sin acceso a la web). En
  ese caso el `fetch` de sincronización fallará y el registro simplemente queda pendiente
  para el siguiente intento — no se pierde información.
- La vista de impresión (`/<id>/imprimir/`) solo está disponible offline si esa página
  concreta ya fue visitada antes (y por tanto cacheada por el Service Worker); no se
  genera un PDF real, se usa `window.print()` del navegador.
