// Plan "Un viaje por la Escritura" para dos lectores, con avance compartido en Firestore.
// plan.json es una copia de itdar (frontend/src/app/shared/viaje/plan-viaje.json).
import { firebaseConfig, lectores as NOMBRES } from './config.js';

const FB = 'https://www.gstatic.com/firebasejs/10.14.1/';
/** El viaje empieza en la temporada 8 (Cristo); el número sigue el orden de la historia bíblica. */
const ORDEN_VIAJE = [8, 1, 2, 3, 4, 5, 6, 7, 9, 10];
const VERSIONES = [
  ['RVR1960', 'Reina-Valera 1960'],
  ['NVI', 'Nueva Versión Internacional'],
  ['NTV', 'Nueva Traducción Viviente'],
  ['LBLA', 'La Biblia de las Américas'],
  ['DHH', 'Dios Habla Hoy'],
  ['TLA', 'Traducción en Lenguaje Actual'],
];
const DIA_MS = 86_400_000;
const NOMBRE_VISTA = { hoy: 'Hoy', juntos: 'Juntos', plan: 'Plan' };

const $app = document.getElementById('app');
const estado = {
  plan: null, yo: null, lectores: {}, demo: false,
  vista: leer('vista') || 'hoy', diaVisto: null, nHoy: null,
  soloPendientes: false, abiertas: new Set(), borradores: {},
};
let backend = null;

/* ---------- Utilidades ---------- */

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function leer(k) { try { return localStorage.getItem('viaje.' + k); } catch { return null; } }
function escribir(k, v) { try { v == null ? localStorage.removeItem('viaje.' + k) : localStorage.setItem('viaje.' + k, v); } catch { /* sin almacenamiento */ } }

const aFecha = iso => { const [a, m, d] = iso.split('-').map(Number); return new Date(a, m - 1, d); };
const isoDe = f => `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
/** Fecha local de hoy; `?hoy=2026-11-05` en la URL la simula para probar. */
function hoyLocal() {
  const simulada = new URLSearchParams(location.search).get('hoy');
  if (simulada && /^\d{4}-\d{2}-\d{2}$/.test(simulada)) return aFecha(simulada);
  const h = new Date();
  return new Date(h.getFullYear(), h.getMonth(), h.getDate());
}
/** Número de día del plan: < 1 antes de empezar, > 360 después de terminar. */
const numeroHoy = () => Math.round((hoyLocal() - aFecha(estado.plan.inicio)) / DIA_MS) + 1;
const fmtFecha = (iso, opts = { weekday: 'long', day: 'numeric', month: 'long' }) => aFecha(iso).toLocaleDateString('es-MX', opts);
const fmtCorta = iso => fmtFecha(iso, { day: 'numeric', month: 'short' });
const enlaceBiblia = (ref, v) => `https://www.biblegateway.com/passage/?search=${encodeURIComponent(ref)}&version=${encodeURIComponent(v)}`;
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

const temporada = n => estado.plan.temporadas.find(t => t.numero === n);
const mio = () => estado.lectores[estado.yo.uid] || { leidos: {}, notas: {} };
const miVersion = () => mio().version || 'RVR1960';
/** Yo primero y luego los demás por nombre. */
const ordenLectores = () => Object.values(estado.lectores)
  .sort((a, b) => (b.uid === estado.yo.uid) - (a.uid === estado.yo.uid) || String(a.nombre).localeCompare(b.nombre));

function aviso(texto) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = texto;
  document.body.append(t);
  setTimeout(() => t.remove(), 2600);
}

/* ---------- Cifras de un lector ---------- */

function resumen(lector, nHoy) {
  const total = estado.plan.dias.length;
  const leidos = new Set(Object.keys(lector.leidos || {}).map(Number));
  const hasta = Math.min(nHoy - 1, total);
  let pendientes = 0;
  for (let n = 1; n <= hasta; n++) if (!leidos.has(n)) pendientes++;
  let n = Math.min(nHoy, total);
  let racha = 0;
  if (n >= 1) {
    if (!leidos.has(n)) n -= 1; // hoy todavía no cuenta en contra
    while (n >= 1 && leidos.has(n)) { racha++; n--; }
  }
  return { leidos: leidos.size, porcentaje: Math.round((leidos.size / total) * 100), pendientes, racha };
}

