import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, User, Edit2, Trash2, ChevronRight, Loader2 } from 'lucide-react';
import { Button, Input } from '../components/ui';
import { peopleAPI } from '../services/api';

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
                <h2 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark mb-4">
                    Renombrar persona
                </h2>
                <Input
                    label="Nombre"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Ej: Mario, Ángel, Ana..."
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && handleSave()}
                />
                <div className="flex gap-3 mt-4">
                    <button
                        onClick={onCancel}
                        className="flex-1 py-3 rounded-xl border-2 border-border-light dark:border-border-dark font-semibold text-text-primary-light dark:text-text-primary-dark hover:border-primary transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || !name.trim()}
                        className="flex-1 py-3 rounded-xl bg-primary hover:bg-primary-hover text-white font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                        Guardar
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────
function DeletePersonModal({ person, onConfirm, onCancel, isDeleting }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
            <div className="relative z-10 bg-surface-light dark:bg-surface-dark rounded-2xl shadow-xl p-6 w-full max-w-sm border border-border-light dark:border-border-dark text-center">
                <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-3">
                    <Trash2 size={22} className="text-red-500" />
                </div>
                <h2 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark">
                    ¿Eliminar a {person?.name}?
                </h2>
                <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mt-1 mb-4">
                    Se eliminará la persona y todas sus detecciones en memorias.
                </p>
                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        disabled={isDeleting}
                        className="flex-1 py-3 rounded-xl border-2 border-border-light dark:border-border-dark font-semibold text-text-primary-light dark:text-text-primary-dark hover:border-primary transition-colors disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isDeleting}
                        className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isDeleting ? <Loader2 size={16} className="animate-spin" /> : null}
                        Eliminar
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Person Card ──────────────────────────────────────────────────────────────
function PersonCard({ person, onRename, onDelete, onClick }) {
    const isUnknown = person.name?.startsWith('Unknown Person');

    return (
        <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-border-light dark:border-border-dark p-4 flex items-center gap-4 hover:shadow-md transition-shadow">
            {/* Avatar */}
            <div
                className="w-14 h-14 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center flex-shrink-0 cursor-pointer"
                onClick={onClick}
            >
                {person.thumbnail_url ? (
                    <img src={person.thumbnail_url} alt={person.name} className="w-full h-full object-cover" />
                ) : (
                    <User size={24} className="text-primary" />
                )}
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
                <button
                    onClick={() => onRename(person)}
                    className="p-2 hover:bg-primary/10 rounded-lg transition-colors text-primary"
                    title="Renombrar"
                >
                    <Edit2 size={16} />
                </button>
                <button
                    onClick={() => onDelete(person)}
                    className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-colors text-red-500"
                    title="Eliminar"
                >
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
        const fetch = async () => {
            try {
                const data = await peopleAPI.getMemories(person.id);
                setMemories(data?.memories || data || []);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetch();
    }, [person.id]);

    return (
        <div className="space-y-4">
            {/* Sub-header */}
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
                <div className="flex justify-center py-12">
                    <Loader2 size={32} className="animate-spin text-primary" />
                </div>
            ) : memories.length === 0 ? (
                <div className="text-center py-12 text-text-secondary-light dark:text-text-secondary-dark">
                    <p className="text-3xl mb-2">📸</p>
                    <p className="font-medium">Sin memorias asociadas</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {memories.map(m => (
                        <div
                            key={m.id}
                            onClick={() => onMemoryClick(m.id)}
                            className="cursor-pointer rounded-xl overflow-hidden border border-border-light dark:border-border-dark hover:shadow-md transition-shadow"
                        >
                            <img
                                src={m.thumbnail_url || m.image_url}
                                alt=""
                                className="w-full h-28 object-cover"
                            />
                            <div className="p-2">
                                <p className="text-xs text-text-primary-light dark:text-text-primary-dark line-clamp-2">
                                    {m.description_raw?.substring(0, 60) || 'Sin descripción'}
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
    const [selectedPerson, setSelectedPerson] = useState(null); // person to show memories of
    const [renamingPerson, setRenamingPerson] = useState(null);
    const [deletingPerson, setDeletingPerson] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchPeople = async () => {
        try {
            setLoading(true);
            const data = await peopleAPI.getAll();
            setPeople(data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchPeople(); }, []);

    const handleRename = async (newName) => {
        try {
            await peopleAPI.rename(renamingPerson.id, newName);
            setPeople(prev => prev.map(p => p.id === renamingPerson.id ? { ...p, name: newName } : p));
            setRenamingPerson(null);
        } catch (e) {
            console.error(e);
        }
    };

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            await peopleAPI.delete(deletingPerson.id);
            setPeople(prev => prev.filter(p => p.id !== deletingPerson.id));
            setDeletingPerson(null);
            if (selectedPerson?.id === deletingPerson.id) setSelectedPerson(null);
        } catch (e) {
            console.error(e);
        } finally {
            setIsDeleting(false);
        }
    };

    const named = people.filter(p => !p.name?.startsWith('Unknown Person'));
    const unknown = people.filter(p => p.name?.startsWith('Unknown Person'));

    return (
        <>
            <div className="min-h-[calc(100vh-80px)] bg-background-light dark:bg-background-dark pb-8">
                {/* Header */}
                <div className="bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark px-6 py-4">
                    <div className="max-w-4xl mx-auto flex items-center justify-between">
                        <button
                            onClick={() => navigate('/')}
                            className="flex items-center gap-2 text-text-primary-light dark:text-text-primary-dark hover:text-primary transition-colors"
                        >
                            <ChevronLeft size={20} />
                            <span className="font-medium">Volver</span>
                        </button>
                        <h1 className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark">
                            👥 Personas
                        </h1>
                        <div className="w-20" />
                    </div>
                </div>

                <div className="max-w-4xl mx-auto px-6 mt-6">
                    {loading ? (
                        <div className="flex justify-center py-16">
                            <Loader2 size={36} className="animate-spin text-primary" />
                        </div>
                    ) : people.length === 0 ? (
                        <div className="text-center py-16 text-text-secondary-light dark:text-text-secondary-dark">
                            <p className="text-5xl mb-4">👤</p>
                            <p className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark">
                                Aún no hay personas reconocidas
                            </p>
                            <p className="text-sm mt-2">
                                Sube una memoria con personas para que la IA las detecte automáticamente.
                            </p>
                        </div>
                    ) : selectedPerson ? (
                        <PersonMemories
                            person={selectedPerson}
                            onBack={() => setSelectedPerson(null)}
                            onMemoryClick={id => navigate(`/memory/${id}`)}
                        />
                    ) : (
                        <div className="space-y-6">
                            {/* Named */}
                            {named.length > 0 && (
                                <div className="space-y-3">
                                    <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark">
                                        Reconocidas ({named.length})
                                    </h2>
                                    <div className="space-y-2">
                                        {named.map(p => (
                                            <PersonCard
                                                key={p.id}
                                                person={p}
                                                onRename={setRenamingPerson}
                                                onDelete={setDeletingPerson}
                                                onClick={() => setSelectedPerson(p)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Unknown */}
                            {unknown.length > 0 && (
                                <div className="space-y-3">
                                    <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark">
                                        Sin nombre ({unknown.length})
                                    </h2>
                                    <div className="space-y-2">
                                        {unknown.map(p => (
                                            <PersonCard
                                                key={p.id}
                                                person={p}
                                                onRename={setRenamingPerson}
                                                onDelete={setDeletingPerson}
                                                onClick={() => setSelectedPerson(p)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Rename Modal */}
            {renamingPerson && (
                <RenameModal
                    person={renamingPerson}
                    onSave={handleRename}
                    onCancel={() => setRenamingPerson(null)}
                />
            )}

            {/* Delete Modal */}
            {deletingPerson && (
                <DeletePersonModal
                    person={deletingPerson}
                    onConfirm={handleDelete}
                    onCancel={() => setDeletingPerson(null)}
                    isDeleting={isDeleting}
                />
            )}
        </>
    );
}
