const numero = valor => {
  const convertido = Number(valor);
  return Number.isFinite(convertido)
    ? convertido
    : 0;
};

const limpiarTexto = valor =>
  (valor || "").toString().trim();

const escaparHtml = valor =>
  limpiarTexto(valor)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const formatoNumero = valor =>
  numero(valor).toLocaleString("es-CL");

const formatoMoneda = valor =>
  `$ ${Math.round(numero(valor)).toLocaleString("es-CL")}`;

const formatoFecha = valor => {
  if (!valor) {
    return "";
  }

  if (typeof valor?.toDate === "function") {
    return valor.toDate().toLocaleDateString("es-CL");
  }

  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime())
    ? limpiarTexto(valor)
    : fecha.toLocaleDateString("es-CL");
};

const formatoFechaHora = valor => {
  if (!valor) {
    return new Date().toLocaleString("es-CL");
  }

  if (typeof valor?.toDate === "function") {
    return valor.toDate().toLocaleString("es-CL");
  }

  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime())
    ? limpiarTexto(valor)
    : fecha.toLocaleString("es-CL");
};

export const calcularResumenOrdenCompra = orden => {
  const subtotal = numero(orden?.subtotal || orden?.total);
  const iva = Math.round(subtotal * 0.19);

  return {
    subtotal,
    iva,
    total: subtotal + iva
  };
};