/** Nivel por semana: -1 sin empezar, 0 nada leído de lo que tocaba, 1–4 según la proporción. */
function nivelesPorSemana(lector, nHoy) {
  const leidos = lector.leidos || {};
  return estado.plan.semanas.map(s => {
    const dias = estado.plan.dias.filter(d => d.semana === s.numero);
    const tocaban = dias.filter(d => d.dia <= nHoy);
    const hechos = tocaban.filter(d => leidos[d.dia]).length;
    let nivel = -1;
    if (tocaban.length) nivel = hechos === 0 ? 0 : Math.max(1, Math.ceil((hechos / tocaban.length) * 4));
    return { semana: s, nivel, hechos, tocaban: tocaban.length, total: dias.length };
  });
}

/* ---------- Vistas ---------- */

function render() {
  if (!estado.yo) return;
  const n = numeroHoy();
  const total = estado.plan.dias.length;
  if (estado.nHoy !== n) { estado.nHoy = n; estado.diaVisto = Math.min(Math.max(n, 1), total); }
  const foco = document.activeElement?.id === 'nota';
  const vistas = { hoy: vistaHoy, juntos: vistaJuntos, plan: vistaPlan };
  $app.innerHTML = `
    ${estado.demo ? '<div class="banner">Modo demostración: Firebase aún no está conectado y lo que marques se queda en este dispositivo.</div>' : ''}
    <header class="cabecera"><p class="eyebrow">${esc(estado.plan.subtitulo)}</p><h1>${esc(estado.plan.titulo)}</h1></header>
    <main>${(vistas[estado.vista] || vistaHoy)(n)}</main>
    <nav class="pestanas">${Object.entries(NOMBRE_VISTA).map(([v, t]) =>
      `<button data-accion="vista" data-v="${v}" class="${estado.vista === v ? 'activa' : ''}">${t}</button>`).join('')}</nav>`;
  if (foco) document.getElementById('nota')?.focus();
}

function vistaHoy(n) {
  const P = estado.plan;
  const total = P.dias.length;
  const d = P.dias[estado.diaVisto - 1];
  const t = temporada(d.temporada);
  const s = P.semanas.find(x => x.numero === d.semana);
  const esHoy = d.dia === n;
  const yoLei = !!mio().leidos?.[d.dia];
  const pendientes = n > 1 ? resumen(mio(), n).pendientes : 0;
  const otros = ordenLectores().filter(l => l.uid !== estado.yo.uid);
  const borrador = estado.borradores[d.dia] ?? mio().notas?.[d.dia] ?? '';

  let previo = '';
  if (n < 1) previo = `<section class="tarjeta destacada"><p class="numero">${plural(1 - n, 'día', 'días')}</p>
    <p>para empezar el viaje, el ${fmtFecha(P.inicio)}.</p></section>`;
  else if (n > total) previo = `<section class="tarjeta destacada"><p class="numero">¡Viaje completo!</p>
    <p>El plan terminó el ${fmtFecha(P.fin)}. Pueden seguir marcando lo que les haya faltado.</p></section>`;

  return `${instalarIos()}${previo}
  <section class="tarjeta dia">
    <div class="navdia">
      <button class="flecha" data-accion="dia" data-d="${d.dia - 1}" ${d.dia <= 1 ? 'disabled' : ''} aria-label="Día anterior">‹</button>
      <div><p class="eyebrow">${esHoy ? 'Hoy · ' : ''}Día ${d.dia} de ${total}</p><p class="fecha">${fmtFecha(d.fecha)}</p></div>
      <button class="flecha" data-accion="dia" data-d="${d.dia + 1}" ${d.dia >= total ? 'disabled' : ''} aria-label="Día siguiente">›</button>
    </div>
    ${!esHoy && n >= 1 && n <= total ? `<button class="enlace" data-accion="dia" data-d="${n}">Volver a hoy</button>` : ''}
    <p class="temporada">Temporada ${esc(t.nombre)} · Semana ${s.numero}</p>
    <ul class="lecturas">${d.lecturas.map(l =>
      `<li><a href="${enlaceBiblia(l.ref, miVersion())}" target="_blank" rel="noopener">${esc(l.texto)}<span aria-hidden="true">↗</span></a></li>`).join('')}</ul>
    <p class="enfocar"><span>Enfocar</span><strong>${esc(d.enfocar)}</strong></p>
    <button class="principal ${yoLei ? 'hecho' : ''}" data-accion="marcar" data-d="${d.dia}">${yoLei ? '✓ Leído' : 'Ya leí'}</button>
    <div class="chips">${ordenLectores().map(l => {
      const si = !!l.leidos?.[d.dia];
      return `<span class="chip ${si ? 'si' : ''}">${esc(l.nombre)} · ${si ? 'leído ✓' : 'pendiente'}</span>`;
    }).join('')}</div>
  </section>
  ${pendientes && esHoy ? `<button class="tarjeta alerta" data-accion="pendientes">Tienes ${plural(pendientes, 'lectura atrasada', 'lecturas atrasadas')}. Verlas →</button>` : ''}
  <section class="tarjeta notas">
    <h2>Lo que nos habló</h2>
    ${otros.map(l => l.notas?.[d.dia]
      ? `<blockquote><p>${esc(l.notas[d.dia])}</p><cite>${esc(l.nombre)}</cite></blockquote>`
      : `<p class="tenue">${esc(l.nombre)} aún no escribe nada de este día.</p>`).join('')}
    <label class="tenue" for="nota">Tu nota</label>
    <textarea id="nota" data-d="${d.dia}" rows="3" placeholder="Algo que quieras compartir de esta lectura…">${esc(borrador)}</textarea>
    <button class="secundario" data-accion="nota" data-d="${d.dia}">Guardar nota</button>
  </section>
  <section class="tarjeta contexto">
    <h2>Semana ${s.numero}: ${esc(s.titulo)}</h2><p>${esc(s.objetivo)}</p>
    <h2>${esc(t.nombre)}: ${esc(t.lema)}</h2><p>${esc(t.descripcion)}</p>
    <p class="pregunta">${esc(t.pregunta)}</p>
  </section>`;
}

