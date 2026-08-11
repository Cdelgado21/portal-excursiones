// ==========================================
// auth-guard.js
//
// "Guardia" de sesión compartido. Reemplaza la verificación falsa de
// localStorage (que cualquiera podía inventarse desde la consola del
// navegador) por una verificación REAL contra Firebase Authentication.
//
// IMPORTANTE — esto es solo la mitad de la protección: la otra mitad, la
// que de verdad importa, son las reglas de seguridad de Firestore y
// Storage. Este archivo mejora la EXPERIENCIA (redirige si no hay sesión,
// evita que se vea contenido a medio cargar) pero un atacante que se salte
// el navegador por completo y llame a Firebase directo solo queda
// bloqueado por las reglas del servidor, no por este archivo. No hay que
// confiar en este archivo como si fuera la protección real.
//
// Uso en cada página protegida — SIEMPRE al final del <body>, después de
// que la página ya haya llamado firebase.initializeApp(...):
//   <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js"></script>
//   ...
//   <script src="auth-guard.js"></script>
// ==========================================

(function () {
  // NUEVO (11/8/2026): la pantalla de "Verificando sesión..." muestra un
  // avión volando en diagonal entre nubes — estilo inspirado en las
  // pantallas de carga de aerolíneas (Copa Airlines, por ejemplo), pero con
  // los colores de marca del sistema (#02535a) en vez del celeste de Copa.
  // Reemplaza dos intentos anteriores (avión orbitando, avión en línea
  // recta) que quedaron menos elegantes.
  function mostrarPantallaVerificando() {
    const overlay = document.createElement("div");
    overlay.id = "overlayVerificandoSesion";
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: #f0f7f7; z-index: 999999;
      display: flex; align-items: center; justify-content: center;
      flex-direction: column; gap: 22px;
      font-family: Arial, sans-serif; color: #02535a;
    `;
    overlay.innerHTML = `
      <div class="loader-cielo">
        <span class="nube nube1"></span>
        <span class="nube nube2"></span>
        <span class="nube nube3"></span>
        <span class="nube nube4"></span>
        <svg class="loader-avion-svg" viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="#02535a" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 3 3 10.5l6.5 2 2 6.5L21 3Z"/>
          <path d="M11.5 12.5 21 3"/>
        </svg>
      </div>
      <div style="font-weight:bold; letter-spacing:0.2px;">Verificando sesión...</div>
      <style>
        .loader-cielo {
          position: relative;
          width: 260px;
          height: 170px;
        }
        .nube {
          position: absolute;
          width: 44px;
          height: 18px;
          border: 2px solid #cfe3e4;
          border-radius: 20px;
          background: transparent;
          animation: flotarNube 3.2s ease-in-out infinite;
        }
        .nube::before, .nube::after {
          content: "";
          position: absolute;
          border: 2px solid #cfe3e4;
          border-radius: 50%;
          background: #f0f7f7;
        }
        .nube::before { width: 20px; height: 20px; top: -11px; left: 5px; }
        .nube::after  { width: 15px; height: 15px; top: -8px;  left: 24px; }
        .nube1 { top: 14%;  left: 6%;  animation-delay: 0s; }
        .nube2 { top: 6%;   left: 46%; transform: scale(0.85); animation-delay: 0.6s; }
        .nube3 { top: 62%;  left: 12%; transform: scale(0.75); animation-delay: 1.1s; }
        .nube4 { top: 70%;  left: 55%; animation-delay: 0.3s; }
        @keyframes flotarNube {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-6px); }
        }
        .loader-avion-svg {
          position: absolute;
          left: 4%;
          top: 78%;
          animation: volarDiagonal 2.4s ease-in-out infinite;
        }
        @keyframes volarDiagonal {
          0%   { left: 4%;  top: 78%; opacity: 0; transform: rotate(0deg); }
          12%  { opacity: 1; }
          88%  { opacity: 1; }
          100% { left: 78%; top: 6%;  opacity: 0; transform: rotate(0deg); }
        }
      </style>
    `;
    document.body.appendChild(overlay);
    return overlay;
  }

  function quitarPantallaVerificando(overlay) {
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }

  function irALogin(motivo) {
    localStorage.removeItem("usuario");
    const sufijo = motivo ? `?motivo=${encodeURIComponent(motivo)}` : "";
    window.location.href = `login.html${sufijo}`;
  }

  if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) {
    console.error("auth-guard.js: Firebase no está inicializado. Debe cargarse este script DESPUÉS de firebase.initializeApp(...).");
    return;
  }

  const overlay = mostrarPantallaVerificando();

  firebase.auth().onAuthStateChanged(async function (usuarioFirebase) {
    if (!usuarioFirebase) {
      // No hay sesión real de Firebase — no importa lo que diga localStorage.
      irALogin("sesion_requerida");
      return;
    }

    try {
      const docUsuario = await firebase.firestore().collection("usuarios").doc(usuarioFirebase.uid).get();

      if (!docUsuario.exists) {
        console.error("auth-guard.js: la cuenta de Firebase existe, pero no tiene un documento en usuarios/ con ese mismo UID.");
        await firebase.auth().signOut();
        irALogin("usuario_no_encontrado");
        return;
      }

      const datosUsuario = docUsuario.data();

      if (datosUsuario.estado !== "Activo") {
        await firebase.auth().signOut();
        irALogin("usuario_inactivo");
        return;
      }

      // Guarda una copia en localStorage — SOLO para que el resto de páginas
      // (que hoy leen localStorage.usuario para mostrar el nombre/rol) sigan
      // funcionando sin tener que reescribirlas todas de una vez. Esta copia
      // se reconstruye desde cero, verificada, cada vez que carga una página
      // protegida — no es la fuente de verdad, solo un reflejo de ella.
      const usuarioParaMostrar = {
        id: usuarioFirebase.uid,
        nombre: datosUsuario.nombre || "",
        apellidos: datosUsuario.apellidos || "",
        correo: datosUsuario.correo || usuarioFirebase.email || "",
        telefono: datosUsuario.telefono || "",
        rol: datosUsuario.rol || "",
        estado: datosUsuario.estado || "",
        fotoURL: datosUsuario.fotoURL || ""
      };
      localStorage.setItem("usuario", JSON.stringify(usuarioParaMostrar));

      window.usuarioActual = usuarioParaMostrar;
      document.dispatchEvent(new CustomEvent("usuarioVerificado", { detail: usuarioParaMostrar }));

      quitarPantallaVerificando(overlay);
    } catch (e) {
      console.error("auth-guard.js: error al verificar el usuario:", e);
      irALogin("error_verificacion");
    }
  });

  // NUEVO: reemplaza cualquier función de "cerrar sesión" que la página ya
  // haya definido (cerrarSesion, cerrarSesionYRedirigir) por una versión que
  // sí cierra la sesión real de Firebase, no solo borra localStorage. Como
  // este script se carga al final, esta versión es la que gana.
  window.cerrarSesion = window.cerrarSesionYRedirigir = function () {
    firebase.auth().signOut().finally(() => {
      localStorage.removeItem("usuario");
      window.location.href = "login.html";
    });
  };
})();
