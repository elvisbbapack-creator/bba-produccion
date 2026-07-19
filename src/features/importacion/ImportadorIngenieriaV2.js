import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";
import * as XLSX from "xlsx";
import BotonVolver from "../../components/BotonVolver";
import {
  actualizarMaterial,
  crearMaterial,
  listarMateriales
} from "../materiales/materialesRepository";
import {
  guardarOperacionCatalogo,
  listarOperacionesCatalogo
} from "../detalles/detallesRepository";
import {
  guardarPieza,
  listarPiezas
} from "../piezas/piezasRepository";
import {
  actualizarComposicionProducto,
  crearProductoConRuta,
  guardarOperacionRuta,
  listarProductos,
  obtenerRuta
} from "../productos/productosRepository";
import {
  guardarSubproducto,
  listarSubproductos
} from "../subproductos/subproductosRepository";
import {
  hojasPlantillaIngenieria,
  leerIngenieriaDesdeWorkbook,
  resumenIngenieria
} from "./importacionIngenieriaUtils";

const campo = {
  width: "100%",
  padding: 11,
  borderRadius: 8,
  border: "1px solid #CBD5E1",
  boxSizing: "border-box",
  fontSize: 15
};

const porCodigo = lista =>
  new Map(
    lista.map(item => [item.codigo, item])
  );

const descargarPlantilla = () => {
  const workbook = XLSX.utils.book_new();

  Object.entries(hojasPlantillaIngenieria)
    .forEach(([nombre, filas]) => {
      const sheet =
        XLSX.utils.aoa_to_sheet(filas);
      XLSX.utils.book_append_sheet(
        workbook,
        sheet,
        nombre
      );
    });

  XLSX.writeFile(
    workbook,
    "plantilla-ingenieria-bba.xlsx"
  );
};

