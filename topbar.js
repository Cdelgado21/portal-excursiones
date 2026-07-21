// ==========================================
// BARRA SUPERIOR COMPARTIDA (topbar.js)
// Se agrega a cada página, DESPUÉS de que la página ya haya llamado a
// firebase.initializeApp(...) — este archivo no inicializa Firebase por su
// cuenta, reutiliza la conexión que ya dejó abierta la página.
//
// Uso en cada página:
//   <link rel="stylesheet" href="topbar.css">
//   ...
//   <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>
//   <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js"></script>
//   <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-storage-compat.js"></script>  <-- necesario para subir foto
//   ...
//   <script> firebase.initializeApp(firebaseConfig); ... </script>
//   <script src="topbar.js"></script>  <-- SIEMPRE al final
//
// Si la página no tiene sesión guardada en localStorage("usuario"), esta
// barra simplemente no aparece (ej. login.html).
// ==========================================

(function () {
  const MINUTOS_INACTIVIDAD = 30;
  const MS_INACTIVIDAD = MINUTOS_INACTIVIDAD * 60 * 1000;

  function obtenerUsuarioSesion() {
    try {
      return JSON.parse(localStorage.getItem("usuario") || "null");
    } catch (e) {
      return null;
    }
  }

  function guardarUsuarioSesion(cambios) {
    const actual = obtenerUsuarioSesion() || {};
    const actualizado = { ...actual, ...cambios };
    localStorage.setItem("usuario", JSON.stringify(actualizado));
    return actualizado;
  }

  // ---------- Cierre de sesión por inactividad ----------
  function cerrarSesionPorInactividad() {
    localStorage.removeItem("usuario");
    window.location.href = "login.html?motivo=inactividad";
  }

  function iniciarControlInactividad() {
    let temporizador;
    function reiniciar() {
      clearTimeout(temporizador);
      temporizador = setTimeout(cerrarSesionPorInactividad, MS_INACTIVIDAD);
    }
    ["mousemove", "keydown", "click", "scroll", "touchstart"].forEach(evento => {
      document.addEventListener(evento, reiniciar, { passive: true });
    });
    reiniciar();
  }

  // ---------- Construcción visual de la barra ----------
  function construirTopbarHTML(usuario) {
    const fotoURL = usuario.fotoURL || "https://cdn-icons-png.flaticon.com/512/219/219986.png";
    return `
      <span class="titulo-sistema">Excursiones Delgado — Sistema Integral</span>
      <div style="display:flex; align-items:center;">
        <div class="campana-container" id="botonCampanaTopbar">
          <span class="campana-icono">🔔</span>
          <span class="campana-badge" id="badgeNotificaciones">0</span>
          <div id="panelNotificaciones"></div>
        </div>
        <div class="usuario-container" id="botonUsuarioTopbar">
          <img src="${fotoURL}" class="usuario-avatar" id="avatarTopbar" alt="Usuario">
          <div class="usuario-datos">
            <span class="usuario-nombre">${usuario.nombre || "Usuario"}</span>
            <span class="usuario-rol">${usuario.rol || ""}</span>
          </div>
          <div id="menuUsuarioDesplegable">
            <button type="button" id="btnEditarPerfilTopbar">✏️ Editar perfil</button>
            <button type="button" id="btnCerrarSesionTopbar">🚪 Cerrar sesión</button>
          </div>
        </div>
      </div>
    `;
  }

  function construirModalPerfilHTML(usuario) {
    const fotoURL = usuario.fotoURL || "https://cdn-icons-png.flaticon.com/512/219/219986.png";
    const avisoStorage = (typeof firebase !== "undefined" && firebase.storage)
      ? ""
      : `<div class="aviso-modal">⚠️ Esta página todavía no tiene cargada la librería de Firebase Storage — agrega
         <code>firebase-storage-compat.js</code> para poder subir la foto desde aquí.</div>`;
    return `
      <div class="modal-contenido">
        <h3>Editar Perfil</h3>
        <img src="${fotoURL}" class="preview-avatar" id="previewFotoPerfil" alt="Vista previa">
        <input type="file" id="inputFotoPerfil" accept="image/*">
        ${avisoStorage}
        <div class="acciones-modal">
          <button type="button" class="btn-cancelar" id="btnCancelarPerfil">Cancelar</button>
          <button type="button" class="btn-guardar" id="btnGuardarPerfil">Guardar</button>
        </div>
      </div>
    `;
  }

  async function subirFotoPerfil(usuario, archivo) {
    if (!firebase.storage) return null;
    const storage = firebase.storage();
    const ref = storage.ref().child(`usuarios/${usuario.id}/foto_${Date.now()}_${archivo.name}`);
    await ref.put(archivo);
    return await ref.getDownloadURL();
  }

  function abrirModalPerfil(usuario) {
    const modal = document.getElementById("modalEditarPerfil");
    modal.innerHTML = construirModalPerfilHTML(usuario);
    modal.style.display = "flex";

    const inputFoto = document.getElementById("inputFotoPerfil");
    inputFoto.addEventListener("change", function () {
      const archivo = this.files[0];
      if (!archivo) return;
      document.getElementById("previewFotoPerfil").src = URL.createObjectURL(archivo);
    });

    document.getElementById("btnCancelarPerfil").addEventListener("click", () => {
      modal.style.display = "none";
    });

    document.getElementById("btnGuardarPerfil").addEventListener("click", async () => {
      const archivo = inputFoto.files[0];
      if (!archivo) {
        modal.style.display = "none";
        return;
      }
      if (!usuario.id) {
        alert("⚠️ No se pudo identificar tu usuario para guardar la foto. Cierra sesión y vuelve a entrar (esto solo pasa si iniciaste sesión antes de este cambio).");
        return;
      }
      try {
        const url = await subirFotoPerfil(usuario, archivo);
        if (!url) {
          alert("⚠️ No se pudo subir la foto: falta la librería de Firebase Storage en esta página.");
          return;
        }
        await firebase.firestore().collection("usuarios").doc(usuario.id).update({ fotoURL: url });
        guardarUsuarioSesion({ fotoURL: url });
        document.getElementById("avatarTopbar").src = url;
        modal.style.display = "none";
      } catch (e) {
        console.error("Error al guardar la foto de perfil:", e);
        alert("❌ No se pudo guardar la foto de perfil. Intenta de nuevo.");
      }
    });
  }

  // ---------- Notificaciones ----------
  function formatearFechaNotificacion(fecha) {
    if (!fecha) return "";
    const f = fecha.toDate ? fecha.toDate() : new Date(fecha);
    if (isNaN(f.getTime())) return "";
    return f.toLocaleString("es-CR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function renderizarNotificaciones(notificaciones) {
    const panel = document.getElementById("panelNotificaciones");
    const badge = document.getElementById("badgeNotificaciones");
    const noLeidas = notificaciones.filter(n => !n.leido).length;

    badge.textContent = noLeidas;
    badge.style.display = noLeidas > 0 ? "inline-block" : "none";

    if (notificaciones.length === 0) {
      panel.innerHTML = `<div class="notificacion-vacia">No tienes notificaciones.</div>`;
      return;
    }

    panel.innerHTML = notificaciones.map(n => `
      <div class="notificacion-item ${n.leido ? "" : "no-leida"}" data-id="${n.id}">
        ${n.mensaje || ""}
        <span class="notificacion-fecha">${formatearFechaNotificacion(n.fecha)}</span>
      </div>
    `).join("");

    panel.querySelectorAll(".notificacion-item").forEach(el => {
      el.addEventListener("click", async () => {
        const id = el.dataset.id;
        if (!el.classList.contains("no-leida")) return;
        try {
          await firebase.firestore().collection("notificaciones").doc(id).update({ leido: true });
          el.classList.remove("no-leida");
          const restantes = Math.max(parseInt(badge.textContent || "0") - 1, 0);
          badge.textContent = restantes;
          badge.style.display = restantes > 0 ? "inline-block" : "none";
        } catch (e) {
          console.error("No se pudo marcar la notificación como leída:", e);
        }
      });
    });
  }

  async function cargarNotificaciones(usuario) {
    if (!usuario.id) return;
    try {
      // NOTA: la primera vez que corra esta consulta, Firestore puede pedir
      // crear un índice compuesto (destinatarioId + fecha) — el error de la
      // consola trae un enlace directo para crearlo con un clic.
      const snapshot = await firebase.firestore().collection("notificaciones")
        .where("destinatarioId", "==", usuario.id)
        .orderBy("fecha", "desc")
        .limit(20)
        .get();
      const notificaciones = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      renderizarNotificaciones(notificaciones);
    } catch (e) {
      console.error("No se pudieron cargar las notificaciones:", e);
    }
  }

  // ---------- Inicialización ----------
  function inicializarTopbar() {
    const usuario = obtenerUsuarioSesion();
    if (!usuario) return; // sin sesión (ej. login.html) no se muestra nada

    if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) {
      console.error("topbar.js: Firebase no está inicializado todavía. Asegúrate de cargar topbar.js DESPUÉS de firebase.initializeApp(...).");
      return;
    }

    const contenedor = document.createElement("div");
    contenedor.id = "barraSuperiorSIED";
    contenedor.innerHTML = construirTopbarHTML(usuario);
    document.body.insertBefore(contenedor, document.body.firstChild);

    const modalPerfil = document.createElement("div");
    modalPerfil.id = "modalEditarPerfil";
    document.body.appendChild(modalPerfil);

    document.getElementById("botonUsuarioTopbar").addEventListener("click", (e) => {
      e.stopPropagation();
      document.getElementById("panelNotificaciones").style.display = "none";
      const menu = document.getElementById("menuUsuarioDesplegable");
      menu.style.display = menu.style.display === "block" ? "none" : "block";
    });

    document.getElementById("botonCampanaTopbar").addEventListener("click", (e) => {
      e.stopPropagation();
      document.getElementById("menuUsuarioDesplegable").style.display = "none";
      const panel = document.getElementById("panelNotificaciones");
      panel.style.display = panel.style.display === "block" ? "none" : "block";
    });

    document.addEventListener("click", () => {
      const menu = document.getElementById("menuUsuarioDesplegable");
      const panel = document.getElementById("panelNotificaciones");
      if (menu) menu.style.display = "none";
      if (panel) panel.style.display = "none";
    });

    document.getElementById("btnEditarPerfilTopbar").addEventListener("click", () => {
      abrirModalPerfil(usuario);
    });

    document.getElementById("btnCerrarSesionTopbar").addEventListener("click", () => {
      localStorage.removeItem("usuario");
      window.location.href = "login.html";
    });

    cargarNotificaciones(usuario);
    iniciarControlInactividad();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", inicializarTopbar);
  } else {
    inicializarTopbar();
  }
})();
