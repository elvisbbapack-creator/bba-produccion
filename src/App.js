import {
  useState,
  useEffect,
  useCallback
} from "react";
import { db } from "./firebase";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  query,
  orderBy,
} from "firebase/firestore";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell
} from "recharts";

function App() {
  /* eslint-disable no-unused-vars */
  const normalizar = (txt) =>
  (txt || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  const [registros, setRegistros] = useState([]);
  const [pantalla, setPantalla] = useState("login");

  const [cantidad, setCantidad] = useState("");

  const [ots, setOts] = useState([]);
  const [procesos, setProcesos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [operarios, setOperarios] = useState([]);
  const [operarioSeleccionado, setOperarioSeleccionado] = useState("");

  const [otSeleccionada, setOtSeleccionada] = useState("");
  const [procesoSeleccionado, setProcesoSeleccionado] = useState("");
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null);

  const [subprocesos, setSubprocesos] = useState([]);
  const [subprocesoSeleccionado, setSubprocesoSeleccionado] = useState("");
  const [detalleSeleccionado, setDetalleSeleccionado] = useState("");

  const [produccionActiva, setProduccionActiva] = useState([]);

  const [procesoAbierto, setProcesoAbierto] =
  useState(null);

  const [estandares, setEstandares] = useState([]);
  const [dashboard, setDashboard] = useState([]);

  const [paroActivo, setParoActivo] = useState(false);

  const [paroActivoProduccion, setParoActivoProduccion] = useState(null);

  const [motivoParo, setMotivoParo] = useState("");

  const [responsableAjuste, setResponsableAjuste] = useState("");

  const [parosActivos, setParosActivos] = useState([]);

  const [todosLosParos, setTodosLosParos] = useState([]);

  const [produccionSeleccionada, setProduccionSeleccionada] = useState(null);

  const [otDetalle, setOtDetalle] = useState(null);

  const [ahora, setAhora] = useState(
    new Date()
  );

  const cargarProduccionActiva = async () => {

  const snap = await getDocs(
    collection(db, "produccion_activa")
  );

  const data = snap.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  setProduccionActiva(data);

  };
  
  const estiloInput = {
    width: "100%",
    padding: 12,
    marginBottom: 12,
    borderRadius: 8,
    border: "1px solid #ccc",
    boxSizing: "border-box"
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

const cargarDatos = useCallback(async () => {

  try {

    await cargarProduccionActiva();

    const otSnap = await getDocs(collection(db, "ordenes_trabajo"));
    setOts(otSnap.docs.map(doc => doc.data()));

    const procSnap = await getDocs(collection(db, "procesos"));
    setProcesos(procSnap.docs.map(doc => doc.data()));

    const userSnap = await getDocs(collection(db, "usuarios"));
    setUsuarios(userSnap.docs.map(doc => doc.data()));

    const operSnap = await getDocs(collection(db, "operarios"));

    setOperarios(
      operSnap.docs.map(doc => doc.data())
    );

    const subSnap = await getDocs(collection(db, "subprocesos"));
    setSubprocesos(subSnap.docs.map(doc => doc.data()));

    const estSnap = await getDocs(collection(db, "estandares"));
    setEstandares(estSnap.docs.map(doc => doc.data()));

  } catch (error) {
    console.error("ERROR:", error);
  }

}, []);

useEffect(() => {

  cargarDatos();

}, [cargarDatos]);
  
useEffect(() => {

  const intervalo = setInterval(() => {

    setAhora(new Date());

  }, 1000);

  return () => clearInterval(intervalo);

}, []);

useEffect(() => {

  cargarDashboard();

  cargarParosActivos();

  cargarTodosLosParos();

  const intervalo = setInterval(() => {

    cargarDashboard();

  }, 5000);

  return () => clearInterval(intervalo);

}, []);

  async function guardar() {
  // 1. Validación estricta inicial
  if (
  !usuarioSeleccionado ||
  !operarioSeleccionado ||
  !procesoSeleccionado ||
  !cantidad ||
  !subprocesoSeleccionado
  ) {
    alert("Faltan datos críticos para el cálculo de eficiencia.");
    return;
  }

  // 2. Cálculo de tiempo (Asegurar que existan marcas de tiempo)

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
  // TEMPORAL
  // mientras migramos a producción_activa

  eficiencia = 100;

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

    console.log("GUARDANDO PARO");
    
    await addDoc(collection(db, "registros_produccion"), {
      iniciado_por:
        usuarioSeleccionado?.nombre || "SIN USUARIO",

      operario: operarioSeleccionado,
      rol: usuarioSeleccionado.rol,
      ot: otSeleccionada,
      proceso: procesoSeleccionado,
      subproceso: subprocesoSeleccionado,
      detalle: detalleSeleccionado,
      responsable_ajuste: responsableAjuste,
      tipo_ajuste: "Corrección Gerencial",
      cantidad_ok: Number(cantidad),
      eficiencia: Math.round(eficiencia),
      estado_eficiencia: colorEficiencia,
      fecha: new Date()
    });

    alert("Guardado correctamente ✅");

    setCantidad("");
    setSubprocesoSeleccionado("");
    setDetalleSeleccionado("");
    
  } 
    catch (error) {

      console.error("ERROR FINALIZAR:", error);

      alert(
        "ERROR: " + error.message
      );
    }
}
const cargarDashboard = async () => {
  try {
    const q = query(
      collection(db, "registros_produccion"),
      orderBy("fecha", "desc")
    );

    const snap = await getDocs(q);
    const data = snap.docs.map(doc => doc.data());
    setDashboard(data);
  } catch (error) {
    console.error("ERROR dashboard:", error);
  }
};

const cargarParosActivos = async () => {

  try {

    const snap = await getDocs(
      collection(db, "paros_produccion")
    );

    const data =
      snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

    setTodosLosParos(data);

    const activos =
      data.filter(p =>
        p.estado === "activo"
      );

    setParosActivos(activos);

  } catch (error) {

    console.error(error);

  }

};

const cargarTodosLosParos = async () => {

  try {

    const snap = await getDocs(
      collection(db, "paros_produccion")
    );

    const data =
      snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

    setTodosLosParos(data);

  } catch (error) {

    console.error(error);

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
          onClick={() =>
            setPantalla("historialParos")
          }
          style={botonAzul}
        >
          📋 Historial de Paros
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

        <button
            onClick={() => setPantalla("avanceOT")}
            style={{
              padding: "15px",
              borderRadius: 10,
              border: "none",
              background: "#FF9800",
              color: "white",
              fontSize: 16,
              fontWeight: "bold",
              cursor: "pointer"
            }}
          >
            📋 Avance OT
          </button>

          <button
            onClick={() =>
              setPantalla("ajusteGerencial")
            }
            style={botonAzul}
          >

            🛠 Ajuste Gerencial

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

        {/* USUARIO LOGUEADO */}
        <div
          style={{
            marginBottom: 12,
            padding: 12,
            background: "#E3F2FD",
            borderRadius: 8,
            fontWeight: "bold",
            color: "#1976D2"
          }}
        >
          👤 Usuario:
          {" "}
          {usuarioSeleccionado?.nombre}
     
          <div style={{
            fontSize: 13,
            marginTop: 4,
            color: "#555"
          }}>
            Rol: {usuarioSeleccionado?.rol}
          </div>
        </div>

        {/* OPERARIO */}
        <select
          onChange={(e) =>
            setOperarioSeleccionado(e.target.value)
          }
          style={estiloInput}
        >
          <option value="">
            Seleccionar Operario
          </option>

          {operarios
            .filter(o => o.activo)
            .map((o, i) => (
              <option key={i} value={o.nombre}>
            {o.nombre}
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

{/* INICIAR PRODUCCIÓN */}
<button
  onClick={async () => {

    if (
      !operarioSeleccionado ||
      !procesoSeleccionado ||
      !subprocesoSeleccionado
    ) {
      alert("Faltan datos");
      return;
    }

    try {

      const yaExiste =
            produccionActiva.find(p =>

              p.operario ===
                operarioSeleccionado &&

              p.proceso ===
                procesoSeleccionado &&

              p.subproceso ===
                subprocesoSeleccionado
            );

          if (yaExiste) {

            alert(
              "Este operario ya tiene este proceso iniciado"
            );

            return;
          }

      await addDoc(
        collection(db, "produccion_activa"),
        {
          operario: operarioSeleccionado,
          proceso: procesoSeleccionado,
          subproceso: subprocesoSeleccionado,
          detalle: detalleSeleccionado,
          ot: otSeleccionada,

          iniciado_por:
            usuarioSeleccionado?.nombre,

          inicio: new Date(),

          estado: "activo"
        }
      );

      alert("Producción iniciada ✅");

      const activaSnap = await getDocs(
        collection(db, "produccion_activa")
      );

      setProduccionActiva(
        activaSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
      );

    } catch (error) {
      console.error(error);
    }

  }}
  style={{
    ...botonVerde,
    fontSize: 18
  }}
>
  ▶️ Iniciar Producción
</button>

<h3 style={{ marginTop: 20 }}>
  🟢 Producciones Activas
</h3>

{produccionActiva.map((p, i) => {

const paroActivoProduccion =
  parosActivos.find(paro =>
    paro.operario === p.operario &&
    paro.ot === p.ot &&
    paro.proceso === p.proceso &&
    paro.subproceso === p.subproceso &&
    paro.estado === "activo"
  );

  const inicio =
  p.inicio?.toDate();

let tiempoDetenidoTotal = 0;

parosDeEstaProduccion.forEach(paro => {

  if (
    paro.inicio_paro?.toDate &&
    paro.fin_paro?.toDate
  ) {

    const inicio =
      paro.inicio_paro.toDate();

    const fin =
      paro.fin_paro.toDate();

    tiempoDetenidoTotal +=
      fin - inicio;

  }

});

const horasDet =
  Math.floor(
    tiempoDetenidoTotal / 3600000
  );

const minutosDet =
  Math.floor(
    (tiempoDetenidoTotal % 3600000)
    / 60000
  );

const segundosDet =
  Math.floor(
    (tiempoDetenidoTotal % 60000)
    / 1000
  );

const tiempoDetenidoFormateado = `
  ${String(horasDet).padStart(2, "0")}
  :
  ${String(minutosDet).padStart(2, "0")}
  :
  ${String(segundosDet).padStart(2, "0")}
`;

  let tiempoPausasMs = 0;

const parosDeEstaProduccion =
  todosLosParos.filter(paro =>

    paro.operario === p.operario &&
    paro.ot === p.ot &&
    paro.proceso === p.proceso &&
    paro.subproceso === p.subproceso

  );

parosDeEstaProduccion.forEach(paro => {

  if (paro.inicio_paro) {

    const inicioParo =
      paro.inicio_paro.toDate
        ? paro.inicio_paro.toDate()
        : new Date(paro.inicio_paro);

    const finParo =
      paro.fin_paro
        ? (
            paro.fin_paro.toDate
              ? paro.fin_paro.toDate()
              : new Date(paro.fin_paro)
          )
        : ahora;

    tiempoPausasMs +=
      finParo - inicioParo;

  }

});

const tiempoHoras =
  inicio
    ? (
        (
          (ahora - inicio)
          - tiempoPausasMs
        ) / 3600000
      )
    : 0;

  const tiempoDetenidoMs =
    parosDeEstaProduccion.reduce(
      (total, paro) => {

        if (!paro.inicio_paro)
          return total;

        const inicioParo =
          paro.inicio_paro.toDate
            ? paro.inicio_paro.toDate()
            : new Date(paro.inicio_paro);

        let finParo = new Date();

        if (paro.fin_paro) {

          finParo =
            paro.fin_paro.toDate
              ? paro.fin_paro.toDate()
              : new Date(paro.fin_paro);

        }

        return (
          total +
          (finParo - inicioParo)
        );

      },
      0
    );

const tiempoProductivoHoras =
  Math.max(
    0,
    tiempoHoras -
    (tiempoDetenidoMs / 3600000)
  );

const estandar =
  estandares.find(e => {

    const matchProc =
      normalizar(e.proceso) ===
      normalizar(p.proceso);

    const matchSub =
      normalizar(e.subproceso) ===
      normalizar(p.subproceso);

    const matchDet =
      !e.detalle ||
      normalizar(e.detalle) ===
      normalizar(p.detalle);

    return (
      matchProc &&
      matchSub &&
      matchDet
    );
  });

const esperado =
  estandar
    ? Math.round(
        estandar.unidades_por_hora *
        tiempoProductivoHoras
    )
    : 0;

const real =
  p.cantidad_actual || 0;

let eficiencia = 0;

let tiempoDetenido = "";

if (
  paroActivoProduccion
  &&
  p.inicio_paro?.toDate
) {

  const inicioParo =
    p.inicio_paro.toDate();

  const diferencia =
    ahora - inicioParo;

  const horas =
    Math.floor(
      diferencia / 3600000
    );

  const minutos =
    Math.floor(
      (diferencia % 3600000)
      / 60000
    );

  const segundos =
    Math.floor(
      (diferencia % 60000)
      / 1000
    );

  tiempoDetenido = `
    ${String(horas).padStart(2, "0")}
    :
    ${String(minutos).padStart(2, "0")}
    :
    ${String(segundos).padStart(2, "0")}
  `;

}

if (esperado > 0) {
  eficiencia =
    Math.round(
      (real / esperado) * 100
    );
}

let color = "#E8F5E9";

if (eficiencia < 70) {
  color = "#FFCDD2";
}
else if (eficiencia < 90) {
  color = "#FFF9C4";
}

return (

  <div
    key={i}
    style={{
      background: color,
      padding: 10,
      borderRadius: 8,
      marginBottom: 10
    }}
  >
    <div>
      👤 <b>{p.operario}</b>
    </div>

    {paroActivoProduccion && (

      <div style={{
        marginTop: 6,
        background: "#D32F2F",
        color: "white",
        padding: "4px 8px",
        borderRadius: 6,
        fontWeight: "bold",
        display: "inline-block"
      }}>

        ⛔ DETENIDO

      </div>

    )}

    <div style={{
      marginTop: 6,
      fontSize: 12,
      fontWeight: "normal"
    }}>

      ⏱ {tiempoDetenido}

    </div>

    <div style={{
      marginTop: 6,
      fontSize: 12
    }}>

      ⏸ Acumulado:
      {" "}
      {tiempoDetenidoFormateado}

    </div>

    <div style={{
      fontSize: 12,
      marginTop: 4
    }}>

      ⚙ Productivo:
      {" "}

      {tiempoProductivoHoras.toFixed(2)}
      h

    </div>

    <div>
      {p.proceso}
      {" → "}
      {p.subproceso}

      {p.detalle && (
        <>
          {" → "}
          {p.detalle}
        </>
      )}
    </div>

    <div style={{
      fontSize: 13,
      fontWeight: "bold",
      color: "#333",
      marginTop: 4
    }}>
      📋 OT:
      {" "}
      {p.ot || "-"}
    </div>

    <div style={{
      marginTop: 8
    }}>
      📦 Actual:
      {" "}
      <b>
        {p.cantidad_actual || 0}
      </b>
    </div>

    <div style={{
      display: "flex",
      gap: 5,
      marginTop: 8
    }}>

      <button
        onClick={async () => {

          try {

            await updateDoc(
              doc(
                db,
                "produccion_activa",
                p.id
              ),
              {
                cantidad_actual:
                  (p.cantidad_actual || 0) + 100
              }
            );

            const activaSnap =
              await getDocs(
                collection(
                  db,
                  "produccion_activa"
                )
              );

            setProduccionActiva(
              activaSnap.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
              }))
            );

          } catch (error) {
            console.error(error);
          }

        }}
        style={{
          flex: 1,
          padding: 8,
          border: "none",
          borderRadius: 6,
          background: "#1976D2",
          color: "white",
          fontWeight: "bold"
        }}
      >
        +100
      </button>

      <button
        onClick={async () => {

          try {

            await updateDoc(
              doc(
                db,
                "produccion_activa",
                p.id
              ),
              {
                cantidad_actual:
                  (p.cantidad_actual || 0) + 500
              }
            );

            const activaSnap =
              await getDocs(
                collection(
                  db,
                  "produccion_activa"
                )
              );

            setProduccionActiva(
              activaSnap.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
              }))
            );

          } catch (error) {
            console.error(error);
          }

        }}
        style={{
          flex: 1,
          padding: 8,
          border: "none",
          borderRadius: 6,
          background: "#4CAF50",
          color: "white",
          fontWeight: "bold"
        }}
      >
        +500
      </button>

    </div>

    <div style={{
      display: "flex",
      gap: 5,
      marginTop: 10
    }}>

      <input
        type="number"
        placeholder="Cantidad"
        onChange={(e) => {
          p.nuevaCantidad =
            Number(e.target.value);
        }}
        style={{
          flex: 1,
          padding: 10,
          borderRadius: 6,
          border: "1px solid #ccc",
          boxSizing: "border-box"
        }}
      />

      <button
        onClick={async () => {

          try {

            await updateDoc(
              doc(
                db,
                "produccion_activa",
                p.id
              ),
              {
                cantidad_actual:
                  Number(
                    p.nuevaCantidad || 0
                  )
              }
            );

            const activaSnap =
              await getDocs(
                collection(
                  db,
                  "produccion_activa"
                )
              );

            setProduccionActiva(
              activaSnap.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
              }))
            );

          } catch (error) {
            console.error(error);
          }

        }}
        style={{
          padding: "10px 15px",
          border: "none",
          borderRadius: 6,
          background: "#212121",
          color: "white",
          fontWeight: "bold"
        }}
      >
        Actualizar
      </button>

    </div>

    <div style={{
      fontSize: 12,
      color: "#555"
    }}>
      Inicio:
      {" "}
      {p.inicio?.toDate
        ? p.inicio.toDate().toLocaleString()
        : "-"}
    </div>

    <div style={{
      marginTop: 6,
      fontWeight: "bold",
      color: "#D32F2F"
    }}>
      ⏱ {

        (() => {

          if (!p.inicio?.toDate)
            return "00:00:00";

          const inicio =
            p.inicio.toDate();

          const diferencia =
            ahora - inicio;

          const horas =
            Math.floor(
              diferencia / 3600000
            );

          const minutos =
            Math.floor(
              (diferencia % 3600000)
              / 60000
            );

          const segundos =
            Math.floor(
              (diferencia % 60000)
              / 1000
            );

          return (
            String(horas).padStart(2, "0") +
            ":" +
            String(minutos).padStart(2, "0") +
            ":" +
            String(segundos).padStart(2, "0")
          );

        })()

      }
    </div>

    <div style={{
      marginTop: 8
    }}>
      🎯 Esperado:
      {" "}
      <b>{esperado}</b>
    </div>

    <div>
      📦 Real:
      {" "}
      <b>{real}</b>
    </div>

    <div style={{
      marginTop: 8,
      fontSize: 20,
      fontWeight: "bold"
    }}>
      {
        eficiencia >= 90
          ? "🟢"
          : eficiencia >= 70
          ? "🟡"
          : "🔴"
      }

      {" "}
      {eficiencia}%
    </div>

    <input
      type="number"
      placeholder="Cantidad OK"
      onChange={(e) => {
        p.cantidadFinal = e.target.value;
      }}
      style={{
        width: "100%",
        padding: 10,
        marginTop: 10,
        borderRadius: 6,
        border: "1px solid #ccc",
        boxSizing: "border-box"
      }}
    />

    <button
      onClick={async () => {

        try {

          const fin = new Date();

          const inicio =
            p.inicio?.toDate();

          const tiempoHoras =
            (fin - inicio) /
            (1000 * 60 * 60);

          const cantidadOK =
            Number(p.cantidadFinal || 0);

          const estandar =
            estandares.find(e => {

              const matchProc =
                normalizar(e.proceso) ===
                normalizar(p.proceso);

              const matchSub =
                normalizar(e.subproceso) ===
                normalizar(p.subproceso);

              const matchDet =
                !e.detalle ||
                normalizar(e.detalle) ===
                normalizar(p.detalle);

              return (
                matchProc &&
                matchSub &&
                matchDet
              );
            });

          let eficiencia = 0;

          if (
            estandar &&
            estandar.unidades_por_hora > 0 &&
            tiempoHoras > 0
          ) {

            const produccionEsperada =
              estandar.unidades_por_hora *
              tiempoHoras;

            eficiencia =
              (cantidadOK /
                produccionEsperada) * 100;
          }

          eficiencia =
            Math.min(
              Math.round(eficiencia),
              150
            );

          let colorEficiencia = "";

          if (eficiencia < 70) {
            colorEficiencia = "🔴";
          }
          else if (eficiencia < 90) {
            colorEficiencia = "🟡";
          }
          else {
            colorEficiencia = "🟢";
          }

          await addDoc(
            collection(db, "registros_produccion"),
            {
              operario: p.operario,
              proceso: p.proceso,
              subproceso: p.subproceso,
              detalle: p.detalle,

              cantidad_actual: 0,

              ot: p.ot,

              cantidad_ok: Number(p.cantidadFinal || 0),

              inicio: p.inicio,
              fin: new Date(),

              tiempo_horas:
                Number(tiempoHoras.toFixed(2)),

              eficiencia,

              estado_eficiencia:
                colorEficiencia,

              fecha: new Date(),

              iniciado_por: p.iniciado_por
            }
          );

          await deleteDoc(
            doc(db, "produccion_activa", p.id)
          );

          const activaSnap = await getDocs(
            collection(db, "produccion_activa")
          );

          setProduccionActiva(
            activaSnap.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }))
          );

          alert("Producción finalizada ✅");

        } catch (error) {
          console.error(error);
        }

      }}
      style={{
        marginTop: 10,
        width: "100%",
        padding: 10,
        border: "none",
        borderRadius: 8,
        background: "#F44336",
        color: "white",
        fontWeight: "bold"
      }}
    >
      ⛔ Finalizar Producción
    </button>

    {!paroActivoProduccion && (
      <button
        onClick={async () => {

          setParoActivo(true);

          setProduccionSeleccionada(p);

        }}
        style={{
          marginTop: 10,
          padding: "8px 12px",
          border: "none",
          borderRadius: 8,
          background: "#D32F2F",
          color: "white",
          fontWeight: "bold",
          cursor: "pointer",
          width: "100%"
        }}
      >
        ⛔ Detener
      </button>
    )}

    {paroActivoProduccion && (

      <button

        onClick={async () => {

          if (paroActivoProduccion) {

  await updateDoc(

    doc(
      db,
      "paros_produccion",
      paroActivoProduccion.id
    ),

    {
      estado: "finalizado",
      fin_paro: new Date()
    }

  );

}

await updateDoc(
  doc(
    db,
    "produccion_activa",
    p.id
  ),
  {
    estado: "activo",
    motivo_paro: "",
    inicio_paro: null
  }
);

await cargarParosActivos();

await cargarProduccionActiva();

          await updateDoc(
            doc(
              db,
              "produccion_activa",
              p.id
            ),
            {
              estado: "activo",
              motivo_paro: "",
              inicio_paro: null
            }
          );

          setProduccionActiva(prev =>
            prev.map(prod =>
              prod.id === produccionSeleccionada.id
                ? {
                    ...prod,
                    estado: "detenido",
                    motivo_paro: motivoParo,
                    inicio_paro: {
                    toDate: () => new Date()
                    }
                  }
                : prod
            )
          );

        }}

        style={{

          marginTop: 8,
          width: "100%",
          padding: 10,
          borderRadius: 8,
          border: "none",
          background: "#2E7D32",
          color: "white",
          fontWeight: "bold",
          cursor: "pointer"

        }}

      >

        ▶️ Reanudar

      </button>

    )}

    {paroActivo && produccionSeleccionada?.operario === p.operario && (

      <div style={{
        marginTop: 15,
        background: "white",
        padding: 15,
        borderRadius: 12,
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)"
      }}>

        <div style={{
          fontWeight: "bold",
          marginBottom: 10
        }}>
          ⛔ Registrar Paro
        </div>

        <select
          value={motivoParo}
          onChange={(e) =>
            setMotivoParo(e.target.value)
          }
          style={{
            width: "100%",
            padding: 10,
            borderRadius: 8,
            border: "1px solid #ccc"
          }}
        >

          <option value="">
            Seleccionar motivo
          </option>

          <option>
            Falla de máquina
          </option>

          <option>
            Falta de energía
          </option>

          <option>
            Cambio de material
          </option>

          <option>
            Espera suministro
          </option>
 
          <option>
            Ajuste / calibración
          </option>

          <option>
            Limpieza
          </option>

          <option>
            Mantención
          </option>

          <option>
            Otros
          </option>

        </select>

        <div style={{
          display: "flex",
          gap: 10,
          marginTop: 12
        }}>

          <button
            onClick={() => {

              setParoActivo(false);

              setMotivoParo("");

            }}
            style={{
              flex: 1,
              padding: 10,
              borderRadius: 8,
              border: "none",
              background: "#BDBDBD",
              color: "white",
              fontWeight: "bold"
            }}
          >
            Cancelar
          </button>

          <button
            onClick={async () => {

              if (!motivoParo) {

                alert("Selecciona motivo");

                return;

              }

              await addDoc(

                collection(db, "paros_produccion"),

                {

                  operario:
                    produccionSeleccionada.operario,

                  ot:
                    produccionSeleccionada.ot,

                  proceso:
                    produccionSeleccionada.proceso,

                  subproceso:
                    produccionSeleccionada.subproceso,

                  detalle:
                    produccionSeleccionada.detalle || "",

                  motivo:
                    motivoParo,

                  inicio_paro:
                    new Date(),

                  estado:
                    "activo"

                }

              );

              await updateDoc(
                doc(
                  db,
                  "produccion_activa",
                  produccionSeleccionada.id
                ),
                {
                  estado: "detenido",

                  motivo_paro: motivoParo,

                  inicio_paro: new Date()
                }
              );

              await cargarProduccionActiva();

              await cargarParosActivos();

              setParoActivo(false);

              setMotivoParo("");

            }}
            style={{
              flex: 1,
              padding: 10,
              borderRadius: 8,
              border: "none",
              background: "#D32F2F",
              color: "white",
              fontWeight: "bold"
            }}
          >
            Guardar
          </button>

        </div>

      </div>

    )}

  </div>

  );
})}

      </div>

      {/* VOLVER */}
      <button
  onClick={() => setPantalla("home")}
  style={{
    padding: "15px 40px",
    fontSize: 18,
    borderRadius: 12,
    border: "none",
    background: "#1976D2",
    color: "white",
    fontWeight: "bold",
    cursor: "pointer",
    marginTop: 30
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

      <button
  onClick={() => setPantalla("home")}
  style={{
    padding: "15px 40px",
    fontSize: 18,
    borderRadius: 12,
    border: "none",
    background: "#1976D2",
    color: "white",
    fontWeight: "bold",
    cursor: "pointer",
    marginTop: 30
  }}
>
  ⬅ Volver
</button>

    </div>
  );
}

