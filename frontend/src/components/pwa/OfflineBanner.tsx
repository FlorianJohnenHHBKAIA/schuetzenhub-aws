import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WifiOff, Wifi } from "lucide-react";
import { toast } from "sonner";

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      toast.success("Wieder online", {
        description: "Daten werden aktualisiert.",
        duration: 3000,
      });
      // Hide reconnected indicator after a moment
      setTimeout(() => setShowReconnected(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnected(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="bg-amber-500 text-amber-950 overflow-hidden"
        >
          <div className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium">
            <WifiOff className="w-4 h-4" />
            <span>Offline – Änderungen sind deaktiviert. Du kannst Inhalte nur ansehen.</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Hook to check if mutations should be disabled
export function useOfflineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return {
    isOnline,
    isOffline: !isOnline,
    canMutate: isOnline,
  };
}
