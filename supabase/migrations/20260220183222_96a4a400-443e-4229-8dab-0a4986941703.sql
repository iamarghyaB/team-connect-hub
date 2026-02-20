
-- Create security definer function to check chat room membership
CREATE OR REPLACE FUNCTION public.is_chat_room_member(_room_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_room_members
    WHERE room_id = _room_id AND user_id = _user_id
  )
$$;

-- Drop broken policies on chat_room_members
DROP POLICY IF EXISTS "Users can view members of their rooms" ON public.chat_room_members;

-- Recreate using security definer function
CREATE POLICY "Users can view members of their rooms"
ON public.chat_room_members
FOR SELECT
USING (public.is_chat_room_member(room_id, auth.uid()) OR is_super_admin(auth.uid()));

-- Fix chat_rooms SELECT policy (had bug: chat_room_members.id instead of chat_rooms.id)
DROP POLICY IF EXISTS "Users can view their chat rooms" ON public.chat_rooms;

CREATE POLICY "Users can view their chat rooms"
ON public.chat_rooms
FOR SELECT
USING (public.is_chat_room_member(id, auth.uid()) OR is_super_admin(auth.uid()));

-- Fix chat_messages SELECT policy to also use the function
DROP POLICY IF EXISTS "Users can view messages in their rooms" ON public.chat_messages;

CREATE POLICY "Users can view messages in their rooms"
ON public.chat_messages
FOR SELECT
USING (public.is_chat_room_member(room_id, auth.uid()) OR is_super_admin(auth.uid()));

-- Fix chat_messages INSERT policy
DROP POLICY IF EXISTS "Users can send messages in their rooms" ON public.chat_messages;

CREATE POLICY "Users can send messages in their rooms"
ON public.chat_messages
FOR INSERT
WITH CHECK (auth.uid() = sender_id AND public.is_chat_room_member(room_id, auth.uid()));