if (pantalla === "otDetalle") {

  const esMobile = window.innerWidth < 768;

  if (dashboard.length === 0) {

    return (

      <div style={{
        padding: 40,
        fontSize: 24,
        fontWeight: "bold"
      }}>

        ⏳ Cargando datos...

      </div>

    );

  }

  return (

    <div style={{
      display: "grid",
      gridTemplateColumns: esMobile
      ? "1fr"
      : "260px 1fr",
      minHeight: "100vh",
      background: "#f4f6f8",
      fontFamily: "Arial"
    }}>

    {/* SIDEBAR */}

    <div style={{
      background: "#111827",
      color: "white",
      padding: esMobile ? 12 : 20
    }}>

      <h2 style={{
        marginBottom: 30
      }}>
        📋 BBA MES
      </h2>

      <div style={{
        display: "flex",
        flexDirection: "column",
        gap: 12
      }}>

        <button
          onClick={() => setPantalla("home")}
          style={{
            padding: 14,
            borderRadius: 10,
            border: "none",
            background: "#1976D2",
            color: "white",
            fontWeight: "bold",
            cursor: "pointer"
          }}
        >
          🏠 Inicio
        </button>

        <button
          onClick={() => setPantalla("ot")}
          style={{
            padding: 14,
            borderRadius: 10,
            border: "none",
            background: "#374151",
            color: "white",
            fontWeight: "bold",
            cursor: "pointer"
          }}
        >
          📋 OT
        </button>

      </div>

    </div>

    {/* CONTENIDO */}

    <div style={{
      padding: 20
    }}>

      <h2 style={{
        fontSize: esMobile ? 22 : 34,
        marginBottom: 10
      }}>
        📦 Detalle Orden de Trabajo
      </h2>

      {otDetalle && (
        <>
          <h3 style={{
            fontSize: esMobile ? 18 : 28,
            marginBottom: 10,
            marginTop: 10,
            color: "#212121"
          }}>
            {otDetalle.nombre}
          </h3>

          {(() => {

          const objetivoOT =
            otDetalle.cantidad || 1;

          const registrosOT =
            dashboard.filter(
              r =>
                normalizar(r.ot) ===
                normalizar(otDetalle.nombre)
            );  
          
            const avancesProcesos =
            otDetalle.procesos?.map((p) => {

              const subprocesos =
                p.subproceso || [];

              const avancesSubprocesos =
                subprocesos.map((s) => {

                  const detalles =
                    s.detalles || [];

                  const avancesDetalles =
                    detalles.map((d) => {

                      const registros =
                        dashboard.filter(r =>

                          normalizar(r.ot) ===
                          normalizar(otDetalle.nombre)

                          &&

                          normalizar(r.proceso) ===
                          normalizar(p.nombre)

                          &&

                          normalizar(r.subproceso) ===
                          normalizar(s.nombre)

                          &&

                          normalizar(r.detalle) ===
                          normalizar(d.nombre)

                        );

                      const producido =
                        registros.reduce(
                          (acc, r) =>
                           acc + (r.cantidad_ok || 0),
                          0
                        );

                      const objetivo =
                        d.cantidad_objetivo || 1;

                      const avance =
                        (producido / objetivo) * 100;

                      return Math.min(avance, 100);

                    });

                  if (avancesDetalles.length === 0) {
                    return 0;
                  }

                  return (
                    avancesDetalles.reduce(
                      (a, b) => a + b,
                     0
                    ) / avancesDetalles.length
                  );

                });

              if (avancesSubprocesos.length === 0) {
                return 0;
              }

              return (
                avancesSubprocesos.reduce(
                  (a, b) => a + b,
                  0
                ) / avancesSubprocesos.length
              );

            }) || [];

          const avanceOT =
            avancesProcesos.length > 0
              ? Math.round(

                  avancesProcesos.reduce(
                    (a, b) => a + b,
                    0
                  ) / avancesProcesos.length

                )
              : 0;

          const producidoOT =
            Math.round(
              (avanceOT / 100) * objetivoOT
            );

          const pendienteOT =
            objetivoOT - producidoOT;

          // PRIMER REGISTRO DE LA OT

          const registrosOrdenados =
            registrosOT
              .filter(r => r.fecha?.toDate)
              .sort(
                (a, b) =>
                  a.fecha.toDate() -
                  b.fecha.toDate()
              );

          const primerRegistro =
            registrosOrdenados[0];

          // HORAS TRABAJADAS

          let horasTrabajadas = 0;

          if (primerRegistro?.fecha?.toDate) {

  horasTrabajadas =
    (
      new Date() -
      primerRegistro.fecha.toDate()
    ) / 3600000;

          }

          // VELOCIDAD REAL

          const velocidadHora =
            horasTrabajadas > 0
              ? producidoOT / horasTrabajadas
              : 0;

          // HORAS RESTANTES

          const horasRestantes =
            velocidadHora > 0
              ? pendienteOT / velocidadHora
              : 0;

          // FECHA ESTIMADA

          let etaTexto = "Sin datos";

          if (
            velocidadHora > 0 &&
            isFinite(horasRestantes)
          ) {

          const fechaEstimada =
            new Date(
              Date.now() +
              horasRestantes * 3600000
            );

            etaTexto =
              fechaEstimada.toLocaleString();

          }

          const procesoCritico =
            otDetalle.procesos?.map((p) => {

              const subprocesos =
                p.subproceso || [];

              const avancesSubprocesos =
                subprocesos.map((s) => {

                  const detalles =
                    s.detalles || [];

                  const avancesDetalles =
                    detalles.map((d) => {

                      console.log("REGISTRO REAL DASHBOARD");
                      console.log(dashboard[0]);
                      
                      const registros =
                        dashboard.filter(r =>

                          normalizar(r.ot) ===
                          normalizar(otDetalle.nombre)

                          &&

                          normalizar(r.proceso) ===
                          normalizar(p.nombre)

                          &&

                          normalizar(r.subproceso) ===
                          normalizar(s.nombre)

                          &&

                          normalizar(r.detalle) ===
                          normalizar(d.nombre)

                        );

                      const producido =
                        registros.reduce(
                          (acc, r) =>
                            acc + (r.cantidad_ok || 0),
                          0
                        );

                      const objetivo =
                        d.cantidad_objetivo || 1;

                      return Math.min(
                        (producido / objetivo) * 100,
                        100
                      );

                    });

                  if (avancesDetalles.length === 0) {
                    return 0;
                  }

                  return (
                    avancesDetalles.reduce(
                      (a, b) => a + b,
                      0
                    ) / avancesDetalles.length
                  );

                });

              const avanceProceso =
                avancesSubprocesos.length > 0
                  ? avancesSubprocesos.reduce(
                      (a, b) => a + b,
                      0
                    ) / avancesSubprocesos.length
                  : 0;

              return {
                proceso: p.nombre,
                avance: Math.round(avanceProceso)
              };

            })

            .sort((a, b) =>
              a.avance - b.avance
            )[0];
          
            let colorOT = "#E8F5E9";

          if (avanceOT < 70) {
            colorOT = "#FFCDD2";
          }
          else if (avanceOT < 90) {
            colorOT = "#FFF9C4";
          }

          let estadoOT = "🟢 En Tiempo";

          if (avanceOT < 50) {
            estadoOT = "🔴 Atrasada";
          }
          else if (avanceOT < 80) {
            estadoOT = "🟡 En Riesgo";
          }

          return (

            <div style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
              marginTop: 20,
              marginBottom: 25
            }}>

              {/* AVANCE */}
              <div style={{
                background: colorOT,
                padding: 18,
                borderRadius: 18,
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
              }}>

                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}>

                  <div style={{
                    fontSize: 14,
                    color: "#666"
                  }}>
                    Avance General
                  </div>

                  <div style={{
                    fontSize: 13,
                    fontWeight: "bold",
                    padding: "4px 10px",
                    borderRadius: 20,
                    background:
                      avanceOT >= 80
                        ? "#C8E6C9"
                        : avanceOT >= 50
                        ? "#FFF9C4"
                        : "#FFCDD2",
                    color:
                      avanceOT >= 80
                        ? "#2E7D32"
                        : avanceOT >= 50
                        ? "#F57F17"
                        : "#C62828"
                  }}>
                    {estadoOT}
                  </div>

                </div>

                <div style={{
                  marginTop: esMobile ? 8 : 16,
                }}>

                  {/* TEXTO */}
                  <div style={{
                    fontSize: 34,
                    fontWeight: "bold",
                    marginBottom: 10
                  }}>
                    {
                      avanceOT >= 90
                        ? "🟢"
                        : avanceOT >= 70
                        ? "🟡"
                        : "🔴"
                    }

                    {" "}
                    {avanceOT}%
                  </div>

                  {/* BARRA */}
                  <div style={{
                    width: "100%",
                    height: 18,
                    background: "#E0E0E0",
                    borderRadius: 20,
                    overflow: "hidden"
                  }}>

                    <div style={{
                      width: `${avanceOT}%`,
                      height: "100%",
                      borderRadius: 20,
                      transition: "0.4s",

                      background:
                        avanceOT >= 90
                          ? "#4CAF50"
                          : avanceOT >= 70
                          ? "#FFC107"
                          : "#F44336"
                    }} />

                  </div>

                </div>

              </div>

              {/* CUELLO DE BOTELLA */}
              <div style={{
                background: "#FFEBEE",
                padding: 18,
                borderRadius: 18,
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
              }}>

                <div style={{
                  fontSize: 14,
                  color: "#666"
                }}>
                  🚨 Proceso Crítico
                </div>

                <div style={{
                  marginTop: 10,
                  fontSize: 22,
                  fontWeight: "bold",
                  color: "#C62828"
                }}>
                  {procesoCritico?.proceso || "-"}
                </div>

                <div style={{
                  marginTop: 8,
                  fontSize: 30,
                  fontWeight: "bold"
                }}>
                  🔴 {procesoCritico?.avance || 0}%
                </div>

              </div>
              
              {/* OBJETIVO */}
              <div style={{
                background: "#FFFFFF",
                padding: 18,
                borderRadius: 18,
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
              }}>

                <div style={{
                  fontSize: 14,
                  color: "#666"
                }}>
                  Objetivo
                </div>

                <div style={{
                  marginTop: 10,
                  fontSize: 34,
                  fontWeight: "bold"
                }}>
                  {objetivoOT}
                </div>

              </div>

              {/* PRODUCIDO */}
              <div style={{
                background: "#E8F5E9",
                padding: 18,
                borderRadius: 18,
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
              }}>

                <div style={{
                  fontSize: 14,
                  color: "#666"
                }}>
                  Producido
                </div>

                <div style={{
                  marginTop: 10,
                  fontSize: 34,
                  fontWeight: "bold",
                  color: "#2E7D32"
                }}>
                  {producidoOT}
                </div>

              </div>

              {/* FALTANTE */}
              <div style={{
                background: "#FFEBEE",
                padding: 18,
                borderRadius: 18,
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
              }}>

                <div style={{
                  fontSize: 14,
                  color: "#666"
                }}>
                  Pendiente
                </div>

                <div style={{
                  marginTop: 10,
                  fontSize: 34,
                  fontWeight: "bold",
                  color: "#C62828"
                }}>
                  {pendienteOT}
                </div>

              </div>

              {/* ETA */}
              <div style={{
                background: "#E3F2FD",
                padding: 18,
                borderRadius: 18,
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
              }}>

                <div style={{
                  fontSize: 14,
                  color: "#666"
                }}>
                  ETA Producción
                </div>

                <div style={{
                  marginTop: 10,
                  fontSize: 18,
                  fontWeight: "bold",
                  color: "#1565C0"
                }}>
                  ⏳ {etaTexto}
                </div>

              </div>

            </div>

          );

        })()}

          <p><b>Cantidad:</b> {otDetalle.cantidad}</p>
          <p>
            <b>Fecha Entrega:</b>{" "}
            {otDetalle.fecha_de_entrega?.toDate().toLocaleDateString()}
          </p>

          <h3>Procesos</h3>

          {otDetalle.procesos?.map((p, i) => {

            const subprocesosProceso =
              p.subproceso || [];

            const objetivoProceso =
              subprocesosProceso.reduce((acc, s) => {

                const detalles =
                  s.detalles || [];

                const total =
                  detalles.reduce(
                    (a, d) =>
                      a + (d.cantidad_objetivo || 0),
                    0
                  );

                return acc + total;

              }, 0);

            const producidoProceso =
              subprocesosProceso.reduce((acc, s) => {

                const detalles =
                  s.detalles || [];

                const total =
                  detalles.reduce((a, d) => {

                    const registros =
                      dashboard.filter(r =>

                        normalizar(r.ot) ===
                        normalizar(otDetalle.nombre)

                        &&

                        normalizar(r.proceso) ===
                        normalizar(p.nombre)

                        &&

                        normalizar(r.subproceso) ===
                        normalizar(s.nombre)

                        &&

                        normalizar(r.detalle) ===
                        normalizar(d.nombre)

                      );

                    const producido =
                      registros.reduce(
                        (x, r) =>
                          x + (r.cantidad_ok || 0),
                        0
                      );

                    return a + producido;

                  }, 0);

                return acc + total;

              }, 0);

            const avanceProceso =
              objetivoProceso > 0
                ? Math.round(
                    (producidoProceso / objetivoProceso) * 100
                  )
                : 0;

            return (

              <div
                key={i}
                style={{
                  marginBottom: esMobile ? 8 : 15,
                  padding: 12,
                  background: "#f4f6f8",
                  borderRadius: 8
                }}
              >

        {/* PROCESO */}
        <div
              onClick={() => {

                if (procesoAbierto === i) {
                  setProcesoAbierto(null);
                } else {
                  setProcesoAbierto(i);
                }

              }}
              style={{
                background: "#FFFFFF",
                padding: 12,
                borderRadius: 12,
                marginBottom: esMobile ? 8 : 20,
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                border: "1px solid #E0E0E0"
              }}
            >

            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 14
            }}>

              <div>

                <div style={{
                  fontWeight: "bold",
                  fontSize: 24,
                  color: "#212121"
                }}>
                  🔧 {p.nombre}
                </div>

                <div style={{
                  marginTop: 4,
                  fontSize: 13,
                  color: "#666"
                }}>
                  Objetivo: {objetivoProceso}
                  {" • "}
                  Producido: {producidoProceso}
                </div>

              </div>

              <div style={{
                fontWeight: "bold",
                fontSize: 24
              }}>
                {
                  avanceProceso >= 90
                    ? "🟢"
                    : avanceProceso >= 70
                    ? "🟡"
                    : "🔴"
                }

                {" "}
                {avanceProceso}%
              </div>

            </div>

      {procesoAbierto === i && (

        <div style={{
          marginTop: 15
        }}>

          <div style={{
            display: "grid",
            gridTemplateColumns: esMobile
              ? "1fr"
              : "repeat(auto-fit, minmax(420px, 1fr))",
            gap: 16,
            marginTop: 10
          }}>

            {p.subproceso?.map((s, j) => {

              const detalles =
                s.detalles || [];

              const totalObjetivo =
                detalles.reduce(
                  (acc, d) =>
                    acc + (d.cantidad_objetivo || 0),
                  0
                );
              if (!s.detalles || s.detalles.length === 0) {
                return null;
              }

              const totalProducido =
                detalles.reduce((acc, d) => {

                  const registros =
                    dashboard.filter(r =>

                      normalizar(r.ot) ===
                      normalizar(otDetalle.nombre)

                      &&

                      normalizar(r.proceso) ===
                      normalizar(p.nombre)

                      &&

                      normalizar(r.subproceso) ===
                      normalizar(s.nombre)

                      &&

                      normalizar(r.detalle) ===
                      normalizar(d.nombre)

                    );

                  const producido =
                    registros.reduce(
                      (a, r) =>
                        a + (r.cantidad_ok || 0),
                      0
                    );

                  return acc + producido;

                }, 0);

              const avanceSubproceso =
                totalObjetivo > 0
                  ? Math.round(
                      (totalProducido / totalObjetivo) * 100
                    )
                  : 0;

              let colorSubproceso = "#E8F5E9";

              if (avanceSubproceso < 70) {
                colorSubproceso = "#FFCDD2";
              }
              else if (avanceSubproceso < 90) {
                colorSubproceso = "#FFF9C4";
              }

            return (

            <div
              key={j}
              style={{
                background: "#FFFFFF",
                padding: esMobile ? 8 : 12,
                borderRadius: 18,
                width: esMobile ? "95%" : "100%",
                maxWidth: esMobile ? 380 : "100%",
                margin: esMobile ? "0 auto" : "0",
                marginBottom: esMobile ? 2 : 6,

                borderLeft: `8px solid ${
                  avanceSubproceso >= 90
                    ? "#4CAF50"
                    : avanceSubproceso >= 70
                    ? "#FFC107"
                    : "#F44336"
                }`,

                boxShadow: "0 4px 12px rgba(0,0,0,0.08)",

                transition: "all 0.25s ease"
              }}
            >

              <div style={{
                display: "flex",
                flexDirection: esMobile ? "column" : "row",
                justifyContent: "space-between",
                alignItems: esMobile ? "flex-start" : "center",
                marginBottom: 6,
                gap: esMobile ? 6 : 0
              }}>

                <div style={{
                   fontWeight: "bold",
                   fontSize: esMobile ? 16 : 18,
                   alignSelf: esMobile ? "flex-end" : "auto"
                }}>
                  ⚙ {s.nombre}
                </div>

                <div style={{
                   fontWeight: "bold",
                   fontSize: 18
                }}>
                  {
                    avanceSubproceso >= 90
                      ? "🟢"
                      : avanceSubproceso >= 70
                      ? "🟡"
                      : "🔴"
                  }
  
                  {" "}
                  {avanceSubproceso}%
                </div>

              </div>

              <div style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 12
              }}>
  
              {s.detalles?.map((d, k) => {  

                const registrosDetalle =
                  dashboard.filter(r =>

                    normalizar(r.ot) ===
                    normalizar(otDetalle.nombre)

                    &&

                    normalizar(r.proceso) ===
                    normalizar(p.nombre)

                    &&

                    normalizar(r.subproceso) ===
                    normalizar(s.nombre)

                    &&

                    normalizar(r.detalle) ===
                    normalizar(d.nombre)    

                  );

                const producido =
                  registrosDetalle.reduce(
                    (acc, r) =>
                      acc + (r.cantidad_ok || 0),
                    0
                  );

                const objetivo =
                  d.cantidad_objetivo || 1;

                const avance =
                  Math.round(
                    (producido / objetivo) * 100
                  );

                let colorAvance = "#E8F5E9";

                if (avance < 70) {
                  colorAvance = "#FFCDD2";
                }
                else if (avance < 90) {
                  colorAvance = "#FFF9C4";
                }

                return (

                <div
                   key={k}
                   style={{
                     background: colorAvance,
                     padding: esMobile ? 2 : 8,
                     borderRadius: 14,
                     marginBottom: 6,
                     width: esMobile ? "92%" : 220,
                     maxWidth: esMobile ? 320 : 220,
                     margin: esMobile ? "0 auto" : "0",
                     border: "1px solid rgba(0,0,0,0.08)",
                     boxShadow: "0 1px 4px rgba(0,0,0,0.05)"
                  }}
                >

                  <div>
                    <div style={{
                      fontSize: esMobile ? 11 : 20,
                      fontWeight: "bold",
                      marginBottom: 8
                    }}>
                      📦 {d.nombre}
                    </div>
                  </div>

                  <div style={{
                    marginTop: 6,
                    fontSize: esMobile ? 13 : 16,
                    color: "#333"
                  }}>
                    🧱 {d.material || "-"}
                    {" • "}
                    📏 {d.medida || "-"}
                  </div>

                  <div style={{
                    display: "flex",
                    justifyContent: "flex-start",
                    gap: esMobile ? 10 : 20,
                    marginTop: 10
                  }}>

                  <div>
                    <div style={{
                      fontSize: 12,
                      color: "#666"
                    }}>
                      Objetivo
                    </div>

                    <div style={{
                      fontWeight: "bold",
                      fontSize: 18
                    }}>
                      {objetivo}
                    </div>
                  </div>

                  <div>
                    <div style={{
                      fontSize: 12,
                      color: "#666"
                    }}>
                      Producido
                    </div>

                    <div style={{
                      fontWeight: "bold",
                      fontSize: 18
                    }}>
                     {producido}
                    </div>
                  </div>

                  </div>

                  <div style={{
                    marginTop: esMobile ? 8 : 16,
                    display: "flex",
                    justifyContent: "flex-start",
                    alignItems: "center",
                    gap: esMobile ? 4 : 10,
                    fontSize: esMobile ? 14 : 24,
                    fontWeight: "bold"
                  }}>

                  <span>
                    {
                      avance >= 90
                        ? "🟢"
                        : avance >= 70
                        ? "🟡"
                        : "🔴"
                    }
                  </span>

                    <span>
                    Avance {avance}%
                    </span>

                  </div>
                </div>

                );
              })}

              </div>

            </div>
            );
            })}
          </div>
        </div>
      )}
        </div>
              </div>
            );
})}    

      </>

      )}
