import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Users,
  FileText,
  Camera,
  FolderOpen,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface EventQuickActionsProps {
  eventId: string;
  eventTitle: string;
  clubId: string;
  /** Number of shifts */
  shiftCount: number;
  /** Number of open slots */
  openSlots: number;
  /** Total slots */
  totalSlots: number;
  /** Days until event start */
  daysUntilEvent: number;
  /** Whether user can manage the event */
  canManage: boolean;
  /** Whether user can create posts */
  canCreatePosts: boolean;
  /** Whether user can manage documents */
  canManageDocuments: boolean;
  /** Callback to create a new post linked to this event */
  onCreatePost?: () => void;
}

export const EventQuickActions = ({
  eventId,
  eventTitle,
  shiftCount,
  openSlots,
  totalSlots,
  daysUntilEvent,
  canManage,
  canCreatePosts,
  canManageDocuments,
  onCreatePost,
}: EventQuickActionsProps) => {
  const isCritical = openSlots > 0 && daysUntilEvent >= 0 && daysUntilEvent <= 7;
  const isComplete = shiftCount > 0 && openSlots === 0;
  
  const filledSlots = totalSlots - openSlots;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            Organisation
            {isCritical && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Kritisch
              </Badge>
            )}
            {isComplete && (
              <Badge className="bg-green-500/10 text-green-600 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Vollständig
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-3">
            {/* Work Shifts Action */}
            <Link
              to={`/portal/workshifts?event=${eventId}`}
              className="block"
            >
              <Button
                variant="outline"
                className={`w-full h-auto py-4 flex-col items-start gap-2 ${
                  isCritical ? "border-destructive/50 bg-destructive/5 hover:bg-destructive/10" : ""
                }`}
              >
                <div className="flex items-center gap-2 w-full">
                  <Users className="w-5 h-5" />
                  <span className="font-medium">Arbeitsdienste</span>
                </div>
                <div className="text-sm text-muted-foreground font-normal text-left w-full">
                  {shiftCount === 0 ? (
                    "Noch keine Schichten"
                  ) : openSlots > 0 ? (
                    <span className={isCritical ? "text-destructive" : "text-amber-600"}>
                      {openSlots} von {totalSlots} Plätzen offen
                    </span>
                  ) : (
                    <span className="text-green-600">
                      {filledSlots} Helfer eingeteilt
                    </span>
                  )}
                </div>
              </Button>
            </Link>

            {/* Create Post Action */}
            {canCreatePosts && (
              <Button
                variant="outline"
                className="w-full h-auto py-4 flex-col items-start gap-2"
                onClick={onCreatePost}
              >
                <div className="flex items-center gap-2 w-full">
                  <FileText className="w-5 h-5" />
                  <span className="font-medium">Beitrag erstellen</span>
                </div>
                <div className="text-sm text-muted-foreground font-normal text-left w-full">
                  Ankündigung oder Info zum Event
                </div>
              </Button>
            )}

            {/* Gallery Action */}
            <Link
              to={`/portal/my-archive?from_event=${eventId}&event_title=${encodeURIComponent(eventTitle)}`}
              className="block"
            >
              <Button
                variant="outline"
                className="w-full h-auto py-4 flex-col items-start gap-2"
              >
                <div className="flex items-center gap-2 w-full">
                  <Camera className="w-5 h-5" />
                  <span className="font-medium">Fotos hochladen</span>
                </div>
                <div className="text-sm text-muted-foreground font-normal text-left w-full">
                  Bilder zum Event teilen
                </div>
              </Button>
            </Link>

            {/* Documents Action */}
            {canManageDocuments && (
              <Link
                to={`/portal/documents?from_event=${eventId}&event_title=${encodeURIComponent(eventTitle)}`}
                className="block"
              >
                <Button
                  variant="outline"
                  className="w-full h-auto py-4 flex-col items-start gap-2"
                >
                  <div className="flex items-center gap-2 w-full">
                    <FolderOpen className="w-5 h-5" />
                    <span className="font-medium">Dokumente</span>
                  </div>
                  <div className="text-sm text-muted-foreground font-normal text-left w-full">
                    Dateien zum Event verwalten
                  </div>
                </Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default EventQuickActions;
