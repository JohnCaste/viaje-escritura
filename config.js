// 1) Pega aquí la configuración de tu app web de Firebase
//    (Consola de Firebase → Configuración del proyecto → Tus apps → SDK config).
//    Mientras apiKey diga "PEGA_AQUI" la página funciona en modo demostración, solo en el dispositivo.
export const firebaseConfig = {
  apiKey: 'PEGA_AQUI',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
};

// 2) Nombre que verá cada quien. El acceso real lo decide firestore.rules, no esta lista.
export const lectores = {
  'tucorreo@gmail.com': 'Jona',
  'correo.de.ella@gmail.com': 'Ella',
};