</div>
      <button
  onClick={() => setPantalla("ot")}
  style={{
    padding: esMobile ? "10px 18px" : "15px 40px",
    fontSize: esMobile ? 14 : 18,
    width: esMobile ? "auto" : "auto",
    minWidth: esMobile ? 140 : 220,
    boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
    borderRadius: 12,
    border: "none",
    background: "#1976D2",
    color: "white",
    fontWeight: "bold",
    cursor: "pointer",
    marginTop: 30
  }}
>
  ⬅ Volver
</button>

    </div>
  );
}

  if (pantalla === "avanceOT") {

    return (

      <div style={{
        padding: 20,
        background: "#f4f6f8",
        minHeight: "100vh",
        fontFamily: "Arial"
      }}>

        <h2>📋 Avance OT</h2>

        <select
          onChange={(e) => {

            const ot = ots.find(
              o => o.nombre === e.target.value
            );

            setOtDetalle(ot);

          }}
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 8,
            border: "1px solid #ccc",
            marginBottom: 20
          }}
        >
          <option value="">
            Seleccionar OT
          </option>

          {ots.map((ot, i) => (
            <option
              key={i}
              value={ot.nombre}
            >
              {ot.nombre}
            </option>
          ))}

        </select>

        {otDetalle && (

          <div>

            <h3>
              📦 {otDetalle.nombre}
            </h3>

            {(() => {

              const avances = otDetalle.procesos?.map((p) => {

                const registrosProceso =
                  dashboard.filter(r =>
                    normalizar(r.ot) ===
                    normalizar(otDetalle.nombre) &&

                    normalizar(r.proceso) ===
                    normalizar(p.nombre)
                  );

                const producido =
                  registrosProceso.reduce(
                    (acc, r) =>
                      acc + (r.cantidad_ok || 0),
                    0
                  );

                const objetivo =
                  otDetalle.cantidad || 1;

                const avance =
                  Math.round(
                    (producido / objetivo) * 100
                  );

                return {
                  proceso: p.nombre,
                  avance
                };

              });

              const cuello =
                avances.reduce((min, actual) =>
                  actual.avance < min.avance
                    ? actual
                    : min
                );

              return (

                <div style={{
                  background: "#FFCDD2",
                  padding: 15,
                  borderRadius: 10,
                  marginBottom: 20
                }}>

                  <div style={{
                    fontSize: 22,
                    fontWeight: "bold",
                    color: "#C62828"
                  }}>
                    🚨 Cuello de Botella
                  </div>

                  <div style={{
                    marginTop: 10,
                    fontSize: 18
                  }}>
                    🔧 {cuello.proceso}
                  </div>

                  <div style={{
                    fontSize: 30,
                    fontWeight: "bold",
                    marginTop: 10
                  }}>
                    🔴 {cuello.avance}%
                  </div>

                </div>

              );

            })()}

            {otDetalle.procesos?.map((p, i) => {

              const subprocesosProceso =
              p.subproceso || [];

            const objetivoProceso =
              subprocesosProceso.reduce((acc, s) => {

                const detalles =
                  s.detalles || [];

    const total =
      detalles.reduce(
        (a, d) =>
          a + (d.cantidad_objetivo || 0),
        0
      );

    return acc + total;

  }, 0);

const producidoProceso =
  subprocesosProceso.reduce((acc, s) => {

    const detalles =
      s.detalles || [];

    const total =
      detalles.reduce((a, d) => {

        const registros =
          dashboard.filter(r =>

            normalizar(r.ot) ===
            normalizar(otDetalle.nombre)

            &&

            normalizar(r.proceso) ===
            normalizar(p.nombre)

            &&

            normalizar(r.subproceso) ===
            normalizar(s.nombre)

            &&

            normalizar(r.detalle) ===
            normalizar(d.nombre)

          );

        const producido =
          registros.reduce(
            (x, r) =>
              x + (r.cantidad_ok || 0),
            0
          );

        return a + producido;

      }, 0);

    return acc + total;

  }, 0);

const avanceProceso =
  objetivoProceso > 0
    ? Math.round(
        (producidoProceso / objetivoProceso) * 100
      )
    : 0;

              const registrosProceso =
                dashboard.filter(r =>
                  normalizar(r.ot) ===
                  normalizar(otDetalle.nombre) &&

                  normalizar(r.proceso) ===
                  normalizar(p.nombre)
                );

              const producido =
                registrosProceso.reduce(
                  (acc, r) =>
                    acc + (r.cantidad_ok || 0),
                  0
                );

              const objetivo =
                otDetalle.cantidad || 1;

              const avance =
                Math.round(
                  (producido / objetivo) * 100
                );

              let color = "#E8F5E9";

              if (avance < 70) {
                color = "#FFCDD2";
              }
              else if (avance < 90) {
                color = "#FFF9C4";
              }

              return (

                <div
                  key={i}
                  style={{
                    background: color,
                    padding: 15,
                    borderRadius: 10,
                    marginBottom: 12
                  }}
                >

                  <div style={{
                    fontWeight: "bold",
                    fontSize: 18
                  }}>
                    🔧 {p.nombre}
                  </div>

                  <div style={{
                    marginTop: 8
                  }}>
                    🎯 Objetivo:
                    {" "}
                    <b>{objetivo}</b>
                  </div>

                  <div>
                    📦 Producido:
                    {" "}
                    <b>{producido}</b>
                  </div>

                  <div style={{
                    marginTop: 10,
                    fontSize: 24,
                    fontWeight: "bold"
                  }}>
                    {
                      avance >= 90
                        ? "🟢"
                        : avance >= 70
                        ? "🟡"
                        : "🔴"
                    }

                    {" "}
                    {avance}%
                  </div>

                </div>
              );
            })}

          </div>

        )}

        <button
          onClick={() => setPantalla("home")}
          style={{
            marginTop: 20,
            padding: "15px 30px",
            borderRadius: 10,
            border: "none",
            background: "#1976D2",
            color: "white",
            fontWeight: "bold"
          }}
        >
          ⬅ Volver
        </button>

      </div>

    );
  }

  if (pantalla === "historialAjustes") {

    const ajustes =
      dashboard.filter(r =>

        r.tipo ===
        "ajuste_gerencial"

      );

    const ajustesPorDia = Object.values(

      ajustes.reduce((acc, a) => {

        const fecha =
          a.fecha?.toDate
            ? a.fecha
                .toDate()
                .toLocaleDateString()
            : "-";

        if (!acc[fecha]) {

          acc[fecha] = {

            fecha,

            cantidad: 0

          };

        }

        acc[fecha].cantidad +=
          a.cantidad_ok || 0;

        return acc;

      }, {})

    );

    const alertasGerenciales = [];

    const totalProduccion =
      dashboard.reduce(
        (acc, r) =>

          acc + (r.cantidad_ok || 0),

        0
      );

    const totalAjustes =
      ajustes.reduce(
        (acc, a) =>

          acc + (a.cantidad_ok || 0),

        0
      );

    const porcentajeAjustes =
      totalProduccion > 0

        ? (
            totalAjustes /
            totalProduccion
          ) * 100

        : 0;

    if (porcentajeAjustes > 5) {

      alertasGerenciales.push({

        tipo: "critico",

        mensaje:
          `🚨 Ajustes superan ${porcentajeAjustes.toFixed(1)}% de la producción`

      });

    }

    const operarioCritico =
      Object.entries(

        ajustes.reduce((acc, a) => {

          const op =
            a.operario || "-";

          acc[op] =
            (acc[op] || 0)
            +
            (a.cantidad_ok || 0);

          return acc;

        }, {})

      )

      .sort((a, b) =>
        b[1] - a[1]
      )[0];

    if (

      operarioCritico

      &&

      operarioCritico[1] > 50

    ) {

      alertasGerenciales.push({

        tipo: "warning",

        mensaje:
          `⚠️ ${operarioCritico[0]} supera 50 unidades ajustadas`

      });

    }

    return (

      <div style={{
        padding: 20
      }}>

        <h2>
          🛠 Historial Ajustes
        </h2>

        {alertasGerenciales.length > 0 && (

          <div style={{
            marginTop: 20,
            marginBottom: 20
          }}>

            {alertasGerenciales.map((a, i) => (

              <div
                key={i}
                style={{
                  background:

                    a.tipo === "critico"

                      ? "#B71C1C"

                      : "#F9A825",

                  color: "white",

                  padding: 15,

                  borderRadius: 12,

                  marginBottom: 10,

                 fontWeight: "bold",

                 fontSize: 16
                }}
              >

                {a.mensaje}

              </div>

            ))}

          </div>

        )}

        <div style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 15,
          marginTop: 20,
          marginBottom: 25
        }}>  

          {/* TOTAL AJUSTADO */}

          <div style={{
            background: "white",
            padding: 20,
            borderRadius: 14,
            boxShadow:
              "0 2px 8px rgba(0,0,0,0.08)"
          }}>

            <div style={{
              fontSize: 14,
              color: "#666"
          }}>

              🛠 Total Ajustado

            </div>

            <h1 style={{
              margin: "10px 0 0 0",
              color: "#6A1B9A"
            }}>

              {

                ajustes.reduce(
                  (acc, a) =>

                    acc + (a.cantidad_ok || 0),

                  0
                )

              }

            </h1>

          </div>

          {/* % AJUSTE */}

          <div style={{
            background: "white",
            padding: 20,
            borderRadius: 14,
            boxShadow:
              "0 2px 8px rgba(0,0,0,0.08)"
          }}>

            <div style={{
              fontSize: 14,
              color: "#666"
            }}>

              📦 % Ajuste

            </div>

            <h1 style={{
              margin: "10px 0 0 0",
              color: "#D32F2F"
            }}>

              {

                (() => {

                  const totalProduccion =
                    dashboard.reduce(
                      (acc, r) =>

                        acc +
                        (r.cantidad_ok || 0),

                      0
                    );

                  const totalAjustes =
                    ajustes.reduce(
                      (acc, a) =>

                        acc +
                        (a.cantidad_ok || 0),

                      0
                    );

                  const porcentaje =
                    totalProduccion > 0

                      ? (
                          totalAjustes /
                          totalProduccion
                        ) * 100

                      : 0;

                  return `
                    ${porcentaje.toFixed(1)}%
                  `;

                })()

              }

            </h1>

          </div>

          {/* OPERARIO MÁS AJUSTADO */}

          <div style={{
            background: "white",
            padding: 20,
            borderRadius: 14,
            boxShadow:
              "0 2px 8px rgba(0,0,0,0.08)"
          }}>

            <div style={{
              fontSize: 14,
              color: "#666"
            }}>

              👤 Operario Más Ajustado

            </div>

            <h2 style={{
              margin: "10px 0 0 0",
              color: "#1976D2"
            }}>

              {

                Object.entries(

                  ajustes.reduce((acc, a) => {

                    const op =
                      a.operario || "-";

                    acc[op] =
                      (acc[op] || 0)
                      +
                      (a.cantidad_ok || 0);

                    return acc;

                  }, {})

                )

                .sort((a, b) =>
                  b[1] - a[1]
                )[0]?.[0]

                || "-"

              }

            </h2>

          </div>

          {/* PROCESO MÁS CORREGIDO */}

          <div style={{
            background: "white",
            padding: 20,
            borderRadius: 14,
            boxShadow:
              "0 2px 8px rgba(0,0,0,0.08)"
          }}>

            <div style={{
              fontSize: 14,
              color: "#666"
            }}>

              ⚙️ Proceso Más Corregido

            </div>

            <h2 style={{
              margin: "10px 0 0 0",
              color: "#F57C00"
            }}>

              {

                Object.entries(

                  ajustes.reduce((acc, a) => {

                    const proc =
                      a.proceso || "-";

                    acc[proc] =
                      (acc[proc] || 0)
                      +
                      (a.cantidad_ok || 0);

                    return acc;

                  }, {})

                )

                .sort((a, b) =>
                  b[1] - a[1]
                )[0]?.[0]

                || "-"

              }

            </h2>

          </div>

        </div>

        <div style={{
  background: "white",
  padding: 20,
  borderRadius: 14,
  marginBottom: 25
}}>

  <h3>
    📈 Tendencia Ajustes
  </h3>

  <div style={{
    width: "100%",
    height: 300
  }}>

    <ResponsiveContainer>

      <BarChart
        data={ajustesPorDia}
      >

        <XAxis
          dataKey="fecha"
        />

        <YAxis />

        <Tooltip />

        <Bar
          dataKey="cantidad"
          fill="#6A1B9A"
        />

      </BarChart>

    </ResponsiveContainer>

  </div>

