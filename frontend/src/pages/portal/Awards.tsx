import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import PortalLayout from "@/components/portal/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Award, Medal, Trophy, Star, Crown, Shield, Gem, Heart } from "lucide-react";

const AWARD_TYPES = [
  { value: 'medal', label: 'Medaille', icon: Medal, color: 'text-amber-500' },
  { value: 'order', label: 'Orden', icon: Award, color: 'text-blue-600' },
  { value: 'honor', label: 'Ehrung', icon: Star, color: 'text-purple-500' },
  { value: 'trophy', label: 'Pokal', icon: Trophy, color: 'text-yellow-600' },
  { value: 'crown', label: 'Krone', icon: Crown, color: 'text-amber-600' },
  { value: 'shield', label: 'Schild', icon: Shield, color: 'text-slate-600' },
  { value: 'gem', label: 'Edelstein', icon: Gem, color: 'text-emerald-500' },
  { value: 'heart', label: 'Verdienst', icon: Heart, color: 'text-red-500' },
  { value: 'other', label: 'Sonstige', icon: Award, color: 'text-muted-foreground' },
];

const getAwardTypeConfig = (type: string) => {
  return AWARD_TYPES.find(t => t.value === type) || AWARD_TYPES[AWARD_TYPES.length - 1];
};

interface AwardsPageProps {}

interface MemberAward {
  id: string;
  title: string;
  description: string | null;
  awarded_at: string;
  award_type: string;
  member: {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  };
}

export default function Awards() {
  const { member } = useAuth();
  const navigate = useNavigate();
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<string>("all");

  const clubId = member?.club_id;

  const { data: awards, isLoading } = useQuery({
    queryKey: ['all-awards', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase
        .from('member_awards')
        .select(`
          id,
          title,
          description,
          awarded_at,
          award_type,
          member:members!member_awards_member_id_fkey (
            id,
            first_name,
            last_name,
            avatar_url
          )
        `)
        .eq('club_id', clubId)
        .order('awarded_at', { ascending: false });

      if (error) throw error;
      return data as unknown as MemberAward[];
    },
    enabled: !!clubId,
  });

  // Get unique years from awards
  const years = awards
    ? [...new Set(awards.map(a => new Date(a.awarded_at).getFullYear()))]
        .sort((a, b) => b - a)
    : [];

  // Filter awards
  const filteredAwards = awards?.filter(award => {
    const matchesType = selectedType === "all" || award.award_type === selectedType;
    const matchesYear = selectedYear === "all" || 
      new Date(award.awarded_at).getFullYear().toString() === selectedYear;
    return matchesType && matchesYear;
  }) || [];

  // Group awards by year for display
  const awardsByYear = filteredAwards.reduce((acc, award) => {
    const year = new Date(award.awarded_at).getFullYear();
    if (!acc[year]) acc[year] = [];
    acc[year].push(award);
    return acc;
  }, {} as Record<number, MemberAward[]>);

  const sortedYears = Object.keys(awardsByYear)
    .map(Number)
    .sort((a, b) => b - a);

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Auszeichnungen</h1>
            <p className="text-muted-foreground">
              Übersicht aller Auszeichnungen im Verein
            </p>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Alle Typen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Typen</SelectItem>
                {AWARD_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex items-center gap-2">
                      <type.icon className={`h-4 w-4 ${type.color}`} />
                      {type.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Alle Jahre" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Jahre</SelectItem>
                {years.map(year => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {AWARD_TYPES.slice(0, 4).map(type => {
            const count = awards?.filter(a => a.award_type === type.value).length || 0;
            return (
              <Card key={type.value} className="cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => setSelectedType(type.value)}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full bg-accent ${type.color}`}>
                      <type.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{count}</p>
                      <p className="text-sm text-muted-foreground">{type.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : filteredAwards.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Award className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {awards?.length === 0 
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
                    {awardsByYear[year].length} Auszeichnung{awardsByYear[year].length !== 1 ? 'en' : ''}
                  </Badge>
                </div>
                
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {awardsByYear[year].map(award => {
                    const typeConfig = getAwardTypeConfig(award.award_type);
                    const IconComponent = typeConfig.icon;
                    
                    return (
                      <Card 
                        key={award.id} 
                        className="hover:bg-accent/30 transition-colors cursor-pointer"
                        onClick={() => navigate(`/portal/member/${award.member.id}`)}
                      >
                        <CardContent className="pt-6">
                          <div className="flex items-start gap-4">
                            <div className={`p-3 rounded-full bg-accent ${typeConfig.color}`}>
                              <IconComponent className="h-6 w-6" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold truncate">{award.title}</h3>
                              {award.description && (
                                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                                  {award.description}
                                </p>
                              )}
                              <div className="flex items-center gap-2 mt-3">
                                <Avatar className="h-6 w-6">
                                  <AvatarImage src={award.member.avatar_url || undefined} />
                                  <AvatarFallback className="text-xs">
                                    {award.member.first_name[0]}{award.member.last_name[0]}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-sm">
                                  {award.member.first_name} {award.member.last_name}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-2">
                                {format(new Date(award.awarded_at), 'dd. MMMM yyyy', { locale: de })}
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
