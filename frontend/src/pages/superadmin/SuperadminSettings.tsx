import { Settings } from "lucide-react";

const SuperadminSettings = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold text-foreground">Systemeinstellungen</h1>
      <p className="text-muted-foreground text-sm mt-1">Plattformweite Konfiguration</p>
    </div>
    <div className="bg-muted/40 border border-dashed rounded-xl p-12 flex flex-col items-center gap-3 text-muted-foreground">
      <Settings className="w-10 h-10 opacity-40" />
      <p className="font-medium">Systemeinstellungen</p>
      <p className="text-sm text-center max-w-sm">
        Hier werden künftig globale Systemkonfigurationen, Feature-Flags und Wartungsoptionen verwaltet.
      </p>
    </div>
  </div>
);

export default SuperadminSettings;
