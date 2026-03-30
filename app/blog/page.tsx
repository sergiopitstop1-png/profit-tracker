export default function Blog() {
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
      <h1 style={{ fontSize: "40px" }}>Blog</h1>

      <p style={{ marginTop: "20px", maxWidth: "800px" }}>
        Pensieri, errori, sistemi.
      </p>

      <div style={{ marginTop: "30px", maxWidth: "800px" }}>
        <h2 style={{ fontSize: "28px" }}>Come si riparte quando hai perso tutto</h2>
        <p style={{ marginTop: "10px" }}>
          Ripartire non è romanticismo. È metodo, dolore e pazienza.
        </p>
      </div>

      <div style={{ marginTop: "30px", maxWidth: "800px" }}>
        <h2 style={{ fontSize: "28px" }}>Il metodo batte sempre la motivazione</h2>
        <p style={{ marginTop: "10px" }}>
          La motivazione va e viene. Il metodo resta.
        </p>
      </div>
    </main>
  );
}