import Link from "next/link";

export default function Navbar() {
  return (
    <header
      style={{
        borderBottom: "1px solid #333",
        padding: "20px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        background: "black",
      }}
    >
      <h1 style={{ color: "white", margin: 0 }}>Sergio Apicella</h1>

      <nav style={{ display: "flex", gap: "20px" }}>
        <Link href="/" style={{ color: "white" }}>Home</Link>
        <Link href="/biografia" style={{ color: "white" }}>Biografia</Link>
        <Link href="/obiettivi" style={{ color: "white" }}>Obiettivi</Link>
        <Link href="/blog" style={{ color: "white" }}>Blog</Link>
        <Link href="/libri" style={{ color: "white" }}>Libri</Link>
        <Link href="/login" style={{ color: "white" }}>Accesso</Link>
      </nav>
    </header>
  );
}