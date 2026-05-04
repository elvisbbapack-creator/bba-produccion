import { useState, useEffect } from "react";
import { db } from "./firebase";
import { collection, addDoc, getDocs } from "firebase/firestore";

function App() {
  /* eslint-disable no-unused-vars */
  const [registros, setRegistros] = useState([]);
  const [pantalla, setPantalla] = useState("login");
  const [cantidad, setCantidad] = useState("");

  const [ots, setOts] = useState([]);
  const [procesos, setProcesos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);

  const [otSeleccionada, setOtSeleccionada] = useState("");
  const [procesoSeleccionado, setProcesoSeleccionado] = useState("");
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null);

  const [subprocesos, setSubprocesos] = useState([]);
  const [subprocesoSeleccionado, setSubprocesoSeleccionado] = useState("");
  const [detalleSeleccionado, setDetalleSeleccionado] = useState("");

  const [estandares, setEstandares] = useState([]);
  const [dashboard, setDashboard] = useState([]);

  const [inicioProduccion, setInicioProduccion] = useState(null);
  const [finProduccion, setFinProduccion] = useState(null);

  const [otDetalle, setOtDetalle] = useState(null);

  const estiloInput = {
  width: "100%",
  padding: 12,
  marginBottom: 12,
  borderRadius: 8,
  border: "1px solid #ccc"
  };

  const botonAzul = {
    width: "100%",
    padding: 14,
    borderRadius: 10,
    border: "none",
    background: "#1976D2",
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
    marginTop: 5
  };

  const botonVerde = {
    width: "100%",
    padding: 12,
    borderRadius: 8,
    border: "none",
    background: "#4CAF50",
    color: "white",
    fontWeight: "bold",
    marginBottom: 8
  };

  const botonRojo = {
    width: "100%",
    padding: 12,
    borderRadius: 8,
    border: "none",
    background: "#F44336",
    color: "white",
    fontWeight: "bold",
    marginBottom: 12
  };

  useEffect(() => {
    async function cargarDatos() {
      try {
        const otSnap = await getDocs(collection(db, "ordenes_trabajo"));
        setOts(otSnap.docs.map(doc => doc.data()));

        const procSnap = await getDocs(collection(db, "procesos"));
        setProcesos(procSnap.docs.map(doc => doc.data()));

        const userSnap = await getDocs(collection(db, "usuarios"));
        setUsuarios(userSnap.docs.map(doc => doc.data()));

        const subSnap = await getDocs(collection(db, "subprocesos"));
        setSubprocesos(subSnap.docs.map(doc => doc.data()));

        const estSnap = await getDocs(collection(db, "estandares"));
        setEstandares(estSnap.docs.map(doc => doc.data()));

        console.log("SUBPROCESOS:", subSnap.docs.map(doc => doc.data()));

      } catch (error) {
        console.error("ERROR:", error);
      }
    }

    cargarDatos();
  }, []); // déjalo así (correcto)
  
  useEffect(() => {
    if (pantalla === "dashboard") {

      cargarDashboard(); // carga inicial

      const intervalo = setInterval(() => {
      cargarDashboard();
      }, 5000); // cada 5 segundos

      return () => clearInterval(intervalo);
    }
  }, [pantalla]);

  async function guardar() {
  // 1. Validación estricta inicial
  if (!usuarioSeleccionado || !procesoSeleccionado || !cantidad || !subprocesoSeleccionado) {
    alert("Faltan datos críticos para el cálculo de eficiencia.");
    return;
  }

  // 2. Cálculo de tiempo (Asegurar que existan marcas de tiempo)
  let tiempoHoras = 0;
  if (inicioProduccion && finProduccion) {
    tiempoHoras = (finProduccion - inicioProduccion) / (1000 * 60 * 60);
  } else {
    alert("Debes marcar Inicio y Fin de producción");
    return;
  }

  // 3. Normalización segura
  const normalizar = (txt) => 
    txt ? txt.toString().toLowerCase().trim().replace(/\s+/g, " ") : "";

  // 4. Búsqueda del estándar con LOGS de depuración
  const estandar = estandares.find(e => {
  const matchProc = normalizar(e.proceso) === normalizar(procesoSeleccionado);
  const matchSub = normalizar(e.subproceso) === normalizar(subprocesoSeleccionado);

  const matchDet =
    !e.detalle || // si el estándar no tiene detalle
    normalizar(e.detalle) === normalizar(detalleSeleccionado);

  return matchProc && matchSub && matchDet;
});

  if (!estandar) {
    console.error("No se encontró un estándar para:", {
      procesoSeleccionado,
      subprocesoSeleccionado,
      detalleSeleccionado
    });
    alert("Error: No existe un valor de referencia (unidades/hora) para esta combinación de proceso/subproceso.");
    return;
  }

  // 5. Cálculo de eficiencia
  let eficiencia = 0;
  if (estandar.unidades_por_hora > 0 && tiempoHoras > 0) {
    const produccionEsperada = estandar.unidades_por_hora * tiempoHoras;
    eficiencia = (Number(cantidad) / produccionEsperada) * 100;
  }

  eficiencia = Math.min(eficiencia, 150);

  let colorEficiencia = "";
  if (eficiencia < 70) {
    colorEficiencia = "🔴";
    } else if (eficiencia < 90) {
      colorEficiencia = "🟡";
    } else {
      colorEficiencia = "🟢";
    }

  try {
    await addDoc(collection(db, "registros_produccion"), {
      usuario: usuarioSeleccionado?.nombre || "SIN USUARIO",
      rol: usuarioSeleccionado.rol,
      ot: otSeleccionada,
      proceso: procesoSeleccionado,
      subproceso: subprocesoSeleccionado,
      detalle: detalleSeleccionado,
      inicio: inicioProduccion,
      fin: finProduccion,
      tiempo_horas: tiempoHoras,
      cantidad_ok: Number(cantidad),
      eficiencia: Math.round(eficiencia),
      estado_eficiencia: colorEficiencia,
      fecha: new Date()
    });

    alert("Guardado correctamente ✅");

    setCantidad("");
    setSubprocesoSeleccionado("");
    setDetalleSeleccionado("");
    setInicioProduccion(null);
    setFinProduccion(null);

  } catch (error) {
    console.error("ERROR:", error);
  }
}
const cargarDashboard = async () => {
  try {
    const snap = await getDocs(collection(db, "registros_produccion"));
    const data = snap.docs.map(doc => doc.data());
    setDashboard(data);
  } catch (error) {
    console.error("ERROR dashboard:", error);
  }
};
  if (pantalla === "login") {
  return (
    <div style={{
      height: "100vh",
      background: "linear-gradient(135deg, #0f172a, #1e3a8a)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      fontFamily: "Arial"
    }}>

      <div style={{
        background: "white",
        padding: 30,
        borderRadius: 12,
        width: 300,
        boxShadow: "0 8px 20px rgba(0,0,0,0.2)",
        textAlign: "center"
      }}>

        {/* LOGO */}
        <img 
          src="/logo-bba.png" 
          alt="BBA"
          style={{ width: 100, marginBottom: 10 }}
        />

        <h2 style={{
  marginBottom: 20,
  fontWeight: "bold",
  color: "#1e3a8a"
}}>
  🔐 Acceso BBA
</h2>

        {/* SELECT USUARIO */}
        <select
          onChange={(e) => {
            const index = e.target.value;
            setUsuarioSeleccionado(usuarios[index]);
          }}
          style={{
            width: "100%",
            padding: 10,
            marginBottom: 15,
            borderRadius: 6,
            border: "1px solid #ccc"
          }}
        >
          <option value="">Seleccionar Usuario</option>
          {usuarios.map((u, i) => (
            <option key={i} value={i}>
              {u.nombre} ({u.rol})
            </option>
          ))}
        </select>

        {/* BOTÓN INGRESAR */}
        <button
          onClick={() => {
            if (!usuarioSeleccionado) {
              alert("Selecciona un usuario");
              return;
            }
            setPantalla("home");
          }}
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 8,
            border: "none",
            background: "#1976D2",
            color: "white",
            fontWeight: "bold",
            cursor: "pointer",
            fontSize: 16
          }}
        >
          Ingresar
        </button>

      </div>
    </div>
  );
}

  if (pantalla === "home") {
  return (
    <div style={{
      padding: 30,
      background: "#f4f6f8",
      minHeight: "100vh",
      fontFamily: "Arial"
    }}>

      {/* LOGO */}
      <div style={{ textAlign: "center", marginBottom: 30 }}>
        <img 
          src="/logo-bba.png" 
          alt="BBA" 
          style={{ width: 120 }}
        />
        <h1 style={{ marginTop: 10 }}>BBA Producción</h1>
      </div>

      {/* BOTONES */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        gap: 15,
        maxWidth: 300,
        margin: "0 auto"
      }}>

        <button
          onClick={() => {
            setPantalla("dashboard");
            cargarDashboard();
          }}
          style={{
            padding: "15px",
            borderRadius: 10,
            border: "none",
            background: "#1976D2",
            color: "white",
            fontSize: 16,
            fontWeight: "bold",
            cursor: "pointer"
          }}
        >
          📊 Ver Dashboard
        </button>

        <button
          onClick={() => setPantalla("registro")}
          style={{
            padding: "15px",
            borderRadius: 10,
            border: "none",
            background: "#4CAF50",
            color: "white",
            fontSize: 16,
            fontWeight: "bold",
            cursor: "pointer"
          }}
        >
          🏭 Registrar Producción
        </button>

        <button
          onClick={() => setPantalla("ot")}
          style={{
            padding: "15px",
            borderRadius: 10,
            border: "none",
            background: "#9C27B0",
            color: "white",
            fontSize: 16,
            fontWeight: "bold",
            marginTop: 10
          }}
        >
          📋 Ver Órdenes de Trabajo
        </button>

      </div>
    </div>
  );
}

