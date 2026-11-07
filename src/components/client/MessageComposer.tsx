'use client';

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { LockIcon, SendIcon, SpinnerIcon } from './icons';

interface MessageComposerProps {
  onSend: (content: string) => Promise<{ ok: boolean; error?: string }>;
  sending: boolean;
  disabled: boolean;
  disabledReason?: string;
  error: string | null;
  showQuickReplies: boolean;
}

const QUICK_REPLIES = [
  "I'll pay this week",
  "I can't pay in full right now",
  'The work was not as agreed',
];

const MAX_LENGTH = 2000;

export default function MessageComposer({
  onSend,
  sending,
  disabled,
  disabledReason,
  error,
  showQuickReplies,
}: MessageComposerProps) {
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`;
  }, [content]);

  function applyQuickReply(reply: string) {
    setContent(reply);
    window.requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.focus();
      const end = reply.length;
      textarea.setSelectionRange(end, end);
    });
  }

  async function submit() {
    const text = content.trim();
    if (!text || sending || disabled) return;

    const result = await onSend(text);
    if (result.ok) {
      setContent('');
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submit();
    }
  }

  if (disabled) {
    return (
      <div className="pp-composer pp-composer--locked">
        <div className="pp-composer__locked">
          <LockIcon width={18} height={18} />
          <p>{disabledReason || 'This conversation is paused.'}</p>
        </div>
      </div>
    );
  }

  const canSend = content.trim().length > 0 && !sending;

  return (
    <div className="pp-composer">
      {showQuickReplies ? (
        <div className="pp-quick-replies" aria-label="Suggested replies">
          <div className="pp-quick-replies__list">
            {QUICK_REPLIES.map((reply) => (
              <button
                key={reply}
                type="button"
                className="pp-quick-reply"
                onClick={() => applyQuickReply(reply)}
                disabled={sending}
              >
                {reply}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="pp-inline-error" role="alert">
          {error}
        </p>
      ) : null}

      <form className="pp-composer__form" onSubmit={handleSubmit}>
        <label className="pp-sr-only" htmlFor="portal-message">
          Message the billing assistant
        </label>
        <div className="pp-composer__box">
          <textarea
            id="portal-message"
            ref={textareaRef}
            value={content}
            onChange={(event) => setContent(event.target.value.slice(0, MAX_LENGTH))}
            onKeyDown={handleKeyDown}
            placeholder="Write a message…"
            rows={1}
            maxLength={MAX_LENGTH}
            disabled={sending}
            aria-describedby="composer-hint"
          />

          <button
            type="submit"
            className="pp-composer__send"
            disabled={!canSend}
            aria-label="Send message"
            title="Send message"
          >
            {sending ? <SpinnerIcon width={18} height={18} /> : <SendIcon width={18} height={18} />}
          </button>
        </div>

        <div className="pp-composer__hint" id="composer-hint">
          <span>Enter to send · Shift + Enter for a new line</span>
          {content.length > MAX_LENGTH - 200 ? (
            <span className="pp-composer__count">
              {content.length} / {MAX_LENGTH}
            </span>
          ) : null}
        </div>
      </form>
    </div>
  );
}
