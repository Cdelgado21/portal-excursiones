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
  function mostrarPantallaVerificando() {
    const overlay = document.createElement("div");
    overlay.id = "overlayVerificandoSesion";
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: #f0f7f7; z-index: 999999;
      display: flex; align-items: center; justify-content: center;
      flex-direction: column; gap: 12px;
      font-family: Arial, sans-serif; color: #02535a;
    `;
    overlay.innerHTML = `
      <div style="width:40px; height:40px; border:4px solid #cfe3e4; border-top-color:#02535a; border-radius:50%; animation: girarVerificando 0.8s linear infinite;"></div>
      <div>Verificando sesión...</div>
      <style>@keyframes girarVerificando { to { transform: rotate(360deg); } }</style>
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
