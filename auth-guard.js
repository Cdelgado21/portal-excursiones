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
        <div class="nube-doble nd1">
          <svg class="nube-atras" viewBox="0 0 24 24" width="46" height="46"><path fill="#a9c6f5" stroke="#02535a" stroke-width="1.2" d="M19.35 10.04A7.49 7.49 0 0012 4a7.49 7.49 0 00-7.35 6.04A5.994 5.994 0 000 16c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/></svg>
          <svg class="nube-frente" viewBox="0 0 24 24" width="34" height="34"><path fill="#ffffff" stroke="#02535a" stroke-width="1.2" d="M19.35 10.04A7.49 7.49 0 0012 4a7.49 7.49 0 00-7.35 6.04A5.994 5.994 0 000 16c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/></svg>
        </div>
        <div class="nube-doble nd2">
          <svg class="nube-atras" viewBox="0 0 24 24" width="38" height="38"><path fill="#a9c6f5" stroke="#02535a" stroke-width="1.2" d="M19.35 10.04A7.49 7.49 0 0012 4a7.49 7.49 0 00-7.35 6.04A5.994 5.994 0 000 16c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/></svg>
          <svg class="nube-frente" viewBox="0 0 24 24" width="27" height="27"><path fill="#ffffff" stroke="#02535a" stroke-width="1.2" d="M19.35 10.04A7.49 7.49 0 0012 4a7.49 7.49 0 00-7.35 6.04A5.994 5.994 0 000 16c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/></svg>
        </div>
        <div class="nube-doble nd3">
          <svg class="nube-atras" viewBox="0 0 24 24" width="40" height="40"><path fill="#a9c6f5" stroke="#02535a" stroke-width="1.2" d="M19.35 10.04A7.49 7.49 0 0012 4a7.49 7.49 0 00-7.35 6.04A5.994 5.994 0 000 16c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/></svg>
          <svg class="nube-frente" viewBox="0 0 24 24" width="29" height="29"><path fill="#ffffff" stroke="#02535a" stroke-width="1.2" d="M19.35 10.04A7.49 7.49 0 0012 4a7.49 7.49 0 00-7.35 6.04A5.994 5.994 0 000 16c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/></svg>
        </div>

        <svg class="loader-avion-svg" viewBox="0 0 200 90" width="96" height="43">
          <polygon points="10,40 40,20 55,40" fill="#d9d9d9"/>
          <polygon points="10,40 30,58 55,45" fill="#bcbcbc"/>
          <ellipse cx="120" cy="42" rx="80" ry="14" fill="#f2f2f2"/>
          <ellipse cx="120" cy="42" rx="80" ry="14" fill="none" stroke="#c9c9c9" stroke-width="1"/>
          <path d="M195,42 L175,29 L175,55 Z" fill="#e2483c"/>
          <path d="M42,42 L18,29 L18,55 Z" fill="#e2483c"/>
          <g fill="#333">
            <circle cx="82" cy="41" r="2"/>
            <circle cx="92" cy="41" r="2"/>
            <circle cx="102" cy="41" r="2"/>
            <circle cx="112" cy="41" r="2"/>
            <circle cx="122" cy="41" r="2"/>
            <circle cx="132" cy="41" r="2"/>
            <circle cx="142" cy="41" r="2"/>
            <circle cx="152" cy="41" r="2"/>
          </g>
          <polygon points="112,40 130,8 152,40" fill="#d9d9d9"/>
          <polygon points="112,50 130,82 152,50" fill="#bcbcbc"/>
          <ellipse cx="133" cy="42" rx="11" ry="11" fill="#e2483c"/>
          <circle cx="133" cy="42" r="5.5" fill="#222"/>
        </svg>
      </div>
      <div style="font-weight:bold; letter-spacing:0.2px;">Verificando sesión...</div>
      <style>
        .loader-cielo {
          position: relative;
          width: 280px;
          height: 190px;
        }
        .nube-doble {
          position: absolute;
          animation: flotarNube 3.4s ease-in-out infinite;
        }
        .nube-doble .nube-atras {
          display: block;
          position: absolute;
          top: -10px;
          left: -14px;
        }
        .nube-doble .nube-frente {
          display: block;
          position: relative;
          top: 10px;
          left: 12px;
        }
        .nd1 { top: 8%;  left: 6%;  animation-delay: 0s; }
        .nd2 { top: 2%;  left: 54%; animation-delay: 0.7s; }
        .nd3 { top: 62%; left: 70%; animation-delay: 1.2s; }
        @keyframes flotarNube {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-7px); }
        }
        .loader-avion-svg {
          position: absolute;
          left: 4%;
          top: 68%;
          transform: rotate(-24deg);
          animation: volarDiagonal 2.6s ease-in-out infinite;
        }
        @keyframes volarDiagonal {
          0%   { left: 4%;  top: 68%; opacity: 0; transform: rotate(-24deg); }
          12%  { opacity: 1; }
          88%  { opacity: 1; }
          100% { left: 46%; top: 8%;  opacity: 0; transform: rotate(-24deg); }
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
