import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/api/client";

interface WorkShiftStats {
  totalHours: number;
  completedShifts: number;
  upcomingShifts: number;
  signedUpShifts: number;
}

interface WorkShiftAssignment {
  id: string;
  status: string;
  hours_override?: number | null;
  work_shift?: {
    start_at: string;
    end_at?: string;
  } | null;
}

export const useWorkShiftStats = (memberId: string | null, year: number = new Date().getFullYear()) => {
  const [stats, setStats] = useState<WorkShiftStats>({
    totalHours: 0,
    completedShifts: 0,
    upcomingShifts: 0,
    signedUpShifts: 0,
  });
  const [loading, setLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    if (!memberId) return;
    setLoading(true);

    try {
      const startOfYear = new Date(year, 0, 1).toISOString();
      const endOfYear = new Date(year, 11, 31, 23, 59, 59).toISOString();
      const now = new Date().toISOString();

      const { data: completedAssignments } = await supabase
        .from('work_shift_assignments')
        .select(`
          id,
          status,
          hours_override,
          work_shift:work_shifts!inner(
            start_at,
            end_at
          )
        `)
        .eq('member_id', memberId)
        .eq('status', 'completed')
        .gte('work_shift.start_at', startOfYear)
        .lte('work_shift.start_at', endOfYear);

      const { data: upcomingAssignments } = await supabase
        .from('work_shift_assignments')
        .select(`
          id,
          status,
          work_shift:work_shifts!inner(
            start_at
          )
        `)
        .eq('member_id', memberId)
        .eq('status', 'signed_up')
        .gte('work_shift.start_at', now);

      let totalHours = 0;
      ((completedAssignments as WorkShiftAssignment[]) || []).forEach((assignment) => {
        if (assignment.hours_override) {
          totalHours += Number(assignment.hours_override);
        } else if (assignment.work_shift?.start_at && assignment.work_shift?.end_at) {
          const start = new Date(assignment.work_shift.start_at);
          const end = new Date(assignment.work_shift.end_at);
          const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
          totalHours += hours;
        }
      });

      const completedCount = (completedAssignments as WorkShiftAssignment[] | null)?.length || 0;
      const upcomingCount = (upcomingAssignments as WorkShiftAssignment[] | null)?.length || 0;

      setStats({
        totalHours: Math.round(totalHours * 10) / 10,
        completedShifts: completedCount,
        upcomingShifts: upcomingCount,
        signedUpShifts: upcomingCount,
      });
    } catch (error: unknown) {
      console.error('Error fetching work shift stats:', error);
    } finally {
      setLoading(false);
    }
  }, [memberId, year]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, refetch: fetchStats };
};