if (pantalla === "registro") {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#f4f6f8",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: 20,
      fontFamily: "Arial"
    }}>

      {/* HEADER */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <img src="/logo-bba.png" alt="BBA" style={{ width: 80 }} />
        <h2 style={{ marginTop: 10 }}>🏭 Registrar Producción</h2>
      </div>

      {/* CARD PRINCIPAL */}
      <div style={{
        background: "white",
        padding: 20,
        borderRadius: 12,
        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        width: "100%",
        maxWidth: 420
      }}>

        {/* OT */}
        <select
          onChange={(e) => setOtSeleccionada(e.target.value)}
          style={estiloInput}
        >
          <option value="">Seleccionar OT</option>
          {ots.map((ot, i) => (
            <option key={i} value={ot.nombre}>
              {ot.nombre}
            </option>
          ))}
        </select>

        {/* USUARIO */}
        <select
          onChange={(e) => {
            const index = e.target.value;
            setUsuarioSeleccionado(usuarios[index]);
          }}
          style={estiloInput}
        >
          <option value="">Seleccionar Usuario</option>
          {usuarios.map((u, i) => (
            <option key={i} value={i}>
              {u.nombre} ({u.rol})
            </option>
          ))}
        </select>

        {/* PROCESO */}
        <select
          onChange={(e) => setProcesoSeleccionado(e.target.value)}
          style={estiloInput}
        >
          <option value="">Seleccionar Proceso</option>
          {procesos.map((p, i) => (
            <option key={i} value={p.nombre}>
              {p.nombre}
            </option>
          ))}
        </select>

        {/* SUBPROCESO */}
        <select
          onChange={(e) => setSubprocesoSeleccionado(e.target.value)}
          style={estiloInput}
        >
          <option value="">Seleccionar Subproceso</option>
          {subprocesos
            .filter(sp => sp.proceso?.toLowerCase() === procesoSeleccionado?.toLowerCase())
            .map((sp, i) => (
              <option key={i} value={sp.nombre}>
                {sp.nombre}
              </option>
            ))}
        </select>

        {/* DETALLE */}
        <select
          onChange={(e) => setDetalleSeleccionado(e.target.value)}
          style={estiloInput}
        >
          <option value="">Seleccionar Detalle</option>
          {subprocesos
            .find(sp => sp.nombre === subprocesoSeleccionado)
            ?.detalles?.map((d, i) => (
              <option key={i} value={d}>
                {d}
              </option>
            ))}
        </select>

        {/* BOTONES TIEMPO */}
        <button
          onClick={() => setInicioProduccion(new Date())}
          style={botonVerde}
        >
          ▶️ Iniciar Producción
        </button>

        <button
          onClick={() => setFinProduccion(new Date())}
          style={botonRojo}
        >
          ⏹ Finalizar Producción
        </button>

        {/* INPUT */}
        <input
          placeholder="Cantidad OK"
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          style={estiloInput}
        />

        {/* GUARDAR */}
        <button
          onClick={guardar}
          style={botonAzul}
        >
          💾 Guardar Producción
        </button>

      </div>

      {/* VOLVER */}
      <button
        onClick={() => setPantalla("home")}
        style={{
          marginTop: 20,
          background: "transparent",
          border: "none",
          color: "#1976D2",
          fontWeight: "bold",
          cursor: "pointer"
        }}
      >
        ⬅ Volver
      </button>

    </div>
  );
}

