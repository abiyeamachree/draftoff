"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ChatMessage } from "@draftoff/shared";
import { QUICK_CHAT_EMOJIS, QUICK_CHAT_PHRASES } from "@draftoff/shared";
import { useChat } from "@/hooks/useChat";

const BUBBLE_TTL_MS = 4500;
const CHAT_COLORS = [
  "#5cff5c",
  "#5cb8ff",
  "#ff8c5c",
  "#d45cff",
  "#ffff5c",
  "#ff5c8c",
  "#5cffd4",
  "#c4ff5c",
];

type RoomChatCtx = {
  messages: ChatMessage[];
  send: (text: string) => void;
  bubbleFor: (userId: string) => string | null;
  nameColor: (userId: string) => string;
};

const Ctx = createContext<RoomChatCtx | null>(null);

function useSpeechBubbles(messages: ChatMessage[]) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 400);
    return () => window.clearInterval(id);
  }, []);

  return useMemo(() => {
    const now = Date.now();
    const map = new Map<string, string>();
    for (const m of messages) {
      if (now - m.at < BUBBLE_TTL_MS) map.set(m.userId, m.text);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tick drives expiry
  }, [messages, tick]);
}

function ChatFeed({
  messages,
  nameColor,
}: {
  messages: ChatMessage[];
  nameColor: (userId: string) => string;
}) {
  const visible = messages.slice(-8);

  return (
    <div className="chat-feed pointer-events-none absolute left-3 top-3 z-30 max-w-[min(20rem,42vw)] space-y-0.5">
      {visible.map((m) => (
        <p key={m.id} className="chat-line leading-snug">
          <span className="font-bold" style={{ color: nameColor(m.userId) }}>
            {m.name}:
          </span>{" "}
          <span className="text-white">{m.text}</span>
        </p>
      ))}
    </div>
  );
}

function QuickChatWheel({ send, open, onClose }: { send: (t: string) => void; open: boolean; onClose: () => void }) {
  if (!open) return null;

  function pick(text: string) {
    send(text);
    onClose();
  }

  return (
    <>
      <button
        type="button"
        aria-label="Close quick chat"
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
      />
      <div className="quick-chat-wheel fixed bottom-16 right-4 z-50 w-[min(20rem,90vw)] space-y-3 p-3">
        <div>
          <span className="title text-[0.5rem] text-gold">Phrases</span>
          <div className="mt-1 grid grid-cols-3 gap-1">
            {QUICK_CHAT_PHRASES.map((phrase) => (
              <button
                key={phrase}
                type="button"
                onClick={() => pick(phrase)}
                className="quick-chat-btn px-1 py-2 text-[0.5rem] leading-tight"
              >
                {phrase}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="title text-[0.5rem] text-gold">Reacts</span>
          <div className="mt-1 flex flex-wrap gap-1">
            {QUICK_CHAT_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => pick(emoji)}
                className="quick-chat-btn h-9 w-9 text-lg leading-none"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

/** Wraps a lobby/draft screen with RL-style overlay chat + speech-bubble helpers. */
export function RoomChatProvider({
  code,
  playerIds,
  children,
}: {
  code: string;
  playerIds: string[];
  children: ReactNode;
}) {
  const { messages, send } = useChat(code);
  const bubbles = useSpeechBubbles(messages);
  const [wheelOpen, setWheelOpen] = useState(false);

  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    playerIds.forEach((id, i) => map.set(id, CHAT_COLORS[i % CHAT_COLORS.length]));
    return map;
  }, [playerIds]);

  const nameColor = useCallback(
    (userId: string) => colorMap.get(userId) ?? "#ffffff",
    [colorMap]
  );

  const bubbleFor = useCallback(
    (userId: string) => bubbles.get(userId) ?? null,
    [bubbles]
  );

  const value = useMemo(
    () => ({ messages, send, bubbleFor, nameColor }),
    [messages, send, bubbleFor, nameColor]
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <ChatFeed messages={messages} nameColor={nameColor} />
      <button
        type="button"
        onClick={() => setWheelOpen((v) => !v)}
        className="quick-chat-trigger fixed bottom-4 right-4 z-40"
        aria-label="Quick chat"
      >
        💬
      </button>
      <QuickChatWheel send={send} open={wheelOpen} onClose={() => setWheelOpen(false)} />
    </Ctx.Provider>
  );
}

export function useRoomChat() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useRoomChat must be used inside RoomChatProvider");
  return ctx;
}

/** Speech bubble anchored above an avatar; pass null text to hide. */
export function SpeechBubble({
  text,
  className = "",
}: {
  text: string | null;
  className?: string;
}) {
  if (!text) return null;
  return (
    <div
      className={`speech-bubble pointer-events-none absolute z-20 whitespace-nowrap ${className}`}
      role="status"
    >
      {text}
    </div>
  );
}
