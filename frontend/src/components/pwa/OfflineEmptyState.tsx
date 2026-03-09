import { WifiOff, CloudOff } from "lucide-react";
import { Button } from "@/components/ui/button";

interface OfflineEmptyStateProps {
  message?: string;
  onRetry?: () => void;
}

export function OfflineEmptyState({ 
  message = "Noch keine Daten gespeichert. Öffne diese Seite einmal online, damit sie offline verfügbar ist.",
  onRetry 
}: OfflineEmptyStateProps) {
  const isOffline = !navigator.onLine;

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        {isOffline ? (
          <WifiOff className="w-8 h-8 text-muted-foreground" />
        ) : (
          <CloudOff className="w-8 h-8 text-muted-foreground" />
        )}
      </div>
      <h3 className="text-lg font-medium mb-2">
        {isOffline ? "Du bist offline" : "Keine Daten verfügbar"}
      </h3>
      <p className="text-muted-foreground max-w-md mb-4">
        {message}
      </p>
      {onRetry && navigator.onLine && (
        <Button onClick={onRetry} variant="outline">
          Erneut laden
        </Button>
      )}
    </div>
  );
}

// Cache status indicator for debugging (optional)
export function CacheIndicator({ isFromCache }: { isFromCache: boolean }) {
  if (!isFromCache) return null;
  
  return (
    <div className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
      <CloudOff className="w-3 h-3" />
      Offline-Daten
    </div>
  );
}
