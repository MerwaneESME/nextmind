"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createMessage, getMessages, type Message } from "@/lib/db/messagesDb";
import { formatDateTime } from "@/lib/utils";

type ChatContext = { projectId?: string; phaseId?: string; lotId?: string };

export default function ChatBox({
  context,
  title = "Discussion",
}: {
  context: ChatContext;
  title?: string;
}) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const contextKey = useMemo(() => JSON.stringify(context ?? {}), [context]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getMessages(context);
      setMessages(data);
    } catch (e: any) {
      setError(e?.message ?? "Impossible de charger les messages.");
      setMessages([]);
    } finally {
      setLoading(false);
      queueMicrotask(() => endRef.current?.scrollIntoView({ behavior: "smooth" }));
    }
  };

  useEffect(() => {
    void loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextKey]);

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      await createMessage({
        content: newMessage.trim(),
        projectId: context.projectId,
        phaseId: context.phaseId,
        lotId: context.lotId,
      });
      setNewMessage("");
      await loadMessages();
    } catch (e: any) {
      setError(e?.message ?? "Erreur lors de l'envoi.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="font-semibold text-gray-900">{title}</div>
        <div className="text-sm text-gray-500">
          {messages.length} message{messages.length > 1 ? "s" : ""}
        </div>
        {error && <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-3 max-h-[420px] overflow-y-auto rounded-lg border border-neutral-200 bg-neutral-50/40 p-4">
          {loading ? (
            <div className="text-sm text-neutral-400 text-center py-4">Chargement...</div>
          ) : messages.length === 0 ? (
            <div className="text-sm text-neutral-400 text-center py-4">Aucun message pour le moment.</div>
          ) : (
            messages.map((msg) => {
              const mine = msg.author_id === user?.id;
              const authorLabel = msg.author?.full_name || msg.author?.email || (mine ? "Vous" : "Interlocuteur");
              const initials = authorLabel.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase();
              return (
                <div key={msg.id} className={`flex items-end gap-2 ${mine ? "flex-row-reverse" : "flex-row"}`}>
                  {/* Avatar */}
                  {msg.author?.avatar_url ? (
                    <img
                      src={msg.author.avatar_url}
                      alt={authorLabel}
                      title={authorLabel}
                      className="h-7 w-7 rounded-full object-cover flex-shrink-0 mb-0.5 ring-1 ring-white shadow-sm"
                    />
                  ) : (
                    <div
                      title={authorLabel}
                      className={`h-7 w-7 rounded-full flex-shrink-0 mb-0.5 flex items-center justify-center text-[10px] font-semibold text-white ring-1 ring-white shadow-sm ${mine ? "bg-gradient-to-br from-primary-400 to-primary-600" : "bg-gradient-to-br from-neutral-400 to-neutral-600"}`}
                    >
                      {initials}
                    </div>
                  )}
                  {/* Bubble */}
                  <div className={`max-w-[70%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap shadow-sm ${mine ? "bg-gradient-to-br from-primary-500 to-primary-700 text-white rounded-br-sm" : "bg-white text-neutral-900 border border-neutral-200 rounded-bl-sm"}`}>
                    {!mine && <div className="text-[11px] font-semibold mb-1 text-primary-600">{authorLabel}</div>}
                    <div className="leading-relaxed">{msg.content}</div>
                    <div className={`text-[10px] mt-1.5 ${mine ? "text-white/70 text-right" : "text-neutral-400"}`}>
                      {msg.created_at ? formatDateTime(msg.created_at) : ""}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={endRef} />
        </div>

        <div className="flex gap-2 items-center">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Écrire un message..."
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) void handleSend();
            }}
            disabled={sending}
            className="rounded-full"
          />
          <Button
            onClick={() => void handleSend()}
            disabled={sending || !newMessage.trim()}
            className="rounded-full px-5 flex-shrink-0 bg-gradient-to-r from-primary-400 to-primary-600"
          >
            {sending ? "…" : "Envoyer"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

