export type ConversationScope = "company" | "club" | "external";

export interface ConversationSummary {
  id: string;
  type: "direct" | "group";
  name: string | null;
  scope: ConversationScope;
  scope_id: string | null;
  scope_company_name: string | null;
  updated_at: string;
  last_message_content: string | null;
  last_message_at: string | null;
  last_message_sender_name: string | null;
  unread_count: number;
  other_member_id: string | null;
  other_member_first_name: string | null;
  other_member_last_name: string | null;
  other_member_avatar_url: string | null;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_member_id: string;
  sender_first_name: string;
  sender_last_name: string;
  sender_avatar_url: string | null;
  content: string;
  created_at: string;
}

export interface CreateConversationParams {
  type: "direct" | "group";
  name?: string;
  memberIds: string[];
  scope?: ConversationScope;
  scope_id?: string;
  alle_mitglieder?: boolean;
}
