import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth";

export interface OnboardingInterests {
  events: boolean;
  workshifts: boolean;
  news: boolean;
  gallery: boolean;
  documents: boolean;
}

const DEFAULT_INTERESTS: OnboardingInterests = {
  events: true,
  workshifts: true,
  news: true,
  gallery: false,
  documents: false,
};

export function useOnboarding() {
  const { member, user, isAdmin } = useAuth();
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(true);
  const [interests, setInterests] = useState<OnboardingInterests>(DEFAULT_INTERESTS);
  const [isLoaded, setIsLoaded] = useState(false);

  // Storage key based on user
  const getStorageKey = useCallback(() => {
    if (!user?.id) return null;
    return `onboarding_completed:${user.id}`;
  }, [user?.id]);

  const getInterestsKey = useCallback(() => {
    if (!user?.id) return null;
    return `onboarding_interests:${user.id}`;
  }, [user?.id]);

  // Load onboarding status from localStorage
  useEffect(() => {
    const key = getStorageKey();
    const interestsKey = getInterestsKey();
    if (!key || !member) return;

    const completed = localStorage.getItem(key);
    setHasCompletedOnboarding(completed === "true");

    // Load saved interests
    if (interestsKey) {
      const savedInterests = localStorage.getItem(interestsKey);
      if (savedInterests) {
        try {
          setInterests(JSON.parse(savedInterests));
        } catch {
          setInterests(DEFAULT_INTERESTS);
        }
      }
    }

    // Auto-open onboarding for first-time users
    if (completed !== "true") {
      // Small delay to let the UI settle
      setTimeout(() => {
        setIsOnboardingOpen(true);
      }, 500);
    }

    setIsLoaded(true);
  }, [getStorageKey, getInterestsKey, member]);

  // Complete onboarding
  const completeOnboarding = useCallback((selectedInterests?: OnboardingInterests) => {
    const key = getStorageKey();
    const interestsKey = getInterestsKey();
    if (!key) return;

    localStorage.setItem(key, "true");
    setHasCompletedOnboarding(true);
    setIsOnboardingOpen(false);

    if (selectedInterests && interestsKey) {
      localStorage.setItem(interestsKey, JSON.stringify(selectedInterests));
      setInterests(selectedInterests);
    }
  }, [getStorageKey, getInterestsKey]);

  // Skip onboarding (same as complete but without saving interests)
  const skipOnboarding = useCallback(() => {
    const key = getStorageKey();
    if (!key) return;

    localStorage.setItem(key, "true");
    setHasCompletedOnboarding(true);
    setIsOnboardingOpen(false);
  }, [getStorageKey]);

  // Restart onboarding
  const restartOnboarding = useCallback(() => {
    setIsOnboardingOpen(true);
  }, []);

  // Reset onboarding (for testing)
  const resetOnboarding = useCallback(() => {
    const key = getStorageKey();
    if (key) {
      localStorage.removeItem(key);
      setHasCompletedOnboarding(false);
    }
  }, [getStorageKey]);

  return {
    isOnboardingOpen,
    setIsOnboardingOpen,
    hasCompletedOnboarding,
    interests,
    isLoaded,
    isAdmin,
    completeOnboarding,
    skipOnboarding,
    restartOnboarding,
    resetOnboarding,
  };
}
