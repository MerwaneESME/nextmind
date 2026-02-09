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
        <div className="space-y-3 max-h-[420px] overflow-y-auto rounded-lg border border-gray-200 bg-white p-4">
          {loading ? (
            <div className="text-sm text-gray-500">Chargement...</div>
          ) : messages.length === 0 ? (
            <div className="text-sm text-gray-500">Aucun message pour le moment.</div>
          ) : (
            messages.map((msg) => {
              const mine = msg.author_id === user?.id;
              const authorLabel =
                msg.author?.full_name || msg.author?.email || (mine ? "Vous" : "Interlocuteur");
              return (
                <div key={msg.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={[
                      "max-w-[75%] rounded-lg p-3 text-sm whitespace-pre-wrap",
                      mine ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-900",
                    ].join(" ")}
                  >
                    {!mine && <div className="text-xs font-semibold mb-1">{authorLabel}</div>}
                    <div>{msg.content}</div>
                    <div className={`text-xs mt-1 ${mine ? "text-white/80" : "text-gray-500"}`}>
                      {msg.created_at ? formatDateTime(msg.created_at) : ""}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={endRef} />
        </div>

        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Écrire un message..."
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSend();
            }}
            disabled={sending}
          />
          <Button onClick={() => void handleSend()} disabled={sending || !newMessage.trim()}>
            {sending ? "Envoi..." : "Envoyer"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

