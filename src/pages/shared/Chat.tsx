import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Send, Plus, Users, MessageCircle, Hash } from "lucide-react";
import { format } from "date-fns";

interface Room {
  id: string;
  name: string | null;
  type: string;
  created_at: string;
}

interface Message {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

interface Profile {
  user_id: string;
  full_name: string;
}

export default function Chat() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [roomMembers, setRoomMembers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [newRoomDialog, setNewRoomDialog] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomType, setNewRoomType] = useState<"direct" | "group">("direct");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      fetchRooms();
      fetchAllProfiles();
    }
  }, [user]);

  useEffect(() => {
    if (activeRoom) {
      fetchMessages(activeRoom);
      fetchRoomMembers(activeRoom);
    }
  }, [activeRoom]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Realtime subscription for messages
  useEffect(() => {
    if (!activeRoom) return;
    const channel = supabase
      .channel(`room-${activeRoom}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `room_id=eq.${activeRoom}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeRoom]);

  const fetchAllProfiles = async () => {
    const { data } = await supabase.from("profiles").select("user_id, full_name");
    if (data) {
      setAllProfiles(data);
      const map: Record<string, string> = {};
      data.forEach((p) => { map[p.user_id] = p.full_name; });
      setProfiles(map);
    }
  };

  const fetchRooms = async () => {
    const { data } = await supabase.from("chat_rooms").select("*").order("created_at", { ascending: false });
    if (data) setRooms(data);
    setLoading(false);
  };

  const fetchMessages = async (roomId: string) => {
    const { data } = await supabase.from("chat_messages").select("*").eq("room_id", roomId).order("created_at", { ascending: true });
    if (data) setMessages(data);
  };

  const fetchRoomMembers = async (roomId: string) => {
    const { data } = await supabase.from("chat_room_members").select("user_id").eq("room_id", roomId);
    if (data) setRoomMembers(data.map((m) => m.user_id));
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !activeRoom || !user) return;
    const { error } = await supabase.from("chat_messages").insert({
      room_id: activeRoom, sender_id: user.id, content: newMessage.trim(),
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setNewMessage("");
  };

  const createRoom = async () => {
    if (!user) return;
    if (newRoomType === "group" && !newRoomName.trim()) return;
    if (selectedMembers.length === 0) return;

    // For direct, check if room already exists
    let roomName = newRoomName.trim();
    if (newRoomType === "direct" && selectedMembers.length === 1) {
      roomName = profiles[selectedMembers[0]] || "Chat";
    }

    const { data: room, error } = await supabase.from("chat_rooms").insert({
      name: roomName, type: newRoomType, created_by: user.id,
    }).select().single();

    if (error || !room) { toast({ title: "Error", description: error?.message, variant: "destructive" }); return; }

    // Add members including self
    const members = [...new Set([user.id, ...selectedMembers])].map((uid) => ({
      room_id: room.id, user_id: uid,
    }));
    await supabase.from("chat_room_members").insert(members);

    // Create notification for each member
    for (const uid of selectedMembers) {
      if (uid !== user.id) {
        await supabase.from("notifications").insert({
          user_id: uid, title: "New Chat", message: `You were added to ${newRoomType === "group" ? `group "${roomName}"` : "a conversation"}`, type: "chat", reference_id: room.id,
        });
      }
    }

    setNewRoomDialog(false);
    setNewRoomName("");
    setSelectedMembers([]);
    fetchRooms();
    setActiveRoom(room.id);
    toast({ title: "Chat created" });
  };

  const getRoomDisplayName = (room?: Room) => {
    if (!room) return "Chat";
    if (room.type === "group") return room.name || "Group";
    return room.name || "Direct Message";
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  if (loading) return <div className="space-y-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold font-display">Chat</h1>
        <Button onClick={() => setNewRoomDialog(true)}><Plus className="h-4 w-4 mr-2" /> New Chat</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4 h-[calc(100vh-220px)]">
        {/* Room list */}
        <div className="rounded-lg border bg-card overflow-hidden flex flex-col">
          <div className="p-3 border-b font-medium text-sm text-muted-foreground">Conversations</div>
          <ScrollArea className="flex-1">
            {rooms.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">No conversations yet</div>
            ) : (
              rooms.map((room) => (
                <button
                  key={room.id}
                  onClick={() => setActiveRoom(room.id)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 text-left transition-colors hover:bg-accent",
                    activeRoom === room.id && "bg-accent"
                  )}
                >
                  <div className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full",
                    room.type === "group" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  )}>
                    {room.type === "group" ? <Hash className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 truncate">
                    <p className="text-sm font-medium truncate">{getRoomDisplayName(room)}</p>
                    <p className="text-xs text-muted-foreground">{room.type === "group" ? "Group" : "Direct"}</p>
                  </div>
                </button>
              ))
            )}
          </ScrollArea>
        </div>

        {/* Chat area */}
        <div className="rounded-lg border bg-card flex flex-col overflow-hidden">
          {!activeRoom ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Select a conversation or start a new one</p>
              </div>
            </div>
          ) : (
            <>
              <div className="p-3 border-b flex items-center gap-2">
                <p className="font-medium text-sm">{getRoomDisplayName(rooms.find((r) => r.id === activeRoom)!)}</p>
                <span className="text-xs text-muted-foreground">({roomMembers.length} members)</span>
              </div>
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-3">
                  {messages.map((msg) => {
                    const isMe = msg.sender_id === user?.id;
                    return (
                      <div key={msg.id} className={cn("flex gap-2", isMe && "flex-row-reverse")}>
                        <Avatar className="h-7 w-7 shrink-0">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {(profiles[msg.sender_id] || "U")[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className={cn("max-w-[70%]", isMe && "text-right")}>
                          <p className="text-xs text-muted-foreground mb-0.5">{profiles[msg.sender_id] || "Unknown"}</p>
                          <div className={cn(
                            "rounded-lg px-3 py-2 text-sm",
                            isMe ? "bg-primary text-primary-foreground" : "bg-muted"
                          )}>
                            {msg.content}
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {format(new Date(msg.created_at), "HH:mm")}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
              <div className="p-3 border-t flex gap-2">
                <Input
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1"
                />
                <Button size="icon" onClick={sendMessage} disabled={!newMessage.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* New Chat Dialog */}
      <Dialog open={newRoomDialog} onOpenChange={setNewRoomDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Conversation</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button variant={newRoomType === "direct" ? "default" : "outline"} size="sm" onClick={() => setNewRoomType("direct")}>
                <MessageCircle className="h-4 w-4 mr-1" /> Direct
              </Button>
              <Button variant={newRoomType === "group" ? "default" : "outline"} size="sm" onClick={() => setNewRoomType("group")}>
                <Users className="h-4 w-4 mr-1" /> Group
              </Button>
            </div>
            {newRoomType === "group" && (
              <div className="space-y-2">
                <Label>Group Name</Label>
                <Input value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} placeholder="Enter group name" />
              </div>
            )}
            <div className="space-y-2">
              <Label>Select Members</Label>
              <ScrollArea className="h-48 rounded-md border p-2">
                {allProfiles.filter((p) => p.user_id !== user?.id).map((p) => (
                  <label key={p.user_id} className="flex items-center gap-2 p-2 hover:bg-accent rounded cursor-pointer">
                    <Checkbox
                      checked={selectedMembers.includes(p.user_id)}
                      onCheckedChange={(checked) => {
                        if (newRoomType === "direct") {
                          setSelectedMembers(checked ? [p.user_id] : []);
                        } else {
                          setSelectedMembers(checked
                            ? [...selectedMembers, p.user_id]
                            : selectedMembers.filter((id) => id !== p.user_id)
                          );
                        }
                      }}
                    />
                    <span className="text-sm">{p.full_name}</span>
                  </label>
                ))}
              </ScrollArea>
            </div>
            <Button onClick={createRoom} className="w-full" disabled={selectedMembers.length === 0 || (newRoomType === "group" && !newRoomName.trim())}>
              Create
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
