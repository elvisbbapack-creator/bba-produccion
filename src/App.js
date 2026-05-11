import { useState, useEffect } from "react";
import { db } from "./firebase";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc
} from "firebase/firestore";

function App() {
  /* eslint-disable no-unused-vars */
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

  const [estandares, setEstandares] = useState([]);
  const [dashboard, setDashboard] = useState([]);

  const [otDetalle, setOtDetalle] = useState(null);

  const [ahora, setAhora] = useState(
    new Date()
  );
  
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

async function cargarDatos() {

  try {

    const activaSnap = await getDocs(
      collection(db, "produccion_activa")
    );

    setProduccionActiva(
      activaSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
    );

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

}

useEffect(() => {
  cargarDatos();
}, []);
  
useEffect(() => {

  const intervalo = setInterval(() => {

    setAhora(new Date());

  }, 1000);

  return () => clearInterval(intervalo);

}, []);

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

    await addDoc(collection(db, "registros_produccion"), {
      iniciado_por:
        usuarioSeleccionado?.nombre || "SIN USUARIO",

      operario: operarioSeleccionado,
      rol: usuarioSeleccionado.rol,
      ot: otSeleccionada,
      proceso: procesoSeleccionado,
      subproceso: subprocesoSeleccionado,
      detalle: detalleSeleccionado,
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

  const inicio =
  p.inicio?.toDate();

const tiempoHoras =
  inicio
    ? (ahora - inicio) / 3600000
    : 0;

const normalizar = (txt) =>
  txt
    ? txt.toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, " ")
    : "";

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

    <div>
      {p.proceso}
      {" → "}
      {p.subproceso}
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

          const normalizar = (txt) =>
  txt
    ? txt.toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, " ")
    : "";

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

  </div>

  );
})}

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
                    r.ot === otDetalle.nombre &&
                    r.proceso === p.nombre
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

              const registrosProceso =
                dashboard.filter(r =>
                  r.ot === otDetalle.nombre &&
                  r.proceso === p.nombre
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

  if (pantalla === "dashboard") {

  const esMobile = window.innerWidth < 768;

  const promedio =
    dashboard.length > 0
      ? dashboard.reduce((a, b) => a + (b.eficiencia || 0), 0) / dashboard.length
      : 0;

  const ranking = Object.values(
    dashboard.reduce((acc, r) => {

      if (!r.operario) return acc;

      if (!acc[r.operario]) {
        acc[r.operario] = {
          operario: r.operario,
          total: 0,
          count: 0
        };
      }

      acc[r.operario].total += r.eficiencia || 0;
      acc[r.operario].count += 1;

      return acc;

    }, {})
  )
  .map(r => ({
    operario: r.operario,
    promedio: r.total / r.count
  }))
  .sort((a, b) => b.promedio - a.promedio);

  const top1 = ranking[0];

  return (
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

          <h2>📊 Dashboard</h2>

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

          const tiempoHoras =
            inicio
              ? (ahora - inicio) / 3600000
              : 0;

          const normalizar = (txt) =>
            txt
              ? txt.toString()
                   .toLowerCase()
                   .trim()
                   .replace(/\s+/g, " ")
              : "";

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

              {dashboard.slice(-10).reverse().map((r, i) => (
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
          {esMobile && dashboard.slice(-10).reverse().map((r, i) => (
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
  );
}
}

export default App;