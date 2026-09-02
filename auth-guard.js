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
  // avión real (SVG verificado, aportado por Cristopher) volando de
  // izquierda a derecha entre nubes de un solo trazo — reemplaza varios
  // intentos anteriores dibujados a mano que no terminaban de verse bien.
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
        <svg class="nube n1" viewBox="0 0 24 24" width="42" height="42"><path fill="none" stroke="#5fa8dd" stroke-width="1.3" d="M19.35 10.04A7.49 7.49 0 0012 4a7.49 7.49 0 00-7.35 6.04A5.994 5.994 0 000 16c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/></svg>
        <svg class="nube n2" viewBox="0 0 24 24" width="32" height="32"><path fill="none" stroke="#5fa8dd" stroke-width="1.3" d="M19.35 10.04A7.49 7.49 0 0012 4a7.49 7.49 0 00-7.35 6.04A5.994 5.994 0 000 16c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/></svg>
        <svg class="nube n3" viewBox="0 0 24 24" width="36" height="36"><path fill="none" stroke="#5fa8dd" stroke-width="1.3" d="M19.35 10.04A7.49 7.49 0 0012 4a7.49 7.49 0 00-7.35 6.04A5.994 5.994 0 000 16c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/></svg>
        <svg class="nube n4" viewBox="0 0 24 24" width="26" height="26"><path fill="none" stroke="#5fa8dd" stroke-width="1.3" d="M19.35 10.04A7.49 7.49 0 0012 4a7.49 7.49 0 00-7.35 6.04A5.994 5.994 0 000 16c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/></svg>
        <svg class="avion" fill="#02535a" viewBox="0 0 465.832 465.832" width="52" height="52">
          <path d="M455.888,257.976c-2.66-1.522-5.129-3.352-7.34-5.437c-2.274-2.145-4.269-4.544-5.929-7.133
            c-5.6-8.729-15.262-13.941-25.847-13.941H108.988l-65.752-78.322c-1.425-1.698-3.528-2.678-5.744-2.678h-26
            c-2.278,0-4.433,1.036-5.856,2.815c-1.423,1.779-1.961,4.109-1.46,6.332l15.492,68.854H7.5c-4.142,0-7.5,3.358-7.5,7.5
            c0,4.142,3.358,7.5,7.5,7.5h9.196c-0.889,3.036-1.107,6.298-0.568,9.592c1.37,8.368,7.295,14.986,15.463,17.271l97.945,27.402
            c11.232,3.142,22.84,4.735,34.502,4.735h91.392c3.815,7.64,11.708,12.901,20.812,12.901h56.75c4.142,0,7.5-3.358,7.5-7.5v-5.401
            h77.67c6.645,0,13.256-0.883,19.659-2.626c6.405-1.752,12.551-4.341,18.273-7.699c6.098-3.586,9.738-9.947,9.738-17.015
            C465.832,267.947,462.113,261.535,455.888,257.976z M325.492,300.366h-49.25c-4.549,0-8.25-3.701-8.25-8.251
            c0-4.55,3.701-8.251,8.25-8.251h36.25h13V300.366z M448.495,279.207c-4.577,2.687-9.5,4.76-14.624,6.162
            c-5.11,1.391-10.396,2.097-15.71,2.097h-77.67v-11.1c0-4.142-3.358-7.5-7.5-7.5H227.825c-4.142,0-7.5,3.358-7.5,7.5
            c0,4.142,3.358,7.5,7.5,7.5h26.684c-0.442,1.159-0.797,2.361-1.05,3.6h-89.421c-10.296,0-20.545-1.406-30.461-4.181
            l-97.945-27.402c-3.736-1.045-4.542-4.281-4.701-5.249c-0.158-0.966-0.425-4.288,2.778-6.467c0.314-0.214,0.607-0.449,0.88-0.701
            h33.403c4.142,0,7.5-3.358,7.5-7.5c0-4.142-3.358-7.5-7.5-7.5h-32.95l-14.175-63h13.129l65.752,78.322
            c1.425,1.698,3.528,2.678,5.744,2.678h311.28c3.773,0,7.301,1.262,10.054,3.5h-1.334c-4.142,0-7.5,3.358-7.5,7.5
            s3.358,7.5,7.5,7.5h14.468c2.62,2.267,5.455,4.3,8.48,6.031c2.159,1.234,2.392,3.299,2.392,4.129
            C450.832,275.939,450.604,277.967,448.495,279.207z"/>
          <path d="M380.037,251.261c0.078,0.052,0.123,0.081-0.048-0.036c-0.184-0.121-0.118-0.076-0.029-0.016
            c-2.812-1.833-6.603-1.586-9.117,0.653c-2.232,1.987-3.075,5.211-2.104,8.037c0.989,2.878,3.679,4.903,6.721,5.057
            c3.241,0.164,6.289-1.872,7.405-4.908C384.047,256.832,382.833,253.201,380.037,251.261z"/>
          <path d="M356.979,252.165c-4.577-4.708-12.817-1.183-12.8,5.3c0.016,6.471,8.205,10.026,12.8,5.3
            c2.137-2.078,2.773-5.439,1.62-8.17C358.241,253.698,357.673,252.84,356.979,252.165z"/>
          <path d="M331.706,251.238c0.096,0.065,0.178,0.12-0.017-0.013c-0.19-0.128-0.106-0.071-0.01-0.006
            c-2.6-1.747-6.136-1.612-8.637,0.247c-2.511,1.865-3.585,5.186-2.687,8.176c0.906,3.014,3.722,5.183,6.863,5.316
            c3.034,0.129,5.94-1.678,7.166-4.456C335.847,257.185,334.673,253.276,331.706,251.238z"/>
          <path d="M310.309,254.595c-0.083-0.197-0.058-0.134-0.02-0.04c-2.035-4.74-8.533-6.173-12.21-2.39
            c-2.895,2.814-2.895,7.785,0,10.6c2.364,2.432,6.253,2.855,9.14,1.141c3.166-1.88,4.439-5.854,3.11-9.253
            C310.364,254.735,310.383,254.779,310.309,254.595z"/>
          <path d="M181.179,250.115c-5.733,1.076-8.053,8.56-3.84,12.65c4.013,4.134,11.19,2.002,12.572-3.476
            C191.229,254.06,186.472,249.048,181.179,250.115z"/>
          <path d="M158.127,249.974c-3.003,0.153-5.676,2.136-6.691,4.963c-1.041,2.9-0.151,6.227,2.188,8.229
            c2.468,2.113,6.133,2.367,8.879,0.636c3.028-1.909,4.313-5.897,2.916-9.207C164.203,251.713,161.27,249.814,158.127,249.974z"/>
          <path d="M272.176,254.938c-2.261,6.338,4.69,12.323,10.624,9.12c3.32-1.792,4.833-5.972,3.359-9.463
            C283.559,248.435,274.445,248.578,272.176,254.938z"/>
          <path d="M248.092,254.766c-2.475,6.385,4.587,12.516,10.558,9.292c3.322-1.794,4.833-5.971,3.359-9.463
            C259.435,248.498,250.498,248.56,248.092,254.766z"/>
          <path d="M230.934,249.965c-3.131,0-6,2.032-7.058,4.972c-1.079,2.999-0.074,6.44,2.416,8.417c2.546,2.021,6.268,2.13,8.929,0.265
            c2.836-1.988,3.993-5.813,2.638-9.024C236.693,251.833,233.949,249.965,230.934,249.965z"/>
          <path d="M212.089,252.165c-4.527-4.663-12.633-1.261-12.796,5.116c-0.168,6.559,8.147,10.272,12.796,5.484
            c2.14-2.077,2.774-5.437,1.62-8.17C213.347,253.691,212.789,252.844,212.089,252.165z"/>
        </svg>
      </div>
      <div style="font-weight:bold; letter-spacing:0.2px;">Verificando sesión...</div>
      <style>
        .loader-cielo {
          position: relative;
          width: 280px;
          height: 170px;
        }
        .nube {
          position: absolute;
          animation: flotarNube 3.2s ease-in-out infinite;
        }
        .n1 { top: 10%; left: 10%; animation-delay: 0s; }
        .n2 { top: 14%; left: 66%; animation-delay: 0.5s; }
        .n3 { top: 66%; left: 60%; animation-delay: 1s; }
        .n4 { top: 72%; left: 14%; animation-delay: 1.4s; }
        @keyframes flotarNube {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-6px); }
        }
        .avion {
          position: absolute;
          top: 40%;
          left: -20%;
          transform: translateY(-50%);
          animation: volarEste 2.6s linear infinite;
        }
        @keyframes volarEste {
          0%   { left: -20%; opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { left: 100%; opacity: 0; }
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

  // NUEVO: páginas que solo puede ver quien tenga rol "Administrador" —
  // cualquier otro rol (Cotizaciones/Reservas/Finanzas, etc.) queda
  // tratado como "Colaborador" para efectos de acceso, sin tocar esas
  // etiquetas existentes en registro.html. Esta misma lista también vive
  // en sidebar.js (para ocultar el link del menú) — si se agrega una
  // página nueva acá, hay que agregarla ahí también.
  const ADMIN_ONLY_PAGES = [
    "comisiones.html",
    "costos_agregar.html",
    "costos_salida_grupal.html",
    "finanzas.html",
    "gastos.html",
    "configuracion.html",
    "registro.html"
  ];

  function archivoActual() {
    const partes = window.location.pathname.split("/");
    return partes[partes.length - 1] || "dashboard.html";
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

      // NUEVO: control de acceso por rol — si esta página es solo para
      // Administrador y quien inició sesión tiene otro rol, se corta acá
      // mismo, antes de mostrar nada de la página ni quitar la pantalla de
      // "Verificando sesión..." — así el contenido protegido nunca llega a
      // verse, ni un instante.
      const paginaActual = archivoActual();
      if (ADMIN_ONLY_PAGES.includes(paginaActual) && datosUsuario.rol !== "Administrador") {
        alert("No tenés permiso para acceder a esta página. Si creés que es un error, contactá a un Administrador.");
        window.location.href = "dashboard.html";
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
