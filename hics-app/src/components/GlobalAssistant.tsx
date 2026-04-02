import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';

interface WidgetMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTED_PROMPTS = [
  'How do I run a 30-minute drill?',
  'Explain Incident Commander responsibilities.',
  'What should I debrief after a scenario?',
];

export default function GlobalAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<WidgetMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hi - I am your HICS assistant. Ask me for protocols, role guidance, debrief prompts, or quick scenario help.',
    },
  ]);
  const nextIdRef = useRef(1);

  const getNextId = () => {
    const id = nextIdRef.current;
    nextIdRef.current += 1;
    return `msg-${id}`;
  };

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) {
      return;
    }

    const userMessage: WidgetMessage = { id: getNextId(), role: 'user', content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const history = messages.slice(-8).map((m) => ({ role: m.role, content: m.content }));
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history,
        }),
      });

      const data = await response.json();
      const reply = response.ok
        ? (typeof data?.reply === 'string' ? data.reply : 'I did not receive a response. Please try again.')
        : (typeof data?.error === 'string' ? data.error : 'Assistant temporarily unavailable.');

      setMessages((prev) => [...prev, { id: getNextId(), role: 'assistant', content: reply }]);
    } catch {
      setMessages((prev) => [...prev, {
        id: getNextId(),
        role: 'assistant',
        content: 'Network issue reaching the assistant. Please try again in a moment.',
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-[60]">
      {isOpen && (
        <div className="mb-3 w-[min(92vw,360px)] nyx-panel border border-white/20 rounded-2xl overflow-hidden shadow-2xl">
          <div className="nyx-hero text-white px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">AI Assistant</p>
              <p className="text-[11px] text-amber-100/80">Live help from any module</p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-white/70 hover:text-white text-lg leading-none"
              aria-label="Close assistant"
            >
              ×
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto px-3 py-3 space-y-2 bg-white/70 dark:bg-black/20">
            {messages.map((m) => (
              <div key={m.id} className={`text-sm rounded-xl px-3 py-2 ${m.role === 'user' ? 'bg-blue-600 text-white ml-8' : 'bg-gray-100 dark:bg-white/10 text-gray-800 dark:text-white/90 mr-8'}`}>
                {m.content}
              </div>
            ))}
            {isLoading && (
              <div className="text-xs text-gray-500 dark:text-white/50 px-1">Thinking...</div>
            )}
          </div>

          <div className="px-3 py-3 border-t border-white/10 bg-white/80 dark:bg-black/20">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void sendMessage(prompt)}
                  className="text-[11px] rounded-full px-2.5 py-1 border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/80 hover:bg-gray-100 dark:hover:bg-white/10"
                >
                  {prompt}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void sendMessage(input);
              }}
              className="flex gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask the assistant..."
                className="nyx-input flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="nyx-button-metal px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                Send
              </button>
            </form>

            <div className="mt-2 text-right">
              <Link to="/chatbot" className="text-xs text-amber-700 dark:text-amber-300 hover:underline">
                Open full assistant page
              </Link>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="nyx-button-metal px-4 py-2.5 rounded-full text-sm font-semibold shadow-xl"
      >
        {isOpen ? 'Hide Assistant' : 'Need Help? Ask AI'}
      </button>
    </div>
  );
}