function vistaJuntos(n) {
  const nEf = Math.min(Math.max(n, 0), estado.plan.dias.length);
  return ordenLectores().map(l => {
    const r = resumen(l, n);
    const celdas = nivelesPorSemana(l, nEf);
    return `<section class="tarjeta lector">
      <div class="lector-cabeza"><h2>${esc(l.nombre)}${l.uid === estado.yo.uid ? ' <span class="tenue">(tú)</span>' : ''}</h2>
        <p class="porcentaje">${r.porcentaje}%</p></div>
      <div class="barra" role="progressbar" aria-valuenow="${r.porcentaje}" aria-valuemin="0" aria-valuemax="100"><span style="width:${r.porcentaje}%"></span></div>
      <dl class="cifras">
        <div><dt>Leídos</dt><dd>${r.leidos}<small>/${estado.plan.dias.length}</small></dd></div>
        <div><dt>Racha</dt><dd>${r.racha}<small> ${r.racha === 1 ? 'día' : 'días'}</small></dd></div>
        <div><dt>Atrasados</dt><dd>${r.pendientes}</dd></div>
      </dl>
      <p class="tenue">Las 52 semanas del plan</p>
      <div class="semanas">${celdas.map(c =>
        `<span class="celda n${c.nivel}" title="Semana ${c.semana.numero}: ${esc(c.semana.titulo)} — ${c.hechos}/${c.total}"></span>`).join('')}</div>
    </section>`;
  }).join('') + `<p class="tenue centro">Cada cuadro es una semana: entre más oscuro, más al día.</p>`;
}

