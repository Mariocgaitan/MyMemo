import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, User, Edit2, Trash2, ChevronRight, Loader2, GitMerge, Link2, Unlink, Check, X, UserPlus } from 'lucide-react';
import { Input } from '../components/ui';
import { peopleAPI, connectionsAPI } from '../services/api';

// ─── Rename Modal ──────────────────────────────────────────────────────────────
function RenameModal({ person, onSave, onCancel }) {
    const [name, setName] = useState(person?.name || '');
    const [saving, setSaving] = useState(false);
    const handleSave = async () => {
        if (!name.trim()) return;
        setSaving(true);
        await onSave(name.trim());
        setSaving(false);
    };
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
            <div className="relative z-10 bg-surface-light dark:bg-surface-dark rounded-2xl shadow-xl p-6 w-full max-w-sm border border-border-light dark:border-border-dark">
                <h2 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark mb-4">Renombrar persona</h2>
                <Input label="Nombre" value={name} onChange={e => setName(e.target.value)}
                    placeholder="Ej: Mario, Angel, Ana..." autoFocus onKeyDown={e => e.key === 'Enter' && handleSave()} />
                <div className="flex gap-3 mt-4">
                    <button onClick={onCancel}
                        className="flex-1 py-3 rounded-xl border-2 border-border-light dark:border-border-dark font-semibold text-text-primary-light dark:text-text-primary-dark hover:border-primary transition-colors">
                        Cancelar
                    </button>
                    <button onClick={handleSave} disabled={saving || !name.trim()}
                        className="flex-1 py-3 rounded-xl bg-primary hover:bg-primary-hover text-white font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                        {saving && <Loader2 size={16} className="animate-spin" />} Guardar
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────
function DeletePersonModal({ person, onConfirm, onCancel, isDeleting }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
            <div className="relative z-10 bg-surface-light dark:bg-surface-dark rounded-2xl shadow-xl p-6 w-full max-w-sm border border-border-light dark:border-border-dark text-center">
                <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-3">
                    <Trash2 size={22} className="text-red-500" />
                </div>
                <h2 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark">
                    ¿Eliminar a {person?.name?.startsWith('Unknown') ? 'persona desconocida' : person?.name}?
                </h2>
                <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mt-1 mb-4">
                    Se eliminará la persona y todas sus detecciones en memorias.
                </p>
                <div className="flex gap-3">
                    <button onClick={onCancel} disabled={isDeleting}
                        className="flex-1 py-3 rounded-xl border-2 border-border-light dark:border-border-dark font-semibold text-text-primary-light dark:text-text-primary-dark hover:border-primary transition-colors disabled:opacity-50">
                        Cancelar
                    </button>
                    <button onClick={onConfirm} disabled={isDeleting}
                        className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                        {isDeleting && <Loader2 size={16} className="animate-spin" />} Eliminar
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Merge Modal ──────────────────────────────────────────────────────────────
function MergeModal({ sourcePerson, allPeople, onConfirm, onCancel, isMerging }) {
    const [targetId, setTargetId] = useState('');
    // Exclude source person from targets
    const targets = allPeople.filter(p => p.id !== sourcePerson.id);
    const sourceName = sourcePerson.name?.startsWith('Unknown') ? 'Persona desconocida' : sourcePerson.name;
    const targetPerson = targets.find(p => p.id === targetId);
    const targetName = targetPerson
        ? (targetPerson.name?.startsWith('Unknown') ? 'Persona desconocida' : targetPerson.name)
        : null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
            <div className="relative z-10 bg-surface-light dark:bg-surface-dark rounded-2xl shadow-xl p-6 w-full max-w-sm border border-border-light dark:border-border-dark">
                {/* Icon */}
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <GitMerge size={24} className="text-primary" />
                </div>

                <h2 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark text-center mb-1">
                    Fusionar persona
                </h2>
                <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark text-center mb-5">
                    <span className="font-semibold text-text-primary-light dark:text-text-primary-dark">{sourceName}</span> se fusionará en la persona que elijas. Sus memorias quedarán bajo esa persona.
                </p>

                {/* Target selector */}
                <label className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark mb-2">
                    Fusionar en:
                </label>
                <select
                    value={targetId}
                    onChange={e => setTargetId(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border-2 border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-text-primary-light dark:text-text-primary-dark focus:border-primary focus:outline-none transition-colors"
                >
                    <option value="">-- Selecciona una persona --</option>
                    {targets.map(p => (
                        <option key={p.id} value={p.id}>
                            {p.name?.startsWith('Unknown') ? 'Persona desconocida' : p.name}
                            {p.face_count ? ` (${p.face_count} apariciones)` : ''}
                        </option>
                    ))}
                </select>

                {/* Preview */}
                {targetName && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-text-secondary-light dark:text-text-secondary-dark bg-primary/5 rounded-xl px-4 py-2">
                        <GitMerge size={14} className="text-primary flex-shrink-0" />
                        <span><b>{sourceName}</b> → <b>{targetName}</b></span>
                    </div>
                )}

                <div className="flex gap-3 mt-5">
                    <button onClick={onCancel}
                        className="flex-1 py-3 rounded-xl border-2 border-border-light dark:border-border-dark font-semibold text-text-primary-light dark:text-text-primary-dark hover:border-primary transition-colors">
                        Cancelar
                    </button>
                    <button onClick={() => onConfirm(targetId)} disabled={!targetId || isMerging}
                        className="flex-1 py-3 rounded-xl bg-primary hover:bg-primary-hover text-white font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                        {isMerging && <Loader2 size={16} className="animate-spin" />}
                        Fusionar
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Link Modal (send connection request) ─────────────────────────────────────
function LinkModal({ initialPerson, allPeople, onSend, onCancel }) {
    const [username, setUsername] = useState('');
    const [personId, setPersonId] = useState(initialPerson?.id || '');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');

    const handleSend = async () => {
        if (!username.trim()) return;
        setSending(true);
        setError('');
        try {
            await onSend(username.trim(), personId || null);
        } catch (e) {
            setError(e?.response?.data?.detail || 'No se encontró ese usuario');
            setSending(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
            <div className="relative z-10 bg-surface-light dark:bg-surface-dark rounded-2xl shadow-xl p-6 w-full max-w-sm border border-border-light dark:border-border-dark">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Link2 size={24} className="text-primary" />
                </div>
                <h2 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark text-center mb-1">Vincular usuario</h2>
                <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark text-center mb-5">
                    Comparte recuerdos donde ambos aparecen.
                </p>

                <Input
                    label="Correo del usuario"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="Ej: diego@gmail.com"
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                />

                <label className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark mt-4 mb-2">
                    ¿Cuál cara es él/ella en tus fotos? (opcional)
                </label>
                <select
                    value={personId}
                    onChange={e => setPersonId(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border-2 border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-text-primary-light dark:text-text-primary-dark focus:border-primary focus:outline-none transition-colors"
                >
                    <option value="">-- No sé / lo asigno después --</option>
                    {allPeople.filter(p => !p.name?.startsWith('Unknown Person')).map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>

                {error && <p className="text-red-500 text-sm mt-3">{error}</p>}

                <div className="flex gap-3 mt-5">
                    <button onClick={onCancel}
                        className="flex-1 py-3 rounded-xl border-2 border-border-light dark:border-border-dark font-semibold text-text-primary-light dark:text-text-primary-dark hover:border-primary transition-colors">
                        Cancelar
                    </button>
                    <button onClick={handleSend} disabled={sending || !username.trim()}
                        className="flex-1 py-3 rounded-xl bg-primary hover:bg-primary-hover text-white font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                        {sending && <Loader2 size={16} className="animate-spin" />} Enviar
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Accept Modal ─────────────────────────────────────────────────────────────
function AcceptModal({ request, allPeople, onAccept, onCancel }) {
    const [personId, setPersonId] = useState('');
    const [accepting, setAccepting] = useState(false);
    const requesterName = request.requester?.name || 'Alguien';

    const handleAccept = async () => {
        setAccepting(true);
        try {
            await onAccept(request.id, personId || null);
        } finally {
            setAccepting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
            <div className="relative z-10 bg-surface-light dark:bg-surface-dark rounded-2xl shadow-xl p-6 w-full max-w-sm border border-border-light dark:border-border-dark">
                <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                    <UserPlus size={24} className="text-green-600 dark:text-green-400" />
                </div>
                <h2 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark text-center mb-1">
                    {requesterName} quiere vincularse
                </h2>
                <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark text-center mb-5">
                    Podrán ver los recuerdos del otro donde aparezcan.
                </p>

                <label className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark mb-2">
                    ¿Cuál cara es {requesterName} en tus fotos? (opcional)
                </label>
                <select
                    value={personId}
                    onChange={e => setPersonId(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border-2 border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-text-primary-light dark:text-text-primary-dark focus:border-primary focus:outline-none transition-colors"
                >
                    <option value="">-- No sé / lo asigno después --</option>
                    {allPeople.filter(p => !p.name?.startsWith('Unknown Person')).map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>

                <div className="flex gap-3 mt-5">
                    <button onClick={onCancel}
                        className="flex-1 py-3 rounded-xl border-2 border-border-light dark:border-border-dark font-semibold text-text-primary-light dark:text-text-primary-dark hover:border-primary transition-colors">
                        Rechazar
                    </button>
                    <button onClick={handleAccept} disabled={accepting}
                        className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                        {accepting && <Loader2 size={16} className="animate-spin" />} Aceptar
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Person Card ──────────────────────────────────────────────────────────────
function PersonCard({ person, allPeople, onRename, onDelete, onMerge, onLink, onClick }) {
    const isUnknown = person.name?.startsWith('Unknown Person');
    return (
        <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-border-light dark:border-border-dark p-4 flex items-center gap-4 hover:shadow-md transition-shadow">
            {/* Avatar */}
            <div className="w-14 h-14 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center flex-shrink-0 cursor-pointer" onClick={onClick}>
                {person.thumbnail_url
                    ? <img
                          src={person.thumbnail_url}
                          alt={person.name}
                          className="w-full h-full object-cover"
                          onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
                      />
                    : null}
                <User size={24} className="text-primary" style={{ display: person.thumbnail_url ? 'none' : 'flex' }} />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 cursor-pointer" onClick={onClick}>
                <p className={`font-semibold truncate ${isUnknown ? 'text-text-secondary-light dark:text-text-secondary-dark italic' : 'text-text-primary-light dark:text-text-primary-dark'}`}>
                    {isUnknown ? 'Persona desconocida' : person.name}
                </p>
                <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-0.5">
                    {person.face_count ?? person.memory_count ?? 0} aparición{(person.face_count ?? person.memory_count ?? 0) !== 1 ? 'es' : ''}
                </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 flex-shrink-0">
                {!isUnknown && (
                    <button onClick={() => onLink(person)}
                        className="p-2 hover:bg-primary/10 rounded-lg transition-colors text-primary" title="Vincular con usuario">
                        <Link2 size={16} />
                    </button>
                )}
                <button onClick={() => onRename(person)}
                    className="p-2 hover:bg-primary/10 rounded-lg transition-colors text-primary" title="Renombrar">
                    <Edit2 size={16} />
                </button>
                {allPeople.length > 1 && (
                    <button onClick={() => onMerge(person)}
                        className="p-2 hover:bg-primary/10 rounded-lg transition-colors text-primary" title="Fusionar con otra persona">
                        <GitMerge size={16} />
                    </button>
                )}
                <button onClick={() => onDelete(person)}
                    className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-colors text-red-500" title="Eliminar">
                    <Trash2 size={16} />
                </button>
                <ChevronRight size={16} className="text-text-secondary-light dark:text-text-secondary-dark ml-1 cursor-pointer" onClick={onClick} />
            </div>
        </div>
    );
}

// ─── Person Memories Panel ────────────────────────────────────────────────────
function PersonMemories({ person, onBack, onMemoryClick }) {
    const [memories, setMemories] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await peopleAPI.getMemories(person.id);
                setMemories(data?.memories || data || []);
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        load();
    }, [person.id]);

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <button onClick={onBack} className="flex items-center gap-1 text-primary text-sm font-medium hover:text-primary-hover transition-colors">
                    <ChevronLeft size={16} /> Personas
                </button>
                <span className="text-text-secondary-light dark:text-text-secondary-dark">·</span>
                <span className="font-semibold text-text-primary-light dark:text-text-primary-dark">
                    {person.name?.startsWith('Unknown') ? 'Persona desconocida' : person.name}
                </span>
            </div>
            {loading ? (
                <div className="flex justify-center py-12"><Loader2 size={32} className="animate-spin text-primary" /></div>
            ) : memories.length === 0 ? (
                <div className="text-center py-12 text-text-secondary-light dark:text-text-secondary-dark">
                <p className="text-3xl mb-2">—</p>
                    <p className="font-medium">Sin memorias asociadas</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {memories.map(m => (
                        <div key={m.id} onClick={() => onMemoryClick(m.id)}
                            className="cursor-pointer rounded-xl overflow-hidden border border-border-light dark:border-border-dark hover:shadow-md transition-shadow">
                            <img src={m.thumbnail_url || m.image_url} alt="" className="w-full h-28 object-cover" />
                            <div className="p-2">
                                <p className="text-xs text-text-primary-light dark:text-text-primary-dark line-clamp-2">
                                    {m.description_raw?.substring(0, 60) || 'Sin descripcion'}
                                </p>
                                <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-1">
                                    {new Date(m.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function People() {
    const navigate = useNavigate();
    const [people, setPeople] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedPerson, setSelectedPerson] = useState(null);
    const [renamingPerson, setRenamingPerson] = useState(null);
    const [deletingPerson, setDeletingPerson] = useState(null);
    const [mergingPerson, setMergingPerson] = useState(null);
    const [linkingPerson, setLinkingPerson] = useState(null);
    const [acceptingRequest, setAcceptingRequest] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isMerging, setIsMerging] = useState(false);
    const [connections, setConnections] = useState([]);
    const [pendingRequests, setPendingRequests] = useState([]);
    const [toast, setToast] = useState(null); // { type: 'success'|'error', msg: string }

    const fetchPeople = async () => {
        try {
            setLoading(true);
            const data = await peopleAPI.getAll();
            setPeople(data || []);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const fetchConnections = async () => {
        try {
            const [accepted, pending] = await Promise.all([
                connectionsAPI.list(),
                connectionsAPI.pending(),
            ]);
            setConnections(Array.isArray(accepted) ? accepted : []);
            setPendingRequests(Array.isArray(pending) ? pending : []);
        } catch (e) { console.error(e); }
    };

    useEffect(() => { fetchPeople(); fetchConnections(); }, []);

    const handleRename = async (newName) => {
        try {
            await peopleAPI.rename(renamingPerson.id, newName);
            setPeople(prev => prev.map(p => p.id === renamingPerson.id ? { ...p, name: newName } : p));
            setRenamingPerson(null);
        } catch (e) { console.error(e); }
    };

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            await peopleAPI.delete(deletingPerson.id);
            setPeople(prev => prev.filter(p => p.id !== deletingPerson.id));
            setDeletingPerson(null);
            if (selectedPerson?.id === deletingPerson.id) setSelectedPerson(null);
        } catch (e) { console.error(e); }
        finally { setIsDeleting(false); }
    };

    const handleMerge = async (targetId) => {
        if (!targetId) return;
        setIsMerging(true);
        try {
            await peopleAPI.merge(mergingPerson.id, targetId);
            setPeople(prev => prev.filter(p => p.id !== mergingPerson.id));
            setMergingPerson(null);
            if (selectedPerson?.id === mergingPerson.id) setSelectedPerson(null);
        } catch (e) { console.error(e); }
        finally { setIsMerging(false); }
    };

    const showToast = (type, msg) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 4000);
    };

    const handleSendLink = async (username, personId) => {
        // Let the error bubble up to LinkModal so it can show the message inline
        await connectionsAPI.send(username, personId);
        setLinkingPerson(null);
        showToast('success', `Solicitud enviada a @${username}`);
        await fetchConnections();
    };

    const handleAcceptRequest = async (connectionId, personId) => {
        await connectionsAPI.accept(connectionId, personId);
        setAcceptingRequest(null);
        showToast('success', 'Conexión aceptada ✨');
        window.dispatchEvent(new CustomEvent('connection-updated'));
        await fetchConnections();
    };

    const handleRejectRequest = async (connectionId) => {
        await connectionsAPI.reject(connectionId);
        setPendingRequests(prev => prev.filter(r => r.id !== connectionId));
        showToast('success', 'Solicitud rechazada');
        window.dispatchEvent(new CustomEvent('connection-updated'));
    };

    const handleDisconnect = async (connectionId) => {
        if (!window.confirm('¿Desvincular esta conexión?')) return;
        await connectionsAPI.remove(connectionId);
        setConnections(prev => prev.filter(c => c.id !== connectionId));
        showToast('success', 'Desvinculado');
    };

    const named = people.filter(p => !p.name?.startsWith('Unknown Person'));
    const unknown = people.filter(p => p.name?.startsWith('Unknown Person'));

    const renderSection = (list, title) => list.length > 0 && (
        <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark">
                {title} ({list.length})
            </h2>
            <div className="space-y-2">
                {list.map(p => (
                    <PersonCard
                        key={p.id}
                        person={p}
                        allPeople={people}
                        onRename={setRenamingPerson}
                        onDelete={setDeletingPerson}
                        onMerge={setMergingPerson}
                        onLink={setLinkingPerson}
                        onClick={() => setSelectedPerson(p)}
                    />
                ))}
            </div>
        </div>
    );

    return (
        <>
            {/* Toast notification */}
            {toast && (
                <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-2xl shadow-xl text-white text-sm font-semibold flex items-center gap-2 transition-all ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
                    {toast.type === 'success' ? '✅' : '❌'} {toast.msg}
                </div>
            )}
            <div className="min-h-[calc(100vh-80px)] bg-background-light dark:bg-background-dark pb-8">
                {/* Header */}
                <div className="bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark px-6 py-4">
                    <div className="max-w-4xl mx-auto flex items-center justify-between">
                        <button onClick={() => navigate('/')}
                            className="flex items-center gap-2 text-text-primary-light dark:text-text-primary-dark hover:text-primary transition-colors">
                            <ChevronLeft size={20} />
                            <span className="font-medium">Volver</span>
                        </button>
                        <h1 className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark">Personas</h1>
                        <div className="w-20" />
                    </div>
                </div>

                <div className="max-w-4xl mx-auto px-6 mt-6">
                    {loading ? (
                        <div className="flex justify-center py-16">
                            <Loader2 size={36} className="animate-spin text-primary" />
                        </div>
                    ) : selectedPerson ? (
                        <PersonMemories
                            person={selectedPerson}
                            onBack={() => setSelectedPerson(null)}
                            onMemoryClick={id => navigate(`/memory/${id}`)}
                        />
                    ) : (
                        <div className="space-y-6">
                            {/* Pending requests */}
                            {pendingRequests.length > 0 && (
                                <div className="space-y-3">
                                    <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark">
                                        Solicitudes pendientes ({pendingRequests.length})
                                    </h2>
                                    <div className="space-y-2">
                                        {pendingRequests.map(req => (
                                            <div key={req.id} className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-border-light dark:border-border-dark p-4 flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                                    <UserPlus size={18} className="text-primary" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-text-primary-light dark:text-text-primary-dark truncate">
                                                        {req.requester?.name || 'Usuario'}
                                                    </p>
                                                    <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">quiere vincularse contigo</p>
                                                </div>
                                                <button onClick={() => setAcceptingRequest(req)}
                                                    className="p-2 bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 rounded-lg transition-colors" title="Aceptar">
                                                    <Check size={16} className="text-green-600 dark:text-green-400" />
                                                </button>
                                                <button onClick={() => handleRejectRequest(req.id)}
                                                    className="p-2 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 rounded-lg transition-colors" title="Rechazar">
                                                    <X size={16} className="text-red-500" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Accepted connections */}
                            {connections.length > 0 && (
                                <div className="space-y-3">
                                    <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark">
                                        Compañeros de recuerdos ({connections.length})
                                    </h2>
                                    <div className="space-y-2">
                                        {connections.map(conn => {
                                            const partner = conn.requester?.id === conn.addressee?.id
                                                ? conn.requester
                                                : (conn.requester?.name ? conn.requester : conn.addressee);
                                            // Determine which side is the current user
                                            const partnerUser = conn.addressee;
                                            return (
                                                <div key={conn.id} className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-border-light dark:border-border-dark p-4 flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                                        <Link2 size={18} className="text-primary" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-semibold text-text-primary-light dark:text-text-primary-dark truncate">
                                                            {conn.requester?.name} &amp; {conn.addressee?.name}
                                                        </p>
                                                        <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">Recuerdos compartidos activos</p>
                                                    </div>
                                                    <button onClick={() => handleDisconnect(conn.id)}
                                                        className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Desvincular">
                                                        <Unlink size={16} className="text-red-500" />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {renderSection(named, 'Reconocidas')}
                            {renderSection(unknown, 'Sin nombre')}

                            {/* Empty state: only when no people AND no connections */}
                            {people.length === 0 && connections.length === 0 && pendingRequests.length === 0 && (
                                <div className="text-center py-16 text-text-secondary-light dark:text-text-secondary-dark">
                                    <User size={48} className="text-primary/30 mx-auto mb-4" />
                                    <p className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark">
                                        Aún no hay personas reconocidas
                                    </p>
                                    <p className="text-sm mt-2">Sube una memoria con personas para que la IA las detecte automáticamente.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {renamingPerson && (
                <RenameModal person={renamingPerson} onSave={handleRename} onCancel={() => setRenamingPerson(null)} />
            )}
            {deletingPerson && (
                <DeletePersonModal person={deletingPerson} onConfirm={handleDelete}
                    onCancel={() => setDeletingPerson(null)} isDeleting={isDeleting} />
            )}
            {mergingPerson && (
                <MergeModal
                    sourcePerson={mergingPerson}
                    allPeople={people}
                    onConfirm={handleMerge}
                    onCancel={() => setMergingPerson(null)}
                    isMerging={isMerging}
                />
            )}
            {linkingPerson && (
                <LinkModal
                    initialPerson={linkingPerson}
                    allPeople={people}
                    onSend={handleSendLink}
                    onCancel={() => setLinkingPerson(null)}
                />
            )}
            {acceptingRequest && (
                <AcceptModal
                    request={acceptingRequest}
                    allPeople={people}
                    onAccept={handleAcceptRequest}
                    onCancel={() => setAcceptingRequest(null)}
                />
            )}
        </>
    );
}
