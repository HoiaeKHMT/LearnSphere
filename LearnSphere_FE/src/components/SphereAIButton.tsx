import { useMemo, useRef, useState, type FormEvent, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';

type SphereAIButtonProps = {
  className?: string;
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type PopupPosition = {
  x: number;
  y: number;
};

type PopupSize = {
  width: number;
  height: number;
};

const POPUP_MARGIN = 8;
const POPUP_GAP = 12;
const MAX_POPUP_WIDTH = 420;
const MAX_POPUP_HEIGHT = 440;

function getPopupSize(): PopupSize {
  const availableWidth = Math.max(280, window.innerWidth - POPUP_MARGIN * 2);
  const availableHeight = Math.max(320, window.innerHeight - POPUP_MARGIN * 2);

  return {
    width: Math.min(MAX_POPUP_WIDTH, availableWidth),
    height: Math.min(MAX_POPUP_HEIGHT, availableHeight),
  };
}

function clamp(value: number, min: number, max: number) {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

const suggestions = [
  'Giải thích bài này ngắn gọn',
  'Tóm tắt ý chính của khóa học',
  'Gợi ý cách học hiệu quả',
  'Quiz này nên ôn phần nào?',
];

const initialMessages: ChatMessage[] = [
  {
    id: 'welcome',
    role: 'assistant',
    content: 'Chào bạn, mình là Sphere AI. Bạn có thể hỏi mình về bài học, quiz, tài liệu hoặc cách tiếp tục lộ trình học.',
  },
];

export function SphereAIButton({ className = '' }: SphereAIButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [popupPosition, setPopupPosition] = useState<PopupPosition>({ x: POPUP_MARGIN, y: POPUP_MARGIN });
  const [popupSize, setPopupSize] = useState<PopupSize>({ width: MAX_POPUP_WIDTH, height: MAX_POPUP_HEIGHT });
  const [isDragging, setIsDragging] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const latestTopic = useMemo(() => {
    const latestUserMessage = [...messages].reverse().find((message) => message.role === 'user');
    return latestUserMessage?.content ?? 'Hỗ trợ học tập';
  }, [messages]);

  function openChat() {
    const size = getPopupSize();
    const buttonRect = buttonRef.current?.getBoundingClientRect();
    const fallbackX = window.innerWidth - size.width - POPUP_MARGIN;
    const fallbackY = window.innerHeight - size.height - POPUP_MARGIN;

    let nextX = fallbackX;
    let nextY = fallbackY;

    if (buttonRect) {
      const hasRoomOnLeft = buttonRect.left >= size.width + POPUP_GAP + POPUP_MARGIN;
      nextX = hasRoomOnLeft ? buttonRect.left - size.width - POPUP_GAP : fallbackX;
      nextY = buttonRect.bottom - size.height;
    }

    setPopupSize(size);
    setPopupPosition({
      x: clamp(nextX, POPUP_MARGIN, window.innerWidth - size.width - POPUP_MARGIN),
      y: clamp(nextY, POPUP_MARGIN, window.innerHeight - size.height - POPUP_MARGIN),
    });
    setIsDragging(false);
    setIsOpen(true);
    window.setTimeout(() => inputRef.current?.focus(), 50);
  }

  function handleDragStart(event: PointerEvent<HTMLElement>) {
    const popup = event.currentTarget.closest('[data-ai-popup="true"]') as HTMLElement | null;
    if (!popup) return;

    const rect = popup.getBoundingClientRect();
    dragOffsetRef.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    setPopupPosition({ x: rect.left, y: rect.top });
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleDragMove(event: PointerEvent<HTMLElement>) {
    if (!isDragging) return;

    const nextX = clamp(event.clientX - dragOffsetRef.current.x, POPUP_MARGIN, window.innerWidth - popupSize.width - POPUP_MARGIN);
    const nextY = clamp(event.clientY - dragOffsetRef.current.y, POPUP_MARGIN, window.innerHeight - popupSize.height - POPUP_MARGIN);
    setPopupPosition({ x: nextX, y: nextY });
  }

  function handleDragEnd(event: PointerEvent<HTMLElement>) {
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function sendMessage(content: string) {
    const normalized = content.trim();
    if (!normalized) return;

    const nextUserMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: normalized,
    };

    const nextAssistantMessage: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: 'Mình đã ghi nhận câu hỏi. Hiện popup này là giao diện trợ lý trong app; phần kết nối AI thật có thể được nối vào API sau.',
    };

    setMessages((current) => [...current, nextUserMessage, nextAssistantMessage]);
    setInput('');
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendMessage(input);
  }

  const popupNode = isOpen ? (
        <section
          className="sphere-ai-popup fixed flex overflow-hidden rounded-2xl border border-[#414754] bg-[#0d131f] text-[#dde2f4] shadow-2xl shadow-black/50"
          data-ai-popup="true"
          style={{
            left: popupPosition.x,
            top: popupPosition.y,
            width: popupSize.width,
            height: popupSize.height,
            zIndex: 2147483647,
          }}
        >
          <button
            className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-[#414754] bg-[#242a37] text-[#c1c6d7] shadow-lg transition hover:border-[#adc7ff]/50 hover:text-[#adc7ff]"
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => setIsOpen(false)}
            aria-label="Đóng trợ lý AI"
          >
            <span className="material-symbols-outlined text-[19px]">close</span>
          </button>
          <aside className="hidden w-44 shrink-0 flex-col gap-5 border-r border-[#414754] bg-[#161c28] p-3 2xl:flex">
            <div className="rounded-xl border border-[#adc7ff]/40 bg-[#1a202c] p-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#4a8eff]/20 text-[#adc7ff]">
                  <span className="material-symbols-outlined">smart_toy</span>
                </span>
                <div>
                  <h3 className="font-mono text-[13px] font-bold text-[#adc7ff]">Sphere AI</h3>
                  <p className="text-[10px] uppercase tracking-wider text-[#8b90a0]">Powered by LearnSphere</p>
                </div>
              </div>
            </div>

            <button
              className="rounded-xl bg-[#adc7ff] px-4 py-3 font-mono text-[12px] font-bold text-[#002e68] transition active:scale-95"
              type="button"
              onClick={() => {
                setMessages(initialMessages);
                setInput('');
              }}
            >
              <span className="material-symbols-outlined mr-1 align-[-4px] text-[17px]">add</span>
              Phiên mới
            </button>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
              <section>
                <h4 className="mb-2 px-2 text-[10px] font-bold uppercase tracking-widest text-[#8b90a0]">Lịch sử</h4>
                <div className="space-y-1">
                  <div className="flex items-center gap-3 rounded-lg bg-[#4a8eff]/10 p-3 font-semibold text-[#adc7ff]">
                    <span className="material-symbols-outlined text-[18px]">chat</span>
                    <span className="truncate text-[13px]">{latestTopic}</span>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg p-3 text-[#c1c6d7]">
                    <span className="material-symbols-outlined text-[18px]">history</span>
                    <span className="truncate text-[13px]">Ôn tập bài học</span>
                  </div>
                </div>
              </section>

              <section>
                <h4 className="mb-2 px-2 text-[10px] font-bold uppercase tracking-widest text-[#8b90a0]">Chủ đề</h4>
                {['Khái niệm khó', 'Quiz & đáp án', 'Lộ trình học'].map((topic) => (
                  <button
                    key={topic}
                    className="flex w-full items-center gap-3 rounded-lg p-3 text-left text-[#c1c6d7] transition hover:bg-[#2f3542]"
                    type="button"
                    onClick={() => sendMessage(topic)}
                  >
                    <span className="material-symbols-outlined text-[18px] text-[#24dfba]">topic</span>
                    <span className="truncate text-[13px]">{topic}</span>
                  </button>
                ))}
              </section>
            </div>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <header
              className={`flex h-14 cursor-grab touch-none select-none items-center justify-between border-b border-[#414754] bg-[#161c28] px-4 pr-14 ${isDragging ? 'cursor-grabbing' : ''}`}
              onPointerDown={handleDragStart}
              onPointerMove={handleDragMove}
              onPointerUp={handleDragEnd}
              onPointerCancel={handleDragEnd}
            >
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#4a8eff]/20 text-[#adc7ff]">
                  <span className="material-symbols-outlined text-[18px]">bolt</span>
                </span>
                <div>
                  <h2 className="text-[15px] font-bold text-[#e7ecff]">Trợ lý AI LearnSphere</h2>
                  <p className="font-mono text-[10px] text-[#8b90a0]">
                    <span className="material-symbols-outlined align-[-3px] text-[13px]">open_with</span>
                    Kéo thanh này để di chuyển
                  </p>
                </div>
              </div>
            </header>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto bg-[#0d131f] p-4">
              {messages.map((message) => (
                <div key={message.id} className={message.role === 'user' ? 'flex justify-end' : 'flex gap-3'}>
                  {message.role === 'assistant' && (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#4a8eff] text-[#00285b]">
                      <span className="material-symbols-outlined text-[19px]">bolt</span>
                    </span>
                  )}
                  <div
                    className={`max-w-[85%] rounded-2xl border p-4 text-[14px] leading-6 ${
                      message.role === 'user'
                        ? 'rounded-tr-none border-[#414754] bg-[#2f3542] text-[#e7ecff]'
                        : 'rounded-tl-none border-[#adc7ff]/25 bg-[#161c28]/80 text-[#c1c6d7]'
                    }`}
                  >
                    {message.role === 'assistant' && (
                      <h3 className="mb-2 flex items-center gap-2 font-bold text-[#adc7ff]">
                        <span className="material-symbols-outlined text-[16px]">info</span>
                        Gợi ý từ Sphere AI
                      </h3>
                    )}
                    <p>{message.content}</p>
                  </div>
                </div>
              ))}
            </div>

            <footer className="space-y-3 border-t border-[#414754] bg-gradient-to-t from-[#0d131f] via-[#0d131f] to-transparent p-4">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    className="shrink-0 rounded-full border border-[#414754] bg-[#161c28] px-4 py-2 text-[12px] text-[#c1c6d7] transition hover:border-[#adc7ff] hover:text-[#adc7ff]"
                    type="button"
                    onClick={() => sendMessage(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>

              <form className="relative" onSubmit={handleSubmit}>
                <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-[#adc7ff] to-[#24dfba] opacity-20 blur transition focus-within:opacity-40" />
                <div className="relative flex items-center gap-2 rounded-2xl border border-[#414754] bg-[#242a37] p-2">
                  <button className="p-3 text-[#8b90a0] transition hover:text-[#adc7ff]" type="button" aria-label="Đính kèm">
                    <span className="material-symbols-outlined">attach_file</span>
                  </button>
                  <input
                    ref={inputRef}
                    className="min-w-0 flex-1 border-none bg-transparent px-2 text-[15px] text-[#e7ecff] outline-none placeholder:text-[#8b90a0] focus:ring-0"
                    placeholder="Hỏi AI..."
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                  />
                  <button className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#adc7ff] text-[#002e68] transition active:scale-95" type="submit" aria-label="Gửi">
                    <span className="material-symbols-outlined">send</span>
                  </button>
                </div>
              </form>
            </footer>
          </div>
        </section>
  ) : null;

  const assistantLayer =
    typeof document !== 'undefined'
      ? createPortal(
          <div className="sphere-ai-root" aria-live="polite">
            {popupNode}

      <button
        ref={buttonRef}
        type="button"
        className={`sphere-ai-launcher ai-assistant-pulse group fixed bottom-8 right-8 flex h-16 w-16 items-center justify-center rounded-full border-2 border-white/10 bg-[linear-gradient(135deg,#adc7ff,#24dfba)] text-[#002e68] shadow-2xl shadow-black/35 transition-transform active:scale-95 hover:scale-105 ${className}`}
        aria-label="Hỏi Sphere AI"
        onClick={openChat}
        style={{ zIndex: 2147483646 }}
      >
        <span className="material-symbols-outlined text-[32px]" style={{ fontVariationSettings: '"FILL" 1' }}>
          psychology
        </span>
        <span className="pointer-events-none absolute bottom-full right-0 mb-4 whitespace-nowrap rounded-xl border border-white/5 bg-[#2f3542] px-4 py-2 font-mono text-[12px] text-[#dde2f4] opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
          Hỏi Sphere AI
        </span>
          </button>
          </div>,
          document.body,
        )
      : null;

  return assistantLayer;
}