function vistaPlan(n) {
  const P = estado.plan;
  const leidos = mio().leidos || {};
  const otros = ordenLectores().filter(l => l.uid !== estado.yo.uid);
  const fila = d => {
    const si = !!leidos[d.dia];
    return `<li class="${d.dia === n ? 'hoy' : ''}">
      <button class="check ${si ? 'si' : ''}" data-accion="marcar" data-d="${d.dia}" aria-label="${si ? 'Desmarcar' : 'Marcar'} día ${d.dia}">${si ? '✓' : ''}</button>
      <button class="info" data-accion="ir" data-d="${d.dia}"><span class="num">${d.dia}</span><span class="fch">${fmtCorta(d.fecha)}</span><span class="txt">${d.lecturas.map(l => esc(l.texto)).join(' · ')}</span></button>
      ${otros.map(o => `<span class="punto ${o.leidos?.[d.dia] ? 'si' : ''}" title="${esc(o.nombre)}">${esc(String(o.nombre).charAt(0))}</span>`).join('')}
    </li>`;
  };

  let cuerpo;
  if (estado.soloPendientes) {
    const pend = P.dias.filter(d => d.dia < n && !leidos[d.dia]);
    cuerpo = pend.length
      ? `<section class="tarjeta"><h2>${plural(pend.length, 'lectura pendiente', 'lecturas pendientes')}</h2><ul class="dias">${pend.map(fila).join('')}</ul></section>`
      : '<section class="tarjeta"><p>Estás al día. 🙌</p></section>';
  } else {
    cuerpo = ORDEN_VIAJE.map(num => {
      const t = temporada(num);
      const dias = P.dias.filter(d => d.temporada === num);
      const hechos = dias.filter(d => leidos[d.dia]).length;
      const semanas = [...new Set(dias.map(d => d.semana))];
      const abierta = estado.abiertas.has(num) || (!estado.abiertas.size && dias.some(d => d.dia === n));
      return `<details class="tarjeta temporada-plan" data-t="${num}" ${abierta ? 'open' : ''}>
        <summary><div><h2>${esc(t.nombre)}</h2><p class="tenue">${esc(t.lema)} · ${fmtCorta(dias[0].fecha)} – ${fmtCorta(dias.at(-1).fecha)}</p></div>
          <span class="mini">${hechos}/${dias.length}</span></summary>
        ${semanas.map(sn => {
          const s = P.semanas.find(x => x.numero === sn);
          return `<h3>Semana ${sn}: ${esc(s.titulo)}</h3><ul class="dias">${dias.filter(d => d.semana === sn).map(fila).join('')}</ul>`;
        }).join('')}
      </details>`;
    }).join('');
  }

  return `<div class="filtro">
      <button class="${estado.soloPendientes ? '' : 'activa'}" data-accion="solo" data-v="0">Todo el plan</button>
      <button class="${estado.soloPendientes ? 'activa' : ''}" data-accion="solo" data-v="1">Mis pendientes</button>
    </div>
    ${cuerpo}
    <section class="tarjeta ajustes">
      <h2>Ajustes</h2>
      <label for="version">Versión de la Biblia</label>
      <select id="version">${VERSIONES.map(([v, nombre]) => `<option value="${v}" ${v === miVersion() ? 'selected' : ''}>${nombre}</option>`).join('')}</select>
      <p class="tenue">Entraste como ${esc(estado.yo.nombre)}${estado.yo.email && !estado.demo ? ` (${esc(estado.yo.email)})` : ''}.</p>
      <button class="secundario" data-accion="salir">${estado.demo ? 'Borrar datos de demostración' : 'Cerrar sesión'}</button>
    </section>`;
}

function instalarIos() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const instalada = navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  if (!ios || instalada || leer('sinInstalar')) return '';
  return `<section class="tarjeta pista"><p><strong>Instálala en tu iPhone:</strong> toca Compartir <span aria-hidden="true">⎋</span> y luego “Agregar a pantalla de inicio”.</p>
    <button class="enlace" data-accion="ocultar-instalar">Entendido</button></section>`;
}

function pantallaAcceso(mensaje = '', modo = 'login') {
  const P = estado.plan;
  let cuerpo;
  if (modo === 'verificar') {
    cuerpo = `<button class="principal" data-accion="recargar">Ya confirmé mi correo</button>
      <button class="secundario" data-accion="salir">Usar otra cuenta</button>`;
  } else if (modo === 'denegado') {
    cuerpo = '<button class="secundario" data-accion="salir">Usar otra cuenta</button>';
  } else {
    cuerpo = `<button class="principal" data-accion="google">Entrar con Google</button>
      <p class="separador"><span>o con correo</span></p>
      <form id="acceso">
        <input type="email" name="email" required autocomplete="email" placeholder="Correo">
        <input type="password" name="pass" required minlength="6" autocomplete="current-password" placeholder="Contraseña">
        <div class="fila"><button type="submit" value="entrar">Entrar</button><button type="submit" value="registrar" class="secundario">Crear cuenta</button></div>
      </form>`;
  }
  $app.innerHTML = `<section class="acceso">
    <p class="eyebrow">${esc(P.subtitulo)}</p><h1>${esc(P.titulo)}</h1>
    <p class="tenue">${fmtFecha(P.inicio, { day: 'numeric', month: 'long', year: 'numeric' })} – ${fmtFecha(P.fin, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
    ${mensaje ? `<p class="mensaje">${esc(mensaje)}</p>` : ''}
    <div class="tarjeta">${cuerpo}</div>
  </section>`;
}

