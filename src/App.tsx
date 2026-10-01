import { FormEvent, KeyboardEvent, useMemo, useState } from 'react'
import {
  AlertCircle, ArrowLeft, ArrowRight, Check, CheckCheck, CircleHelp,
  Download, FileText, Link2, LogOut, Moon, Paperclip, Plus, Send,
  ShieldAlert, Sparkles, Sun, UploadCloud, Users, X, Zap,
} from 'lucide-react'

type Page = 'home' | 'create' | 'join' | 'workspace'
type Toast = { type: 'success' | 'error'; title: string; message: string }
type Message = { id: number; author: string; text: string; time: string; own?: boolean; system?: boolean }

const initialMessages: Message[] = [
  { id: 1, author: 'SYSTEM', text: 'You joined the Prosperity study terminal.', time: '09:41', system: true },
  { id: 2, author: 'Maya Chen', text: 'I uploaded the practice set for today. The probability section is worth a second look.', time: '09:44' },
  { id: 3, author: 'You', text: 'Perfect, thanks. I will work through questions 4-8 and share my notes here.', time: '09:46', own: true },
]

function GlassCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`glass-card ${className}`}>{children}</section>
}

function ThemeToggle({ dark, onToggle }: { dark: boolean; onToggle: () => void }) {
  return <button className="icon-button" onClick={onToggle} aria-label={dark ? 'Use light theme' : 'Use dark theme'} title={dark ? 'Light theme' : 'Dark theme'}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
}

function BrandHeader({ page, dark, onToggle, onLeave }: { page: Page; dark: boolean; onToggle: () => void; onLeave?: () => void }) {
  const workspace = page === 'workspace'
  return <header className={`brand-header ${workspace ? 'workspace-header' : ''}`}>
    <div className="brand-lockup"><div className="brand-mark"><Zap size={19} fill="currentColor" /></div><div><div className="brand-name">PROSPERITY</div><div className="brand-subtitle">TERMINAL WORKSPACE</div></div></div>
    <div className="header-actions">{workspace && <><div className="connection"><span className="status-dot" /> <span>Connected to <strong>Focus Room</strong></span></div><button className="button button-ghost leave-button" onClick={onLeave}><LogOut size={15} /> Leave</button></>}<ThemeToggle dark={dark} onToggle={onToggle} /></div>
  </header>
}

function ToastView({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  return <div className={`toast toast-${toast.type}`} role="status"><div className="toast-icon">{toast.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}</div><div><strong>{toast.title}</strong><p>{toast.message}</p></div><button className="toast-close" onClick={onClose} aria-label="Dismiss notification"><X size={15} /></button></div>
}

function Home({ navigate }: { navigate: (page: Page) => void }) {
  return <main className="home-page page-enter"><div className="home-intro"><div className="announcement"><Sparkles size={14} /> A calmer way to collaborate</div><h1>Welcome to the <span>Workspace</span></h1><p>Choose how you want to continue.</p></div><div className="choice-grid">
    <button className="choice-card" onClick={() => navigate('join')}><div className="choice-icon"><Link2 size={23} /></div><div className="choice-copy"><div className="micro-label">ACCESS A ROOM</div><h2>Join Existing Terminal</h2><p>Connect to a friend's workspace with the credentials they shared with you.</p><div className="choice-action">Enter credentials <ArrowRight size={16} /></div></div></button>
    <button className="choice-card" onClick={() => navigate('create')}><div className="choice-icon choice-icon-blue"><Plus size={23} /></div><div className="choice-copy"><div className="micro-label">START A ROOM</div><h2>Create New Terminal</h2><p>Open a private workspace and invite your study group to join you.</p><div className="choice-action">Set it up <ArrowRight size={16} /></div></div></button>
  </div><div className="home-footer"><span /> Create a room <b>{'->'}</b> Share access <b>{'->'}</b> Collaborate <b>{'->'}</b> Upload <b>{'->'}</b> Chat <b>{'->'}</b> Finish <span /></div></main>
}

function FormField({ label, value, onChange, type = 'text', placeholder, autoComplete }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder: string; autoComplete?: string }) {
  return <label className="form-field"><span>{label}</span><input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} autoComplete={autoComplete} /></label>
}

