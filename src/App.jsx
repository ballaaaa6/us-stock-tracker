import React, { useState, useEffect } from "react";
import Login from "./components/Login";
import Register from "./components/Register";
import Dashboard from "./components/Dashboard";
import ErrorBoundary from "./components/common/ErrorBoundary";

export default function App() {
  const [user, setUser] = useState(null);
  const [currentPage, setCurrentPage] = useState("login"); // login, register, dashboard
  const [toast, setToast] = useState({ show: false, message: "", type: "info" });

  // 1. Auto-Login hook: check if user session already exists in localStorage on startup
  useEffect(() => {
    const savedUser = localStorage.getItem("portfolio_user");
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        if (parsedUser && parsedUser.token) {
          setUser(parsedUser);
          setCurrentPage("dashboard");
        }
      } catch (err) {
        console.error("Error parsing saved session: ", err);
        localStorage.removeItem("portfolio_user");
      }
    }
  }, []);

  // 2. Global Toast system helper
  const showToast = (message, type = "info") => {
    setToast({ show: true, message, type });
    // Automatically close toast after 3.5 seconds
    setTimeout(() => {
      setToast({ show: false, message: "", type: "info" });
    }, 3500);
  };

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    setCurrentPage("dashboard");
  };

  const handleLogout = () => {
    if (window.confirm("คุณแน่ใจหรือไม่ที่จะออกจากระบบพอร์ตของคุณ?")) {
      localStorage.removeItem("portfolio_user");
      setUser(null);
      setCurrentPage("login");
      showToast("ออกจากระบบพอร์ตของคุณสำเร็จแล้ว!", "info");
    }
  };

  return (
    <>
      {/* Basic router logic */}
      {currentPage === "login" && (
        <Login
          onLoginSuccess={handleLoginSuccess}
          onNavigateToRegister={() => setCurrentPage("register")}
          showToast={showToast}
        />
      )}

      {currentPage === "register" && (
        <Register onNavigateToLogin={() => setCurrentPage("login")} showToast={showToast} />
      )}

      {currentPage === "dashboard" && user && (
        <ErrorBoundary>
          <Dashboard user={user} onLogout={handleLogout} showToast={showToast} />
        </ErrorBoundary>
      )}

      {/* 3. Global Floating Toast Notification Banner */}
      {toast.show && (
        <div className={`alert-toast toast-${toast.type}`}>
          {toast.type === "success" && "✅"}
          {toast.type === "error" && "❌"}
          {toast.type === "info" && "ℹ️"}
          <span>{toast.message}</span>
        </div>
      )}
    </>
  );
}
