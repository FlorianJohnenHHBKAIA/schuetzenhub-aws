import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { apiJson } from "@/integrations/api/client";
import { Badge } from "@/components/ui/badge";

export function MessagesBadge() {
  const { member } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!member) return;
    const fetch = async () => {
      try {
        const data = await apiJson<{ count: number }>("/api/messages/unread-count");
        setCount(data?.count ?? 0);
      } catch {
        // ignore
      }
    };
    fetch();
    const interval = setInterval(fetch, 30000);
    return () => clearInterval(interval);
  }, [member]);

  if (count === 0) return null;

  return (
    <Badge
      variant="destructive"
      className="h-4 min-w-4 flex items-center justify-center p-0 text-[10px] ml-auto"
    >
      {count > 9 ? "9+" : count}
    </Badge>
  );
}
