import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Loader2, Save, Plus, X, MapPin } from 'lucide-react';
import { Button, Input, Textarea, Chip } from '../components/ui';
import { memoryAPI, categoriesAPI } from '../services/api';
import LocationPickerModal from '../components/LocationPickerModal';

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
    const [categories, setCategories] = useState([]);
    const [addingCat, setAddingCat] = useState(false);
    const [newCatLabel, setNewCatLabel] = useState('');
    const [showLocationPicker, setShowLocationPicker] = useState(false);
    const [latitude, setLatitude] = useState(null);
    const [longitude, setLongitude] = useState(null);

    // Load categories from API
    useEffect(() => {
        categoriesAPI.getAll().then(cats => {
            if (cats && cats.length) setCategories(cats);
        }).catch(() => {});
    }, []);

    // Load memory data
    useEffect(() => {
        const load = async () => {
            try {
                const data = await memoryAPI.getById(id);
                setMemory(data);
                setDescription(data.description_raw || '');
                setLocationName(data.location_name || '');
                setLatitude(data.latitude || null);
                setLongitude(data.longitude || null);
                // Parse current categories from ai_metadata
                const meta = data.ai_metadata || {};
                const existingCats = [
                    ...(meta.user_categories || []),
                    ...(meta.nlp?.themes || []),
                ];
                // Match categories by value
                const matched = existingCats.filter(cat => cat && cat.length > 0);
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

    const addCategory = async () => {
        if (!newCatLabel.trim()) return;
        const label = newCatLabel.trim();
        const value = label.toLowerCase().replace(/\s+/g, '_');
        const newCat = { id: `cat_${Date.now()}`, label, value };
        const updated = [...categories, newCat];
        setCategories(updated);
        // Automatically select the new category
        setSelectedCategories(prev => [...prev, value]);
        setNewCatLabel('');
        setAddingCat(false);
        try {
            await categoriesAPI.save(updated);
        } catch (e) {
            console.error('Error saving category:', e);
        }
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
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
                            Ubicación
                        </label>
                        <div className="flex gap-2 items-stretch">
                            <button
                                type="button"
                                onClick={() => setShowLocationPicker(true)}
                                title="Elegir en mapa"
                                className="flex items-center justify-center w-11 rounded-xl border-2 border-border-light dark:border-border-dark hover:border-primary hover:text-primary text-text-secondary-light dark:text-text-secondary-dark transition-colors flex-shrink-0 bg-surface-light dark:bg-surface-dark"
                            >
                                <MapPin size={20} />
                            </button>
                            <input
                                type="text"
                                value={locationName}
                                onChange={e => setLocationName(e.target.value)}
                                onFocus={() => {
                                    if (!locationName) setShowLocationPicker(true);
                                }}
                                placeholder="Toca el 📍 o escribe el nombre del lugar"
                                className="flex-1 px-4 py-3 rounded-xl bg-surface-light dark:bg-surface-dark border-2 border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark placeholder:text-text-tertiary-light placeholder:dark:text-text-tertiary-dark focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none text-sm"
                            />
                        </div>
                    </div>

                    {/* Categories */}
                    <div className="space-y-3">
                        <label className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
                            Categorías
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {categories.map(cat => (
                                <Chip
                                    key={cat.id}
                                    selected={selectedCategories.includes(cat.value)}
                                    onClick={() => toggleCategory(cat.value)}
                                >
                                    {cat.label}
                                </Chip>
                            ))}
                            {/* Add new category button/input */}
                            {addingCat ? (
                                <div className="flex items-center gap-1.5">
                                    <input
                                        autoFocus
                                        value={newCatLabel}
                                        onChange={e => setNewCatLabel(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') addCategory();
                                            if (e.key === 'Escape') { setAddingCat(false); setNewCatLabel(''); }
                                        }}
                                        placeholder="Nombre..."
                                        className="text-sm px-3 py-2 rounded-full border-2 border-primary bg-surface-light dark:bg-surface-dark text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all w-32"
                                    />
                                    <button 
                                        type="button"
                                        onClick={addCategory} 
                                        className="text-sm text-primary font-medium hover:text-primary-hover flex-shrink-0 px-2 py-1"
                                    >
                                        OK
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => { setAddingCat(false); setNewCatLabel(''); }} 
                                        className="flex-shrink-0 text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setAddingCat(true)}
                                    className="flex items-center gap-1.5 text-sm text-primary hover:text-primary-hover font-medium px-3 py-2 rounded-full border-2 border-dashed border-primary/40 hover:border-primary transition-colors"
                                >
                                    <Plus size={14} /> Nueva
                                </button>
                            )}
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
                            'Guardado'
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

            {/* Location Picker Modal */}
            <LocationPickerModal
                isOpen={showLocationPicker}
                onClose={() => setShowLocationPicker(false)}
                onConfirm={(lat, lng, locName) => {
                    setLatitude(lat);
                    setLongitude(lng);
                    setLocationName(locName);
                    setShowLocationPicker(false);
                }}
                initialLat={latitude}
                initialLng={longitude}
            />
        </div>
    );
}
