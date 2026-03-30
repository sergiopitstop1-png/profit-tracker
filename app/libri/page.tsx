export default function Libri() {
  return (
    <main
      style={{
        background: "black",
        color: "white",
        padding: "60px 20px",
        minHeight: "100vh",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1 style={{ fontSize: "40px" }}>Libri</h1>

      <p style={{ marginTop: "20px", maxWidth: "800px" }}>
        Storie scritte tra realtà e immaginazione.
      </p>

      <div style={{ marginTop: "30px", maxWidth: "800px" }}>
        <h2 style={{ fontSize: "28px" }}>Sotto la superficie</h2>
        <p style={{ marginTop: "10px" }}>
          Un thriller che si muove tra verità nascoste e sistemi invisibili.
        </p>
        <p style={{ marginTop: "5px", color: "#aaa" }}>
          Stato: In lavorazione
        </p>
      </div>
    </main>
  );
}