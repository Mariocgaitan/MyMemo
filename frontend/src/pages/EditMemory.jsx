import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Loader2, Save } from 'lucide-react';
import { Button, Input, Textarea, Chip } from '../components/ui';
import { memoryAPI } from '../services/api';

const INITIAL_CATEGORIES = [
    { id: 'cat_1', label: 'GeitanVida', value: 'geitanvida' },
    { id: 'cat_2', label: 'ComidaBienRica', value: 'comidabienrica' },
    { id: 'cat_3', label: 'ConLasGuarras', value: 'conlasguarras' },
    { id: 'cat_4', label: 'Onichans', value: 'onichans' },
    { id: 'cat_5', label: 'Fititit', value: 'fititit' },
    { id: 'cat_6', label: 'Aestetik?', value: 'aestetik' },
    { id: 'cat_7', label: 'NerdBoy', value: 'nerdboy' },
    { id: 'cat_8', label: 'Famituki', value: 'famituki' },
];

export default function EditMemory() {
    const navigate = useNavigate();
    const { id } = useParams();

    const [memory, setMemory] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const [description, setDescription] = useState('');
    const [locationName, setLocationName] = useState('');
    const [selectedCategories, setSelectedCategories] = useState([]);

    // Load memory data
    useEffect(() => {
        const load = async () => {
            try {
                const data = await memoryAPI.getById(id);
                setMemory(data);
                setDescription(data.description_raw || '');
                setLocationName(data.location_name || '');
                // Parse current categories from ai_metadata
                const meta = data.ai_metadata || {};
                const existingCats = [
                    ...(meta.user_categories || []),
                    ...(meta.nlp?.themes || []),
                ];
                // Match against INITIAL_CATEGORIES by value
                const matched = INITIAL_CATEGORIES
                    .filter(c => existingCats.includes(c.value) || existingCats.includes(c.label))
                    .map(c => c.value);
                setSelectedCategories(matched);
            } catch (e) {
                setError('No se pudo cargar el recuerdo');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id]);

    const toggleCategory = (value) => {
        setSelectedCategories(prev =>
            prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
        );
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!description.trim()) return;
        setSaving(true);
        setError('');
        try {
            await memoryAPI.update(id, {
                description: description.trim(),
                location_name: locationName.trim() || undefined,
                categories: selectedCategories.join(','),
            });
            setSuccess(true);
            // Navigate back to detail after brief success feedback
            setTimeout(() => navigate(`/memory/${id}`), 800);
        } catch (err) {
            setError(err.response?.data?.detail || 'Error al guardar los cambios.');
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-[calc(100vh-80px)] flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent" />
                    <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">Cargando recuerdo...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-[calc(100vh-80px)] bg-background-light dark:bg-background-dark">
            {/* Header */}
            <div className="bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark px-6 py-4">
                <div className="max-w-2xl mx-auto flex items-center justify-between">
                    <button
                        onClick={() => navigate(`/memory/${id}`)}
                        className="flex items-center gap-2 text-text-primary-light dark:text-text-primary-dark hover:text-primary transition-colors"
                    >
                        <ChevronLeft size={20} />
                        <span className="font-medium">Cancelar</span>
                    </button>
                    <h1 className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark">
                        Editar recuerdo
                    </h1>
                    <div className="w-24" />
                </div>
            </div>

            <div className="max-w-2xl mx-auto px-6 mt-6 pb-8">
                {/* Preview image */}
                {memory?.thumbnail_url || memory?.image_url ? (
                    <div className="aspect-[3/2] rounded-2xl overflow-hidden shadow-card mb-6">
                        <img
                            src={memory.thumbnail_url || memory.image_url}
                            alt="Recuerdo"
                            className="w-full h-full object-cover opacity-80"
                        />
                    </div>
                ) : null}

                <form onSubmit={handleSave} className="space-y-5">
                    {/* Description */}
                    <Textarea
                        label="Descripcion"
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="¿Que paso en este momento?"
                        rows={4}
                        required
                    />

                    {/* Location */}
                    <Input
                        label="Nombre del lugar"
                        value={locationName}
                        onChange={e => setLocationName(e.target.value)}
                        placeholder="Ej: Parque Mexico, Cafe Tacuba..."
                    />

                    {/* Categories */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
                            Categorias
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {INITIAL_CATEGORIES.map(cat => (
                                <Chip
                                    key={cat.id}
                                    selected={selectedCategories.includes(cat.value)}
                                    onClick={() => toggleCategory(cat.value)}
                                >
                                    {cat.label}
                                </Chip>
                            ))}
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-xl p-4">
                            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                        </div>
                    )}

                    {/* Submit */}
                    <Button
                        type="submit"
                        fullWidth
                        size="lg"
                        disabled={!description.trim() || saving || success}
                    >
                        {success ? (
                            '✅ Guardado'
                        ) : saving ? (
                            <span className="flex items-center gap-2 justify-center">
                                <Loader2 size={18} className="animate-spin" /> Guardando...
                            </span>
                        ) : (
                            <span className="flex items-center gap-2 justify-center">
                                <Save size={18} /> Guardar cambios
                            </span>
                        )}
                    </Button>
                </form>
            </div>
        </div>
    );
}
