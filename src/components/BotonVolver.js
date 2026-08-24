const estiloBase = {
  width: "fit-content",
  padding: "10px 14px",
  borderRadius: 9,
  border: "none",
  background: "#1976D2",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
  boxShadow: "0 2px 8px rgba(25,118,210,0.25)"
};

export default function BotonVolver({
  onClick,
  children = "Volver",
  style = {}
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...estiloBase,
        ...style
      }}
    >
      {children}
    </button>
  );
}
