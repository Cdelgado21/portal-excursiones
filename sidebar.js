// ==========================================
// SIDEBAR COMPARTIDO (sidebar.js)
// Reemplaza el menú lateral que antes estaba pegado a mano (HTML + CSS)
// en cada página por separado — por eso algunas páginas (ej. registro.html)
// tenían la lista incompleta: cada vez que se creaba una página nueva había
// que acordarse de agregarla a mano en TODAS las demás, y eso se olvidaba.
// Ahora la lista vive en un solo lugar (MENU_ITEMS, abajo) y se arma sola
// en cada página, resaltando automáticamente en cuál estás parado.
//
// Uso en cada página — SIEMPRE al final del <body>, después de topbar.js
// (topbar.js pone la barra de arriba; sidebar.js pone el menú de la
// izquierda; no dependen uno del otro para funcionar, pero van juntos):
//   <script src="topbar.js"></script>
//   <script src="sidebar.js"></script>
//
// IMPORTANTE para retirar el sidebar viejo de una página: hay que borrar de
// esa página (1) el <button class="toggle-btn">, (2) el <div class="sidebar"
// id="sidebar">...</div> completo, (3) el bloque de CSS de
// .toggle-btn/.sidebar/.nav-links/etc. en el <style>, y (4) la función
// inicializarMenuLateral() y su llamada — todo eso ahora lo pone y lo
// controla este archivo. El <main id="contenidoPrincipal"> SÍ se deja tal
// cual, es lo único que sidebar.js espera encontrar ya en la página.
// ==========================================

