import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth";

export type UIMode = "member" | "admin";

// Permissions that indicate admin/management capabilities
const ADMIN_PERMISSIONS = [
  "club.admin.full",
  "club.members.manage",
  "club.roles.manage",
  "club.appointments.manage",
  "club.posts.approve_publication",
  "club.events.approve_publication",
  "club.companies.manage",
  "club.settings.manage",
  "company.delegations.manage",
];

export function useUIMode() {
  const { member, hasPermission, isAdmin, user } = useAuth();
  const [uiMode, setUIMode] = useState<UIMode>("member");
  const [isLoaded, setIsLoaded] = useState(false);

  // Check if user has any admin/management permissions
  const hasAnyAdminPermission = useCallback(() => {
    if (isAdmin) return true;
    return ADMIN_PERMISSIONS.some((perm) => hasPermission(perm));
  }, [isAdmin, hasPermission]);

  // Storage key based on club and user
  const getStorageKey = useCallback(() => {
    if (!member?.club_id || !user?.id) return null;
    return `portal_ui_mode:${member.club_id}:${user.id}`;
  }, [member?.club_id, user?.id]);

  // Load mode from localStorage on mount, default to admin mode if user has admin permissions
  useEffect(() => {
    const key = getStorageKey();
    if (!key) return;

    const stored = localStorage.getItem(key);
    if (stored === "admin" || stored === "member") {
      setUIMode(stored);
    } else {
      // First-time users: default to admin mode if they have admin permissions
      const defaultMode = hasAnyAdminPermission() ? "admin" : "member";
      setUIMode(defaultMode);
      localStorage.setItem(key, defaultMode);
    }
    setIsLoaded(true);
  }, [getStorageKey, hasAnyAdminPermission]);

  // Toggle function
  const toggleMode = useCallback(() => {
    const key = getStorageKey();
    if (!key) return;

    const newMode: UIMode = uiMode === "member" ? "admin" : "member";
    setUIMode(newMode);
    localStorage.setItem(key, newMode);
  }, [uiMode, getStorageKey]);

  // Set specific mode
  const setMode = useCallback((mode: UIMode) => {
    const key = getStorageKey();
    if (!key) return;

    setUIMode(mode);
    localStorage.setItem(key, mode);
  }, [getStorageKey]);

  return {
    uiMode,
    isAdminMode: uiMode === "admin",
    isMemberMode: uiMode === "member",
    canToggle: hasAnyAdminPermission(),
    toggleMode,
    setMode,
    isLoaded,
  };
}
