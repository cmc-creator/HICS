import { useState, useRef, useEffect } from 'react';
import type { ChatMessage } from '../types';

function getInitialMessage(): ChatMessage {
  return {
    id: '0',
    role: 'assistant',
    content: "Hello! I'm the NyxHICSlab AI Assistant, trained on HICS protocols, ICS structure, triage methods, and hospital emergency management. How can I help you prepare today?",
    timestamp: new Date(),
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatBotMessage(text: string): string {
  // Escape HTML first to prevent XSS, then apply safe markdown-like formatting
  return escapeHtml(text)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>');
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex items-start gap-3 mb-4 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${
        isUser ? 'chat-avatar-user text-white' : 'chat-avatar-assistant text-slate-100'
      }`}>
        {isUser ? 'USR' : 'AI'}
      </div>
      <div className={`max-w-[80%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        {isUser ? (
          <div className="px-4 py-3 rounded-2xl text-sm leading-relaxed chat-user-bubble text-white rounded-tr-sm">
            {message.content}
          </div>
        ) : (
          <div
            className="px-4 py-3 rounded-2xl text-sm leading-relaxed chat-assistant-bubble text-gray-800 dark:text-white rounded-tl-sm"
            dangerouslySetInnerHTML={{ __html: formatBotMessage(message.content) }}
          />
        )}
        <div className="text-xs text-gray-400 dark:text-white/40 mt-1 px-1">
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}

const suggestedQuestions = [
  'What is HICS?',
  'How does START triage work?',
  'What is the RACE protocol?',
  'Who is the Incident Commander?',
  'What is the IAP?',
  'How do I respond to a hazmat incident?',
  'What is span of control?',
  'How does HIPAA apply during emergencies?',
];

export default function ChatbotPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([getInitialMessage()]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextMessageIdRef = useRef(1);

  const getNextMessageId = (): string => {
    const id = nextMessageIdRef.current;
    nextMessageIdRef.current += 1;
    return id.toString();
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const sendMessage = (text: string) => {
    if (!text.trim()) return;

    const userMessage: ChatMessage = {
      id: getNextMessageId(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    // Build history for the API (exclude the initial greeting, send last 10 exchanges)
    const historySnapshot = messages
      .slice(1)
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }));

    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text.trim(), history: historySnapshot }),
    })
      .then(async (response) => {
        const data = await response.json();
        const reply = response.ok
          ? (data.reply ?? 'No response received.')
          : (data.error ?? 'AI service is temporarily unavailable. Please try again.');
        const botMessage: ChatMessage = {
          id: getNextMessageId(),
          role: 'assistant',
          content: reply,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, botMessage]);
      })
      .catch(() => {
        const botMessage: ChatMessage = {
          id: getNextMessageId(),
          role: 'assistant',
          content: 'Unable to reach the AI service. Check your connection and try again.',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, botMessage]);
      })
      .finally(() => {
        setIsTyping(false);
      });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleClear = () => {
    setMessages([getInitialMessage()]);
    inputRef.current?.focus();
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col lux-page">
      {/* Header */}
      <div className="nyx-hero text-white py-4 px-4 relative overflow-hidden">
        <div className="lux-grid-pattern" />
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 lux-hero-shell py-2 px-3">
            <div className="w-10 h-10 chat-avatar-user rounded-full flex items-center justify-center text-xs font-bold tracking-widest">
              NX
            </div>
            <div>
              <h1 className="text-lg font-bold">NyxHICSlab Assistant</h1>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-green-400 rounded-full" />
                <span className="text-xs text-amber-100/90">Online - Ready to help</span>
              </div>
            </div>
          </div>
          <button
            onClick={handleClear}
            className="text-amber-100 hover:text-white text-sm px-3 py-1 rounded border border-amber-200/30 hover:border-amber-100/70 transition-colors"
          >
            Clear Chat
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full">
        {/* Suggested Questions */}
        <div className="nyx-panel border-b px-4 py-3 mt-3">
          <div className="text-xs text-gray-500 dark:text-white/50 mb-2 font-medium">Suggested questions:</div>
          <div className="flex flex-wrap gap-2">
            {suggestedQuestions.map((q) => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                className="text-xs nyx-chip px-3 py-1.5 rounded-full hover:bg-slate-200 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}

          {isTyping && (
            <div className="flex items-start gap-3 mb-4">
              <div className="w-8 h-8 rounded-full chat-avatar-assistant flex items-center justify-center text-[10px] font-bold tracking-widest text-slate-100">
                AI
              </div>
              <div className="chat-assistant-bubble rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="nyx-panel border-t px-4 py-4 mb-4">
          <form onSubmit={handleSubmit} className="flex gap-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about HICS protocols, triage, emergency procedures..."
              className="nyx-input flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
              disabled={isTyping}
            />
            <button
              type="submit"
              disabled={!input.trim() || isTyping}
              className="nyx-button-metal px-5 py-2.5 rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              Send
              <span>→</span>
            </button>
          </form>
          <p className="text-xs text-gray-400 dark:text-white/40 mt-2 text-center">
            NyxHICSlab provides training guidance. Always consult your hospital's Emergency Operations Plan for official procedures.
          </p>
        </div>
      </div>
    </div>
  );
}