/* ---------- Eventos ---------- */

$app.addEventListener('click', async e => {
  const b = e.target.closest('[data-accion]');
  if (!b) return;
  const d = Number(b.dataset.d);
  switch (b.dataset.accion) {
    case 'vista':
      estado.vista = b.dataset.v; escribir('vista', estado.vista); render(); scrollTo(0, 0); break;
    case 'dia':
      estado.diaVisto = d; render(); break;
    case 'ir':
      estado.diaVisto = d; estado.vista = 'hoy'; render(); scrollTo(0, 0); break;
    case 'marcar':
      backend.guardar({ leidos: { [d]: mio().leidos?.[d] ? null : isoDe(new Date()) } }); break;
    case 'nota': {
      const texto = document.getElementById('nota').value.trim();
      delete estado.borradores[d];
      backend.guardar({ notas: { [d]: texto || null } });
      aviso(texto ? 'Nota guardada' : 'Nota borrada');
      break;
    }
    case 'pendientes':
      estado.vista = 'plan'; estado.soloPendientes = true; render(); scrollTo(0, 0); break;
    case 'solo':
      estado.soloPendientes = b.dataset.v === '1'; render(); break;
    case 'ocultar-instalar':
      escribir('sinInstalar', '1'); render(); break;
    case 'salir': backend.salir(); break;
    case 'recargar': backend.recargar(); break;
    case 'google':
      try { await backend.google(); } catch (err) { pantallaAcceso(errorAuth(err)); }
      break;
  }
});

$app.addEventListener('submit', async e => {
  if (e.target.id !== 'acceso') return;
  e.preventDefault();
  const datos = new FormData(e.target);
  const email = String(datos.get('email')).trim();
  const pass = String(datos.get('pass'));
  try {
    if (e.submitter?.value === 'registrar') await backend.registrar(email, pass);
    else await backend.entrar(email, pass);
  } catch (err) { pantallaAcceso(errorAuth(err)); }
});

$app.addEventListener('input', e => {
  if (e.target.id === 'nota') estado.borradores[e.target.dataset.d] = e.target.value;
});

$app.addEventListener('change', e => {
  if (e.target.id === 'version') backend.guardar({ version: e.target.value });
});

$app.addEventListener('toggle', e => {
  const t = Number(e.target.dataset?.t);
  if (!t) return;
  if (e.target.open) estado.abiertas.add(t); else estado.abiertas.delete(t);
}, true);

// Al volver a la app otro día, salta a la lectura nueva.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && estado.yo && estado.nHoy !== numeroHoy()) render();
});

function errorAuth(err) {
  const textos = {
    'auth/invalid-credential': 'Correo o contraseña incorrectos.',
    'auth/wrong-password': 'Correo o contraseña incorrectos.',
    'auth/user-not-found': 'No hay una cuenta con ese correo; usa “Crear cuenta”.',
    'auth/email-already-in-use': 'Ese correo ya tiene cuenta; usa “Entrar”.',
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
    'auth/popup-closed-by-user': 'Se cerró la ventana de Google antes de terminar.',
    'auth/popup-blocked': 'El navegador bloqueó la ventana de Google; intenta con correo.',
    'auth/network-request-failed': 'Sin conexión. Intenta de nuevo.',
  };
  return textos[err?.code] || `No se pudo entrar (${err?.code || err?.message || err}).`;
}

/* ---------- Backend: Firebase ---------- */

