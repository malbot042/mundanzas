(() => {
    const DB_NAME = "mudanzas-offline";
    const DB_VERSION = 1;
    const STORE_NAME = "pendientes";
    const SYNC_URL = "/api/sync/";

    function openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: "client_uuid" });
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async function savePending(data) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            tx.objectStore(STORE_NAME).put(data);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async function removePending(clientUuid) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            tx.objectStore(STORE_NAME).delete(clientUuid);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async function listPending() {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readonly");
            const request = tx.objectStore(STORE_NAME).getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    function getCookie(name) {
        const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
        return match ? decodeURIComponent(match[1]) : null;
    }

    function formToObject(form) {
        const data = {};
        new FormData(form).forEach((value, key) => {
            if (key !== "csrfmiddlewaretoken") data[key] = value;
        });
        return data;
    }

    async function guardarOffline(form) {
        const data = formToObject(form);
        if (!data.client_uuid) {
            data.client_uuid = crypto.randomUUID();
        }
        await savePending(data);
        sessionStorage.setItem(
            "mudanzas:mensaje",
            "Mudanza guardada sin conexión. Se sincronizará automáticamente cuando vuelva la conexión."
        );
        window.location.href = "/";
    }

    async function flush() {
        if (!navigator.onLine) return;
        const pendientes = await listPending();
        let sincronizadas = 0;
        for (const item of pendientes) {
            try {
                const response = await fetch(SYNC_URL, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRFToken": getCookie("csrftoken"),
                    },
                    body: JSON.stringify(item),
                });
                if (response.ok) {
                    await removePending(item.client_uuid);
                    sincronizadas += 1;
                }
            } catch (error) {
                break; // seguimos sin conexión real, se reintentará más tarde
            }
        }
        if (sincronizadas > 0) {
            document.dispatchEvent(
                new CustomEvent("mudanzas:sync", { detail: { sincronizadas } })
            );
        }
    }

    function actualizarIndicador() {
        const el = document.querySelector("[data-offline-indicator]");
        if (!el) return;
        el.textContent = navigator.onLine ? "En línea" : "Sin conexión";
        el.classList.toggle("badge--offline", !navigator.onLine);
        el.classList.toggle("badge--online", navigator.onLine);
    }

    function mostrarMensajePendiente() {
        const mensaje = sessionStorage.getItem("mudanzas:mensaje");
        if (!mensaje) return;
        sessionStorage.removeItem("mudanzas:mensaje");
        let lista = document.querySelector(".messages");
        if (!lista) {
            lista = document.createElement("ul");
            lista.className = "messages";
            document.querySelector("main").prepend(lista);
        }
        const item = document.createElement("li");
        item.className = "message message--info";
        item.textContent = mensaje;
        lista.prepend(item);
    }

    function registrarFormularios() {
        document.querySelectorAll("form[data-offline-form]").forEach((form) => {
            const clientUuidField = form.querySelector('input[name="client_uuid"]');
            if (clientUuidField && !clientUuidField.value) {
                clientUuidField.value = crypto.randomUUID();
            }
            form.addEventListener("submit", (event) => {
                if (navigator.onLine) return; // envío normal al servidor
                event.preventDefault();
                guardarOffline(form);
            });
        });
    }

    window.mudanzasOffline = { listPending, flush };

    document.addEventListener("DOMContentLoaded", () => {
        if ("serviceWorker" in navigator) {
            navigator.serviceWorker.register("/service-worker.js").catch(() => {});
        }
        registrarFormularios();
        actualizarIndicador();
        mostrarMensajePendiente();
        flush();
    });

    window.addEventListener("online", () => {
        actualizarIndicador();
        flush();
    });
    window.addEventListener("offline", actualizarIndicador);
})();