export const construirHtmlOrdenCompra = (
  orden,
  {
    comprador = "",
    fechaEntrega = "",
    direccionEnvio = {},
    mostrarAcciones = true
  } = {}
) => {
  const resumen = calcularResumenOrdenCompra(orden);
  const compradorNombre = limpiarTexto(comprador) || "Gaby Huanca";
  const condicionPago =
    limpiarTexto(orden?.condicion_pago) ||
    "Por definir";
  const fechaPedido = formatoFechaHora(
    orden?.creado_en
  );
  const entrega = formatoFecha(fechaEntrega) ||
    "Por coordinar";
  const envio = {
    titulo: "Dirección de Envío",
    area: "Logística",
    direccion: "El Juncal 240, Bodega 19",
    comuna: "Quilicura",
    ciudad: "Santiago",
    pais: "Chile",
    telefono: "(+56) 9 2850 7414",
    ...direccionEnvio
  };

  const filas = (orden?.items || [])
    .map(item => {
      const totalLinea =
        numero(item.total_linea) ||
        numero(item.cantidad) *
          numero(item.costo_unitario);

      return `
        <tr>
          <td>
            <strong>${escaparHtml(item.material_nombre)}</strong>
            <small>${escaparHtml(item.material_codigo)}</small>
            ${item.solicitud_interna_codigo
              ? `<small>Req ${escaparHtml(item.solicitud_interna_codigo)}</small>`
              : ""}
            ${item.ot_codigo
              ? `<small>OT ${escaparHtml(item.ot_codigo)}</small>`
              : ""}
          </td>
          <td>${escaparHtml(formatoFecha(item.fecha_requerida))}</td>
          <td class="right">${escaparHtml(formatoNumero(item.cantidad))}</td>
          <td>${escaparHtml(item.unidad_medida)}</td>
          <td class="right">${escaparHtml(formatoMoneda(item.costo_unitario))}</td>
          <td class="right">${escaparHtml(formatoMoneda(totalLinea))}</td>
        </tr>
      `;
    })
    .join("");

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>OC ${escaparHtml(orden?.codigo)} - BBA</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #F1F5F9;
      color: #111827;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 13px;
    }
    .page {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      padding: 16mm 18mm;
      background: white;
    }
    .header {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 26px;
      align-items: start;
    }
    .logo {
      width: 58px;
      height: 58px;
      object-fit: contain;
      margin-bottom: 34px;
    }
    .empresa {
      text-align: left;
      font-weight: 700;
      line-height: 1.65;
    }
    .bloque {
      line-height: 1.55;
      white-space: pre-line;
    }
    .proveedor {
      padding-top: 52px;
    }
    h1 {
      color: #006BFF;
      font-size: 28px;
      font-weight: 400;
      margin: 28px 0 24px;
    }
    .meta {
      display: grid;
      grid-template-columns: 1fr 1.2fr 1fr;
      gap: 28px;
      margin-bottom: 26px;
    }
    .meta strong,
    .pago strong {
      display: block;
      margin-bottom: 8px;
      font-size: 13px;
      color: #111827;
    }
    .pago {
      display: grid;
      grid-template-columns: 190px 1fr;
      gap: 28px;
      margin-bottom: 22px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      border-top: 2px solid #111827;
      border-bottom: 2px solid #111827;
    }
    th {
      padding: 13px 5px 12px;
      text-align: left;
      font-size: 12px;
      font-weight: 700;
    }
    td {
      padding: 10px 5px;
      vertical-align: top;
    }
    td small {
      display: block;
      color: #64748B;
      margin-top: 3px;
      font-size: 10px;
    }
    .right { text-align: right; }
    .totales {
      display: grid;
      grid-template-columns: 1fr 320px;
      gap: 24px;
      margin-top: 14px;
    }
    .totales table {
      border-top: 0;
      border-bottom: 2px solid #111827;
    }
    .totales td {
      padding: 9px 0;
      font-size: 13px;
    }
    .condiciones {
      margin-top: 28px;
      line-height: 1.55;
    }
    .condiciones h2 {
      font-size: 14px;
      margin: 22px 0 10px;
      font-weight: 500;
    }
    .footer {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 18px;
      align-items: end;
      margin-top: 54px;
      font-size: 13px;
    }
    .links { color: #006BFF; line-height: 1.45; }
    .footer-center { text-align: center; line-height: 1.45; }
    .claim {
      text-align: right;
      font-weight: 700;
      font-size: 15px;
    }
    .actions {
      position: sticky;
      top: 0;
      z-index: 5;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 10px;
      background: #0F172A;
    }
    @media screen and (max-width: 760px) {
      body { background: white; }
      .page {
        width: 100%;
        min-height: auto;
        padding: 18px 16px;
      }
      .header,
      .meta,
      .pago,
      .totales,
      .footer {
        grid-template-columns: 1fr;
        gap: 12px;
      }
      .proveedor { padding-top: 18px; }
      h1 { font-size: 24px; margin: 22px 0 18px; }
      table {
        display: block;
        overflow-x: auto;
        white-space: nowrap;
      }
      .actions { justify-content: center; }
    }
    .actions button {
      border: 0;
      border-radius: 10px;
      padding: 10px 16px;
      color: white;
      background: #2563EB;
      font-weight: 700;
      cursor: pointer;
    }
    @media print {
      body { background: white; }
      .page {
        width: auto;
        min-height: auto;
        margin: 0;
        padding: 0;
      }
      .actions { display: none; }
      @page { size: A4; margin: 16mm 18mm; }
    }
  </style>
</head>
<body>
  ${mostrarAcciones
    ? `<div class="actions">
    <button onclick="window.print()">Imprimir / Guardar PDF</button>
  </div>`
    : ""}
  <main class="page">
    <section class="header">
      <div>
        <img class="logo" src="/logo-bba.png" alt="BBA" />
        <div class="bloque">
          <strong>${escaparHtml(envio.titulo)}</strong>
          ${escaparHtml(envio.area)}
          ${escaparHtml(envio.direccion)}
          ${escaparHtml(envio.comuna)}
          ${escaparHtml(envio.ciudad)}
          ${escaparHtml(envio.pais)}
          ${escaparHtml(envio.telefono)}
        </div>
      </div>
      <div>
        <div class="empresa">
          BBA CHILE SPA<br />
          RUT: 78063084-1
        </div>
        <div class="bloque proveedor">
          <strong>${escaparHtml(orden?.proveedor_nombre)}</strong>
          ${orden?.proveedor_codigo ? `Código: ${escaparHtml(orden.proveedor_codigo)}` : ""}
          ${orden?.proveedor_email ? `Email: ${escaparHtml(orden.proveedor_email)}` : ""}
          ${orden?.proveedor_telefono ? `Tel: ${escaparHtml(orden.proveedor_telefono)}` : ""}
        </div>
      </div>
    </section>

    <h1>Pedido de compra #${escaparHtml(orden?.codigo)}</h1>

    <section class="meta">
      <div>
        <strong>Comprador</strong>
        ${escaparHtml(compradorNombre)}
      </div>
      <div>
        <strong>Fecha del Pedido</strong>
        ${escaparHtml(fechaPedido)}
      </div>
      <div>
        <strong>Fecha del Entrega</strong>
        ${escaparHtml(entrega)}
      </div>
    </section>

    <section class="pago">
      <strong>CONDICIÓN DE PAGO:</strong>
      <span>${escaparHtml(condicionPago)}</span>
    </section>

    <table>
      <thead>
        <tr>
          <th>DESCRIPCIÓN</th>
          <th>FECHA REQ</th>
          <th class="right">CANTIDAD</th>
          <th>UN</th>
          <th class="right">P UNIT</th>
          <th class="right">MONTO</th>
        </tr>
      </thead>
      <tbody>
        ${filas || `<tr><td colspan="6">Sin líneas registradas.</td></tr>`}
      </tbody>
    </table>

    <section class="totales">
      <div></div>
      <table>
        <tbody>
          <tr>
            <td>Subtotal</td>
            <td class="right">${escaparHtml(formatoMoneda(resumen.subtotal))}</td>
          </tr>
          <tr>
            <td>IVA</td>
            <td class="right">${escaparHtml(formatoMoneda(resumen.iva))}</td>
          </tr>
          <tr>
            <td>Total</td>
            <td class="right">${escaparHtml(formatoMoneda(resumen.total))}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="condiciones">
      <h2>ENTREGA DE MATERIALES</h2>
      <p>1. Entregar los sgtes. documentos junto con el material: Orden de Compra, Guía de Remisión, Factura, Letra.</p>
      <p>2. Sírvase entregar el material debidamente embalado y rotulado con el número de Orden de Compra.</p>

      <h2>HORARIO DE RECEPCIÓN</h2>
      <p>1. Lunes a viernes de 8:00am a 17:00pm</p>
      <p>2. Sábados de 8:00am a 12:00pm</p>

      <h2>DEVOLUCIÓN DE MATERIALES</h2>
      <p>Los materiales que no se ajusten a lo requerido en la presente Orden de Compra, serán devueltos y los gastos que esto ocasione serán cargados a cuenta del proveedor.</p>
    </section>

    <footer class="footer">
      <div class="links">
        bbachile.cl<br />
        bbapack.com
      </div>
      <div class="footer-center">
        BBA CHILE SPA<br />
        RUT: 78063084-1
      </div>
      <div class="claim">Crea sin límites.</div>
    </footer>
  </main>
</body>
</html>`;
};

export const abrirOrdenCompraImprimible = (
  orden,
  opciones = {}
) => {
  const ventana = window.open("", "_blank");

  if (!ventana) {
    throw new Error(
      "El navegador bloqueó la ventana del PDF. Permite ventanas emergentes para generar la OC."
    );
  }

  ventana.document.open();
  ventana.document.write(
    construirHtmlOrdenCompra(orden, opciones)
  );
  ventana.document.close();
  ventana.focus();

  setTimeout(() => {
    ventana.print();
  }, 500);
};
