import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiJson } from "@/integrations/api/client";
import { useAuth } from "@/lib/auth";
import PortalLayout from "@/components/portal/PortalLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Award, Search, Lock, FileText } from "lucide-react";
import { getAwardTypeConfig } from "@/components/portal/AwardDialog";
import type { AwardType } from "@/components/portal/AwardDialog";
import { cn } from "@/lib/utils";

const CATEGORY_LABELS: Record<string, string> = {
  all: "Alle Kategorien",
  orden: "Orden",
  ehrenzeichen: "Ehrenzeichen",
  vereinsauszeichnung: "Vereinsauszeichnung",
  custom: "Vereinsintern",
};

const CATEGORY_COLORS: Record<string, string> = {
  orden: "bg-blue-500/10 text-blue-700 border-blue-200",
  ehrenzeichen: "bg-purple-500/10 text-purple-700 border-purple-200",
  vereinsauszeichnung: "bg-amber-500/10 text-amber-700 border-amber-200",
  custom: "bg-muted text-muted-foreground",
};

interface MemberAward {
  id: string;
  title: string;
  description: string | null;
  awarded_at: string;
  award_type: string;
  award_type_id: string | null;
  awarded_by: string | null;
  notes: string | null;
  certificate_url: string | null;
  member: {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  } | null;
  award_type_info: {
    id: string;
    name: string;
    icon: string;
    category: string;
    is_bhds_standard: boolean;
  } | null;
}

export default function Awards() {
  const { member } = useAuth();
  const navigate = useNavigate();
  const [searchMember, setSearchMember] = useState("");
  const [selectedTypeId, setSelectedTypeId] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<string>("all");

  const clubId = member?.club_id;

  const { data: awardTypes } = useQuery<AwardType[]>({
    queryKey: ["award-types", clubId],
    queryFn: () => apiJson<AwardType[]>("/api/award-types"),
    enabled: !!clubId,
  });

  const { data: awards, isLoading } = useQuery<MemberAward[]>({
    queryKey: ["all-awards", clubId],
    queryFn: () => apiJson<MemberAward[]>("/api/awards?status=approved"),
    enabled: !!clubId,
  });

  const years = awards
    ? [...new Set(awards.map(a => new Date(a.awarded_at).getFullYear()))].sort((a, b) => b - a)
    : [];

  const filteredAwards = (awards || []).filter(a => {
    if (selectedTypeId !== "all" && a.award_type_id !== selectedTypeId) return false;
    if (selectedCategory !== "all" && a.award_type_info?.category !== selectedCategory) return false;
    if (selectedYear !== "all" && new Date(a.awarded_at).getFullYear().toString() !== selectedYear) return false;
    if (searchMember) {
      const name = `${a.member?.first_name} ${a.member?.last_name}`.toLowerCase();
      if (!name.includes(searchMember.toLowerCase())) return false;
    }
    return true;
  });

  const awardsByYear = filteredAwards.reduce<Record<number, MemberAward[]>>((acc, a) => {
    const year = new Date(a.awarded_at).getFullYear();
    if (!acc[year]) acc[year] = [];
    acc[year].push(a);
    return acc;
  }, {});

  const sortedYears = Object.keys(awardsByYear).map(Number).sort((a, b) => b - a);

  return (
    <PortalLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Auszeichnungen</h1>
          <p className="text-muted-foreground">Übersicht aller Auszeichnungen im Verein</p>
        </div>

        {/* Filter */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchMember}
              onChange={e => setSearchMember(e.target.value)}
              placeholder="Mitglied suchen…"
              className="pl-9"
            />
          </div>

          <Select value={selectedTypeId} onValueChange={setSelectedTypeId}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Alle Auszeichnungen" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="all">Alle Auszeichnungen</SelectItem>
              {awardTypes && awardTypes.filter(t => t.is_bhds_standard).length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    BHDS-Auszeichnungen
                  </div>
                  {awardTypes.filter(t => t.is_bhds_standard).map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      <div className="flex items-center gap-1.5">
                        <Lock className="w-3 h-3 text-muted-foreground" />
                        {t.name}
                      </div>
                    </SelectItem>
                  ))}
                  <Separator className="my-1" />
                </>
              )}
              {awardTypes && awardTypes.filter(t => !t.is_bhds_standard).map(t => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[190px]">
              <SelectValue placeholder="Alle Kategorien" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                <SelectItem key={val} value={val}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Alle Jahre" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Jahre</SelectItem>
              {years.map(y => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Inhalt */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
        ) : filteredAwards.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Award className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {(awards?.length || 0) === 0
                  ? "Noch keine Auszeichnungen vergeben"
                  : "Keine Auszeichnungen für die gewählten Filter"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {sortedYears.map(year => (
              <div key={year}>
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-xl font-semibold">{year}</h2>
                  <Badge variant="secondary">
                    {awardsByYear[year].length} Auszeichnung{awardsByYear[year].length !== 1 ? "en" : ""}
                  </Badge>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {awardsByYear[year].map(award => {
                    const iconName = award.award_type_info?.icon || award.award_type || "medal";
                    const cfg = getAwardTypeConfig(iconName);
                    const Icon = cfg.icon;
                    const category = award.award_type_info?.category;

                    return (
                      <Card
                        key={award.id}
                        className="hover:bg-accent/30 transition-colors cursor-pointer"
                        onClick={() => award.member && navigate(`/portal/member/${award.member.id}`)}
                      >
                        <CardContent className="pt-5 pb-4">
                          <div className="flex items-start gap-3">
                            <div className={cn("p-2.5 rounded-full shrink-0", cfg.bgColor)}>
                              <Icon className={cn("h-5 w-5", cfg.color)} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start gap-1.5 flex-wrap">
                                <h3 className="font-semibold text-sm leading-snug">
                                  {award.award_type_info?.name || award.title}
                                </h3>
                                {award.award_type_info?.is_bhds_standard && (
                                  <Lock className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
                                )}
                              </div>
                              {category && (
                                <Badge
                                  variant="outline"
                                  className={cn("text-xs mt-1 mb-1.5", CATEGORY_COLORS[category])}
                                >
                                  {CATEGORY_LABELS[category] || category}
                                </Badge>
                              )}
                              {award.description && (
                                <p className="text-xs text-muted-foreground line-clamp-2 mb-1.5">
                                  {award.description}
                                </p>
                              )}
                              {award.awarded_by && (
                                <p className="text-xs text-muted-foreground mb-1.5">
                                  Verliehen von: <span className="text-foreground">{award.awarded_by}</span>
                                </p>
                              )}
                              <div className="flex items-center gap-2 mt-2">
                                <Avatar className="h-5 w-5">
                                  <AvatarImage src={award.member?.avatar_url || undefined} />
                                  <AvatarFallback className="text-[10px]">
                                    {award.member?.first_name?.[0]}{award.member?.last_name?.[0]}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-xs">
                                  {award.member?.first_name} {award.member?.last_name}
                                </span>
                                {award.certificate_url && (
                                  <FileText className="w-3.5 h-3.5 text-muted-foreground ml-auto" title="Urkunde vorhanden" />
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1.5">
                                {format(new Date(award.awarded_at), "dd. MMMM yyyy", { locale: de })}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