async function iniciarFirebase() {
  const [{ initializeApp }, A, F] = await Promise.all(
    ['firebase-app.js', 'firebase-auth.js', 'firebase-firestore.js'].map(m => import(FB + m)));
  const app = initializeApp(firebaseConfig);
  const auth = A.getAuth(app);
  auth.languageCode = 'es';
  // Caché local: se puede marcar sin internet y se sube al reconectar.
  const db = F.initializeFirestore(app, {
    localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }),
  });
  /** null en un campo de mapa significa "bórralo". */
  const aFirestore = cambios => Object.fromEntries(Object.entries(cambios).map(([k, v]) =>
    [k, v && typeof v === 'object'
      ? Object.fromEntries(Object.entries(v).map(([k2, v2]) => [k2, v2 === null ? F.deleteField() : v2]))
      : v]));
  const sinAcceso = email => {
    estado.yo = null;
    pantallaAcceso(`La cuenta ${email} no tiene acceso a este plan.`, 'denegado');
  };

  let desuscribir = null;
  backend = {
    guardar(cambios) {
      F.setDoc(F.doc(db, 'lectores', estado.yo.uid), aFirestore(cambios), { merge: true })
        .catch(err => aviso('No se pudo guardar: ' + (err.code || err.message)));
    },
    salir: () => A.signOut(auth),
    google: () => A.signInWithPopup(auth, new A.GoogleAuthProvider()),
    entrar: (email, pass) => A.signInWithEmailAndPassword(auth, email, pass),
    async registrar(email, pass) {
      const cred = await A.createUserWithEmailAndPassword(auth, email, pass);
      await A.sendEmailVerification(cred.user);
    },
    async recargar() { await auth.currentUser?.reload(); location.reload(); },
  };

  A.onAuthStateChanged(auth, user => {
    desuscribir?.();
    desuscribir = null;
    estado.lectores = {};
    estado.yo = null;
    if (!user) { pantallaAcceso(); return; }
    if (!user.emailVerified) {
      pantallaAcceso(`Te enviamos un correo a ${user.email}. Confírmalo y luego toca el botón.`, 'verificar');
      return;
    }
    const email = user.email.toLowerCase();
    const nombre = NOMBRES[email] || user.displayName || email.split('@')[0];
    estado.yo = { uid: user.uid, email, nombre };
    estado.lectores[user.uid] = { uid: user.uid, nombre, email, leidos: {}, notas: {} };
    F.setDoc(F.doc(db, 'lectores', user.uid), { nombre, email }, { merge: true })
      .catch(err => { if (err.code === 'permission-denied') sinAcceso(email); });
    desuscribir = F.onSnapshot(F.collection(db, 'lectores'), snap => {
      if (!estado.yo) return;
      const nuevos = { [user.uid]: { uid: user.uid, nombre, email, leidos: {}, notas: {} } };
      snap.forEach(d => { nuevos[d.id] = { uid: d.id, leidos: {}, notas: {}, ...d.data() }; });
      estado.lectores = nuevos;
      render();
    }, err => (err.code === 'permission-denied' ? sinAcceso(email) : aviso('Error de conexión: ' + err.code)));
    render();
  });
}

/* ---------- Backend: demostración (sin Firebase) ---------- */

function iniciarDemo() {
  let datos;
  try { datos = JSON.parse(leer('demo')); } catch { datos = null; }
  datos ||= {
    yo: { uid: 'yo', nombre: 'Yo', leidos: {}, notas: {} },
    amiga: { uid: 'amiga', nombre: 'Tu amiga', leidos: { 1: '2026-10-29', 2: '2026-10-30', 3: '2026-10-31' },
      notas: { 1: 'Me encantó empezar con la genealogía: Dios cumple sus promesas.' } },
  };
  const publicar = () => { escribir('demo', JSON.stringify(datos)); estado.lectores = { ...datos }; render(); };
  estado.demo = true;
  estado.yo = { uid: 'yo', nombre: 'Yo' };
  backend = {
    guardar(cambios) {
      for (const [campo, valor] of Object.entries(cambios)) {
        if (valor && typeof valor === 'object') {
          datos.yo[campo] ||= {};
          for (const [k, v] of Object.entries(valor)) { if (v === null) delete datos.yo[campo][k]; else datos.yo[campo][k] = v; }
        } else datos.yo[campo] = valor;
      }
      publicar();
    },
    salir() { escribir('demo', null); location.reload(); },
    recargar() { location.reload(); },
  };
  publicar();
}

/* ---------- Arranque ---------- */

(async function iniciar() {
  try {
    estado.plan = await (await fetch('plan.json')).json();
  } catch {
    $app.innerHTML = '<p class="cargando">No se pudo cargar el plan. Revisa tu conexión.</p>';
    return;
  }
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  if (!firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith('PEGA')) { iniciarDemo(); return; }
  try {
    await iniciarFirebase();
  } catch (err) {
    $app.innerHTML = `<p class="cargando">No se pudo conectar con Firebase: ${esc(err.message)}</p>`;
  }
})();
