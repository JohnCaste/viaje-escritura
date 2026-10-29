// 1) Configuración de la app web de Firebase
//    (Consola de Firebase → Configuración del proyecto → Tus apps → SDK config).
//    Si apiKey dice "PEGA_AQUI" la página funciona en modo demostración, solo en el dispositivo.
export const firebaseConfig = {
  apiKey: 'AIzaSyCxcp2_mr8QmgVQ-0bf3pfnZ5EDYnOYF8U',
  authDomain: 'viaje-escritura.firebaseapp.com',
  projectId: 'viaje-escritura',
  storageBucket: 'viaje-escritura.firebasestorage.app',
  messagingSenderId: '508819721425',
  appId: '1:508819721425:web:eae7f60ab4ae6e33dd49f0',
};

// 2) Nombre que verá cada quien. El acceso real lo decide firestore.rules, no esta lista.
export const lectores = {
  'johncastehdez@gmail.com': 'Jona',
  'floresdanna496@gmail.com': 'Danna',
};
