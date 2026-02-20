
-- Chat rooms table
CREATE TABLE public.chat_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  type text NOT NULL DEFAULT 'direct', -- 'direct' or 'group'
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;

-- Chat room members
CREATE TABLE public.chat_room_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(room_id, user_id)
);

ALTER TABLE public.chat_room_members ENABLE ROW LEVEL SECURITY;

-- Chat messages
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'general', -- 'task', 'leave', 'notice', 'chat', 'request'
  reference_id uuid,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Enable realtime for chat_messages and notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- RLS: Chat rooms - members can view rooms they belong to
CREATE POLICY "Users can view their chat rooms"
ON public.chat_rooms FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.chat_room_members WHERE room_id = id AND user_id = auth.uid())
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Authenticated users can create chat rooms"
ON public.chat_rooms FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Super admins can manage all chat rooms"
ON public.chat_rooms FOR ALL
USING (is_super_admin(auth.uid()));

-- RLS: Chat room members
CREATE POLICY "Users can view members of their rooms"
ON public.chat_room_members FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.chat_room_members crm WHERE crm.room_id = chat_room_members.room_id AND crm.user_id = auth.uid())
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Authenticated users can add members"
ON public.chat_room_members FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Super admins can manage all members"
ON public.chat_room_members FOR ALL
USING (is_super_admin(auth.uid()));

-- RLS: Chat messages - members can view/send in their rooms
CREATE POLICY "Users can view messages in their rooms"
ON public.chat_messages FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.chat_room_members WHERE room_id = chat_messages.room_id AND user_id = auth.uid())
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Users can send messages in their rooms"
ON public.chat_messages FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (SELECT 1 FROM public.chat_room_members WHERE room_id = chat_messages.room_id AND user_id = auth.uid())
);

CREATE POLICY "Super admins can manage all messages"
ON public.chat_messages FOR ALL
USING (is_super_admin(auth.uid()));

-- RLS: Notifications - users can only see their own
CREATE POLICY "Users can view own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can create notifications"
ON public.notifications FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Owners can create notifications"
ON public.notifications FOR INSERT
WITH CHECK (is_owner(auth.uid()));

CREATE POLICY "Super admins can manage all notifications"
ON public.notifications FOR ALL
USING (is_super_admin(auth.uid()));
