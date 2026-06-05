import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleHardRefresh = () => {
    localStorage.clear();
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Fallback UI
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
            color: "#F8FAFC",
            fontFamily: "var(--font-sans, system-ui, sans-serif)",
            boxSizing: "border-box"
          }}
        >
          <div
            style={{
              maxWidth: "560px",
              width: "100%",
              background: "rgba(30, 41, 59, 0.7)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "24px",
              padding: "32px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4)",
              animation: "scaleInModal 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
              display: "flex",
              flexDirection: "column",
              gap: "24px"
            }}
          >
            {/* Header / Icon */}
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "16px",
                  background: "rgba(239, 68, 68, 0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "28px",
                  border: "1px solid rgba(239, 68, 68, 0.25)"
                }}
              >
                ⚠️
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "#F1F5F9" }}>
                  เกิดข้อผิดพลาดในการทำงาน
                </h2>
                <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#94A3B8" }}>
                  ระบบตรวจพบข้อผิดพลาดที่ไม่คาดคิดในส่วนของ UI
                </p>
              </div>
            </div>

            {/* Error Message summary */}
            <div
              style={{
                background: "rgba(15, 23, 42, 0.4)",
                border: "1px solid rgba(255, 255, 255, 0.05)",
                borderRadius: "16px",
                padding: "16px",
                fontSize: "14px",
                lineHeight: "1.6",
                color: "#FDA4AF"
              }}
            >
              <strong>ข้อความข้อผิดพลาด:</strong>
              <div style={{ marginTop: "4px", fontFamily: "monospace", wordBreak: "break-all" }}>
                {this.state.error && this.state.error.toString()}
              </div>
            </div>

            {/* Collapsible stack trace */}
            <details style={{ width: "100%" }}>
              <summary
                style={{
                  cursor: "pointer",
                  fontSize: "13px",
                  color: "#38BDF8",
                  fontWeight: 600,
                  outline: "none",
                  userSelect: "none"
                }}
              >
                ดูรายละเอียดทางเทคนิค (Stack Trace)
              </summary>
              <pre
                style={{
                  marginTop: "12px",
                  padding: "12px",
                  background: "rgba(15, 23, 42, 0.6)",
                  border: "1px solid rgba(255, 255, 255, 0.05)",
                  borderRadius: "12px",
                  fontSize: "11px",
                  fontFamily: "monospace",
                  color: "#94A3B8",
                  overflowX: "auto",
                  maxHeight: "180px",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all"
                }}
              >
                {this.state.errorInfo && this.state.errorInfo.componentStack}
              </pre>
            </details>

            {/* Actions */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "8px" }}>
              <button
                type="button"
                onClick={this.handleReset}
                style={{
                  background: "linear-gradient(135deg, #5236FF 0%, #3B82F6 100%)",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "12px",
                  height: "44px",
                  fontSize: "14px",
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(82, 54, 255, 0.25)",
                  transition: "transform 0.2s"
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.02)")}
                onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
              >
                🔄 ลองใหม่อีกครั้ง (Try Again)
              </button>

              <button
                type="button"
                onClick={this.handleHardRefresh}
                style={{
                  background: "rgba(239, 68, 68, 0.1)",
                  color: "#EF4444",
                  border: "1.5px solid rgba(239, 68, 68, 0.3)",
                  borderRadius: "12px",
                  height: "40px",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "background 0.2s"
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(239, 68, 68, 0.15)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)")}
              >
                🔥 ล้างแคชและรีเฟรชหน้าเว็บ (Clear Cache & Reload)
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
