import React, { useState } from "react";
import { api } from "../services/api";
import { UserPlus, User, Lock, Eye, EyeOff, ArrowLeft } from "lucide-react";

export default function Register({ onNavigateToLogin, showToast }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const cleanUser = username.trim();
    if (!cleanUser || !password || !confirmPassword) {
      showToast("กรุณากรอกข้อมูลให้ครบถ้วนในทุกช่อง", "error");
      return;
    }

    if (cleanUser.length < 3) {
      showToast("ชื่อผู้ใช้งานต้องมีความยาวอย่างน้อย 3 ตัวอักษร", "error");
      return;
    }

    if (password.length < 6) {
      showToast("รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร", "error");
      return;
    }

    if (password !== confirmPassword) {
      showToast("รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง", "error");
      return;
    }

    setLoading(true);
    try {
      const data = await api.auth.register(cleanUser, password);

      showToast(data.message || "สมัครสมาชิกเสร็จสมบูรณ์!", "success");
      onNavigateToLogin(); // Go back to login
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper fade-in">
      <div className="auth-card">
        {/* Back Arrow */}
        <button
          type="button"
          onClick={onNavigateToLogin}
          style={{
            position: "absolute",
            top: "24px",
            left: "24px",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#64748B",
            display: "flex",
            alignItems: "center",
            gap: "4px",
            fontSize: "14px",
            fontWeight: "600"
          }}
          disabled={loading}
        >
          <ArrowLeft size={16} /> ย้อนกลับ
        </button>

        {/* App Logo */}
        <div className="auth-logo">AG</div>

        <h1 className="auth-title">สมัครสมาชิกใหม่</h1>
        <p className="auth-subtitle">สร้างพอร์ตของคุณเองได้ฟรี ข้อมูลการเงินแยกบัญชี 100%</p>

        <form onSubmit={handleSubmit}>
          {/* Username Input */}
          <div className="form-group">
            <label className="form-label">ชื่อผู้ใช้งานภาษาอังกฤษ (สำหรับล็อกอิน)</label>
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
                placeholder="ระบุชื่อผู้ใช้งาน (อย่างน้อย 3 ตัวอักษร)"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="form-group">
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
                placeholder="ระบุรหัสผ่าน (อย่างน้อย 6 ตัวอักษร)"
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

          {/* Confirm Password Input */}
          <div className="form-group" style={{ marginBottom: "32px" }}>
            <label className="form-label">ยืนยันรหัสผ่าน</label>
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
                placeholder="ป้อนรหัสผ่านอีกครั้ง"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          {/* Register Button */}
          <button
            type="submit"
            className="btn btn-primary"
            style={{ backgroundColor: "#00B98A", boxShadow: "0 8px 24px rgba(0, 185, 138, 0.2)" }}
            disabled={loading}
          >
            {loading ? "กำลังสมัครสมาชิก..." : "เปิดบัญชีพอร์ตโฟลิโอฟรี"}
            {!loading && <UserPlus size={18} />}
          </button>
        </form>

        {/* Toggle back to Login */}
        <div style={{ marginTop: "24px", fontSize: "14px", color: "#64748B" }}>
          มีบัญชีอยู่แล้ว?{" "}
          <button type="button" className="btn-text" onClick={onNavigateToLogin} disabled={loading}>
            เข้าสู่ระบบที่นี่
          </button>
        </div>
      </div>
    </div>
  );
}