if (pantalla === "ot") {
  return (
    <div style={{ padding: 20 }}>

      <h2>📋 Órdenes de Trabajo</h2>

      {ots.map((ot, i) => (
        <div
          key={i}
          onClick={() => {
            setOtDetalle(ot);
            setPantalla("otDetalle");
          }}
          style={{
            padding: 15,
            marginBottom: 10,
            background: "white",
            borderRadius: 8,
            boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
            cursor: "pointer"
          }}
        >
          <b>{ot.nombre}</b>
          <div>Cantidad: {ot.cantidad}</div>
          <div>Entrega: {ot.fecha_entrega}</div>
        </div>
      ))}

      <button onClick={() => setPantalla("home")}>
        ⬅ Volver
      </button>

    </div>
  );
}

if (pantalla === "otDetalle") {
  return (
    <div style={{ padding: 20 }}>

      <h2>📦 Detalle OT</h2>

      {otDetalle && (
        <>
          <h3>{otDetalle.nombre}</h3>

          <p><b>Cantidad:</b> {otDetalle.cantidad}</p>
          <p>
            <b>Fecha Entrega:</b>{" "}
            {otDetalle.fecha_de_entrega?.toDate().toLocaleDateString()}
          </p>

          <h3>Procesos</h3>

          {otDetalle.procesos?.map((p, i) => (
  <div
    key={i}
    style={{
      marginBottom: 15,
      padding: 12,
      background: "#f4f6f8",
      borderRadius: 8
    }}
  >
    {/* PROCESO */}
    <div style={{ fontWeight: "bold", marginBottom: 6 }}>
      🔧 {p.nombre}
    </div>

    {/* SUBPROCESOS */}
    {p.subprocesos?.map((sp, j) => (
      <div
        key={j}
        style={{
          marginLeft: 10,
          padding: 6,
          background: "white",
          borderRadius: 6,
          marginBottom: 6
        }}
      >
        <div>
          🧩 {sp.nombre} — <b>{sp.cantidad}</b>
        </div>

        {/* DETALLE (SI EXISTE) */}
        {sp.detalles?.map((d, k) => (
          <div
            key={k}
            style={{
              marginLeft: 10,
              fontSize: 13,
              color: "#555"
            }}
          >
            ▸ {d}
          </div>
        ))}
      </div>
    ))}
  </div>
))}

        </>
      )}

      <button onClick={() => setPantalla("ot")}>
        ⬅ Volver
      </button>

    </div>
  );
}

  if (pantalla === "dashboard") {

  const esMobile = window.innerWidth < 768;  

  const promedio =
    dashboard.length > 0
      ? dashboard.reduce((a, b) => a + (b.eficiencia || 0), 0) / dashboard.length
      : 0;

  const ranking = Object.values(
    dashboard.reduce((acc, r) => {
      if (!r.usuario) return acc;

      if (!acc[r.usuario]) {
        acc[r.usuario] = {
          usuario: r.usuario,
          total: 0,
          count: 0
        };
      }

      acc[r.usuario].total += r.eficiencia || 0;
      acc[r.usuario].count += 1;

      return acc; // ✅ AQUÍ termina el reduce
    }, {})
  )
  .map(r => ({
    usuario: r.usuario,
    promedio: r.total / r.count
  }))
  .sort((a, b) => b.promedio - a.promedio);

  const top1 = ranking[0];

  let colorTop = "#333";

  if (top1) {
    if (top1.promedio >= 90) colorTop = "#4CAF50";
    else if (top1.promedio >= 70) colorTop = "#FFC107";
    else colorTop = "#F44336";
  }

  return (
    <div style={{
      padding: 20,
      background: "#f4f6f8",
      minHeight: "100vh",
      fontFamily: "Arial"
    }}>

      <div style={{ textAlign: "center", marginBottom: 10 }}>
  🔴 EN VIVO
</div>

      {top1 && (
        <div
          className={top1.promedio < 70 ? "parpadeo" : ""}
          style={{
            background: colorTop,
            color: "white",
            padding: 25,
            borderRadius: 12,
            marginBottom: 20,
            textAlign: "center",
            boxShadow: "0px 4px 10px rgba(0,0,0,0.3)"
          }}
        >
          <h2>🥇 MEJOR OPERARIO</h2>
          <h1 style={{ fontSize: 45, margin: 10 }}>
            {top1.usuario}
          </h1>
          <h2>{top1.promedio.toFixed(1)}%</h2>
        </div>
      )}

      <h3>🏆 Ranking Operarios</h3>

      {ranking.map((r, i) => (
        <div key={i} style={{
          padding: 10,
          marginBottom: 8,
          border: "1px solid #ccc",
          borderRadius: 5
        }}>
          <b>{i + 1}. {r.usuario}</b> — {r.promedio.toFixed(1)}%
        </div>
      ))}

      <h2>📊 Dashboard Producción</h2>

      <h1>{promedio.toFixed(1)}%</h1>

      <h3>Últimos registros</h3>

{!esMobile && (
      <div
  style={{
    display: "grid",
    gridTemplateColumns: "80px 1fr 1fr 1fr 100px 80px",
    fontWeight: "bold",
    marginBottom: 10
  }}
>
  <div>Estado</div>
  <div>Operario</div>
  <div>Proceso</div>
  <div>Subproceso</div>
  <div>Cantidad</div>
  <div>%</div>
</div>
)}

      {dashboard.slice(-10).reverse().map((r, i) => (

  esMobile ? (

    <div
      key={i}
      style={{
        background: "white",
        padding: 12,
        borderRadius: 10,
        marginBottom: 10,
        boxShadow: "0 2px 6px rgba(0,0,0,0.1)"
      }}
    >
      <div style={{ fontSize: 18 }}>
        {r.estado_eficiencia} <b>{r.usuario}</b>
      </div>

      <div style={{ fontSize: 14, color: "#555" }}>
        {r.proceso} → {r.subproceso}
      </div>

      <div style={{
        display: "flex",
        justifyContent: "space-between",
        marginTop: 6
      }}>
        <span>{r.cantidad_ok} un</span>
        <b>{r.eficiencia}%</b>
      </div>
    </div>

  ) : (

    <div
      key={i}
      style={{
        display: "grid",
        gridTemplateColumns: "80px 1fr 1fr 1fr 100px 80px",
        padding: "10px",
        marginBottom: "6px",
        background: "white",
        borderRadius: 6,
        alignItems: "center"
      }}
    >
      <div>{r.estado_eficiencia}</div>
      <div><b>{r.usuario}</b></div>
      <div>{r.proceso}</div>
      <div>{r.subproceso}</div>
      <div>{r.cantidad_ok} un</div>
      <div><b>{r.eficiencia}%</b></div>
    </div>

  )

))}

      <br />

      <button onClick={cargarDashboard}>
        🔄 Actualizar
      </button>

      <br /><br />

      <button onClick={() => setPantalla("home")}>
        Volver
      </button>

    </div>
  );
}
}

export default App;