(function () {
  // NUEVO: lista única de páginas del menú — para agregar una página nueva
  // al menú de TODO el sistema, se agrega una sola línea acá, no en cada
  // archivo. archivo debe coincidir EXACTO con el nombre del .html real.
  const MENU_ITEMS = [
    { archivo: "dashboard.html", icono: "🏠", texto: "Inicio" },
    { archivo: "solicitud_cotizaciones.html", icono: "📨", texto: "Solicitud de Cotización" },
    { archivo: "reservas.html", icono: "🧳", texto: "Reservas" },
    { archivo: "reservas_historicas.html", icono: "🕓", texto: "Reservas Históricas" },
    { archivo: "registro.html", icono: "👥", texto: "Usuarios" },
    { archivo: "comisiones.html", icono: "🏆", texto: "Comisiones" },
    { archivo: "clientes.html", icono: "🧑‍💼", texto: "Clientes" },
    { archivo: "tours.html", icono: "🌎", texto: "Tours" },
    { archivo: "finanzas.html", icono: "💰", texto: "Finanzas" },
    { archivo: "gastos.html", icono: "🧾", texto: "Gastos" },
    { archivo: "proveedores.html", icono: "🏨", texto: "Proveedores" },
    { archivo: "salidas_grupales.html", icono: "🗓️", texto: "Salidas Grupales" },
    { archivo: "configuracion.html", icono: "⚙️", texto: "Configuración" }
  ];

  function inyectarEstilosSidebar() {
    if (document.getElementById("estilosSidebarSIED")) return;
    const estilo = document.createElement("style");
    estilo.id = "estilosSidebarSIED";
    estilo.textContent = `
      .toggle-btn {
        position: fixed;
        top: 20px;
        left: 20px;
        font-size: 24px;
        background: white;
        color: #02535a;
        border: none;
        border-radius: 50%;
        padding: 8px 12px;
        z-index: 1100;
        cursor: pointer;
        box-shadow: 0 2px 6px rgba(0,0,0,0.15);
      }
      .sidebar {
        position: fixed;
        top: 0;
        left: 0;
        width: 250px;
        height: 100%;
        background-color: #02535a;
        color: white;
        padding: 20px;
        transform: translateX(-250px);
        transition: transform 0.3s ease;
        z-index: 1000;
        overflow-y: auto;
        box-sizing: border-box;
        font-family: Arial, Helvetica, sans-serif;
      }
      .sidebar.active {
        transform: translateX(0);
      }
      .sidebar .user-info {
        text-align: center;
        margin-bottom: 20px;
        margin-top: 40px;
      }
      .sidebar .user-info .avatar {
        width: 70px;
        height: 70px;
        border-radius: 50%;
        margin-bottom: 10px;
      }
      .sidebar .user-info h3 {
        font-size: 1rem;
        margin: 0;
        color: white;
      }
      .sidebar .user-info small {
        font-size: 0.8rem;
        color: #f4f7f8;
      }
      .nav-links {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      .nav-links li a {
        background-color: #f4f7f8;
        color: #02535a;
        padding: 8px 12px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        text-decoration: none;
        margin-bottom: 8px;
        font-weight: bold;
        font-size: 14px;
      }
      .nav-links li a:hover {
        background-color: #e0e0e0;
      }
      .nav-links li a.activo {
        background-color: #ffb703;
        color: #02535a;
      }
      .nav-links .icon {
        margin-right: 10px;
        font-size: 1.2rem;
      }
      main#contenidoPrincipal {
        margin-left: 0;
        padding: 20px 20px 20px 70px;
        transition: margin-left 0.3s ease;
        box-sizing: border-box;
      }
      main#contenidoPrincipal.sidebar-visible {
        margin-left: 250px;
        padding-left: 20px;
      }
      @media screen and (max-width: 768px) {
        main#contenidoPrincipal.sidebar-visible {
          margin-left: 0;
          padding-left: 70px;
        }
      }
    `;
    document.head.appendChild(estilo);
  }

  function obtenerUsuarioSesion() {
    try {
      return JSON.parse(localStorage.getItem("usuario") || "null");
    } catch (e) {
      return null;
    }
  }

  function archivoActual() {
    const partes = window.location.pathname.split("/");
    return partes[partes.length - 1] || "dashboard.html";
  }

  function construirNavHTML() {
    const actual = archivoActual();
    const items = MENU_ITEMS.map(item => `
      <li>
        <a href="${item.archivo}" class="${item.archivo === actual ? 'activo' : ''}">
          <span class="icon">${item.icono}</span>${item.texto}
        </a>
      </li>
    `).join("");

    return items + `
      <li><a href="#" id="linkCerrarSesionSidebar"><span class="icon">🚪</span>Cerrar sesión</a></li>
    `;
  }

  function construirSidebarHTML(usuario) {
    const fotoURL = usuario?.fotoURL || "https://cdn-icons-png.flaticon.com/512/219/219986.png";
    return `
      <div class="user-info">
        <img src="${fotoURL}" class="avatar" alt="Usuario">
        <h3>${usuario?.nombre || "Cargando..."}</h3>
        <small>${usuario?.rol || "-"}</small>
      </div>
      <ul class="nav-links">
        ${construirNavHTML()}
      </ul>
    `;
  }

  function inicializarSidebar() {
    inyectarEstilosSidebar();

    const usuario = obtenerUsuarioSesion();

    const toggleBtn = document.createElement("button");
    toggleBtn.className = "toggle-btn";
    toggleBtn.id = "botonToggleSidebar";
    toggleBtn.textContent = "☰";
    document.body.insertBefore(toggleBtn, document.body.firstChild);

    const sidebar = document.createElement("div");
    sidebar.className = "sidebar";
    sidebar.id = "sidebar";
    sidebar.innerHTML = construirSidebarHTML(usuario);
    document.body.insertBefore(sidebar, document.body.firstChild.nextSibling);

    const contenido = document.getElementById("contenidoPrincipal");

    function checkScreenSize() {
      if (window.innerWidth <= 768) {
        sidebar.classList.remove("active");
        if (contenido) contenido.classList.remove("sidebar-visible");
      } else {
        sidebar.classList.add("active");
        if (contenido) contenido.classList.add("sidebar-visible");
      }
    }

    window.toggleSidebar = function () {
      sidebar.classList.toggle("active");
      if (contenido) contenido.classList.toggle("sidebar-visible");
    };
    toggleBtn.addEventListener("click", window.toggleSidebar);

    const linkCerrar = document.getElementById("linkCerrarSesionSidebar");
    if (linkCerrar) {
      linkCerrar.addEventListener("click", (e) => {
        e.preventDefault();
        // NUEVO: reusa window.cerrarSesion si ya existe (auth-guard.js lo
        // define con el cierre de sesión REAL de Firebase) — si por algún
        // motivo esta página no cargó auth-guard.js, cae a un cierre
        // simple de respaldo.
        if (window.cerrarSesion) {
          window.cerrarSesion();
        } else {
          localStorage.removeItem("usuario");
          window.location.href = "login.html";
        }
      });
    }

    window.addEventListener("resize", checkScreenSize);
    checkScreenSize();

    // NUEVO: si auth-guard.js todavía no terminó de verificar la sesión
    // cuando este script corrió, el nombre/rol del usuario van a quedar en
    // "Cargando..." — se actualizan solos apenas auth-guard.js confirme
    // quién es (evento "usuarioVerificado").
    document.addEventListener("usuarioVerificado", (e) => {
      const u = e.detail;
      const nombreEl = sidebar.querySelector(".user-info h3");
      const rolEl = sidebar.querySelector(".user-info small");
      const avatarEl = sidebar.querySelector(".user-info .avatar");
      if (nombreEl) nombreEl.textContent = u.nombre || "Usuario";
      if (rolEl) rolEl.textContent = u.rol || "";
      if (avatarEl && u.fotoURL) avatarEl.src = u.fotoURL;
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", inicializarSidebar);
  } else {
    inicializarSidebar();
  }
})();
