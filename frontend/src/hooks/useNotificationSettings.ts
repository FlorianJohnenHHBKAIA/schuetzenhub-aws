import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

export interface NotificationSettings {
  member_id: string;
  email_enabled: boolean;
  push_enabled: boolean;
  digest_frequency: 'daily' | 'weekly' | 'none';
  notify_posts: boolean;
  notify_events: boolean;
  notify_comments: boolean;
  notify_workshifts: boolean;
  notify_reminders: boolean;
  notify_system: boolean;
  email_important: boolean;
  email_info: boolean;
  push_important: boolean;
  push_reminders: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
}

const DEFAULT_SETTINGS: Omit<NotificationSettings, 'member_id'> = {
  email_enabled: true,
  push_enabled: false,
  digest_frequency: 'weekly',
  notify_posts: true,
  notify_events: true,
  notify_comments: true,
  notify_workshifts: true,
  notify_reminders: false,
  notify_system: true,
  email_important: true,
  email_info: false,
  push_important: true,
  push_reminders: false,
  quiet_hours_enabled: true,
  quiet_hours_start: '21:00:00',
  quiet_hours_end: '08:00:00',
};

export const useNotificationSettings = () => {
  const { member } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    if (!member) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('member_notification_settings')
        .select('*')
        .eq('member_id', member.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings(data as NotificationSettings);
      } else {
        // Create default settings for new users
        const newSettings = { member_id: member.id, ...DEFAULT_SETTINGS };
        const { error: insertError } = await supabase
          .from('member_notification_settings')
          .insert(newSettings);
        
        if (insertError) throw insertError;
        setSettings(newSettings);
      }
    } catch (error) {
      console.error('Error fetching notification settings:', error);
      // Use defaults if fetch fails
      setSettings({ member_id: member.id, ...DEFAULT_SETTINGS });
    } finally {
      setLoading(false);
    }
  }, [member]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = async (updates: Partial<NotificationSettings>) => {
    if (!member || !settings) return false;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('member_notification_settings')
        .update(updates)
        .eq('member_id', member.id);

      if (error) throw error;

      setSettings({ ...settings, ...updates });
      toast({
        title: "Gespeichert",
        description: "Benachrichtigungseinstellungen wurden aktualisiert.",
      });
      return true;
    } catch (error) {
      console.error('Error updating notification settings:', error);
      toast({
        title: "Fehler",
        description: "Einstellungen konnten nicht gespeichert werden.",
        variant: "destructive",
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    settings,
    loading,
    saving,
    updateSettings,
    refetch: fetchSettings,
  };
};
