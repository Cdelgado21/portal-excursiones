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
//
// NUEVO: Comunicación interna — la campanita ahora también permite CREAR
// una notificación (comunicado o tarea) para otro usuario, no solo leer
// las que le llegan a uno. Mismo esquema "notificaciones" de siempre, con
// dos campos nuevos:
//   tipo: "comunicado" | "tarea"
//   estado: "Pendiente" | "Hecha"   (solo aplica a tipo "tarea")
//   fechaLimite: "AAAA-MM-DD"       (opcional, solo tareas)
// Las tareas pendientes de uno se muestran también en la tarjeta
// "Tareas asignadas" del dashboard — ver dashboard.html.
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

    // NUEVO: el botón de "Nuevo comunicado / tarea" siempre va arriba del
    // panel, sin importar si hay notificaciones o no.
    const encabezado = `
      <div class="notificacion-encabezado">
        <button type="button" id="btnNuevoComunicado">➕ Nuevo comunicado / tarea</button>
      </div>
    `;

    if (notificaciones.length === 0) {
      panel.innerHTML = encabezado + `<div class="notificacion-vacia">No tienes notificaciones.</div>`;
    } else {
      const lista = notificaciones.map(n => {
        const etiquetaTipo = n.tipo === "tarea" ? `<span class="notificacion-tipo-tarea">📋 Tarea</span>` : "";
        return `
        <div class="notificacion-item ${n.leido ? "" : "no-leida"}" data-id="${n.id}">
          ${etiquetaTipo}
          ${n.mensaje || ""}
          <span class="notificacion-fecha">${formatearFechaNotificacion(n.fecha)}</span>
        </div>
      `;
      }).join("");
      panel.innerHTML = encabezado + lista;
    }

    document.getElementById("btnNuevoComunicado").addEventListener("click", (e) => {
      e.stopPropagation();
      abrirModalNuevoComunicado();
    });

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
      // Igual se muestra el botón de "Nuevo comunicado" aunque falle la
      // carga de la lista (ej. falta el índice todavía).
      renderizarNotificaciones([]);
    }
  }

  // ---------- NUEVO: Comunicación interna (crear notificación/tarea) ----------

  let listaUsuariosParaComunicado = null; // cache — se carga una sola vez por sesión de página

  async function cargarUsuariosParaComunicado() {
    if (listaUsuariosParaComunicado) return listaUsuariosParaComunicado;
    try {
      const snap = await firebase.firestore().collection("usuarios").get();
      listaUsuariosParaComunicado = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(u => u.estado !== "Inactivo")
        .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
    } catch (e) {
      console.error("No se pudo cargar la lista de usuarios:", e);
      listaUsuariosParaComunicado = [];
    }
    return listaUsuariosParaComunicado;
  }

  function construirModalNuevoComunicadoHTML(listaUsuarios, usuarioActual) {
    const opciones = listaUsuarios
      .filter(u => u.id !== usuarioActual.id) // no tiene sentido mandarse uno a sí mismo
      .map(u => `<option value="${u.id}" data-nombre="${u.nombre || ''}">${u.nombre || u.id}</option>`)
      .join("");

    return `
      <div class="modal-contenido">
        <h3>Nuevo comunicado / tarea</h3>

        <label>Para</label>
        <select id="comunicadoPara">
          <option value="">-- Seleccione un compañero --</option>
          ${opciones}
        </select>

        <label>Tipo</label>
        <select id="comunicadoTipo" onchange="document.getElementById('comunicadoFechaLimiteWrap').style.display = this.value === 'tarea' ? 'block' : 'none';">
          <option value="comunicado">📢 Comunicado (solo avisar)</option>
          <option value="tarea">📋 Tarea (con seguimiento)</option>
        </select>

        <label>Mensaje</label>
        <textarea id="comunicadoMensaje" rows="4" placeholder="Ej. Revisar pasaportes del grupo Panamá antes del viernes"></textarea>

        <div id="comunicadoFechaLimiteWrap" style="display:none;">
          <label>Fecha límite (opcional)</label>
          <input type="date" id="comunicadoFechaLimite">
        </div>

        <div class="aviso-modal" id="comunicadoAviso" style="display:none;"></div>

        <div class="acciones-modal">
          <button type="button" class="btn-cancelar" id="btnCancelarComunicado">Cancelar</button>
          <button type="button" class="btn-guardar" id="btnEnviarComunicado">Enviar</button>
        </div>
      </div>
    `;
  }

  async function abrirModalNuevoComunicado() {
    document.getElementById("menuUsuarioDesplegable").style.display = "none";
    document.getElementById("panelNotificaciones").style.display = "none";

    const usuario = obtenerUsuarioSesion();
    const modal = document.getElementById("modalNuevoComunicado");
    modal.innerHTML = `<div class="modal-contenido"><p>Cargando compañeros...</p></div>`;
    modal.classList.add("abierto");

    const usuarios = await cargarUsuariosParaComunicado();
    modal.innerHTML = construirModalNuevoComunicadoHTML(usuarios, usuario);

    document.getElementById("btnCancelarComunicado").addEventListener("click", () => {
      modal.classList.remove("abierto");
    });

    document.getElementById("btnEnviarComunicado").addEventListener("click", async () => {
      await enviarNuevoComunicado(usuario);
    });
  }

  async function enviarNuevoComunicado(usuarioActual) {
    const selectPara = document.getElementById("comunicadoPara");
    const destinatarioId = selectPara.value;
    const destinatarioNombre = selectPara.selectedOptions[0]?.dataset.nombre || "";
    const tipo = document.getElementById("comunicadoTipo").value;
    const mensaje = document.getElementById("comunicadoMensaje").value.trim();
    const fechaLimite = document.getElementById("comunicadoFechaLimite")?.value || "";
    const aviso = document.getElementById("comunicadoAviso");

    if (!destinatarioId || !mensaje) {
      aviso.style.display = "block";
      aviso.textContent = "⚠️ Elegí a quién va dirigido y escribí un mensaje.";
      return;
    }

    const boton = document.getElementById("btnEnviarComunicado");
    boton.disabled = true;
    boton.textContent = "Enviando...";

    try {
      const datosNotificacion = {
        destinatarioId,
        destinatarioNombre,
        remitenteId: usuarioActual.id || "",
        remitenteNombre: usuarioActual.nombre || "Alguien del equipo",
        tipo,
        mensaje: tipo === "tarea" ? `📋 Tarea de ${usuarioActual.nombre || 'un compañero'}: ${mensaje}` : `${usuarioActual.nombre || 'Un compañero'}: ${mensaje}`,
        leido: false,
        fecha: new Date()
      };
      if (tipo === "tarea") {
        datosNotificacion.estado = "Pendiente";
        if (fechaLimite) datosNotificacion.fechaLimite = fechaLimite;
      }

      await firebase.firestore().collection("notificaciones").add(datosNotificacion);

      document.getElementById("modalNuevoComunicado").classList.remove("abierto");
    } catch (e) {
      console.error("No se pudo enviar el comunicado:", e);
      aviso.style.display = "block";
      aviso.textContent = "❌ No se pudo enviar. Intenta de nuevo.";
      boton.disabled = false;
      boton.textContent = "Enviar";
    }
  }

  // NUEVO: estilos mínimos para las piezas nuevas (botón de "Nuevo
  // comunicado", etiqueta de tarea, y los campos del formulario del modal)
  // — inyectados acá para no depender de reglas de topbar.css que no están
  // a la vista en este archivo. Los campos genéricos (label/select/
  // textarea/input) quedan acotados a #modalNuevoComunicado, para no
  // pisarle el estilo a inputs de otras partes de la página.
  function inyectarEstilosComunicacionInterna() {
    if (document.getElementById("estilosComunicacionInterna")) return;
    const estilo = document.createElement("style");
    estilo.id = "estilosComunicacionInterna";
    estilo.textContent = `
      .notificacion-encabezado {
        padding: 8px 12px;
        border-bottom: 1px solid #eee;
      }
      #btnNuevoComunicado {
        width: 100%;
        background-color: #02535a;
        color: white;
        border: none;
        padding: 8px 10px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 13px;
        font-weight: bold;
      }
      #btnNuevoComunicado:hover { background-color: #036a6d; }
      .notificacion-tipo-tarea {
        display: inline-block;
        background: #ffb703;
        color: #02535a;
        font-size: 11px;
        font-weight: bold;
        padding: 2px 8px;
        border-radius: 999px;
        margin-right: 6px;
      }
      /* FIX: el modal salía sin ningún estilo (se insertaba en medio de la
         página, en vez de flotar como ventana centrada) — acá se define
         TODO lo que necesita para verse bien, sin depender de nada de
         topbar.css que no está a la vista en este archivo. Usa el mismo
         id como selector para tener prioridad sobre cualquier regla
         genérica que pudiera existir en otro lado. */
      #modalNuevoComunicado {
        display: none !important;
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        height: 100% !important;
        background-color: rgba(0, 0, 0, 0.5) !important;
        z-index: 99999 !important;
        align-items: center !important;
        justify-content: center !important;
        font-family: Arial, Helvetica, sans-serif;
      }
      #modalNuevoComunicado.abierto {
        display: flex !important;
      }
      #modalNuevoComunicado .modal-contenido {
        background: white;
        border-radius: 12px;
        padding: 24px;
        max-width: 420px;
        width: 90%;
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25);
        box-sizing: border-box;
      }
      #modalNuevoComunicado h3 {
        margin: 0 0 4px 0;
        color: #02535a;
      }
      #modalNuevoComunicado label {
        display: block;
        margin-top: 12px;
        margin-bottom: 4px;
        font-weight: bold;
        font-size: 13px;
        color: #02535a;
      }
      #modalNuevoComunicado select,
      #modalNuevoComunicado textarea,
      #modalNuevoComunicado input[type="date"] {
        width: 100%;
        padding: 8px;
        border-radius: 6px;
        border: 1px solid #ccc;
        box-sizing: border-box;
        font-family: inherit;
        font-size: 14px;
      }
      #modalNuevoComunicado .aviso-modal {
        margin-top: 10px;
        font-size: 13px;
        color: #a35b00;
      }
      #modalNuevoComunicado .acciones-modal {
        margin-top: 18px;
        text-align: right;
      }
      #modalNuevoComunicado .acciones-modal button {
        border: none;
        padding: 9px 18px;
        border-radius: 6px;
        font-weight: bold;
        cursor: pointer;
        font-size: 14px;
        margin-left: 8px;
      }
      #modalNuevoComunicado .btn-cancelar {
        background: #ccc;
        color: #333;
      }
      #modalNuevoComunicado .btn-guardar {
        background: #02535a;
        color: white;
      }
      #modalNuevoComunicado .btn-guardar:hover { background: #036a6d; }
    `;
    document.head.appendChild(estilo);
  }

  // ---------- Inicialización ----------
  function inicializarTopbar() {
    const usuario = obtenerUsuarioSesion();
    if (!usuario) return; // sin sesión (ej. login.html) no se muestra nada

    if (typeof firebase === "undefined" || !firebase.apps || !firebase.apps.length) {
      console.error("topbar.js: Firebase no está inicializado todavía. Asegúrate de cargar topbar.js DESPUÉS de firebase.initializeApp(...).");
      return;
    }

    inyectarEstilosComunicacionInterna();

    const contenedor = document.createElement("div");
    contenedor.id = "barraSuperiorSIED";
    contenedor.innerHTML = construirTopbarHTML(usuario);
    document.body.insertBefore(contenedor, document.body.firstChild);

    const modalPerfil = document.createElement("div");
    modalPerfil.id = "modalEditarPerfil";
    document.body.appendChild(modalPerfil);

    // NUEVO: contenedor del modal de "Nuevo comunicado / tarea" — el
    // posicionamiento (overlay oscuro, centrado) vive en el CSS inyectado
    // por inyectarEstilosComunicacionInterna() (con !important, por si
    // topbar.css tiene alguna regla genérica que lo pise), no acá.
    const modalComunicado = document.createElement("div");
    modalComunicado.id = "modalNuevoComunicado";
    document.body.appendChild(modalComunicado);

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

  // ---------- NUEVO: helper global para avisos AUTOMÁTICOS del sistema ----------
  // Distinto del modal de "Nuevo comunicado/tarea" (ese es para mensajes
  // manuales entre compañeros) — este es para que el propio sistema le
  // avise a quien tenga rol "Administrador" cuando pasa algo importante
  // (nueva solicitud de cotización, nueva reserva, pago registrado, etc.),
  // sin que nadie tenga que escribirlo a mano. Se expone en "window" para
  // que cualquier página pueda llamarlo después de guardar algo, sin
  // duplicar esta lógica en cada archivo.
  async function crearNotificacionParaAdmins(mensaje) {
    try {
      const snap = await firebase.firestore().collection("usuarios")
        .where("rol", "==", "Administrador")
        .get();
      const escrituras = snap.docs
        .filter(d => d.data().estado !== "Inactivo")
        .map(d => firebase.firestore().collection("notificaciones").add({
          destinatarioId: d.id,
          destinatarioNombre: d.data().nombre || "",
          remitenteId: "sistema",
          remitenteNombre: "Sistema",
          tipo: "comunicado",
          mensaje,
          leido: false,
          fecha: new Date()
        }));
      await Promise.all(escrituras);
    } catch (e) {
      console.error("No se pudo crear la notificación automática:", e);
    }
  }
  window.crearNotificacionParaAdmins = crearNotificacionParaAdmins;

  // NUEVO: aviso automático por CORREO — a propósito, NO usa el rol
  // "Administrador" (eso es sobre permisos de acceso al sistema, no sobre
  // quién debe recibir estos avisos operativos). Usa un campo aparte,
  // "recibeAvisosOperativos" (true/false), para que el Dueño/Gerente pueda
  // marcar exactamente a quién le llegan, sin importar cuántas cuentas con
  // rol Administrador existan.
  //
  // MIGRADO (11/8/2026): antes le pegaba directo al Worker de Cloudflare
  // correo-cotizaciones.cris-delgado21.workers.dev — se descubrió que ese
  // dominio (*.workers.dev) queda bloqueado en redes/computadoras con
  // ciertos antivirus o firewalls corporativos (filtro genérico contra
  // dominios usados en phishing). Ahora usa una Netlify Function que vive
  // en el MISMO dominio del sistema — mismo patrón que ya usaba el
  // comprobante de reserva (netlify/functions/comprobante-correo.js).
  const URL_CORREO_AVISOS = "/.netlify/functions/correo-cotizaciones";

  async function enviarCorreoAdmins(asunto, html) {
    try {
      const snap = await firebase.firestore().collection("usuarios")
        .where("recibeAvisosOperativos", "==", true)
        .get();
      const correos = snap.docs
        .filter(d => d.data().estado !== "Inactivo")
        .map(d => d.data().correo)
        .filter(Boolean);

      if (correos.length === 0) {
        console.warn('No hay ningún usuario con "recibeAvisosOperativos: true" y correo cargado — no se envió el aviso automático.');
        return;
      }

      const respuesta = await fetch(URL_CORREO_AVISOS, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: correos, subject: asunto, html })
      });
      // NUEVO: antes el Worker siempre devolvía 200 "OK" sin importar si
      // el correo realmente salió o no — ahora la Netlify Function reenvía
      // la respuesta REAL del Apps Script, así que sí se puede detectar un
      // fallo de verdad (cuota excedida, error del script, etc.).
      if (!respuesta.ok) {
        const texto = await respuesta.text().catch(() => "");
        console.error("El envío del correo automático respondió con error:", respuesta.status, texto);
      }
    } catch (e) {
      console.error("No se pudo enviar el correo automático:", e);
    }
  }
  window.enviarCorreoAdmins = enviarCorreoAdmins;

  // Arma el HTML del correo con el mismo estilo que ya usaba el aviso de
  // "nueva solicitud de cotización" — título en el color de marca, una
  // fila por dato, y un botón naranja "Ver en el sistema" que lleva
  // directo al detalle de lo que sea que disparó el aviso.
  function construirHtmlCorreoAviso(titulo, filas, urlDetalle, textoBoton) {
    const filasHtml = filas
      .filter(([, valor]) => valor)
      .map(([etiqueta, valor]) => `<p><strong>${etiqueta}:</strong> ${valor}</p>`)
      .join("");
    return `
      <h2 style="color:#02535a;">${titulo}</h2>
      ${filasHtml}
      <a href="${urlDetalle}" target="_blank" style="display:inline-block; padding:12px 20px; margin-top:15px; background-color:#f49859; color:white; text-decoration:none; border-radius:8px; font-weight:bold;">${textoBoton || 'Ver en el sistema'}</a>
      <p style="margin-top:20px; font-size:12px; color:#888;">Equipo Excursiones Delgado</p>
    `;
  }
  window.construirHtmlCorreoAviso = construirHtmlCorreoAviso;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", inicializarTopbar);
  } else {
    inicializarTopbar();
  }
})();
