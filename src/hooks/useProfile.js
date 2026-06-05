import { useState, useEffect } from "react";
import { api } from "../services/api";

/**
 * Custom hook to manage user profile, avatar upload, password changes, and server sync.
 * @param {Object} params
 * @param {Object} params.user - User object containing token and username.
 * @param {Function} params.showToast - Toast notification function.
 * @returns {Object} Profile state and handlers.
 */
export function useProfile({ user, showToast }) {
  const [portfolioName, setPortfolioName] = useState(
    () => localStorage.getItem(`portfolio_name_${user.username}`) || "StockVault"
  );
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState("");
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profilePic, setProfilePic] = useState(() => localStorage.getItem(`profile_pic_${user.username}`) || "");
  const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false);
  const [avatarHovered, setAvatarHovered] = useState(false);
  const [presetModalOpen, setPresetModalOpen] = useState(false);
  const [nickname, setNickname] = useState(() => localStorage.getItem(`profile_nickname_${user.username}`) || "");
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem("gemini_api_key") || "");

  const [newNickname, setNewNickname] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // Sync profile options to the server
  const syncProfileToServer = async (name, pic, nick) => {
    if (user.username === "local_user") return;
    try {
      await api.profile.update(user.token, {
        portfolioName: name,
        profilePic: pic,
        nickname: nick
      });
    } catch (err) {
      console.error("Profile sync failed:", err);
    }
  };

  // Load profile from server on mount
  useEffect(() => {
    const fetchProfileSync = async () => {
      try {
        const data = await api.profile.get(user.token);
        if (data.portfolioName) {
          setPortfolioName(data.portfolioName);
          localStorage.setItem(`portfolio_name_${user.username}`, data.portfolioName);
        }
        if (data.profilePic) {
          setProfilePic(data.profilePic);
          localStorage.setItem(`profile_pic_${user.username}`, data.profilePic);
        }
        if (data.nickname) {
          setNickname(data.nickname);
          localStorage.setItem(`profile_nickname_${user.username}`, data.nickname);
        }
      } catch (err) {
        console.warn("โหลดโปรไฟล์จากเซิร์ฟเวอร์ไม่สำเร็จ ใช้ข้อมูล Local แทน:", err.message);
      }
    };
    fetchProfileSync();
  }, [user.token, user.username]);

  // Sync form inputs when the profile settings modal opens
  useEffect(() => {
    if (profileModalOpen) {
      setNewNickname(nickname);
      setOldPassword("");
      setNewPassword("");
    }
  }, [profileModalOpen, nickname]);

  const handleSaveName = async () => {
    const trimmed = tempName.trim();
    if (trimmed) {
      setPortfolioName(trimmed);
      localStorage.setItem(`portfolio_name_${user.username}`, trimmed);
      await syncProfileToServer(trimmed, profilePic, nickname);
    }
    setIsEditingName(false);
  };

  const handleAvatarUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      showToast("ขนาดไฟล์ต้องไม่เกิน 10MB", "error");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        const MAX_DIM = 300;

        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.7);
        setProfilePic(compressedDataUrl);
      };
      img.onerror = () => {
        showToast("ไม่สามารถประมวลผลไฟล์รูปภาพนี้ได้", "error");
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    try {
      const trimmedNickname = newNickname.trim();
      localStorage.setItem(`profile_nickname_${user.username}`, trimmedNickname);
      setNickname(trimmedNickname);
      localStorage.setItem(`profile_pic_${user.username}`, profilePic);
      showToast("บันทึกข้อมูลโปรไฟล์สำเร็จ!", "success");
      setProfileModalOpen(false);
      await syncProfileToServer(portfolioName, profilePic, trimmedNickname);
    } catch {
      showToast("เกิดข้อผิดพลาดในการบันทึกโปรไฟล์", "error");
    }
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword) {
      showToast("กรุณากรอกรหัสผ่านเดิมและรหัสผ่านใหม่ให้ครบถ้วน", "error");
      return;
    }
    if (newPassword.length < 6) {
      showToast("รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร", "error");
      return;
    }

    try {
      await api.auth.changePassword(user.username, oldPassword, newPassword);
      showToast("เปลี่ยนรหัสผ่านสำเร็จแล้ว!", "success");
      setOldPassword("");
      setNewPassword("");
    } catch {
      showToast("เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน", "error");
    }
  };

  // Expose a helper to reset profile settings to initial empty states
  const resetProfile = async () => {
    setProfilePic("");
    setNickname("");
    setNewNickname("");
    setPortfolioName("StockVault");
    localStorage.removeItem(`profile_pic_${user.username}`);
    localStorage.removeItem(`profile_nickname_${user.username}`);
    localStorage.removeItem(`portfolio_name_${user.username}`);
    await syncProfileToServer("StockVault", "", "");
  };

  return {
    portfolioName,
    setPortfolioName,
    isEditingName,
    setIsEditingName,
    tempName,
    setTempName,
    profileModalOpen,
    setProfileModalOpen,
    profilePic,
    setProfilePic,
    avatarPreviewOpen,
    setAvatarPreviewOpen,
    avatarHovered,
    setAvatarHovered,
    presetModalOpen,
    setPresetModalOpen,
    nickname,
    setNickname,
    geminiKey,
    setGeminiKey,
    newNickname,
    setNewNickname,
    oldPassword,
    setOldPassword,
    newPassword,
    setNewPassword,
    handleSaveName,
    handleAvatarUpload,
    handleSaveProfile,
    handleChangePassword,
    resetProfile,
    syncProfileToServer
  };
}