function PasswordChecks({ password }: { password: string }) {
  const checks = [{ text: 'At least 6 characters', valid: password.length >= 6 }, { text: 'One uppercase character', valid: /[A-Z]/.test(password) }, { text: 'One numeric value', valid: /\d/.test(password) }]
  return <div className="requirements"><div className="micro-label">PASSWORD REQUIREMENTS</div>{checks.map(check => <div className={check.valid ? 'requirement valid' : 'requirement'} key={check.text}>{check.valid ? <Check size={14} /> : <X size={14} />}<span>{check.text}</span></div>)}</div>
}

function FormPage({ mode, navigate, notify }: { mode: 'create' | 'join'; navigate: (page: Page) => void; notify: (toast: Toast) => void }) {
  const create = mode === 'create'
  const [username, setUsername] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const validPassword = password.length >= 6 && /[A-Z]/.test(password) && /\d/.test(password)
  const valid = create ? Boolean(username.trim() && name.trim() && validPassword && password === confirm) : Boolean(username.trim() && password.trim())
  const submit = (event: FormEvent) => { event.preventDefault(); if (!valid || loading) return; setLoading(true); window.setTimeout(() => { setLoading(false); notify({ type: 'success', title: create ? 'Terminal created' : 'Connected successfully', message: create ? 'Your private room is ready to share.' : `Welcome to Focus Room${displayName ? `, ${displayName}` : ''}.` }); navigate('workspace') }, 900) }
  return <main className="form-page page-enter"><button className="back-link" onClick={() => navigate('home')}><ArrowLeft size={16} /> Back to home</button><GlassCard className="form-card"><div className={`form-icon ${create ? 'choice-icon-blue' : ''}`}>{create ? <Plus size={25} /> : <Link2 size={25} />}</div><div className="form-heading"><div className="micro-label">{create ? 'NEW PRIVATE ROOM' : 'INVITED ACCESS'}</div><h1>{create ? 'Create New Terminal' : 'Join Existing Terminal'}</h1><p>{create ? 'Your username and password become shared access credentials for your group.' : 'Enter the credentials shared by the owner of the terminal.'}</p></div><form onSubmit={submit}>
    <div className="form-grid">{create ? <><FormField label="Username" value={username} onChange={setUsername} placeholder="e.g. study-group" autoComplete="username" /><FormField label="Terminal name" value={name} onChange={setName} placeholder="e.g. Focus Room" /></> : <FormField label="Terminal username" value={username} onChange={setUsername} placeholder="Enter terminal username" autoComplete="username" />}<FormField label={create ? 'Password' : 'Terminal password'} value={password} onChange={setPassword} type="password" placeholder="Enter password" autoComplete="current-password" />{create ? <FormField label="Confirm password" value={confirm} onChange={setConfirm} type="password" placeholder="Repeat password" autoComplete="new-password" /> : <FormField label="Your display name (optional)" value={displayName} onChange={setDisplayName} placeholder="How should others see you?" />}</div>
    {create && <><PasswordChecks password={password} />{confirm && password !== confirm && <div className="field-error"><AlertCircle size={15} /> Passwords do not match yet.</div>}</>}{!create && <div className="form-hint"><CircleHelp size={15} /> Credentials are case-sensitive. Ask the owner if you need a fresh invite.</div>}<button className="button button-primary submit-button" disabled={!valid || loading}>{loading ? <><span className="spinner" /> {create ? 'Creating terminal...' : 'Verifying credentials...'}</> : <>{create ? 'Create terminal' : 'Connect to terminal'} <ArrowRight size={17} /></>}</button>
  </form>{create && <div className="form-note">Your room stays private. Share credentials only with people you trust.</div>}{!create && <button className="alternate-action" onClick={() => navigate('create')}>Need your own room? <strong>Create a new terminal</strong></button>}</GlassCard></main>
}

function MessageBubble({ message }: { message: Message }) {
  if (message.system) return <div className="system-message"><span />{message.text}<span /></div>
  return <div className={`message-row ${message.own ? 'own' : ''}`}><div className="message-bubble"><div className="message-meta"><strong>{message.author}</strong><span>{message.time}</span></div><p>{message.text}</p>{message.own && <CheckCheck size={14} className="read-mark" />}</div></div>
}

