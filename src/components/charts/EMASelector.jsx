import React from "react";

export default function EMASelector({
  isCashAsset,
  showEma10,
  setShowEma10,
  showEma20,
  setShowEma20,
  showEma50,
  setShowEma50,
  showEma200,
  setShowEma200
}) {
  if (isCashAsset) return null;

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      style={{
        position: "absolute",
        top: "8px",
        right: "24px",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        background: "rgba(255, 255, 255, 0.85)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        border: "1px solid var(--border)",
        borderRadius: "10px",
        padding: "4px 10px",
        boxShadow: "var(--shadow-xs)",
        zIndex: 10,
        pointerEvents: "auto",
        fontFamily: "Outfit, sans-serif"
      }}
    >
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "5px",
          cursor: "pointer",
          fontSize: "11px",
          fontWeight: "700",
          color: "var(--text-muted)",
          userSelect: "none"
        }}
      >
        <input
          type="checkbox"
          checked={showEma10}
          onChange={(e) => setShowEma10(e.target.checked)}
          style={{ cursor: "pointer", accentColor: "#00d2ff" }}
        />
        <span
          style={{
            display: "inline-block",
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: "#00d2ff"
          }}
        ></span>
        EMA 10
      </label>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "5px",
          cursor: "pointer",
          fontSize: "11px",
          fontWeight: "700",
          color: "var(--text-muted)",
          userSelect: "none"
        }}
      >
        <input
          type="checkbox"
          checked={showEma20}
          onChange={(e) => setShowEma20(e.target.checked)}
          style={{ cursor: "pointer", accentColor: "#FBBF24" }}
        />
        <span
          style={{
            display: "inline-block",
            width: "8px",
            height: "8px",
            borderRadius: "1px",
            border: "1px dashed #FBBF24",
            background: "transparent"
          }}
        ></span>
        EMA 20
      </label>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "5px",
          cursor: "pointer",
          fontSize: "11px",
          fontWeight: "700",
          color: "var(--text-muted)",
          userSelect: "none"
        }}
      >
        <input
          type="checkbox"
          checked={showEma50}
          onChange={(e) => setShowEma50(e.target.checked)}
          style={{ cursor: "pointer", accentColor: "#F97316" }}
        />
        <span
          style={{
            display: "inline-block",
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: "#F97316"
          }}
        ></span>
        EMA 50
      </label>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "5px",
          cursor: "pointer",
          fontSize: "11px",
          fontWeight: "700",
          color: "var(--text-muted)",
          userSelect: "none"
        }}
      >
        <input
          type="checkbox"
          checked={showEma200}
          onChange={(e) => setShowEma200(e.target.checked)}
          style={{ cursor: "pointer", accentColor: "#DC2626" }}
        />
        <span
          style={{
            display: "inline-block",
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: "#DC2626"
          }}
        ></span>
        EMA 200
      </label>
    </div>
  );
}
