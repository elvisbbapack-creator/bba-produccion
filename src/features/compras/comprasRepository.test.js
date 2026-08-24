import {
  filtrarMaterialesComprables
} from "./ComprasV2";
import {
  calcularResumenOrdenCompra,
  construirHtmlOrdenCompra
} from "./ordenCompraDocumento";
import {
  agruparSolicitudesPorProveedor,
  calcularTotalesOrdenCompra,
  construirTextoAvisoInternoOrdenCompra,
  construirTextoOrdenCompra,
  construirTextoSolicitudCotizacionCompra,
  construirUrlPublicaOrdenCompra,
  crearEnlaceCorreoAvisoContabilidad,
  crearEnlaceCorreoAvisoSolicitantes,
  crearEnlaceCorreoOrdenCompra,
  crearEnlaceCorreoSolicitudCotizacionCompra,
  crearEnlaceWhatsappOrdenCompra,
  crearEnlaceWhatsappSolicitudCotizacionCompra,
  prepararSolicitudCompra,
  prepararOrdenCompra,
  prepararSolicitudCotizacionCompra,
  proveedorDesdeMaterial,
  siguienteCodigoOrdenCompra,
  siguienteCodigoSolicitudCotizacion
} from "./comprasRepository";

describe("comprasRepository", () => {
  test("filtra materiales comprables por texto y solo muestra MP/SUM activos", () => {
    const materiales = [
      {
        id: "m1",
        tipo: "MP",
        codigo: "MP0001",
        nombre: "Tubo 15x15x1 mm",
        activo: true
      },
      {
        id: "m2",
        tipo: "SUM",
        codigo: "SUM0030",
        nombre: "Tinta UV CMYK",
        activo: true
      },
      {
        id: "m3",
        tipo: "RF",
        codigo: "RF0001",
        nombre: "Tubo cortado",
        activo: true
      },
      {
        id: "m4",
        tipo: "MP",
        codigo: "MP0002",
        nombre: "PAI Blanco",
        activo: false
      }
    ];

    expect(
      filtrarMaterialesComprables(materiales, "tubo")
        .map(material => material.codigo)
    ).toEqual(["MP0001"]);
    expect(
      filtrarMaterialesComprables(materiales, "tinta")
        .map(material => material.codigo)
    ).toEqual(["SUM0030"]);
  });

  test("propone el siguiente correlativo OC disponible", () => {
    expect(
      siguienteCodigoOrdenCompra([
        { codigo: "OC0001" },
        { codigo: "OC0003" },
        { codigo: "otro" }
      ])
    ).toBe("OC0002");
  });

  test("guarda trazabilidad de la solicitud interna", () => {
    const solicitud = prepararSolicitudCompra({
      empresaId: "bba",
      plantaId: "chile",
      areaSolicitante: "mantencion",
      motivoSolicitud: "herramienta_equipo",
      solicitudInternaId: "bba__chile__REQ20260824-12345",
      solicitudInternaCodigo: "REQ20260824-12345",
      lineaSolicitudNumero: 2,
      material: {
        id: "m1",
        codigo: "SUM0001",
        nombre: "Disco corte",
        tipo: "SUM",
        unidad_medida: "unidad"
      },
      proveedor: {
        proveedor_nombre: "Ferretería"
      },
      cantidad: 4,
      prioridad: "alta",
      usuario: {
        uid: "u1",
        nombre: "Edgar",
        email: "edgar@bbapack.com"
      }
    });

    expect(solicitud).toMatchObject({
      area_solicitante_id: "mantencion",
      area_solicitante_nombre: "Mantención",
      motivo_solicitud_id: "herramienta_equipo",
      motivo_solicitud_nombre: "Herramienta o equipo",
      solicitud_interna_codigo: "REQ20260824-12345",
      linea_solicitud_numero: 2,
      solicitado_por_id: "u1",
      solicitado_por_nombre: "Edgar",
      solicitado_por_email: "edgar@bbapack.com"
    });
  });

  test("usa el proveedor preferente del material", () => {
    const proveedor = proveedorDesdeMaterial(
      {
        proveedor_preferente_codigo: "PRV001",
        proveedor_preferente_nombre: "Acero Chile"
      },
      [
        {
          id: "p1",
          codigo: "PRV001",
          nombre: "Acero Chile",
          email: "ventas@acero.cl",
          telefono: "+56911112222",
          condicion_pago: "Factura 30",
          requiere_cotizacion_previa: true
        }
      ]
    );

    expect(proveedor).toMatchObject({
      proveedor_id: "p1",
      proveedor_codigo: "PRV001",
      proveedor_email: "ventas@acero.cl",
      condicion_pago: "Factura 30",
      proveedor_requiere_cotizacion_previa: true
    });
  });

  test("agrupa solo solicitudes pendientes por proveedor", () => {
    const grupos =
      agruparSolicitudesPorProveedor([
        {
          id: "s1",
          estado: "pendiente",
          proveedor_id: "p1",
          proveedor_nombre: "Acero",
          cantidad: 2
        },
        {
          id: "s2",
          estado: "en_oc",
          proveedor_id: "p1",
          proveedor_nombre: "Acero",
          cantidad: 5
        },
        {
          id: "s3",
          estado: "pendiente",
          proveedor_id: "p1",
          proveedor_nombre: "Acero",
          cantidad: 3
        }
      ]);

    expect(grupos).toHaveLength(1);
    expect(grupos[0].solicitudes.map(item => item.id))
      .toEqual(["s1", "s3"]);
  });

  test("calcula totales y texto de OC", () => {
    const orden = prepararOrdenCompra({
      empresaId: "bba",
      plantaId: "chile",
      codigo: "OC0004",
      proveedor: {
        proveedor_id: "p1",
        proveedor_codigo: "PRV001",
        proveedor_nombre: "Acero",
        proveedor_email: "ventas@acero.cl",
        proveedor_telefono: "+56911112222"
      },
      solicitudes: [
        {
          id: "s1",
          material_id: "m1",
          material_codigo: "MP0001",
          material_nombre: "Tubo",
          material_tipo: "MP",
          unidad_medida: "m",
          cantidad: 10,
          costo_unitario_referencial: 2500,
          moneda: "CLP",
          area_solicitante_nombre: "Producción",
          motivo_solicitud_nombre: "Consumo por OT",
          solicitud_interna_codigo: "REQ20260824-12345",
          solicitado_por_nombre: "Edgar",
          solicitado_por_email: "edgar@bbapack.com"
        }
      ],
      usuario: {
        uid: "u1",
        nombre: "Elvis"
      }
    });

    expect(calcularTotalesOrdenCompra(orden.items))
      .toMatchObject({
        subtotal: 25000,
        total: 25000
      });
    expect(construirTextoOrdenCompra(orden))
      .toContain("Orden de compra OC0004");
    expect(construirTextoOrdenCompra(orden))
      .toContain("Producción | Consumo por OT");
    expect(construirTextoOrdenCompra(orden))
      .toContain("Req REQ20260824-12345");
    expect(construirTextoOrdenCompra(orden))
      .toContain("PU CLP 2.500");
    expect(construirTextoOrdenCompra(orden))
      .toContain("Total línea CLP 25.000");
    expect(crearEnlaceCorreoOrdenCompra(orden))
      .toContain("mailto:ventas%40acero.cl");
    expect(crearEnlaceWhatsappOrdenCompra(orden))
      .toContain("https://wa.me/56911112222");
    expect(
      construirUrlPublicaOrdenCompra(
        {
          ...orden,
          token_compartir: "token-oc-0004"
        },
        "https://bba-erp-pruebas.web.app"
      )
    ).toBe(
      "https://bba-erp-pruebas.web.app/oc-publica/token-oc-0004"
    );
    expect(
      crearEnlaceWhatsappOrdenCompra(
        {
          ...orden,
          token_compartir: "token-oc-0004"
        },
        {
          urlPublica:
            "https://bba-erp-pruebas.web.app/oc-publica/token-oc-0004"
        }
      )
    ).toContain("oc-publica%2Ftoken-oc-0004");
    expect(construirTextoAvisoInternoOrdenCompra(
      orden,
      "recibida"
    )).toContain("Almacén ya registró la recepción");
    expect(crearEnlaceCorreoAvisoSolicitantes(
      orden,
      {
        correoContabilidad: "contabilidad@bbapack.com"
      }
    )).toContain("mailto:edgar@bbapack.com");
    expect(crearEnlaceCorreoAvisoContabilidad(
      orden,
      {
        correoContabilidad: "contabilidad@bbapack.com"
      }
    )).toContain("mailto:contabilidad@bbapack.com");
  });

  test("prepara solicitud de cotizacion sin exponer precios internos", () => {
    expect(
      siguienteCodigoSolicitudCotizacion([
        { codigo: "SC0001" },
        { codigo: "SC0003" }
      ])
    ).toBe("SC0002");

    const solicitudCotizacion =
      prepararSolicitudCotizacionCompra({
        empresaId: "bba",
        plantaId: "chile",
        codigo: "SC0002",
        proveedor: {
          proveedor_id: "p1",
          proveedor_codigo: "PRV001",
          proveedor_nombre: "Acero",
          proveedor_email: "ventas@acero.cl",
          proveedor_telefono: "+56911112222"
        },
        solicitudes: [
          {
            id: "s1",
            material_id: "m1",
            material_codigo: "MP0001",
            material_nombre: "Tubo",
            material_tipo: "MP",
            unidad_medida: "m",
            cantidad: 10,
            costo_unitario_referencial: 2500,
            moneda: "CLP",
            area_solicitante_nombre: "Producción",
            motivo_solicitud_nombre: "Consumo por OT",
            solicitud_interna_codigo: "REQ20260824-12345",
            fecha_requerida: "2026-08-30"
          }
        ],
        usuario: {
          uid: "u1",
          nombre: "Elvis"
        }
      });

    expect(solicitudCotizacion).toMatchObject({
      codigo: "SC0002",
      estado: "solicitada",
      total_referencial: 25000
    });

    const texto =
      construirTextoSolicitudCotizacionCompra(
        solicitudCotizacion
      );

    expect(texto)
      .toContain("Solicitud de cotización SC0002");
    expect(texto)
      .toContain("precio unitario");
    expect(texto)
      .toContain("Fecha requerida 2026-08-30");
    expect(texto)
      .not.toContain("2.500");
    expect(crearEnlaceCorreoSolicitudCotizacionCompra(
      solicitudCotizacion
    )).toContain("mailto:ventas%40acero.cl");
    expect(crearEnlaceWhatsappSolicitudCotizacionCompra(
      solicitudCotizacion
    )).toContain("https://wa.me/56911112222");
  });

  test("construye documento imprimible de OC con IVA y condiciones", () => {
    const orden = {
      codigo: "OC0005",
      proveedor_nombre: "Inchalam S.A.",
      proveedor_email: "ventas@inchalam.cl",
      proveedor_telefono: "+56911112222",
      condicion_pago: "Factura 60",
      creado_por_nombre: "Elvis",
      subtotal: 100000,
      items: [
        {
          material_codigo: "MP0001",
          material_nombre: "Alambre Crudo BCC 2.7 mm",
          cantidad: 100,
          unidad_medida: "kg",
          costo_unitario: 1000,
          total_linea: 100000,
          fecha_requerida: "2026-08-24",
          solicitud_interna_codigo: "REQ20260824-12345"
        }
      ]
    };

    expect(calcularResumenOrdenCompra(orden))
      .toMatchObject({
        subtotal: 100000,
        iva: 19000,
        total: 119000
      });

    const html = construirHtmlOrdenCompra(orden);

    expect(html).toContain("Pedido de compra #OC0005");
    expect(html).toContain("Inchalam S.A.");
    expect(html).toContain("Gaby Huanca");
    expect(html).toContain("(+56) 9 2850 7414");
    expect(html).toContain("Alambre Crudo BCC 2.7 mm");
    expect(html).toContain("Req REQ20260824-12345");
    expect(html).toContain("IVA");
    expect(html).toContain("$ 119.000");
    expect(html).toContain("HORARIO DE RECEPCIÓN");
    expect(html).not.toContain("<th class=\"right\">DESC</th>");
    expect(html).not.toContain("<th>IMPUESTO</th>");
  });
});
