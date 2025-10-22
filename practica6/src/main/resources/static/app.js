// app.js - UI mínimo + IndexedDB outbox + sync
// Backend esperado:
// GET  ${API_BASE}/tareas            -> lista de tareas
// POST ${API_BASE}/tareas           -> crear tarea (acepta clientId opcional)
// PUT  ${API_BASE}/tareas/{id}      -> actualizar tarea (opcional)
// PUT  ${API_BASE}/tareas/{id}/completada -> actualizar completada
// DELETE ${API_BASE}/tareas/{id}    -> eliminar tarea

const API_BASE = '/apiTarea';
const dbName = 'agenda-db';
const dbVersion = 1;

// ---------- IndexedDB helpers ----------
function openDB() {
    return new Promise((res, rej) => {
        const req = indexedDB.open(dbName, dbVersion);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains('tasks')) db.createObjectStore('tasks', { keyPath: 'id' });
            if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { autoIncrement: true });
        };
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
    });
}

async function putTaskToDB(task) {
    const db = await openDB();
    const tx = db.transaction('tasks', 'readwrite');
    tx.objectStore('tasks').put(task);
    return tx.complete;
}

async function getAllTasksFromDB() {
    const db = await openDB();
    return new Promise(res => {
        const tx = db.transaction('tasks', 'readonly');
        const req = tx.objectStore('tasks').getAll();
        req.onsuccess = () => res(req.result || []);
    });
}

async function clearTasksDB() {
    const db = await openDB();
    const tx = db.transaction('tasks', 'readwrite');
    tx.objectStore('tasks').clear();
    return tx.complete;
}

// Outbox
async function addToOutbox(op) {
    const db = await openDB();
    const tx = db.transaction('outbox', 'readwrite');
    tx.objectStore('outbox').add(op);
    return tx.complete;
}

async function getOutbox() {
    const db = await openDB();
    return new Promise(res => {
        const tx = db.transaction('outbox', 'readonly');
        const req = tx.objectStore('outbox').getAll();
        req.onsuccess = () => res(req.result || []);
    });
}

async function clearOutbox() {
    const db = await openDB();
    const tx = db.transaction('outbox', 'readwrite');
    tx.objectStore('outbox').clear();
    return tx.complete;
}

// ---------- UI ----------
const tasksEl = document.getElementById('tasks');
const infoEl = document.getElementById('info');
const statusEl = document.getElementById('online-status');

function setStatus() {
    statusEl.textContent = navigator.onLine ? 'En línea' : 'Sin conexión';
    statusEl.style.color = navigator.onLine ? 'green' : '#c33';
}
window.addEventListener('online', () => {
    setStatus();
    tryRegisterSync();
    syncOutbox();
});
window.addEventListener('offline', setStatus);
setStatus();

