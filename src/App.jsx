import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown, ArrowUp, AudioLines, Bot, Check, ChevronDown, Command,
  FileText, ImagePlus, Menu, MessageSquare, MoreHorizontal, Paperclip,
  Plus, Search, Settings2, Sparkles, SquarePen, X, Zap
} from 'lucide-react';

const STORAGE_KEY = 'nhk-ai-conversations-v1';
const starterPrompts = [
  { icon: '✦', title: 'Brainstorm ideas', text: 'Help me brainstorm ideas for a new project' },
  { icon: '⌘', title: 'Write something', text: 'Help me write a clear and engaging introduction' },
  { icon: '⌁', title: 'Understand a topic', text: 'Explain a difficult topic in simple terms' },
  { icon: '⚡', title: 'Build with code', text: 'Help me plan and build a small web app' }
];

function readConversations() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}

function makeConversation() {
  return { id: crypto.randomUUID(), title: 'New conversation', updatedAt: Date.now(), messages: [] };
}

export default function App() {
  const [conversations, setConversations] = useState(readConversations);
  const [activeId, setActiveId] = useState(() => readConversations()[0]?.id || null);
  const [prompt, setPrompt] = useState('');
  const [search, setSearch] = useState('');
  const [model, setModel] = useState('NHK Smart');
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [copiedId, setCopiedId] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const endRef = useRef(null);
  const fileRef = useRef(null);

  const active = conversations.find(c => c.id === activeId) || null;
  const filtered = useMemo(() => conversations
    .filter(c => c.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b) => b.updatedAt - a.updatedAt), [conversations, search]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [active?.messages.length]);

  function newChat() {
    const chat = makeConversation();
    setConversations(prev => [chat, ...prev]);
    setActiveId(chat.id);
    setPrompt('');
    setAttachments([]);
    setMobileSidebar(false);
  }

  async function sendMessage(text = prompt) {
    const content = text.trim();
    if ((!content && attachments.length === 0) || isSending) return;
    const chat = active || makeConversation();
    const userMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content || 'I selected a file, but file analysis is not enabled yet.',
      files: attachments.map(file => file.name)
    };
    const history = [...chat.messages, userMessage];
    const title = chat.messages.length ? chat.title : (content.slice(0, 34) || 'File discussion');
    setConversations(prev => {
      const exists = prev.some(item => item.id === chat.id);
      const updated = { ...chat, title, updatedAt: Date.now(), messages: history };
      return exists ? prev.map(item => item.id === chat.id ? updated : item) : [updated, ...prev];
    });
    setActiveId(chat.id);
    setPrompt('');
    setAttachments([]);
    setIsSending(true);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          style: model,
          messages: history.slice(-20).map(({ role, content: messageContent }) => ({ role, content: messageContent }))
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'The AI server could not complete your request.');
      const reply = { id: crypto.randomUUID(), role: 'assistant', content: data.reply };
      setConversations(prev => prev.map(item => item.id === chat.id
        ? { ...item, updatedAt: Date.now(), messages: [...item.messages, reply] }
        : item));
    } catch (error) {
      const reply = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: error.message || 'I could not connect to the NHK AI server. Make sure the backend is running and configured.'
      };
      setConversations(prev => prev.map(item => item.id === chat.id
        ? { ...item, updatedAt: Date.now(), messages: [...item.messages, reply] }
        : item));
    } finally {
      setIsSending(false);
    }
  }

  function addFiles(event) {
    const picked = Array.from(event.target.files || []);
    setAttachments(prev => [...prev, ...picked.map(file => ({ name: file.name, size: file.size }))]);
    event.target.value = '';
  }

  function removeConversation(id) {
    const remaining = conversations.filter(c => c.id !== id);
    setConversations(remaining);
    if (activeId === id) setActiveId(remaining[0]?.id || null);
  }

  async function copyMessage(message) {
    try { await navigator.clipboard.writeText(message.content); setCopiedId(message.id); setTimeout(() => setCopiedId(null), 1500); } catch {}
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileSidebar ? 'sidebar-open' : ''}`}>
        <div className="brand-row">
          <div className="brand-mark"><Sparkles size={19} strokeWidth={2.3}/></div>
          <span className="brand-name">NHK<span>AI</span></span>
          <button className="icon-btn sidebar-close" onClick={() => setMobileSidebar(false)} aria-label="Close menu"><X size={18}/></button>
        </div>
        <button className="new-chat-btn" onClick={newChat}><SquarePen size={17}/> <span>New chat</span><kbd>⌘ K</kbd></button>
        <div className="side-search"><Search size={15}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search conversations"/></div>
        <div className="side-label">WORKSPACE</div>
        <button className="nav-item active"><MessageSquare size={16}/> All conversations</button>
        <button className="nav-item" onClick={() => setSettingsOpen(true)}><Settings2 size={16}/> Preferences</button>
        <div className="history-head"><span className="side-label">RECENT</span><button className="tiny-icon" onClick={newChat}><Plus size={15}/></button></div>
        <div className="conversation-list">
          {filtered.length === 0 && <div className="empty-history">No conversations yet</div>}
          {filtered.map(chat => (
            <div key={chat.id} className={`history-item ${chat.id === activeId ? 'selected' : ''}`}>
              <button onClick={() => { setActiveId(chat.id); setMobileSidebar(false); }}><MessageSquare size={14}/><span>{chat.title}</span></button>
              <button className="remove-chat" title="Delete conversation" onClick={() => removeConversation(chat.id)}><X size={13}/></button>
            </div>
          ))}
        </div>
        <div className="sidebar-bottom">
          <div className="plan-card"><div className="plan-icon"><Zap size={15}/></div><div><strong>Your AI workspace</strong><small>Ready for your ideas</small></div><span className="online-dot"/></div>
          <button className="profile-row" onClick={() => setSettingsOpen(true)}><div className="avatar">N</div><div className="profile-copy"><strong>NHK Workspace</strong><small>Personal workspace</small></div><MoreHorizontal size={18}/></button>
        </div>
      </aside>

      {mobileSidebar && <button className="mobile-scrim" onClick={() => setMobileSidebar(false)} aria-label="Close navigation"/>}

      <main className="main-panel">
        <header className="topbar">
          <div className="top-left"><button className="icon-btn mobile-menu" onClick={() => setMobileSidebar(true)} aria-label="Open menu"><Menu size={19}/></button><span className="top-context">Workspace <span>/</span> <b>{active?.title || 'New chat'}</b></span></div>
          <div className="top-actions">
            <div className="model-wrap">
              <button className="model-select" onClick={() => setMenuOpen(v => !v)}><span className="model-dot"/>{model}<ChevronDown size={14}/></button>
              {menuOpen && <div className="model-menu">{['NHK Smart', 'NHK Creative', 'NHK Code'].map(name => <button key={name} onClick={() => {setModel(name);setMenuOpen(false);}}><span>{name}</span>{model === name && <Check size={14}/>}</button>)}</div>}
            </div>
            <button className="icon-btn" onClick={() => setSettingsOpen(true)} aria-label="Settings"><Settings2 size={18}/></button>
          </div>
        </header>

        <section className="chat-area">
          {!active || active.messages.length === 0 ? (
            <div className="welcome">
              <div className="welcome-orb"><div className="orb-core"><Sparkles size={29}/></div><span className="orb-ring ring-one"/><span className="orb-ring ring-two"/></div>
              <div className="eyebrow"><span/> YOUR PERSONAL AI WORKSPACE</div>
              <h1>Make room for<br/><em>big ideas.</em></h1>
              <p className="welcome-sub">A smarter space to think, create, learn, and build.<br/>What can we help you with today?</p>
              <div className="prompt-grid">{starterPrompts.map(item => <button key={item.title} className="prompt-card" onClick={() => sendMessage(item.text)}><span className="prompt-icon">{item.icon}</span><span><strong>{item.title}</strong><small>{item.text}</small></span><ArrowUp size={15}/></button>)}</div>
              <div className="welcome-note"><span className="sparkle-mini">✦</span> Your ideas, one conversation at a time.</div>
            </div>
          ) : (
            <div className="messages-wrap">
              <div className="conversation-title"><span className="title-icon"><Sparkles size={17}/></span><div><h2>{active.title}</h2><p>Conversation · Saved in this browser</p></div></div>
              {active.messages.map(message => <article key={message.id} className={`message-row ${message.role}`}><div className={`message-avatar ${message.role}`}>{message.role === 'assistant' ? <Sparkles size={16}/> : 'N'}</div><div className="message-content"><div className="message-author">{message.role === 'assistant' ? 'NHK AI' : 'You'}</div><p>{message.content}</p>{message.files?.length > 0 && <div className="attached-list">{message.files.map(name => <span key={name}><FileText size={13}/>{name}</span>)}</div>}{message.role === 'assistant' && <button className="copy-btn" onClick={() => copyMessage(message)}>{copiedId === message.id ? <Check size={13}/> : <Command size={13}/>} {copiedId === message.id ? 'Copied' : 'Copy'}</button>}</div></article>)}
              {isSending && <div className="message-row assistant"><div className="message-avatar assistant"><Sparkles size={16}/></div><div className="message-content"><div className="message-author">NHK AI</div><p className="typing-indicator">Thinking…</p></div></div>}{isSending && <div className="message-row assistant"><div className="message-avatar assistant"><Sparkles size={16}/></div><div className="message-content"><div className="message-author">NHK AI</div><p className="typing-indicator">Thinking…</p></div></div>}<div ref={endRef}/>
            </div>
          )}
        </section>

        <footer className="composer-zone">
          <div className="composer">
            {attachments.length > 0 && <div className="attachment-chips">{attachments.map((file,i) => <span key={i}><FileText size={13}/>{file.name}<button onClick={() => setAttachments(prev => prev.filter((_,j) => j !== i))}><X size={12}/></button></span>)}</div>}
            <textarea value={prompt} disabled={isSending} onChange={e => setPrompt(e.target.value)} onKeyDown={e => {if(e.key === 'Enter' && !e.shiftKey){e.preventDefault();sendMessage();}}} placeholder="Message NHK AI..." rows={1}/>
            <div className="composer-tools"><div className="tool-left"><input ref={fileRef} type="file" multiple onChange={addFiles} hidden/><button className="tool-btn" onClick={() => fileRef.current?.click()}><Paperclip size={16}/> <span>Attach</span></button><span className="tool-divider"/><span className="composer-hint">Shift + Enter for new line</span></div><div className="tool-right"><button className="tool-btn voice-btn" title="Voice input is coming soon"><AudioLines size={17}/></button><button className="send-btn" onClick={() => sendMessage()} disabled={isSending || (!prompt.trim() && attachments.length === 0)} aria-label="Send message">{isSending ? <span className="send-spinner"/> : <ArrowUp size={18}/>}</button></div></div>
          </div>
          <div className="disclaimer">NHK AI can make mistakes. Check important information. <span>·</span> Built for curious minds.</div>
        </footer>
      </main>

      {settingsOpen && <div className="modal-backdrop" onClick={() => setSettingsOpen(false)}><section className="settings-modal" onClick={e => e.stopPropagation()}><div className="modal-head"><div><span className="modal-kicker">WORKSPACE</span><h2>Preferences</h2></div><button className="icon-btn" onClick={() => setSettingsOpen(false)}><X size={18}/></button></div><div className="setting-row"><div><strong>Default model</strong><small>Choose the assistant style for new chats.</small></div><select value={model} onChange={e => setModel(e.target.value)}><option>NHK Smart</option><option>NHK Creative</option><option>NHK Code</option></select></div><div className="setting-row"><div><strong>Conversation storage</strong><small>Chats are currently saved locally in this browser.</small></div><span className="status-pill"><span/> On device</span></div><div className="settings-info"><Sparkles size={16}/><p>AI requests are sent through the secure NHK AI server. Your API key stays on the server and is never sent to this browser.</p></div><button className="modal-done" onClick={() => setSettingsOpen(false)}>Done</button></section></div>}
    </div>
  );
}