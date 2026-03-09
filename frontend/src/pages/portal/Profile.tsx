import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Loader2 } from "lucide-react";
import PortalLayout from "@/components/portal/PortalLayout";

/**
 * Redirect page for /portal/profile that navigates to the user's own profile
 */
const Profile = () => {
  const navigate = useNavigate();
  const { member, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && member?.id) {
      navigate(`/portal/member/${member.id}`, { replace: true });
    }
  }, [member, isLoading, navigate]);

  return (
    <PortalLayout>
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    </PortalLayout>
  );
};

export default Profile;
