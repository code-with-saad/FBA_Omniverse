import { Fragment, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { getLang, t, tServer } from '../../i18n';

const WELCOME = {
  from: 'bot',
  text: "Hi! I'm Basket, the MarketLink assistant.\nAsk me about market timings, the top rated farmers, best sellers, offers, pickup windows or where to find a product. You can write in English, Urdu or Roman Urdu. I remember our chat, so you can ask follow-up questions.",
  suggestions: ['Top rated farmers', 'Markets open now', 'Where can I buy mangoes?', 'Offers this week'],
};
const GUEST_KEY = 'ml_chat_guest';
const HISTORY_LIMIT = 60;

// Guests keep their conversation and the assistant's memory in this browser only.
function loadGuestChat() {
  try {
    const saved = JSON.parse(localStorage.getItem(GUEST_KEY) || 'null');
    return {
      messages: Array.isArray(saved?.messages) ? saved.messages.slice(-HISTORY_LIMIT) : [],
      memory: saved?.memory && typeof saved.memory === 'object' ? saved.memory : {},
    };
  } catch {
    return { messages: [], memory: {} };
  }
}
function saveGuestChat(messages, memory) {
  try {
    const slim = messages.slice(-HISTORY_LIMIT).map(({ from, text, cards }) => ({ from, text, cards }));
    localStorage.setItem(GUEST_KEY, JSON.stringify({ messages: slim, memory }));
  } catch {
    /* storage full or blocked: the chat still works for this visit */
  }
}
function clearGuestChat() {
  try {
    localStorage.removeItem(GUEST_KEY);
  } catch {
    /* ignore */
  }
}

/** Renders **bold** text and {{icon:name}} icon tokens from the assistant's replies safely (no HTML injection). */
function RichText({ text }) {
  return text.split('\n').map((line, i) => (
    <Fragment key={i}>
      {line.split(/(\*\*[^*]+\*\*|\{\{icon:[a-z0-9-]+\}\})/g).map((part, j) => {
        if (part.startsWith('**') && part.endsWith('**')) return <strong key={j}>{part.slice(2, -2)}</strong>;
        const icon = part.match(/^\{\{icon:([a-z0-9-]+)\}\}$/);
        if (icon) return <i key={j} className={`bi bi-${icon[1]} chat-icon`} aria-hidden="true" />;
        return <Fragment key={j}>{part.replace(/\*([^*]+)\*/g, '$1')}</Fragment>;
      })}
      {i < text.split('\n').length - 1 && <br />}
    </Fragment>
  ));
}

/** What the assistant currently remembers, shown as small chips under the header. */
function memoryChips(memory) {
  return [
    memory.name && { icon: 'bi-person', label: memory.name },
    memory.city && { icon: 'bi-buildings', label: memory.city },
    memory.marketName && { icon: 'bi-geo-alt', label: memory.marketName },
    memory.farmerName && { icon: 'bi-shop', label: memory.farmerName },
    memory.productName && { icon: 'bi-basket', label: memory.productName },
  ].filter(Boolean);
}

/**
 * Floating AI assistant (rule-based chatbot answered by the MarketLink API).
 * Mounted with key={user id} so logging in or out starts from that account's own history.
 */
export default function ChatWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [chat, setChat] = useState(() => (user ? { messages: [], memory: {} } : loadGuestChat()));
  const [loaded, setLoaded] = useState(!user); // signed-in history is fetched when the panel first opens
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const bodyRef = useRef(null);
  const { messages, memory } = chat;

  useEffect(() => {
    if (!open || loaded) return undefined;
    let cancelled = false;
    api
      .get('/assistant/history')
      .then((res) => {
        if (!cancelled) setChat({ messages: res.messages || [], memory: res.memory || {} });
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, loaded]);

  useEffect(() => {
    if (!user) saveGuestChat(messages, memory);
  }, [user, messages, memory]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, typing, open, confirmClear]);

  async function send(text) {
    const message = (text ?? input).trim();
    if (!message || typing) return;
    setInput('');
    setConfirmClear(false);
    setChat((c) => ({ ...c, messages: [...c.messages, { from: 'me', text: message }] }));
    setTyping(true);
    try {
      const res = await api.post('/assistant', { message, memory: user ? undefined : memory, lang: getLang() });
      setChat((c) => ({
        messages: [...c.messages, { from: 'bot', text: res.reply, cards: res.cards, suggestions: res.suggestions }].slice(-HISTORY_LIMIT),
        memory: res.memory || c.memory,
      }));
    } catch (err) {
      setChat((c) => ({ ...c, messages: [...c.messages, { from: 'bot', text: err.message || t('Sorry, something went wrong.') }] }));
    } finally {
      setTyping(false);
    }
  }

  async function clearChat() {
    setConfirmClear(false);
    if (user) {
      try {
        await api.del('/assistant/history');
      } catch {
        /* the local view is cleared either way */
      }
    } else {
      clearGuestChat();
    }
    setChat({ messages: [], memory: {} });
  }

  const shown = [{ ...WELCOME, text: t(WELCOME.text) }, ...messages];
  const last = shown[shown.length - 1];
  const chips = memoryChips(memory);

  return (
    <>
      {open && (
        <section className="chat-panel" aria-label={t('MarketLink assistant')}>
          <div className="chat-head">
            <span className="bot-avatar">
              <i className="bi bi-basket2-fill" aria-hidden="true" />
            </span>
            <div className="flex-grow-1 min-w-0">
              <strong className="d-block">{t('Basket · AI assistant')}</strong>
              <span className="fs-7" style={{ color: 'rgba(255,255,255,.7)' }}>
                <i className="bi bi-circle-fill text-lime" style={{ fontSize: 7 }} /> {t('Answers from live market data')}
              </span>
            </div>
            <button
              type="button"
              className="chat-head-btn"
              onClick={() => setConfirmClear(!confirmClear)}
              disabled={!messages.length && !chips.length}
              aria-label={t('Clear chat history')}
              title={t('Clear chat history')}
            >
              <i className="bi bi-trash3" />
            </button>
            <button type="button" className="btn-close btn-close-white" onClick={() => setOpen(false)} aria-label={t('Close assistant')} />
          </div>

          {chips.length > 0 && (
            <div className="chat-memory" aria-label={t('What the assistant remembers')}>
              <span className="chat-memory-label">
                <i className="bi bi-bookmark-heart" /> {t('Remembers')}
              </span>
              {chips.map((c) => (
                <span key={c.icon + c.label} className="chat-memory-chip">
                  <i className={`bi ${c.icon}`} /> {t(c.label)}
                </span>
              ))}
            </div>
          )}

          {confirmClear && (
            <div className="chat-confirm" role="alert">
              <span>{t('Delete this conversation and everything Basket remembers?')}</span>
              <div className="d-flex gap-2">
                <button type="button" className="btn btn-sm btn-danger" onClick={clearChat}>
                  <i className="bi bi-trash3" /> {t('Clear chat')}
                </button>
                <button type="button" className="btn btn-sm btn-white" onClick={() => setConfirmClear(false)}>
                  {t('Cancel')}
                </button>
              </div>
            </div>
          )}

          <div className="chat-body" ref={bodyRef}>
            {!loaded && (
              <div className="text-center text-muted-2 small py-2">
                <span className="spinner-border spinner-border-sm" /> {t('Loading your conversation…')}
              </div>
            )}
            {shown.map((m, i) => (
              <Fragment key={i}>
                <div className={`msg ${m.from}`}>
                  <RichText text={m.text} />
                </div>
                {m.cards?.length > 0 && (
                  <div className="chat-cards">
                    {m.cards.map((c) => (
                      <Link key={c.kind + c.id} to={c.link} className="chat-card" onClick={() => setOpen(false)}>
                        {c.image ? <img src={c.image} alt="" /> : <i className={`bi ${c.kind === 'link' ? 'bi-arrow-right-circle' : 'bi-receipt'} fs-4 text-success`} />}
                        <span>
                          <strong>{c.title}</strong>
                          <span className="text-muted-2">{c.subtitle}</span>
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </Fragment>
            ))}
            {typing && (
              <div className="msg bot typing" aria-label={t('Assistant is typing')}>
                <span />
                <span />
                <span />
              </div>
            )}
            {!typing && last?.from === 'bot' && last.suggestions?.length > 0 && (
              <div className="suggestions">
                {last.suggestions.map((s) => (
                  <button type="button" key={s} onClick={() => send(s)}>
                    {tServer(s)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <form
            className="chat-input"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={t('Ask about markets, farmers, products…')} aria-label={t('Message')} maxLength={300} />
            <button type="submit" className="btn btn-primary btn-icon" aria-label={t('Send')} disabled={!input.trim() || typing}>
              <i className="bi bi-send-fill" />
            </button>
          </form>
        </section>
      )}
      <button type="button" className="chat-launcher" onClick={() => setOpen(!open)} aria-label={open ? t('Close assistant') : t('Open AI assistant')} aria-expanded={open}>
        {!open && <span className="pulse" />}
        <i className={`bi ${open ? 'bi-x-lg' : 'bi-chat-dots-fill'}`} />
      </button>
    </>
  );
}
