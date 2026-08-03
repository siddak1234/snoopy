import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Autom8x — Automation multiplied by AI";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Social share card in the Nocturne voice: dark ground, accent kicker and
 * rule, Inter-adjacent system type. Colors mirror app/globals.css tokens
 * (ImageResponse can't read CSS custom properties).
 */
export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "80px",
        backgroundColor: "#161826",
        backgroundImage:
          "radial-gradient(900px 500px at 50% -150px, rgba(43,39,65,0.9), transparent 60%)",
        color: "#e9e9ed",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div
        style={{
          fontSize: 26,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "#9184d9",
        }}
      >
        Automation × AI
      </div>
      <div
        style={{
          marginTop: 28,
          fontSize: 96,
          fontWeight: 500,
          letterSpacing: "-0.016em",
          lineHeight: 1.05,
        }}
      >
        Autom8 any workflow.
      </div>
      <div
        style={{
          marginTop: 32,
          fontSize: 30,
          color: "#b2b6ca",
        }}
      >
        Repetitive work becomes agentic workflows.
      </div>
      <div
        style={{
          marginTop: 48,
          width: 96,
          height: 3,
          backgroundColor: "#9184d9",
        }}
      />
      <div style={{ marginTop: 24, fontSize: 26, color: "#9397ab" }}>
        autom8x.ai
      </div>
    </div>,
    size,
  );
}