function Workspace({ navigate, notify }: { navigate: (page: Page) => void; notify: (toast: Toast) => void }) {
  const [messages, setMessages] = useState(initialMessages)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [attached, setAttached] = useState(false)
  const members = useMemo(() => [{ name: 'Maya Chen', initials: 'MC', status: 'online', owner: true }, { name: 'You', initials: 'YO', status: 'online' }, { name: 'Alex Rivera', initials: 'AR', status: 'offline' }], [])
  const send = () => { if (!draft.trim() || sending) return; setSending(true); const text = draft.trim(); setDraft(''); window.setTimeout(() => { setMessages(current => [...current, { id: Date.now(), author: 'You', text, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), own: true }]); setSending(false) }, 450) }
  const keyDown = (event: KeyboardEvent<HTMLInputElement>) => { if (event.key === 'Enter') send() }
  return <main className="workspace-page page-enter"><div className="workspace-welcome"><div><div className="micro-label">PRIVATE COLLABORATION ROOM</div><h1>Focus Room</h1></div><div className="workspace-caption">A shared place to think clearly.</div></div><div className="workspace-grid"><GlassCard className="chat-panel"><div className="panel-heading"><div><div className="micro-label">SHARED CHAT</div><h2>Room conversation</h2></div><span className="message-count">{messages.length} messages</span></div><div className="messages">{messages.map(message => <MessageBubble message={message} key={message.id} />)}</div><div className="composer"><button className={`icon-button composer-action ${attached ? 'active' : ''}`} onClick={() => { setAttached(!attached); notify({ type: 'success', title: attached ? 'Attachment removed' : 'Ready to attach', message: attached ? 'The attachment was removed.' : 'Choose a file to share with the room.' }) }} aria-label="Attach a file" title="Attach a file"><Paperclip size={18} /></button><input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={keyDown} placeholder="Share a message, note or practical data..." aria-label="Message" /><button className="send-button" onClick={send} disabled={!draft.trim() || sending} aria-label="Send message" title="Send message">{sending ? <span className="spinner spinner-dark" /> : <Send size={17} />}</button></div>{attached && <div className="attachment-chip"><FileText size={14} /> practice-set.pdf <button onClick={() => setAttached(false)} aria-label="Remove attachment"><X size={13} /></button></div>}</GlassCard><aside className="sidebar"><GlassCard className="side-panel"><div className="panel-heading compact"><div className="side-title"><Users size={17} /><div className="micro-label">CONNECTED USERS</div></div><span className="online-count">2 online</span></div><div className="member-list">{members.map(member => <div className="member" key={member.name}><div className="avatar">{member.initials}</div><div className="member-name"><strong>{member.name}</strong>{member.owner && <span className="owner-badge">OWNER</span>}</div><span className={`member-status ${member.status}`}>{member.status === 'online' ? 'Online' : 'Away'}</span></div>)}</div></GlassCard><GlassCard className="side-panel files-panel"><div className="panel-heading compact"><div className="side-title"><FileText size={17} /><div className="micro-label">SHARED FILES</div></div><button className="mini-icon" aria-label="Upload a file" title="Upload a file"><UploadCloud size={15} /></button></div><div className="file-row"><div className="file-icon"><FileText size={17} /></div><div className="file-info"><strong>practice-set.pdf</strong><span>2.4 MB · Maya Chen</span></div><button className="mini-icon" aria-label="Download practice-set.pdf" title="Download"><Download size={15} /></button></div><div className="file-row"><div className="file-icon"><FileText size={17} /></div><div className="file-info"><strong>week-03-notes.docx</strong><span>816 KB · You</span></div><button className="mini-icon" aria-label="Download week-03-notes.docx" title="Download"><Download size={15} /></button></div></GlassCard><GlassCard className="side-panel credential-panel"><div className="credential-mark"><ShieldAlert size={16} /></div><div><div className="micro-label">INVITE SOMEONE</div><p>Share the terminal username and password with friends you trust. Anyone with access can see this room.</p></div></GlassCard></aside></div><button className="workspace-leave" onClick={() => navigate('home')}><LogOut size={15} /> Leave Focus Room</button></main>
}

export default function App() {
  const [page, setPage] = useState<Page>('home')
  const [dark, setDark] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
  const navigate = (next: Page) => setPage(next)
  const notify = (next: Toast) => { setToast(next); window.setTimeout(() => setToast(null), 4200) }
  return <div className={dark ? 'app dark' : 'app'}><div className="ambient ambient-one" /><div className="ambient ambient-two" /><div className="app-shell"><BrandHeader page={page} dark={dark} onToggle={() => setDark(!dark)} onLeave={() => navigate('home')} />{page === 'home' && <Home navigate={navigate} />}{(page === 'create' || page === 'join') && <FormPage mode={page} navigate={navigate} notify={notify} />}{page === 'workspace' && <Workspace navigate={navigate} notify={notify} />}</div>{toast && <ToastView toast={toast} onClose={() => setToast(null)} />}</div>
}