</div>

        <div style={{
          overflowX: "auto"
        }}>

          <table style={{
            width: "100%",
            borderCollapse: "collapse",
            background: "white"
          }}>

            <thead>

              <tr style={{
                background: "#6A1B9A",
                color: "white"
              }}>

                <th style={{ padding: 10 }}>
                  Fecha
                </th>

                <th style={{ padding: 10 }}>
                  Responsable
                </th>

                <th style={{ padding: 10 }}>
                  OT
                </th>

                <th style={{ padding: 10 }}>
                  Operario
                </th>

                <th style={{ padding: 10 }}>
                  Proceso
                </th>

                <th style={{ padding: 10 }}>
                  Subproceso
                </th>

                <th style={{ padding: 10 }}>
                  Detalle
                </th>

                <th style={{ padding: 10 }}>
                  Cantidad
                </th>

                <th style={{ padding: 10 }}>
                  Motivo
                </th>

              </tr>

            </thead>

            <tbody>

              {ajustes.map((a, i) => (

                <tr
                  key={i}
                  style={{
                    borderBottom:
                      "1px solid #ddd"
                  }}
                >

                  <td style={{ padding: 10 }}>

                    {
                      a.fecha?.toDate
                        ? a.fecha
                            .toDate()
                            .toLocaleString()
                        : "-"
                    }

                  </td>

                  <td style={{ padding: 10 }}>

                    {
                      a.responsable_ajuste
                      || "-"
                    }

                  </td>

                  <td style={{ padding: 10 }}>
                    {a.ot}
                  </td>

                  <td style={{ padding: 10 }}>
                    {a.operario}
                  </td>

                  <td style={{ padding: 10 }}>
                    {a.proceso}
                  </td>

                  <td style={{ padding: 10 }}>
                    {a.subproceso}
                  </td>
  
                  <td style={{ padding: 10 }}>
                    {a.detalle}
                  </td>

                  <td style={{
                    padding: 10,
                    fontWeight: "bold",
                    color: "#2E7D32"
                  }}>

                    +{a.cantidad_ok}

                  </td>

                  <td style={{ padding: 10 }}>

                    {
                      a.motivo_ajuste
                      || "-"
                    }

                  </td>

                </tr>
 
              ))}

            </tbody>

          </table>

        </div>

        <button
          onClick={() =>
            setPantalla("dashboard")
          }
          style={{
            ...botonAzul,
            marginTop: 20
          }}
        >

          ← Volver

        </button>

      </div>

    );

  }
  
  if (pantalla === "historialParos") { 
  
    const promedio =
      dashboard.length > 0
        ? dashboard.reduce(
            (a, b) =>
              a + (b.eficiencia || 0),
            0
          ) / dashboard.length
        : 0;

  const datosParos =
    Object.entries(
      todosLosParos.reduce((acc, paro) => {

        const motivo =
          paro.motivo || "Sin motivo";

        acc[motivo] =
          (acc[motivo] || 0) + 1;

        return acc;

      }, {})
    )

    .map(([motivo, cantidad]) => ({
      motivo,
      cantidad
    }))

    .sort((a, b) =>
      b.cantidad - a.cantidad
    );

  return (

    <div style={{ padding: 20 }}>

      <h2>
        📋 Historial de Paros
      </h2>

      <div style={{
        background: "#FFF3E0",
        padding: 20,
        borderRadius: 12,
        marginBottom: 20
      }}>

      <h3>
        🔴 Pareto de Paros
      </h3>

      <div style={{
        width: "100%",
        height: 300
      }}>

        <ResponsiveContainer>

          <BarChart data={datosParos}>

            <XAxis dataKey="motivo" />

            <YAxis />

            <Tooltip />

            <Bar dataKey="cantidad">

              {datosParos.map((entry, index) => (

                  <Cell
                  key={`paro-${index}`}
                  fill="#F44336"
                />

              ))}

            </Bar>

          </BarChart>

        </ResponsiveContainer>

      </div>  

        <h3>
          ⏱ Tiempo Total Perdido
        </h3>

        <h1 style={{
          color: "#E65100",
          margin: 0
        }}>

          {

            (() => {

              let totalMs = 0;

              todosLosParos.forEach(paro => {

                const inicio =
                  paro.inicio_paro?.toDate
                    ? paro.inicio_paro.toDate()
                    : new Date(paro.inicio_paro);

                const fin =
                  paro.fin_paro
                    ? (
                        paro.fin_paro.toDate
                          ? paro.fin_paro.toDate()
                          : new Date(paro.fin_paro)
                      )
                    : ahora;

                totalMs +=
                  fin - inicio;

              });

              const horas =
                Math.floor(
                  totalMs / 3600000
                );

              const minutos =
                Math.floor(
                  (totalMs % 3600000)
                  / 60000
                );

              return `
                ${horas}h ${minutos}m
              `;

            })()

          }

        </h1>

      </div>

      <div style={{
        background: "#E3F2FD",
        padding: 20,
        borderRadius: 12,
        marginBottom: 20
      }}>

        <h3>
          📊 Top Motivos de Paro
        </h3>

        {

          Object.entries(

            todosLosParos.reduce((acc, paro) => {

              const motivo =
                paro.motivo || "SIN MOTIVO";

              acc[motivo] =
                (acc[motivo] || 0) + 1;

              return acc;

            }, {})

          )

          .sort((a, b) => b[1] - a[1])

          .slice(0, 5)

          .map(([motivo, cantidad], i) => (

            <div
              key={i}
              style={{
                marginBottom: 10,
                background: "white",
                padding: 10,
                borderRadius: 8
              }}
            >

              <b>
                {i + 1}. {motivo}
              </b>

              <div style={{
                marginTop: 4,
                color: "#555"
              }}>
                {cantidad} detenciones
              </div>

            </div>

          ))

        }

      </div>

      {/* TOP OPERARIOS */}

      <div style={{
        background: "#F3E5F5",
        padding: 20,
        borderRadius: 12,
        marginBottom: 20
      }}>

        <h3>
          👷 Operarios con Más Detenciones
        </h3>

        {

          Object.entries(

            todosLosParos.reduce((acc, paro) => {

              const operario =
                paro.operario || "SIN OPERARIO";

              acc[operario] =
                (acc[operario] || 0) + 1;

              return acc;

            }, {})

          )

          .sort((a, b) => b[1] - a[1])

          .slice(0, 5)

          .map(([operario, cantidad], i) => (

            <div
              key={i}
              style={{
                marginBottom: 10,
                background: "white",
                padding: 10,
                borderRadius: 8
              }}
            >

              <b>
                {i + 1}. {operario}
              </b>

              <div style={{
                marginTop: 4,
                color: "#555"
              }}>
                {cantidad} detenciones
              </div>

            </div>

          ))

        }

      </div>

      {/* TOP OTs */}

      <div style={{
        background: "#E8F5E9",
        padding: 20,
        borderRadius: 12,
        marginBottom: 20
      }}>

        <h3>
          📋 OTs con Más Tiempo Perdido
        </h3>

        {

          Object.entries(

            todosLosParos.reduce((acc, paro) => {

              const ot =
                paro.ot || "SIN OT";

              const inicio =
                paro.inicio_paro?.toDate
                  ? paro.inicio_paro.toDate()
                  : new Date(paro.inicio_paro);

              const fin =
                paro.fin_paro
                  ? (
                      paro.fin_paro.toDate
                        ? paro.fin_paro.toDate()
                        : new Date(paro.fin_paro)
                    )
                  : ahora;

              const tiempo =
                fin - inicio;

              acc[ot] =
                (acc[ot] || 0) + tiempo;

              return acc;

            }, {})

          )

          .sort((a, b) => b[1] - a[1])

          .slice(0, 5)

          .map(([ot, tiempo], i) => {

            const horas =
              Math.floor(
                tiempo / 3600000
              );

            const minutos =
              Math.floor(
                (tiempo % 3600000)
                / 60000
              );

            return (

              <div
                key={i}
                style={{
                  marginBottom: 10,
                  background: "white",
                  padding: 10,
                  borderRadius: 8
                }}
              >

                <b>
                  {i + 1}. {ot}
                </b>

                <div style={{
                  marginTop: 4,
                  color: "#555"
                }}>

                  {horas}h {minutos}m perdidos

                </div>

              </div>

            );

          })

        }

      </div>

      {/* DISPONIBILIDAD */}

      <div style={{
        background: "#FFF8E1",
        padding: 20,
        borderRadius: 12,
        marginBottom: 20
      }}>

        <h3>
          ⚙️ Disponibilidad General
        </h3>

        {

          (() => {

            let tiempoTotalMs = 0;

            let tiempoPausasMs = 0;

            produccionActiva.forEach(p => {

              if (!p.inicio?.toDate)
                return;

              const inicio =
                p.inicio.toDate();

              tiempoTotalMs +=
                ahora - inicio;

            });

            todosLosParos.forEach(paro => {

              const inicio =
                paro.inicio_paro?.toDate
                  ? paro.inicio_paro.toDate()
                  : new Date(paro.inicio_paro);

              const fin =
                paro.fin_paro
                  ? (
                      paro.fin_paro.toDate
                        ? paro.fin_paro.toDate()
                        : new Date(paro.fin_paro)
                    )
                  : ahora;

              tiempoPausasMs +=
                fin - inicio;

            });

            const disponibilidad =
              tiempoTotalMs > 0
                ? (
                    (
                      tiempoTotalMs -
                      tiempoPausasMs
                    )
                    / tiempoTotalMs
                  ) * 100
                : 0;

            return (

              <div>

                <h1 style={{
                  margin: 0,
                  color:
                    disponibilidad >= 90
                      ? "#2E7D32"
                      : disponibilidad >= 75
                      ? "#F9A825"
                      : "#C62828"
                }}>

                  {disponibilidad.toFixed(1)}%

                </h1>

                <div style={{
                  marginTop: 8,
                  color: "#555"
                }}>
      
                  {

                    disponibilidad >= 90
                      ? "🟢 Excelente"
                      : disponibilidad >= 75
                      ? "🟡 Riesgo"
                      : "🔴 Crítico"

                  }

                </div>

              </div>

            );

          })()

        }

      </div>

      {/* OEE */}

      <div style={{
        background: "#ECEFF1",
        padding: 20,
        borderRadius: 12,
        marginBottom: 20
      }}>

        <h3>
          🏭 OEE General
        </h3>

        {

          (() => {

            let tiempoTotalMs = 0;

            let tiempoPausasMs = 0;

            produccionActiva.forEach(p => {

              if (!p.inicio?.toDate)
                return;

              const inicio =
                p.inicio.toDate();

              tiempoTotalMs +=
                ahora - inicio;

            });

            todosLosParos.forEach(paro => {

              const inicio =
                paro.inicio_paro?.toDate
                  ? paro.inicio_paro.toDate()
                  : new Date(paro.inicio_paro);

              const fin =
                paro.fin_paro
                  ? (
                      paro.fin_paro.toDate
                        ? paro.fin_paro.toDate()
                        : new Date(paro.fin_paro)
                    )
                  : ahora;

              tiempoPausasMs +=
                fin - inicio;

            });

            const disponibilidad =
              tiempoTotalMs > 0
                ? (
                    (
                      tiempoTotalMs -
                      tiempoPausasMs
                    )
                    / tiempoTotalMs
                  ) * 100
                : 0;

            const rendimiento =
              promedio || 0;

            const calidad = 100;

            const oee =
              (
                disponibilidad / 100
              ) *
              (
                rendimiento / 100
              ) *
              (
                calidad / 100
              ) * 100;

            return (

              <div>

                <h1 style={{
                  margin: 0,
                  color:
                    oee >= 85
                      ? "#2E7D32"
                      : oee >= 60
                      ? "#F9A825"
                      : "#C62828"
                }}>

                  {oee.toFixed(1)}%

                </h1>

                <div style={{
                  marginTop: 10,
                  color: "#555"
                }}>

                  Disponibilidad:
                  {" "}
                  {disponibilidad.toFixed(1)}%

                  <br />

                  Rendimiento:
                  {" "}
                  {rendimiento.toFixed(1)}%

                  <br />

                  Calidad:
                  {" "}
                  {calidad}%

                </div>

              </div>

            );

          })()

        }

      </div>

      <table style={{
        width: "100%",
        borderCollapse: "collapse"
      }}>

        <thead>

          <tr style={{
            background: "#222",
            color: "white"
          }}>

            <th>Operario</th>
            <th>OT</th>
            <th>Motivo</th>
            <th>Inicio</th>
            <th>Fin</th>
            <th>Duración</th>

          </tr>

        </thead>

        <tbody>

          {todosLosParos.map(paro => {

            const inicio =
              paro.inicio_paro?.toDate
                ? paro.inicio_paro.toDate()
                : new Date(paro.inicio_paro);

            const fin =
              paro.fin_paro
                ? (
                    paro.fin_paro.toDate
                      ? paro.fin_paro.toDate()
                      : new Date(paro.fin_paro)
                  )
                : ahora;

            const duracionMs =
              fin - inicio;

            const horas =
              Math.floor(
                duracionMs / 3600000
              );

            const minutos =
              Math.floor(
                (duracionMs % 3600000)
                / 60000
              );

            return (

              <tr
                key={paro.id}
                style={{
                  borderBottom:
                    "1px solid #ccc"
                }}
              >

                <td>{paro.operario}</td>

                <td>{paro.ot}</td>

                <td>{paro.motivo}</td>

                <td>
                  {inicio.toLocaleString()}
                </td>

                <td>
                  {
                    paro.fin_paro
                      ? fin.toLocaleString()
                      : "ACTIVO"
                  }
                </td>

                <td>
                  {horas}h {minutos}m
                </td>

              </tr>

            );

          })}

        </tbody>

      </table>

      <button
        onClick={() =>
          setPantalla("dashboard")
        }
        style={{
          ...botonAzul,
          marginTop: 20
        }}
      >
        ← Volver
      </button>

    </div>

  );

}

  if (pantalla === "ajusteGerencial") {

    const responsablesAjuste =
      usuarios.filter(u => {

        const rol =
          normalizar(u.rol);

        return (

          rol === "jefe"

          ||

          rol === "gerencia"

        );

      });
    
    return (

      <div style={{
        padding: 20,
        maxWidth: 500,
        margin: "0 auto"
      }}>

        <h2>
          🛠 Ajuste Gerencial
        </h2>

        <select
          style={estiloInput}
          value={otSeleccionada}
          onChange={(e) =>
            setOtSeleccionada(
              e.target.value
            )
          }
        >

          <option value="">
            Seleccionar OT
          </option>

          {ots.map((o, i) => (

            <option
              key={i}
              value={o.nombre}
            >

              {o.nombre}

            </option>

          ))}

        </select>

        <select
          style={estiloInput}
          value={operarioSeleccionado}
          onChange={(e) =>
            setOperarioSeleccionado(
              e.target.value
            )
          }
        >

          <option value="">
            Operario
          </option>

          {operarios.map((o, i) => (

            <option
              key={i}
              value={o.nombre}
            >

              {o.nombre}

            </option>

          ))}

        </select>

        <select
  style={estiloInput}
  value={operarioSeleccionado}
  onChange={(e) =>
    setOperarioSeleccionado(
      e.target.value
    )
  }
>

  <option value="">
    Responsable Ajuste
  </option>

  {responsablesAjuste.map((u, i) => (

    <option
      key={i}
      value={u.nombre}
    >

      {u.nombre}
      {" — "}
      {u.rol}

    </option>

  ))}

</select>

<select
  style={estiloInput}
  value={procesoSeleccionado}
  onChange={(e) =>
    setProcesoSeleccionado(
      e.target.value
    )
  }
>

  <option value="">
    Proceso
  </option>

  {procesos.map((p, i) => (

    <option
      key={i}
      value={p.nombre}
    >

      {p.nombre}

    </option>

  ))}

</select>

<select
  style={estiloInput}
  value={subprocesoSeleccionado}
  onChange={(e) =>
    setSubprocesoSeleccionado(
      e.target.value
    )
  }
>

  <option value="">
    Subproceso
  </option>

  {

    subprocesos

    .filter(s =>

      normalizar(s.proceso)
      ===
      normalizar(
        procesoSeleccionado
      )

    )

    .map((s, i) => (

      <option
        key={i}
        value={s.nombre}
      >

        {s.nombre}

      </option>

    ))

  }

</select>

<select
  style={estiloInput}
  value={detalleSeleccionado}
  onChange={(e) =>
    setDetalleSeleccionado(
      e.target.value
    )
  }
>

  <option value="">
    Detalle
  </option>

  {

    subprocesos

    .find(s =>

      normalizar(s.nombre)
      ===
      normalizar(
        subprocesoSeleccionado
      )

    )

    ?.detalles

    ?.map((d, i) => {

      const nombreDetalle =
        typeof d === "string"
          ? d
          : d.nombre;

      return (

        <option
          key={i}
          value={nombreDetalle}
        >

          {nombreDetalle}

        </option>

      );

    })

  }

</select>

        <input
          type="number"
          placeholder="Cantidad ajuste"
          style={estiloInput}
          value={cantidad}
          onChange={(e) =>
            setCantidad(e.target.value)
          }
        />

        <input
          type="text"
          placeholder="Motivo ajuste"
          style={estiloInput}
          value={motivoParo}
          onChange={(e) =>
            setMotivoParo(e.target.value)
          }
        />

        <button
          style={botonVerde}
          onClick={async () => {

            if (

              !otSeleccionada ||

              !operarioSeleccionado ||

              !responsableAjuste ||

              !procesoSeleccionado ||

              !subprocesoSeleccionado ||

              !cantidad ||

              !motivoParo

            ) {

              alert(
                "Completa los datos"
              );

              return;

            }

            try {

              await addDoc(
                collection(
                  db,
                  "registros_produccion"
                ),
                {

                  tipo:
                    "ajuste_gerencial",

                  ot:
                    otSeleccionada,

                  operario:
                    operarioSeleccionado,

                  cantidad_ok:
                    Number(cantidad),

                  motivo_ajuste:
                    motivoParo,

                  ajustado_por:
                    usuarioSeleccionado?.nombre
                    || "GERENCIA",

                  fecha:
                    new Date(),

                  eficiencia: 100,

                  estado_eficiencia:
                    "🟢"

                }
              );

              const prodActiva =
                produccionActiva.find(p =>

                  normalizar(p.ot)
                  ===
                  normalizar(
                    otSeleccionada
                  )

                  &&

                  normalizar(
                    p.operario
                  )
                  ===
                  normalizar(
                    operarioSeleccionado
                  )

                );

              if (prodActiva) {

                await updateDoc(

                  doc(
                    db,
                    "produccion_activa",
                    prodActiva.id
                  ),

                  {

                    cantidad_actual:

                      (
                        prodActiva.cantidad_actual
                        || 0
                      )

                      +

                      Number(cantidad)

                  }

                );

              }

              alert(
                "✅ Ajuste aplicado"
              );

              setCantidad("");

              setMotivoParo("");

              await cargarDashboard();

              await cargarProduccionActiva();

            }

            catch (error) {

              console.error(error);

              alert(
                "Error ajuste"
              );

            }

          }}
        >

          ✅ Aplicar Ajuste

        </button>

        <button
          style={botonAzul}
          onClick={() =>
            setPantalla("home")
          }
        >

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

  const hace7Dias = new Date();

  hace7Dias.setDate(
  hace7Dias.getDate() - 7
  );

  const registrosSemana =
    dashboard.filter(r => {

      if (!r.fecha?.toDate)
        return false;

      return (
        r.fecha.toDate() >= hace7Dias
      );

    });

  const ranking = Object.values(

    registrosSemana.reduce((acc, r) => {

      if (!r.operario)
        return acc;

      if (!acc[r.operario]) {

        acc[r.operario] = {
          operario: r.operario,
          total: 0,
          count: 0
        };

      }

      acc[r.operario].total +=
        r.eficiencia || 0;

      acc[r.operario].count += 1;

      return acc;

    }, {})

  )

  .map(r => ({

    operario: r.operario,

    promedio:
     r.count > 0
        ? r.total / r.count
        : 0

  }))

  .sort((a, b) =>
    b.promedio - a.promedio
  );

  const top1 = ranking[0];

  const alertas = [];

if (parosActivos.length > 0) {

  alertas.push({
    tipo: "error",
    mensaje:
      `⛔ Hay ${parosActivos.length} paro(s) activo(s)`
  });

}

if (promedio < 60) {

  alertas.push({
    tipo: "critico",
    mensaje:
      "📉 Eficiencia general crítica"
  });

}

produccionActiva.forEach(p => {

  if (!p.inicio?.toDate)
    return;

  const horas =
    (ahora - p.inicio.toDate())
    / 3600000;

  if (horas >= 4) {

    alertas.push({
      tipo: "warning",
      mensaje:
        `🕒 ${p.operario} lleva más de 4h en producción`
    });

  }

});

  const datosGrafico =
  ranking.map(r => ({

    nombre: r.operario,

    eficiencia:
      Number(
        r.promedio.toFixed(1)
      )

  }));

  const datosParos = Object.entries(

    todosLosParos.reduce((acc, paro) => {

      const motivo =
        paro.motivo || "SIN MOTIVO";

      acc[motivo] =
        (acc[motivo] || 0) + 1;

      return acc;

    }, {})

  )

  .map(([motivo, cantidad]) => ({

    motivo,

    cantidad

  }))

  .sort((a, b) =>
    b.cantidad - a.cantidad
  )

  .slice(0, 5);

  return (
  <>

    <style>
    {`

      @keyframes blink {

        0% {
          opacity: 1;
        }

        50% {
          opacity: 0.3;
        }

        100% {
          opacity: 1;
        }

      }

    `}
    </style>

    <div style={{
      padding: 20,
      background: "#f4f6f8",
      minHeight: "100vh",
      fontFamily: "Arial"
    }}>

      {/* 🧠 LAYOUT PRINCIPAL */}
      <div style={{
        display: esMobile ? "block" : "grid",
        gridTemplateColumns: "300px 1fr",
        gap: 20
      }}>

        {/* IZQUIERDA */}
        <div>

          <div style={{ marginBottom: 10 }}>
            🔴 EN VIVO
          </div>

          {top1 && (
            <div style={{
              background: "#4CAF50",
              color: "white",
              padding: 20,
              borderRadius: 12,
              textAlign: "center",
              marginBottom: 20
            }}>
              <h3>🥇 MEJOR OPERARIO</h3>

              <h1>
                {top1.operario}
              </h1>

              <h2>
                {top1.promedio.toFixed(1)}%
              </h2>
            </div>
          )}

          <h3>🏆 Ranking</h3>

          {ranking.map((r, i) => (
            <div
              key={i}
              style={{
                padding: 6,
                marginBottom: 8,
                background: "white",
                borderRadius: 8
              }}
            >
              {i + 1}. {r.operario} — {r.promedio.toFixed(1)}%
            </div>
          ))}

        </div>

        {/* DERECHA */}
        <div>

          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 15
          }}>

            <div>

              <h2 style={{
                margin: 0
              }}>
                📊 Dashboard
              </h2>

              <div style={{
                marginTop: 5,
                fontSize: 14,
                color: "#555",
                fontWeight: "bold"
              }}>

                🕒 {

                  ahora.toLocaleString()

                }

              </div>

            </div>

            <button
              onClick={() => {

                if (
                  !document.fullscreenElement
                ) {

                  document.documentElement
                    .requestFullscreen();

                }
                else {

                  document.exitFullscreen();

                }

              }}
              style={{
                padding: "10px 18px",
                borderRadius: 10,
                border: "none",
                background: "#111",
                color: "white",
                fontWeight: "bold",
                cursor: "pointer"
              }}
            >
              📺 Modo TV
            </button>

          </div>

          {alertas.length > 0 && (

            <div style={{
              marginTop: 20,
              marginBottom: 20
            }}>

              {alertas.map((a, i) => (

                <div
                  key={i}
                  style={{
                    background:
                      a.tipo === "critico"
                        ? "#B71C1C"
                        : a.tipo === "error"
                        ? "#D32F2F"
                        : "#F9A825",

                    color: "white",

                    padding: 15,

                    borderRadius: 12,

                    marginBottom: 10,

                    fontWeight: "bold",

                    fontSize: 16,

                    animation:
                      a.tipo === "critico"
                        ? "blink 1s infinite"
                        : "none"

                  }}
                >

                  🚨 {a.mensaje}

                </div>

              ))}

            </div>

          )}

          <div style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 15,
            marginTop: 20,
            marginBottom: 25
          }}>

            {/* PRODUCCIÓN TOTAL */}
            <div style={{
              background: "white",
              padding: 20,
              borderRadius: 14,
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
            }}>

              <div style={{
                fontSize: 14,
                color: "#666"
              }}>
                📦 Producción Total
              </div>

              <h1 style={{
                margin: "10px 0 0 0",
                color: "#1976D2"
              }}>
                {
                  dashboard.reduce(
                    (acc, r) =>
                      acc + (r.cantidad_ok || 0),
                    0
                  )
                }
              </h1>

            </div>

            {/* OPERARIOS ACTIVOS */}
            <div style={{
              background: "white",
              padding: 20,
              borderRadius: 14,
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
            }}>

              <div style={{
                fontSize: 14,
                color: "#666"
              }}>
                👷 Operarios Activos
              </div>

              <h1 style={{
                margin: "10px 0 0 0",
                color: "#2E7D32"
              }}>
                {produccionActiva.length}
              </h1>

            </div>

            {/* PAROS ACTIVOS */}
            <div style={{
              background: "white",
              padding: 20,
              borderRadius: 14,
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
            }}>

              <div style={{
                fontSize: 14,
                color: "#666"
              }}>
                ⛔ Paros Activos
              </div>

              <h1 style={{
                margin: "10px 0 0 0",
                color:
                  parosActivos.length > 0
                    ? "#C62828"
                    : "#2E7D32"
              }}>
                {parosActivos.length}
              </h1>

            </div>

            {/* EFICIENCIA */}
            <div style={{
              background: "white",
              padding: 20,
              borderRadius: 14,
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
            }}>

              <div style={{
                fontSize: 14,
                color: "#666"
              }}>
                ⚙️ Eficiencia General
              </div>

              <h1 style={{
                margin: "10px 0 0 0",
                color:
                  promedio >= 90
                    ? "#2E7D32"
                    : promedio >= 70
                    ? "#F9A825"
                    : "#C62828"
              }}>
                {promedio.toFixed(1)}%
              </h1>

            </div>

          </div>

          <div style={{
            background: "white",
            padding: 20,
            borderRadius: 12,
            marginTop: 20,
            marginBottom: 20
          }}>

            <h3>
              📈 Eficiencia por Operario
            </h3>

            <div style={{
              background: "white",
              padding: 20,
              borderRadius: 12,
              marginTop: 20,
              marginBottom: 20
            }}>

            </div>

            <div style={{
              width: "100%",
              height: 300
            }}>

              <ResponsiveContainer>

                <BarChart data={datosGrafico}>

                  <XAxis dataKey="nombre" />

                  <YAxis />

                  <Tooltip />

                  <Bar dataKey="eficiencia">

                    {datosGrafico.map((entry, index) => {

                      let color = "#4CAF50";

                      if (entry.eficiencia < 70) {

                        color = "#F44336";

                      }
                      else if (entry.eficiencia < 90) {

                        color = "#FFC107";

                      }

                      return (

                        <Cell
                          key={`cell-${index}`}
                          fill={color}
                        />

                      );

                    })}

                  </Bar>

                </BarChart>

              </ResponsiveContainer>

            </div>

          </div>

          <h3 style={{ marginTop: 20 }}>
            🟢 Producciones Activas
          </h3>

          <div style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 15,
            marginTop: 15
          }}>
          
          {produccionActiva.map((p, i) => {

            const inicio =
              p.inicio?.toDate();

            let tiempoPausasMs = 0;

            const parosDeEstaProduccion =
              todosLosParos.filter(paro =>

                normalizar(paro.operario) ===
                normalizar(p.operario)

                &&

                normalizar(paro.proceso) ===
                normalizar(p.proceso)

                );

            parosDeEstaProduccion.forEach(paro => {

              if (paro.inicio_paro) {

                const inicioParo =
                  paro.inicio_paro.toDate
                    ? paro.inicio_paro.toDate()
                    : new Date(paro.inicio_paro);

                const finParo =
                  paro.fin_paro
                    ? (
                        paro.fin_paro.toDate
                          ? paro.fin_paro.toDate()
                          : new Date(paro.fin_paro)
                      )
                    : ahora;

                tiempoPausasMs +=
                  finParo - inicioParo;

              }

            });

            const tiempoRealMs =
              inicio
                ? (
                    (ahora - inicio)
                    - tiempoPausasMs
                  )
                : 0;

            const tiempoHoras =
              tiempoRealMs / 3600000;

            const estandar =
              estandares.find(e => {

                const matchProc =
                  normalizar(e.proceso) ===
                  normalizar(p.proceso);

                const matchSub =
                  normalizar(e.subproceso) ===
                  normalizar(p.subproceso);

                const matchDet =
                  !e.detalle ||
                  normalizar(e.detalle) ===
                  normalizar(p.detalle);

                return (
                  matchProc &&
                  matchSub &&
                  matchDet
                );
              });

            const esperado =
              estandar
                ? Math.round(
                    estandar.unidades_por_hora *
                    tiempoHoras
                )
                : 0;

            const real =
              p.cantidad_actual || 0;

            let eficiencia = 0;

            if (esperado > 0) {
              eficiencia =
                Math.round(
                  (real / esperado) * 100
                );
            }

            const paroDeEstaProduccion =
              parosActivos.find(paro =>

                normalizar(paro.operario) ===
                normalizar(p.operario)

                 &&

                normalizar(paro.proceso) ===
                normalizar(p.proceso)

              );

            let color = "#E8F5E9";

            let textoColor = "#000";

            if (paroDeEstaProduccion) {

              color = "#B71C1C";

              textoColor = "white";

            }
            else if (eficiencia < 70) {

              color = "#FFCDD2";

            }
            else if (eficiencia < 90) {

              color = "#FFF9C4";

            }

            return (

            <div
              key={i}
              style={{
                background: color,
                color: textoColor,
                padding: 6,
                borderRadius: 8,
                marginBottom: 10
              }}
            >
              <div>
                👤 <b>{p.operario}</b>
              </div>

              <div>
                {p.proceso}
                {" → "}
                {p.subproceso}

                {p.detalle && (
                  <>
                    {" → "}
                    {p.detalle}
                  </>
                )}
              </div>

              <div style={{
                fontSize: 13,
                fontWeight: "bold",
                color: "#333",
                marginTop: 4
              }}>
                📋 OT:
                {" "}
                {p.ot || "-"}
              </div>

              <div style={{
                marginTop: 8
              }}>
                📦 Actual:
                {" "}
                <b>
                  {p.cantidad_actual || 0}
                </b>
              </div>

              <div style={{
                fontSize: 12,
                color: "#555"
              }}>
                Inicio:
                {" "}
                {p.inicio?.toDate
                  ? p.inicio.toDate().toLocaleString()
                  : "-"}
              </div>

              <div style={{
                marginTop: 6,
                fontWeight: "bold",
                color: "#D32F2F"
              }}>
                ⏱ {

                  (() => {

                    if (!p.inicio?.toDate)
                      return "00:00:00";

                    const inicio =
                      p.inicio.toDate();

                    const diferencia =
                      tiempoRealMs;

                    const horas =
                      Math.floor(
                        diferencia / 3600000
                      );

                    const minutos =
                      Math.floor(
                        (diferencia % 3600000)
                        / 60000
                      );

                    const segundos =
                      Math.floor(
                        (diferencia % 60000)
                        / 1000
                      );

                    return `
                      ${String(horas)
                        .padStart(2, "0")}
                      :
                      ${String(minutos)
                        .padStart(2, "0")}
                      :
                      ${String(segundos)
                        .padStart(2, "0")}
                    `;

                  })()

                }
              </div>

              <div style={{
                marginTop: 8
              }}>
                🎯 Esperado:
                {" "}
                <b>{esperado}</b>
              </div>

              <div>
                📦 Real:
                {" "}
                <b>{real}</b>
              </div>

              {paroDeEstaProduccion && (

                <div style={{
                  marginTop: 10,
                  padding: 10,
                  borderRadius: 10,
                  background: "#D32F2F",
                  color: "white",
                  fontWeight: "bold",
                  textAlign: "center"
                }}>

                  ⛔ PRODUCCIÓN DETENIDA

                  <div style={{
                    fontSize: 12,
                    marginTop: 4
                  }}>
                    {paroActivoProduccion.motivo}
                  </div>

                </div>

              )}

              <div style={{
                marginTop: 8,
                fontSize: 16,
                fontWeight: "bold"
              }}>
                {
                   eficiencia >= 90
                    ? "🟢"
                    : eficiencia >= 70
                    ? "🟡"
                    : "🔴"
                }

                {" "}
                {eficiencia}%
              </div>
  
            </div>

            );
          })}
          </div>

          <h1>{promedio.toFixed(1)}%</h1>

          <h3>Últimos registros</h3>

          {/* DESKTOP */}
          {!esMobile && (
            <>
              <div style={{
                display: "grid",
                gridTemplateColumns: "160px 60px 150px 200px 160px 180px 160px 120px 70px",
                fontWeight: "bold",
                marginBottom: 10
              }}>
                <div>Fecha</div>
                <div>Estado</div>
                <div>Operario</div>
                <div>OT</div>
                <div>Proceso</div>
                <div>Subproceso</div>
                <div>Detalle</div>
                <div>Cantidad</div>
                <div>%</div>
              </div>

              {dashboard.slice(0, 10).map((r, i) => (
                <div key={i} style={{
                  display: "grid",
                  gridTemplateColumns: "160px 60px 150px 200px 160px 180px 160px 120px 70px",
                  padding: 5,
                  background: "white",
                  borderRadius: 8,
                  marginBottom: 8
                }}>
                  <div>
                    {r.fecha?.toDate
                      ? r.fecha.toDate().toLocaleString()
                      : "-"}
                  </div>
                  <div>{r.estado_eficiencia}</div>
                  <div><b>{r.operario}</b></div>
                  <div>{r.ot || "-"}</div>
                  <div>{r.proceso}</div>
                  <div>{r.subproceso}</div>
                  <div>{r.detalle || "-"}</div>
                  <div>{r.cantidad_ok} un</div>
                  <div>{r.eficiencia}%</div>
                </div>
              ))}
            </>
          )}

          {/* MOBILE */}
          {esMobile && dashboard.slice(0, 10).map((r, i) => (
            <div key={i} style={{
              background: "white",
              padding: 15,
              borderRadius: 12,
              marginBottom: 12
            }}>
              <div style={{
                fontSize: 12,
                color: "#777",
                marginBottom: 5
              }}>
                {r.fecha?.toDate
                  ? r.fecha.toDate().toLocaleString()
                  : "-"}
              </div>
              <b>{r.estado_eficiencia} {r.operario}</b>
              <div>
                {r.proceso}
                {" → "}
                {r.subproceso}
              </div>

              <div style={{
                fontSize: 13,
                marginTop: 3
              }}>
                📋 OT:
                {" "}
                {r.ot || "-"}
              </div>
              <div style={{ fontSize: 13 }}>{r.detalle}</div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{r.cantidad_ok} un</span>
                <b>{r.eficiencia}%</b>
              </div>
            </div>
          ))}

        </div>
      </div> 

      <div style={{
        marginTop: 20,
        marginBottom: 20
      }}>

        <button
          onClick={() =>
            setPantalla("historialParos")
          }
          style={{
            padding: "12px 25px",
            borderRadius: 10,
            border: "none",
            background: "#455A64",
            color: "white",
            fontWeight: "bold",
            cursor: "pointer"
          }}
        >
          📋 Historial de Paros
        </button>

        <button
          onClick={() =>
            setPantalla(
              "historialAjustes"
            )
          }
          style={{
            padding: "12px 25px",
            borderRadius: 10,
            border: "none",
            background: "#6A1B9A",
            color: "white",
            fontWeight: "bold",
            cursor: "pointer",
            marginLeft: 10
          }}
        >

          🛠 Historial Ajustes

        </button>

      </div>

      {/* BOTÓN */}
      <div style={{ textAlign: "center", marginTop: 30 }}>
        <button
          onClick={() => setPantalla("home")}
          style={{
            padding: "15px 40px",
            fontSize: 18,
            borderRadius: 12,
            border: "none",
            background: "#1976D2",
            color: "white",
            fontWeight: "bold"
          }}
        >
          ⬅ Volver al Inicio
        </button>
      </div>

    </div>

    </>
    );
}
}

export default App;