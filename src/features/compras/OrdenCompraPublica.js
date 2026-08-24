import {
  useEffect,
  useMemo,
  useState
} from "react";
import {
  construirHtmlOrdenCompra
} from "./ordenCompraDocumento";
import {
  obtenerOrdenCompraPublica
} from "./comprasRepository";

const obtenerTokenDesdeUrl = () => {
  const partes = window.location.pathname
    .split("/")
    .filter(Boolean);

  if (partes[0] === "oc-publica" && partes[1]) {
    return decodeURIComponent(partes[1]);
  }

  return new URLSearchParams(window.location.search)
    .get("token");
};

const OrdenCompraPublica = ({ db }) => {
  const [orden, setOrden] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const token = useMemo(obtenerTokenDesdeUrl, []);

  useEffect(() => {
    let activo = true;

    const cargarOrden = async () => {
      setCargando(true);
      setError("");

      try {
        const ordenPublica =
          await obtenerOrdenCompraPublica(db, token);

        if (!activo) {
          return;
        }

        if (!ordenPublica) {
          setError(
            "No encontramos esta orden de compra o el enlace ya no está disponible."
          );
          return;
        }

        setOrden(ordenPublica);
      } catch (err) {
        if (activo) {
          setError(
            err?.message ||
              "No se pudo cargar la orden de compra."
          );
        }
      } finally {
        if (activo) {
          setCargando(false);
        }
      }
    };

    cargarOrden();

    return () => {
      activo = false;
    };
  }, [db, token]);

  const html = useMemo(
    () =>
      orden
        ? construirHtmlOrdenCompra(orden, {
            comprador: "Gaby Huanca",
            mostrarAcciones: false
          })
        : "",
    [orden]
  );

  const imprimir = () => {
    const frame = document.getElementById(
      "oc-publica-frame"
    );

    if (frame?.contentWindow) {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#F8FAFC",
      padding: 10
    }}>
      <div style={{
        maxWidth: 920,
        margin: "0 auto"
      }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          marginBottom: 10,
          flexWrap: "wrap"
        }}>
          <div>
            <h1 style={{
              margin: 0,
              fontSize: 22,
              color: "#163B7A"
            }}>
              BBA
            </h1>
            <p style={{
              margin: "4px 0 0",
              color: "#475569"
            }}>
              Enlace seguro de visualización para proveedor.
            </p>
          </div>
          {orden && (
            <button
              type="button"
              onClick={imprimir}
              style={{
                border: 0,
                borderRadius: 10,
                background: "#2563EB",
                color: "white",
                fontWeight: 800,
                padding: "12px 16px",
                cursor: "pointer"
              }}
            >
              Descargar / imprimir PDF
            </button>
          )}
        </div>

        {cargando && (
          <p style={{ color: "#334155" }}>
            Cargando orden de compra...
          </p>
        )}

        {error && (
          <div style={{
            background: "#FEF2F2",
            color: "#B91C1C",
            border: "1px solid #FECACA",
            borderRadius: 12,
            padding: 16,
            fontWeight: 700
          }}>
            {error}
          </div>
        )}

        {html && (
          <iframe
            id="oc-publica-frame"
            title={`Orden de compra ${orden.codigo}`}
            srcDoc={html}
            style={{
              width: "100%",
              minHeight: "calc(100vh - 92px)",
              border: "1px solid #CBD5E1",
              borderRadius: 10,
              background: "white"
            }}
          />
        )}
      </div>
    </div>
  );
};

export default OrdenCompraPublica;
