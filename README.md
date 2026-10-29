# Un viaje por la Escritura — juntos

El plan de lectura bíblica del itdar (29 oct 2026 – 23 oct 2027, 360 lecturas) en una página web para dos personas. Cada quien marca lo que lee, y ambos ven el avance y las notas del otro al momento. Funciona en iPhone y Android como app instalada (PWA) y también sin conexión.

- **Hoy**: la lectura del día con enlaces a Bible Gateway, la palabra para enfocar, el botón "Ya leí", si el otro ya leyó y las notas de ese día.
- **Juntos**: porcentaje, racha, lecturas atrasadas y un mapa de las 52 semanas de cada uno.
- **Plan**: las 10 temporadas en orden, con casillas por día, tus pendientes y los ajustes (versión de la Biblia, cerrar sesión).

Mientras `config.js` tenga `PEGA_AQUI`, la página funciona en **modo demostración** y lo que marques se queda en tu dispositivo. Para simular otra fecha, agrega `?hoy=2026-11-05` a la URL.

---

## 1. Crear el proyecto en Firebase (gratis)

1. Entra a <https://console.firebase.google.com> y elige **Agregar proyecto**, por ejemplo con el nombre `viaje-escritura`. Google Analytics no hace falta.
2. **Compilación → Firestore Database → Crear base de datos**. Elige una ubicación (por ejemplo `nam5` o `us-central`) y empieza en **modo de producción**.
3. En la pestaña **Reglas**, pega el contenido de [`firestore.rules`](firestore.rules) **con sus dos correos reales** y toca **Publicar**.
4. **Compilación → Authentication → Comenzar**. En la pestaña **Método de acceso**, activa:
   - **Google**, que es lo más fácil.
   - **Correo electrónico/contraseña**, como respaldo, porque el acceso con Google a veces falla en la app instalada en iPhone.
5. **Configuración del proyecto** (el engrane) → **Tus apps** → ícono **`</>`** (Web). Regístrala sin Hosting y copia el objeto `firebaseConfig`.
6. Pega ese objeto en [`config.js`](config.js) y pon ahí también los correos y nombres de ustedes dos.

> La `apiKey` de Firebase no es secreta: identifica al proyecto, y quién entra lo deciden las reglas. Por eso es seguro tenerla en un repositorio público.

## 2. Publicar en GitHub Pages

```bash
git remote add origin https://github.com/TU_USUARIO/viaje-escritura.git
```

```bash
git push -u origin main
```

En GitHub, ve al repositorio → **Settings → Pages → Source: Deploy from a branch → `main` / `(root)`** y guarda. En uno o dos minutos queda en `https://TU_USUARIO.github.io/viaje-escritura/`.

Luego, en Firebase: **Authentication → Configuración → Dominios autorizados → Agregar dominio** → `TU_USUARIO.github.io`. Sin este paso, el acceso con Google falla.

## 3. Instalar en el iPhone

1. Abre la URL en **Safari**. Tiene que ser Safari, no Chrome.
2. Toca **Compartir → Agregar a pantalla de inicio**.
3. Abre la app desde el ícono y entra con Google, o con correo y contraseña. Si usa correo, le llegará un mensaje para confirmar la cuenta.

## Publicar cambios

Cada vez que cambies algo, sube la versión en `sw.js` (`viaje-v1` → `viaje-v2`) antes de hacer push. Así los teléfonos descargan la versión nueva.

## Cómo se guardan los datos

Firestore tiene una colección `lectores` con un documento por persona (su `uid`):

```json
{ "nombre": "Jona", "email": "…", "version": "RVR1960",
  "leidos": { "1": "2026-10-29", "2": "2026-10-30" },
  "notas":  { "1": "Lo que me habló hoy…" } }
```

Las reglas dejan que los dos lean ambos documentos, pero cada quien solo puede escribir el suyo.

`plan.json` es una copia de `itdarCompleto/frontend/src/app/shared/viaje/plan-viaje.json`.
