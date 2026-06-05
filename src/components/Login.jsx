import React, { useState } from "react";
import { api } from "../services/api";
import { LogIn, User, Lock, Eye, EyeOff } from "lucide-react";

export default function Login({ onLoginSuccess, onNavigateToRegister, showToast }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const autoLoginAttemptedRef = React.useRef(false);

  React.useEffect(() => {
    if (autoLoginAttemptedRef.current) return;

    const params = new URLSearchParams(window.location.search);
    const autoUsername = params.get("username");
    const autoPassword = params.get("password");

    if (autoUsername && autoPassword) {
      autoLoginAttemptedRef.current = true;
      setLoading(true);

      (async () => {
        try {
          const data = await api.auth.login(autoUsername, autoPassword);

          localStorage.setItem("portfolio_user", JSON.stringify(data));
          showToast("ยินดีต้อนรับกลับเข้าสู่ระบบ!", "success");
          onLoginSuccess(data);
        } catch (err) {
          showToast(err.message, "error");
          setLoading(false);
        }
      })();
    }
  }, [onLoginSuccess, showToast]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      showToast("กรุณากรอกชื่อผู้ใช้และรหัสผ่าน", "error");
      return;
    }

    setLoading(true);
    try {
      const data = await api.auth.login(username, password);

      // Save user session in localStorage to enable Auto-Login
      localStorage.setItem("portfolio_user", JSON.stringify(data));
      showToast("ยินดีต้อนรับกลับเข้าสู่ระบบ!", "success");

      // Trigger parent handler to display dashboard
      onLoginSuccess(data);

    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper fade-in">
      <div className="auth-card">
        {/* App Logo */}
        <div className="auth-logo">
          AG
        </div>
        
        <h1 className="auth-title">ยินดีต้อนรับสู่ Antigravity Tracker</h1>
        <p className="auth-subtitle">ระบบติดตามพอร์ตสินทรัพย์สหรัฐ คริปโต ทองคำ และเงินสด</p>

        <form onSubmit={handleSubmit}>
          {/* Username Input */}
          <div className="form-group">
            <label className="form-label">ชื่อผู้ใช้งาน</label>
            <div style={{ position: "relative" }}>
              <User 
                size={18} 
                style={{ 
                  position: "absolute", 
                  left: "16px", 
                  top: "50%", 
                  transform: "translateY(-50%)", 
                  color: "#64748B" 
                }} 
              />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: "48px" }}
                placeholder="กรอกชื่อผู้ใช้ (เช่น admin)"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="form-group" style={{ marginBottom: "32px" }}>
            <label className="form-label">รหัสผ่าน</label>
            <div style={{ position: "relative" }}>
              <Lock 
                size={18} 
                style={{ 
                  position: "absolute", 
                  left: "16px", 
                  top: "50%", 
                  transform: "translateY(-50%)", 
                  color: "#64748B" 
                }} 
              />
              <input
                type={showPassword ? "text" : "password"}
                className="form-input"
                style={{ paddingLeft: "48px", paddingRight: "48px" }}
                placeholder="กรอกรหัสผ่าน"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: "16px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#64748B",
                  display: "flex",
                  alignItems: "center"
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบทันที"}
            {!loading && <LogIn size={18} />}
          </button>
        </form>

        {/* Navigation to Register */}
        <div style={{ marginTop: "24px", fontSize: "14px", color: "#64748B" }}>
          ยังไม่มีบัญชีใช้งานพอร์ต?{" "}
          <button 
            type="button" 
            className="btn-text" 
            onClick={onNavigateToRegister}
            disabled={loading}
          >
            สมัครสมาชิกใหม่ที่นี่
          </button>
        </div>
      </div>
    </div>
  );
}