function renderTasks(tasks) {
    if (!tasks.length) infoEl.textContent = 'No hay tareas';
    else infoEl.textContent = '';
    tasksEl.innerHTML = '';
    tasks.forEach(t => {
        const div = document.createElement('div');
        div.className = 'task' + (t.completada ? ' completed' : '');
        div.innerHTML = `
      <input type="checkbox" data-id="${t.id}" ${t.completada ? 'checked' : ''}>
      <div style="flex:1">
        <div>${escapeHtml(t.titulo)}</div>
        <div class="meta">${t.clientId ? '(pendiente sync)' : ''} ${new Date(t.createdAt || t.createdAtServer || Date.now()).toLocaleString()}</div>
      </div>
      <button data-delete="${t.id}">Borrar</button>
    `;
        tasksEl.appendChild(div);
    });
}
function escapeHtml(s){ return (s||'').toString().replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// ---------- API wrapper ----------
async function apiFetch(path, opts = {}) {
    const method = opts.method || 'GET';
    const fetchOpts = { method, headers: {} };
    if (opts.body !== undefined && opts.body !== null) {
        fetchOpts.headers['Content-Type'] = 'application/json';
        fetchOpts.body = opts.body;
    }
    const res = await fetch(path, fetchOpts);
    if (!res.ok) throw new Error('API error ' + res.status);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
}

// ---------- Sync logic ----------
async function refreshTasks() {
    try {
        const serverTasks = await apiFetch(`${API_BASE}/tareas`);
        await clearTasksDB();
        for (const s of serverTasks) {
            const task = {
                id: s.idTarea || s.id || generateUuidShort(),
                titulo: s.titulo,
                completada: !!s.completada,
                createdAtServer: s.createdAt || s.created_at
            };
            await putTaskToDB(task);
        }
        const tasks = await getAllTasksFromDB();
        renderTasks(tasks);
    } catch (err) {
        console.warn('No se pudo refrescar desde servidor, usando caché', err);
        const tasks = await getAllTasksFromDB();
        renderTasks(tasks);
    }
}

async function syncOutbox() {
    const out = await getOutbox();
    if (!out.length) {
        if (navigator.onLine) await refreshTasks();
        return;
    }
    for (const op of out) {
        try {
            // Build fetch options: only include body when necessary
            if (op.method === 'POST') {
                const res = await apiFetch(op.url, { method: 'POST', body: JSON.stringify(op.body) });
                if (res && res.idTarea) {
                    await replaceLocalTaskId(op.body.id, res.idTarea, res);
                }
            } else if (op.method === 'PUT') {
                // PUT for completada or full update - op.body may be null for some deletes (but here it's PUT so body expected)
                await apiFetch(op.url, { method: 'PUT', body: JSON.stringify(op.body) });
            } else if (op.method === 'DELETE') {
                // Do not send body with DELETE
                await apiFetch(op.url, { method: 'DELETE' });
            } else {
                // fallback
                await apiFetch(op.url, { method: op.method, body: op.body ? JSON.stringify(op.body) : null });
            }
        } catch (err) {
            console.error('Fallo al sincronizar operación', op, err);
            return; // stop on first failure
        }
    }
    await clearOutbox();
    await refreshTasks();
}

async function replaceLocalTaskId(clientId, serverId, serverTask) {
    const db = await openDB();
    const tx = db.transaction('tasks', 'readwrite');
    const store = tx.objectStore('tasks');
    const req = store.get(clientId);
    req.onsuccess = async () => {
        const local = req.result;
        if (local) {
            local.id = serverId;
            delete local.clientId;
            if (serverTask.titulo) local.titulo = serverTask.titulo;
            if (serverTask.completada !== undefined) local.completada = serverTask.completada;
            store.delete(clientId);
            store.put(local);
        }
    };
    return tx.complete;
}

// ---------- UI actions (create, toggle, delete) ----------
document.getElementById('form').addEventListener('submit', async e => {
    e.preventDefault();
    const input = document.getElementById('title');
    const title = input.value.trim();
    if (!title) return;
    input.value = '';
    const clientId = generateUuidShort();
    const task = {
        id: clientId,
        titulo: title,
        completada: false,
        createdAt: Date.now(),
        clientId
    };
    await putTaskToDB(task);
    renderTasks(await getAllTasksFromDB());

    try {
        if (navigator.onLine) {
            const res = await apiFetch(`${API_BASE}/tareas`, { method: 'POST', body: JSON.stringify(task) });
            if (res && res.idTarea) await replaceLocalTaskId(clientId, res.idTarea, res);
            await refreshTasks();
        } else {
            await addToOutbox({ method: 'POST', url: `${API_BASE}/tareas`, body: task });
            infoEl.textContent = 'Tarea creada localmente y pendiente de sincronizar';
            tryRegisterSync();
        }
    } catch (err) {
        console.warn('Creación falló, guardando en outbox', err);
        await addToOutbox({ method: 'POST', url: `${API_BASE}/tareas`, body: task });
        infoEl.textContent = 'Tarea creada localmente y pendiente de sincronizar';
        tryRegisterSync();
    }
});

tasksEl.addEventListener('change', async e => {
    if (!e.target.matches('input[type="checkbox"]')) return;
    const id = e.target.dataset.id;
    const completed = e.target.checked;
    const db = await openDB();
    const tx = db.transaction('tasks', 'readwrite');
    const store = tx.objectStore('tasks');
    const req = store.get(id);
    req.onsuccess = async () => {
        const t = req.result;
        if (!t) return;
        t.completada = completed;
        await store.put(t);
        renderTasks(await getAllTasksFromDB());

        // Use the completada endpoint your controller exposes
        const url = `${API_BASE}/tareas/${id}/completada`;
        const op = { method: 'PUT', url, body: { completada: completed } };

        try {
            if (navigator.onLine) {
                await apiFetch(url, { method: 'PUT', body: JSON.stringify(op.body) });
                await refreshTasks();
            } else {
                await addToOutbox(op);
                infoEl.textContent = 'Cambio guardado localmente y pendiente de sincronizar';
                tryRegisterSync();
            }
        } catch (err) {
            console.warn('No se pudo actualizar en servidor, se guarda en outbox', err);
            await addToOutbox(op);
            tryRegisterSync();
        }
    };
});

tasksEl.addEventListener('click', async e => {
    if (!e.target.matches('button[data-delete]')) return;
    const id = e.target.getAttribute('data-delete');
    const db = await openDB();
    const tx = db.transaction('tasks', 'readwrite');
    tx.objectStore('tasks').delete(id);
    await tx.complete;
    renderTasks(await getAllTasksFromDB());

    const op = { method: 'DELETE', url: `${API_BASE}/tareas/${id}`, body: null };
    try {
        if (navigator.onLine) {
            await apiFetch(op.url, { method: 'DELETE' });
            await refreshTasks();
        } else {
            await addToOutbox(op);
            infoEl.textContent = 'Eliminación pendiente de sincronizar';
            tryRegisterSync();
        }
    } catch (err) {
        console.warn('Delete failed, queued', err);
        await addToOutbox(op);
        tryRegisterSync();
    }
});

// ---------- Setup: register service worker and listen messages ----------
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            const reg = await navigator.serviceWorker.register('/service-worker.js');
            console.log('SW registrado', reg.scope);
        } catch (err) {
            console.warn('No se pudo registrar SW', err);
        }
    });

    navigator.serviceWorker.addEventListener('message', event => {
        const msg = event.data;
        if (!msg) return;
        if (msg.type === 'SYNC_OUTBOX') {
            syncOutbox();
        }
    });
}

async function tryRegisterSync() {
    if (!('serviceWorker' in navigator) || !('SyncManager' in window)) return;
    try {
        const reg = await navigator.serviceWorker.ready;
        await reg.sync.register('sync-outbox');
        console.log('sync-outbox registrado');
    } catch (err) {
        console.warn('No se pudo registrar background sync', err);
    }
}

refreshTasks();

function generateUuidShort() {
    return 'c-' + Math.random().toString(36).slice(2, 9);
}