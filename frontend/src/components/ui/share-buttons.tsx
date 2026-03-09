import { useState } from "react";
import { 
  Share2, 
  Copy, 
  Check,
  MessageCircle,
  Facebook,
  Twitter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface ShareButtonsProps {
  url: string;
  title: string;
  description?: string;
  variant?: "default" | "compact" | "icon";
  className?: string;
}

const ShareButtons = ({ 
  url, 
  title, 
  description = "", 
  variant = "default",
  className = "" 
}: ShareButtonsProps) => {
  const [copied, setCopied] = useState(false);
  
  const fullUrl = url.startsWith("http") ? url : `${window.location.origin}${url}`;
  const shareText = description ? `${title} - ${description}` : title;
  
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      toast.success("Link kopiert!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Link konnte nicht kopiert werden");
    }
  };
  
  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: description,
          url: fullUrl,
        });
      } catch (err) {
        // User cancelled or share failed silently
      }
    }
  };
  
  const shareLinks = {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${fullUrl}`)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(fullUrl)}&quote=${encodeURIComponent(title)}`,
    twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(fullUrl)}`,
  };
  
  const openShareLink = (platform: keyof typeof shareLinks) => {
    window.open(shareLinks[platform], "_blank", "width=600,height=400,noopener,noreferrer");
  };
  
  // Compact: just the dropdown trigger
  if (variant === "compact" || variant === "icon") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size={variant === "icon" ? "icon" : "sm"} 
            className={className}
          >
            <Share2 className="w-4 h-4" />
            {variant === "compact" && <span className="ml-1.5">Teilen</span>}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {navigator.share && (
            <DropdownMenuItem onClick={handleNativeShare}>
              <Share2 className="w-4 h-4 mr-2" />
              Teilen...
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => openShareLink("whatsapp")}>
            <MessageCircle className="w-4 h-4 mr-2" />
            WhatsApp
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openShareLink("facebook")}>
            <Facebook className="w-4 h-4 mr-2" />
            Facebook
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openShareLink("twitter")}>
            <Twitter className="w-4 h-4 mr-2" />
            Twitter / X
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleCopyLink}>
            {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
            Link kopieren
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
  
  // Default: inline buttons
  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      {navigator.share && (
        <Button variant="outline" size="sm" onClick={handleNativeShare}>
          <Share2 className="w-4 h-4 mr-1.5" />
          Teilen
        </Button>
      )}
      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => openShareLink("whatsapp")}
        className="bg-[#25D366]/10 border-[#25D366]/30 text-[#25D366] hover:bg-[#25D366]/20"
      >
        <MessageCircle className="w-4 h-4 mr-1.5" />
        WhatsApp
      </Button>
      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => openShareLink("facebook")}
        className="bg-[#1877F2]/10 border-[#1877F2]/30 text-[#1877F2] hover:bg-[#1877F2]/20"
      >
        <Facebook className="w-4 h-4 mr-1.5" />
        Facebook
      </Button>
      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => openShareLink("twitter")}
        className="bg-foreground/5 border-foreground/20 hover:bg-foreground/10"
      >
        <Twitter className="w-4 h-4 mr-1.5" />
        Twitter
      </Button>
      <Button variant="outline" size="sm" onClick={handleCopyLink}>
        {copied ? <Check className="w-4 h-4 mr-1.5" /> : <Copy className="w-4 h-4 mr-1.5" />}
        Link kopieren
      </Button>
    </div>
  );
};

export { ShareButtons };