function ImportadorIngenieriaV2({
  db,
  perfil,
  onVolver
}) {
  const [archivoNombre, setArchivoNombre] =
    useState("");
  const [preview, setPreview] = useState(null);
  const [catalogos, setCatalogos] = useState({
    productos: [],
    piezas: [],
    subproductos: [],
    operaciones: [],
    materiales: []
  });
  const [cargando, setCargando] =
    useState(true);
  const [importando, setImportando] =
    useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const resumen = useMemo(
    () => resumenIngenieria(preview),
    [preview]
  );

  const cargarCatalogos = useCallback(
    async () => {
      try {
        setCargando(true);
        setError("");
        const [
          productos,
          piezas,
          subproductos,
          operaciones,
          materiales
        ] = await Promise.all([
          listarProductos(db, perfil.empresa_id),
          listarPiezas(db, perfil.empresa_id),
          listarSubproductos(
            db,
            perfil.empresa_id
          ),
          listarOperacionesCatalogo(
            db,
            perfil.empresa_id
          ),
          listarMateriales(db, perfil.empresa_id)
        ]);
        setCatalogos({
          productos,
          piezas,
          subproductos,
          operaciones,
          materiales
        });
      } catch (fallo) {
        setError(
          fallo?.message ||
          "No se pudieron cargar los catálogos actuales."
        );
      } finally {
        setCargando(false);
      }
    },
    [db, perfil.empresa_id]
  );

  useEffect(() => {
    cargarCatalogos();
  }, [cargarCatalogos]);

  const validarContraCatalogos = useCallback(
    data => {
      const errores = [...data.errores];
      const advertencias = [
        ...data.advertencias
      ];
      const materiales = porCodigo(
        [
          ...catalogos.materiales,
          ...(data.materiales || [])
        ]
      );
      const existentes = {
        productos: porCodigo(
          catalogos.productos
        ),
        piezas: porCodigo(catalogos.piezas),
        subproductos: porCodigo(
          catalogos.subproductos
        ),
        operaciones: porCodigo(
          catalogos.operaciones
        )
      };

      data.piezas.forEach(pieza => {
        (pieza.materiales_base_codigos || []).forEach(
          materialCodigo => {
            if (!materiales.has(materialCodigo)) {
              errores.push(
                `Pieza ${pieza.codigo} usa material base inexistente ${materialCodigo}.`
              );
            }
          }
        );
        if (existentes.piezas.has(pieza.codigo)) {
          advertencias.push(
            `Pieza ${pieza.codigo} ya existe y se omitirá.`
          );
        }
      });

      (data.materiales || []).forEach(material => {
        if (
          catalogos.materiales.some(
            existente =>
              existente.codigo === material.codigo
          )
        ) {
          advertencias.push(
            `Material ${material.codigo} ya existe y se usará como referencia.`
          );
        }
      });

      data.productos.forEach(producto => {
        if (
          existentes.productos.has(
            producto.codigo
          )
        ) {
          advertencias.push(
            `Producto ${producto.codigo} ya existe y se usará para la ruta.`
          );
        }
      });

      data.subproductos.forEach(
        subproducto => {
          if (
            existentes.subproductos.has(
              subproducto.codigo
            )
          ) {
            advertencias.push(
              `Subproducto ${subproducto.codigo} ya existe y se omitirá.`
            );
          }
        }
      );

      data.operaciones.forEach(operacion => {
        const materialesEntradaCodigos =
          (operacion.materiales_entrada_codigos || [])
            .length > 0
            ? operacion.materiales_entrada_codigos
            : operacion.material_entrada_codigo
              ? [operacion.material_entrada_codigo]
              : [];

        materialesEntradaCodigos
          .forEach(materialCodigo => {
            if (!materiales.has(materialCodigo)) {
              errores.push(
                `Operación ${operacion.codigo} usa material entrada inexistente ${materialCodigo}.`
              );
            }
          });
        if (
          operacion.material_salida_codigo &&
          !materiales.has(
            operacion.material_salida_codigo
          )
        ) {
          errores.push(
            `Operación ${operacion.codigo} usa material salida inexistente ${operacion.material_salida_codigo}.`
          );
        }
        if (
          existentes.operaciones.has(
            operacion.codigo
          )
        ) {
          advertencias.push(
            `Operación catálogo ${operacion.codigo} ya existe y se omitirá.`
          );
        }
      });

      return {
        ...data,
        errores,
        advertencias
      };
    },
    [catalogos]
  );

  const leerArchivo = async evento => {
    const archivo = evento.target.files?.[0];

    setError("");
    setMensaje("");
    setPreview(null);

    if (!archivo) {
      return;
    }

    try {
      setArchivoNombre(archivo.name);
      const buffer =
        await archivo.arrayBuffer();
      const workbook = XLSX.read(buffer, {
        type: "array"
      });
      const data = leerIngenieriaDesdeWorkbook(
        workbook,
        XLSX
      );
      setPreview(
        validarContraCatalogos(data)
      );
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo leer el Excel de ingeniería."
      );
    }
  };

  const importar = async () => {
    if (!preview || preview.errores.length > 0) {
      setError(
        "Corrige los errores del Excel antes de importar."
      );
      return;
    }

    try {
      setImportando(true);
      setError("");
      setMensaje("");

      const materiales = porCodigo(
        catalogos.materiales
      );
      const productosExistentes = porCodigo(
        catalogos.productos
      );
      const piezasExistentes = porCodigo(
        catalogos.piezas
      );
      const subproductosExistentes = porCodigo(
        catalogos.subproductos
      );
      const operacionesExistentes = porCodigo(
        catalogos.operaciones
      );

      const productos = new Map(
        productosExistentes
      );
      const piezas = new Map(piezasExistentes);
      const subproductos = new Map(
        subproductosExistentes
      );
      const operaciones = new Map(
        operacionesExistentes
      );

      for (const producto of preview.productos) {
        if (productos.has(producto.codigo)) {
          continue;
        }
        const creado = await crearProductoConRuta(
          db,
          perfil.empresa_id,
          {
            ...producto,
            creada_por: perfil.uid
          }
        );
        productos.set(creado.codigo, creado);
      }

      for (const material of preview.materiales || []) {
        if (materiales.has(material.codigo)) {
          continue;
        }
        const producto = productos.get(
          material.producto_codigo
        );
        const subproducto = subproductos.get(
          material.subproducto_codigo
        );
        const creado = await crearMaterial(
          db,
          perfil.empresa_id,
          {
            ...material,
            producto_id: producto?.id || "",
            producto_codigo: producto?.codigo || "",
            producto_nombre: producto?.nombre || "",
            subproducto_id:
              subproducto?.id || "",
            subproducto_codigo:
              subproducto?.codigo || "",
            subproducto_nombre:
              subproducto?.nombre || "",
            proveedor_preferente_id: ""
          }
        );
        materiales.set(creado.codigo, creado);
      }

      for (const pieza of preview.piezas) {
        if (piezas.has(pieza.codigo)) {
          continue;
        }
        const materialesBase =
          (pieza.materiales_base_codigos || [])
            .map((materialCodigo, indice) => {
              const material =
                materiales.get(materialCodigo);
              if (!material) {
                return null;
              }
              return {
              material_id: material.id,
              material_codigo: material.codigo,
              material_nombre: material.nombre,
                cantidad:
                  pieza.materiales_base_cantidades?.[
                    indice
                  ] || 1
              };
            })
            .filter(Boolean);
        const producto = productos.get(
          pieza.producto_codigo
        );
        const subproducto = subproductos.get(
          pieza.subproducto_codigo
        );
        const creada = await guardarPieza(
          db,
          perfil.empresa_id,
          {
            codigo: pieza.codigo,
            nombre: pieza.nombre,
            medida: pieza.medida,
            material_base_id:
              materialesBase[0]?.material_id ||
              "",
            materiales_base: materialesBase,
            producto_id: producto?.id || "",
            producto_codigo: producto?.codigo || "",
            producto_nombre: producto?.nombre || "",
            subproducto_id:
              subproducto?.id || "",
            subproducto_codigo:
              subproducto?.codigo || "",
            subproducto_nombre:
              subproducto?.nombre || "",
            activo: pieza.activo
          },
          Array.from(piezas.values())
        );
        piezas.set(creada.codigo, creada);
      }

      for (const subproducto of preview.subproductos) {
        if (
          subproductosExistentes.has(
            subproducto.codigo
          )
        ) {
          continue;
        }
        const producto = productos.get(
          subproducto.producto_codigo
        );
        const piezaSalida = piezas.get(
          subproducto.pieza_salida_codigo
        );
        const componentes =
          preview.componentesSubproducto
            .filter(
              componente =>
                componente.subproducto_codigo ===
                subproducto.codigo
            )
            .map(componente => {
              const pieza = piezas.get(
                componente.pieza_codigo
              );
              return {
                pieza_id: pieza.id,
                pieza_codigo: pieza.codigo,
                pieza_nombre: pieza.nombre,
                cantidad: componente.cantidad
              };
            });

        const creado = await guardarSubproducto(
          db,
          perfil.empresa_id,
          {
            codigo: subproducto.codigo,
            nombre: subproducto.nombre,
            producto_id: producto.id,
            producto_codigo: producto.codigo,
            producto_nombre: producto.nombre,
            pieza_salida_id:
              piezaSalida?.id || "",
            pieza_salida_codigo:
              piezaSalida?.codigo || "",
            pieza_salida_nombre:
              piezaSalida?.nombre || "",
            componentes,
            activo: subproducto.activo
          },
          Array.from(
            subproductosExistentes.values()
          )
        );
        subproductos.set(creado.codigo, creado);
      }

      for (const material of preview.materiales || []) {
        if (
          material.tipo !== "RF" ||
          !material.subproducto_codigo
        ) {
          continue;
        }
        const existente = materiales.get(
          material.codigo
        );
        const producto = productos.get(
          material.producto_codigo
        );
        const subproducto = subproductos.get(
          material.subproducto_codigo
        );

        if (!existente || !subproducto) {
          continue;
        }

        const actualizado = await actualizarMaterial(
          db,
          perfil.empresa_id,
          existente.id,
          {
            ...existente,
            producto_id:
              producto?.id || existente.producto_id,
            producto_codigo:
              producto?.codigo ||
              existente.producto_codigo,
            producto_nombre:
              producto?.nombre ||
              existente.producto_nombre,
            subproducto_id: subproducto.id,
            subproducto_codigo: subproducto.codigo,
            subproducto_nombre: subproducto.nombre
          },
          Array.from(materiales.values())
        );
        materiales.set(
          actualizado.codigo,
          actualizado
        );
      }

      const composicionPorProducto = (
        preview.composicionProducto || []
      ).reduce((acumulado, item) => {
        const lista =
          acumulado.get(item.producto_codigo) || [];
        lista.push(item);
        acumulado.set(item.producto_codigo, lista);
        return acumulado;
      }, new Map());

      for (
        const [
          productoCodigo,
          composicion
        ] of composicionPorProducto.entries()
      ) {
        const producto = productos.get(productoCodigo);
        const composicionNormalizada =
          composicion.map(item => {
            const referencia =
              item.tipo === "SUBPRODUCTO"
                ? subproductos.get(item.item_codigo)
                : item.tipo === "PIEZA"
                  ? piezas.get(item.item_codigo)
                  : materiales.get(item.item_codigo);

            return {
              tipo: item.tipo,
              categoria: item.categoria,
              item_id: referencia.id,
              item_codigo: referencia.codigo,
              item_nombre: referencia.nombre,
              cantidad: item.cantidad
            };
          });

        await actualizarComposicionProducto(
          db,
          producto.id,
          composicionNormalizada
        );
      }

      for (const operacion of preview.operaciones) {
        const pieza = piezas.get(
          operacion.pieza_codigo
        );
        const materialesEntradaCodigos =
          (operacion.materiales_entrada_codigos || [])
            .length > 0
            ? operacion.materiales_entrada_codigos
            : operacion.material_entrada_codigo
              ? [operacion.material_entrada_codigo]
              : [];
        const materialesEntrada =
          materialesEntradaCodigos
            .map((materialCodigo, indice) => {
              const material =
                materiales.get(materialCodigo);
              if (!material) {
                return null;
              }
              return {
              material_id: material.id,
              material_codigo: material.codigo,
              material_nombre: material.nombre,
                cantidad:
                  operacion
                    .materiales_entrada_cantidades?.[
                      indice
                    ] || 1
              };
            })
            .filter(Boolean);
        const materialSalida =
          materiales.get(
            operacion.material_salida_codigo
          );

        if (
          !operacionesExistentes.has(
            operacion.codigo
          )
        ) {
          const creada = await guardarOperacionCatalogo(
            db,
            perfil.empresa_id,
            {
              codigo: operacion.codigo,
              nombre: operacion.nombre,
              pieza_id: pieza.id,
              pieza_codigo: pieza.codigo,
              pieza_nombre: pieza.nombre,
              medida: pieza.medida,
              material_entrada_id:
                materialesEntrada[0]?.material_id ||
                "",
              materiales_entrada:
                materialesEntrada,
              material_salida_id:
                materialSalida?.id || "",
              activo: true
            },
            Array.from(
              operaciones.values()
            )
          );
          operaciones.set(creada.codigo, creada);
        }
      }

      const operacionesExcel = porCodigo(
        preview.operaciones
      );

      const rutasPorEntidad = (
        preview.rutas || []
      ).reduce((acumulado, itemRuta) => {
        const clave = [
          itemRuta.tipo_ruta || "PRODUCTO",
          itemRuta.producto_codigo,
          itemRuta.subproducto_codigo || ""
        ].join("::");
        const lista = acumulado.get(clave) || [];
        lista.push(itemRuta);
        acumulado.set(clave, lista);
        return acumulado;
      }, new Map());

      for (const rutasEntidad of rutasPorEntidad.values()) {
        const primeraRuta = rutasEntidad[0];
        const producto = productos.get(
          primeraRuta.producto_codigo
        );
        const subproducto =
          primeraRuta.tipo_ruta === "SUBPRODUCTO"
            ? subproductos.get(
                primeraRuta.subproducto_codigo
              )
            : null;
        const opcionesRuta =
          primeraRuta.tipo_ruta === "SUBPRODUCTO"
            ? {
                tipoRuta: "SUBPRODUCTO",
                subproductoId: subproducto.id,
                entidadId: subproducto.id
              }
            : { tipoRuta: "PRODUCTO" };
        const version =
          primeraRuta.tipo_ruta === "SUBPRODUCTO"
            ? subproducto.version_ruta_activa || 1
            : producto.version_ruta_activa || 1;
        const ruta = await obtenerRuta(
          db,
          producto.id,
          perfil.empresa_id,
          version,
          opcionesRuta
        );
        const existentesRuta =
          ruta.operaciones || [];
        const codigosRuta = new Set(
          existentesRuta.map(
            item => item.operacion_codigo
          )
        );

        for (const itemRuta of rutasEntidad.sort(
          (a, b) => a.secuencia - b.secuencia
        )) {
          if (codigosRuta.has(itemRuta.codigo)) {
            continue;
          }
          const operacion =
            operacionesExcel.get(itemRuta.codigo) ||
            operaciones.get(itemRuta.codigo);
          const pieza = piezas.get(
            operacion.pieza_codigo
          );
          const materialesEntradaCodigos =
            (operacion.materiales_entrada_codigos || [])
              .length > 0
              ? operacion.materiales_entrada_codigos
              : operacion.material_entrada_codigo
                ? [operacion.material_entrada_codigo]
                : [];
          const materialesEntrada =
            materialesEntradaCodigos
              .map((materialCodigo, indice) => {
                const material =
                  materiales.get(materialCodigo);
                if (!material) {
                  return null;
                }
                return {
                material_id: material.id,
                material_codigo: material.codigo,
                material_nombre: material.nombre,
                  cantidad:
                    operacion
                      .materiales_entrada_cantidades?.[
                        indice
                      ] || 1
                };
              })
              .filter(Boolean);
          const materialSalida =
            materiales.get(
              operacion.material_salida_codigo
            );
          const subproductoAsociado =
            itemRuta.subproducto_codigo
              ? subproductos.get(
                  itemRuta.subproducto_codigo
                )
              : null;

          await guardarOperacionRuta(
            db,
            perfil.empresa_id,
            producto.id,
            version,
            {
              codigo: operacion.codigo,
              nombre: operacion.nombre,
              pieza_id: pieza.id,
              pieza_codigo: pieza.codigo,
              pieza_nombre: pieza.nombre,
              subproducto_id:
                subproductoAsociado?.id || "",
              subproducto_codigo:
                subproductoAsociado?.codigo || "",
              subproducto_nombre:
                subproductoAsociado?.nombre || "",
              proceso_codigo:
                itemRuta.proceso_codigo,
              proceso_nombre:
                itemRuta.proceso_nombre,
              subproceso_codigo:
                itemRuta.subproceso_codigo,
              subproceso_nombre:
                itemRuta.subproceso_nombre,
              material_entrada_id:
                materialesEntrada[0]?.material_id ||
                "",
              materiales_entrada:
                materialesEntrada,
              material_salida_id:
                materialSalida?.id || "",
              medida: pieza.medida,
              unidades_por_producto:
                itemRuta.unidades_por_producto,
              unidades_por_hora:
                itemRuta.unidades_por_hora,
              secuencia: itemRuta.secuencia,
              dependencia_id:
                itemRuta
                  .dependencia_operacion_codigo,
              porcentaje_minimo_avance:
                itemRuta.porcentaje_minimo_avance
            },
            existentesRuta,
            opcionesRuta
          );
        }
      }

      await cargarCatalogos();
      setMensaje(
        "Ingeniería importada correctamente."
      );
    } catch (fallo) {
      setError(
        fallo?.message ||
        "No se pudo importar la ingeniería."
      );
    } finally {
      setImportando(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#F1F5F9",
      padding: 24,
      fontFamily: "Arial"
    }}>
      <div style={{
        maxWidth: 1180,
        margin: "0 auto"
      }}>
        <BotonVolver
          onClick={onVolver}
          style={{ marginBottom: 12 }}
        >
          Volver a Ingeniería
        </BotonVolver>

        <h1 style={{ marginBottom: 4 }}>
          Importar Ingeniería de Producto
        </h1>
        <p style={{
          color: "#475569",
          marginTop: 0
        }}>
          Sube la plantilla Excel V3 para crear materiales,
          productos, piezas, subproductos, composición,
          operaciones y rutas sin digitación manual.
        </p>

        <section style={{
          background: "white",
          borderRadius: 14,
          padding: 22,
          boxShadow:
            "0 2px 10px rgba(15,23,42,0.08)",
          marginBottom: 18
        }}>
          <div style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 14,
            alignItems: "end"
          }}>
            <div>
              <label>
                Archivo Excel
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={leerArchivo}
                  disabled={cargando}
                  style={{
                    ...campo,
                    marginTop: 6
                  }}
                />
              </label>
              {archivoNombre && (
                <p style={{
                  color: "#64748B",
                  marginBottom: 0
                }}>
                  Archivo: {archivoNombre}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={descargarPlantilla}
              style={{
                ...campo,
                background: "#EFF6FF",
                borderColor: "#BFDBFE",
                color: "#1D4ED8",
                cursor: "pointer",
                fontWeight: "bold"
              }}
            >
              Descargar plantilla Excel
            </button>

            <button
              type="button"
              onClick={importar}
              disabled={
                !preview ||
                preview.errores.length > 0 ||
                importando
              }
              style={{
                ...campo,
                background:
                  !preview ||
                  preview.errores.length > 0
                    ? "#CBD5E1"
                    : "#0F766E",
                color: "white",
                border: "none",
                cursor: importando
                  ? "wait"
                  : "pointer",
                fontWeight: "bold"
              }}
            >
              {importando
                ? "Importando..."
                : "Confirmar importación"}
            </button>
          </div>
        </section>

        {error && (
          <div role="alert" style={{
            color: "#B91C1C",
            background: "#FEF2F2",
            padding: 12,
            borderRadius: 10,
            marginBottom: 14
          }}>
            {error}
          </div>
        )}

        {mensaje && (
          <div style={{
            color: "#166534",
            background: "#F0FDF4",
            padding: 12,
            borderRadius: 10,
            marginBottom: 14
          }}>
            {mensaje}
          </div>
        )}

        {preview && (
          <div style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 16
          }}>
            <section style={{
              background: "white",
              borderRadius: 14,
              padding: 18,
              boxShadow:
                "0 2px 10px rgba(15,23,42,0.08)"
            }}>
              <h2 style={{ marginTop: 0 }}>
                Vista previa
              </h2>
              <ul style={{
                color: "#334155",
                lineHeight: 1.8
              }}>
                <li>
                  Materiales MP/RF/SUM:{" "}
                  {resumen.materiales}
                </li>
                <li>Productos: {resumen.productos}</li>
                <li>Piezas: {resumen.piezas}</li>
                <li>
                  Subproductos:{" "}
                  {resumen.subproductos}
                </li>
                <li>
                  Composición:{" "}
                  {resumen.composicion}
                </li>
                <li>
                  Componentes:{" "}
                  {resumen.componentes}
                </li>
                <li>
                  Operaciones catálogo:{" "}
                  {resumen.operaciones}
                </li>
                <li>Rutas: {resumen.rutas}</li>
              </ul>
            </section>

            <section style={{
              background: "white",
              borderRadius: 14,
              padding: 18,
              boxShadow:
                "0 2px 10px rgba(15,23,42,0.08)"
            }}>
              <h2 style={{ marginTop: 0 }}>
                Errores ({preview.errores.length})
              </h2>
              {preview.errores.length === 0 ? (
                <p style={{ color: "#166534" }}>
                  Sin errores críticos.
                </p>
              ) : (
                <ul style={{
                  color: "#B91C1C",
                  paddingLeft: 18
                }}>
                  {preview.errores.map(errorItem => (
                    <li key={errorItem}>
                      {errorItem}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section style={{
              background: "white",
              borderRadius: 14,
              padding: 18,
              boxShadow:
                "0 2px 10px rgba(15,23,42,0.08)"
            }}>
              <h2 style={{ marginTop: 0 }}>
                Advertencias (
                {preview.advertencias.length})
              </h2>
              {preview.advertencias.length === 0 ? (
                <p style={{ color: "#475569" }}>
                  No hay advertencias.
                </p>
              ) : (
                <ul style={{
                  color: "#92400E",
                  paddingLeft: 18
                }}>
                  {preview.advertencias.map(
                    advertencia => (
                      <li key={advertencia}>
                        {advertencia}
                      </li>
                    )
                  )}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

export default ImportadorIngenieriaV2;
