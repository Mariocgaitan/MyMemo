import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, Camera, Upload, MapPin, Loader2, Calendar, Plus, X } from 'lucide-react';
import { Button, Input, Textarea, Chip } from '../components/ui';
import { memoryAPI, categoriesAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import LocationPickerModal from '../components/LocationPickerModal';
import TourOverlay from '../components/onboarding/TourOverlay';

// Upload progress steps for the overlay
const UPLOAD_STEPS = [
  { id: 'prepare', label: 'Preparando foto...', emoji: null },
  { id: 'upload', label: 'Subiendo...', emoji: null },
  { id: 'ai', label: 'Analizando con IA...', emoji: null },
];

function UploadOverlay({ step }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-light dark:bg-surface-dark rounded-2xl p-8 w-full max-w-xs mx-4 shadow-xl text-center">
        <div className="mb-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Loader2 size={32} className="text-primary animate-spin" />
          </div>
          <p className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark">
            Guardando
          </p>
        </div>
        <div className="space-y-3">
          {UPLOAD_STEPS.map((s, i) => {
            const idx = UPLOAD_STEPS.findIndex(x => x.id === step);
            const isDone = i < idx;
            const isActive = i === idx;
            return (
              <div key={s.id} className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-all ${isActive ? 'bg-primary/10 text-primary' :
                isDone ? 'text-green-600 dark:text-green-400' :
                  'text-text-secondary-light dark:text-text-secondary-dark opacity-40'
                }`}>
                <span className={`w-5 h-5 flex items-center justify-center text-sm flex-shrink-0`}>
                  {isDone ? '✓' : ''}
                </span>
                <span className={`text-sm font-medium ${isActive ? 'font-semibold' : ''}`}>{s.label}</span>
                {isActive && <Loader2 size={14} className="ml-auto animate-spin" />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}



export default function CreateMemory() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadStep, setUploadStep] = useState(null); // 'prepare' | 'upload' | 'ai'
  const [error, setError] = useState('');
  const [gpsStatus, setGpsStatus] = useState('loading'); // 'loading', 'success', 'error'
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showCreateTutorial, setShowCreateTutorial] = useState(false);
  const [addingCat, setAddingCat] = useState(false);
  const [newCatLabel, setNewCatLabel] = useState('');
  const [formData, setFormData] = useState({
    image: null,
    imagePreview: null,
    location: '',
    latitude: null,
    longitude: null,
    description: '',
    selectedCategories: [],
    people: '', // Comma-separated names
    memoryDate: '', // ISO date string or empty (means "now")
  });

  const createTutorialKey = `mymemo:onboarding:create:${user?.id || 'anon'}`;

  const createSteps = [
    {
      title: 'Empieza con foto y fecha',
      text: 'Sube una foto clara y confirma la fecha del recuerdo.',
      targetSelector: '[data-onboarding-create="photo"]',
    },
    {
      title: 'Cuenta que paso',
      text: 'Una descripcion corta mejora mucho la busqueda futura.',
      targetSelector: '[data-onboarding-create="description"]',
    },
    {
      title: 'Categorias',
      text: 'Las categorias son tuyas para organizar mejor. Puedes seleccionar varias.',
      targetSelector: '[data-onboarding-create="categories"]',
    },
    {
      title: 'Personas',
      text: 'Agrega quienes aparecen o participaron. Esto mejora filtros y sugerencias.',
      targetSelector: '[data-onboarding-create="people"]',
    },
    {
      title: 'Asociacion por amistades',
      text: 'Con amistades conectadas, MyMemo puede relacionar personas equivalentes entre cuentas.',
      targetSelector: '[data-onboarding-create="people"]',
    },
    {
      title: 'Guardar recuerdo',
      text: 'Cuando termines, guarda. Luego puedes editar descripcion, categorias y personas.',
      targetSelector: '[data-onboarding-create="submit"]',
    },
  ];

  const toDateTimeLocal = (isoLike) => {
    if (!isoLike) return '';
    const d = new Date(isoLike);
    if (Number.isNaN(d.getTime())) return '';
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
  };

  // Load categories from API
  useEffect(() => {
    categoriesAPI.getAll().then(cats => {
      if (cats && cats.length) setCategories(cats);
    }).catch(() => {});

    // Try to get GPS location
    if (navigator.geolocation) {
      setGpsStatus('loading');
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData(prev => ({
            ...prev,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            location: `GPS: ${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`
          }));
          setGpsStatus('success');
          console.log('GPS location obtained:', position.coords.latitude, position.coords.longitude);
        },
        (error) => {
          console.warn('GPS error:', error.message);
          setGpsStatus('error');
        },
        {
          enableHighAccuracy: true,
          timeout: 15000, // 15 seconds
          maximumAge: 0
        }
      );
    } else {
      setGpsStatus('error');
    }
  }, []);

  useEffect(() => {
    const alreadyCompleted = localStorage.getItem(createTutorialKey) === '1';
    if (!alreadyCompleted) {
      const t = setTimeout(() => setShowCreateTutorial(true), 350);
      return () => clearTimeout(t);
    }
  }, [createTutorialKey]);

  useEffect(() => {
    const openCreateTutorial = () => setShowCreateTutorial(true);
    window.addEventListener('mymemo:open-create-tutorial', openCreateTutorial);
    return () => window.removeEventListener('mymemo:open-create-tutorial', openCreateTutorial);
  }, []);

  // If user comes from Generator, prefill image/date/people to speed up memory creation.
  useEffect(() => {
    const prefilledFile = location.state?.prefilledFile;
    const prefilledDate = location.state?.prefilledDate;
    const prefilledPeople = location.state?.prefilledPeople;

    if (!prefilledFile && !prefilledDate && !prefilledPeople) return;

    setFormData(prev => ({
      ...prev,
      image: prefilledFile || prev.image,
      imagePreview: prefilledFile ? URL.createObjectURL(prefilledFile) : prev.imagePreview,
      memoryDate: prefilledDate ? toDateTimeLocal(prefilledDate) : prev.memoryDate,
      people: Array.isArray(prefilledPeople) && prefilledPeople.length > 0
        ? prefilledPeople.join(', ')
        : prev.people,
    }));
  }, [location.state]);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData(prev => ({
        ...prev,
        image: file,
        imagePreview: URL.createObjectURL(file),
      }));
    }
  };

  const toggleCategory = (catValue) => {
    setFormData(prev => ({
      ...prev,
      selectedCategories: prev.selectedCategories.includes(catValue)
        ? prev.selectedCategories.filter(c => c !== catValue)
        : [...prev.selectedCategories, catValue]
    }));
  };

  const addCategory = async () => {
    if (!newCatLabel.trim()) return;
    const label = newCatLabel.trim();
    const value = label.toLowerCase().replace(/\s+/g, '_');
    const newCat = { id: `cat_${Date.now()}`, label, value };
    const updated = [...categories, newCat];
    setCategories(updated);
    // Automatically select the new category
    setFormData(prev => ({
      ...prev,
      selectedCategories: [...prev.selectedCategories, value]
    }));
    setNewCatLabel('');
    setAddingCat(false);
    try {
      await categoriesAPI.save(updated);
    } catch (e) {
      console.error('Error saving category:', e);
    }
  };

  const convertImageToBase64 = async (file) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('No se pudo inicializar canvas');
    }

    // Prefer EXIF-aware decoding when available so portrait/landscape render correctly.
    if (typeof createImageBitmap === 'function') {
      try {
        const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close?.();
        return canvas.toDataURL('image/jpeg', 0.92);
      } catch (err) {
        console.warn('createImageBitmap orientation fallback:', err);
      }
    }

    // Fallback path for older browsers.
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0, img.width, img.height);
          resolve(canvas.toDataURL('image/jpeg', 0.92));
        };
        img.onerror = reject;
        img.src = e.target?.result;
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Clear any previous errors
    setError('');

    if (!formData.image || !formData.description) {
      setError('Debes subir una imagen y agregar una descripción');
      return;
    }

    try {
      setLoading(true);
      setUploadStep('prepare');

      // Step 1: Convert image to base64
      const imageBase64 = await convertImageToBase64(formData.image);

      // Use GPS coordinates if available, otherwise use default (CDMX)
      const lat = formData.latitude || 19.4326;
      const lng = formData.longitude || -99.1332;

      // Prepare payload
      const payload = {
        image_base64: imageBase64,
        description: formData.description,
        location_name: formData.location || 'Sin ubicación GPS',
        coordinates: {
          latitude: lat,
          longitude: lng
        },
        categories: formData.selectedCategories.join(','),
        tagged_people: formData.people,
        memory_date: formData.memoryDate ? new Date(formData.memoryDate).toISOString() : null,
      };

      // Step 2: Upload to backend
      setUploadStep('upload');
      const response = await memoryAPI.create(payload);

      // Step 3: IA kicked off
      setUploadStep('ai');
      await new Promise(r => setTimeout(r, 800)); // brief visual pause

      // Go directly to memory detail; faces and names are managed there.
      navigate(`/memory/${response.id}`);

    } catch (err) {
      console.error('Error creating memory:', err);
      setError(err.response?.data?.detail || 'Error al subir el recuerdo. Intenta de nuevo.');
    } finally {
      setLoading(false);
      setUploadStep(null);
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-background-light dark:bg-background-dark">
      {/* Upload overlay */}
      {uploadStep && <UploadOverlay step={uploadStep} />}
      <div className="max-w-2xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-text-primary-light dark:text-text-primary-dark hover:text-primary transition-colors"
          >
            <ChevronLeft size={20} />
            <span className="font-medium">Volver</span>
          </button>
          <h1 className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark">
            Nuevo Recuerdo
          </h1>
          <div className="w-20" /> {/* Spacer for centering */}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Image Upload */}
          <div className="space-y-3" data-onboarding-create="photo">
            {formData.imagePreview ? (
              <div className="relative rounded-2xl overflow-hidden min-h-[220px] max-h-[60vh] bg-black/5 dark:bg-black/20 flex items-center justify-center">
                <img
                  src={formData.imagePreview}
                  alt="Preview"
                  className="w-full h-auto max-h-[60vh] object-contain"
                  style={{ transform: 'scaleX(-1)' }}
                />
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, image: null, imagePreview: null }))}
                  className="absolute top-4 right-4 px-4 py-2 bg-white/90 hover:bg-white rounded-xl text-sm font-medium transition-colors"
                >
                  Cambiar foto
                </button>
              </div>
            ) : (
              <div className="aspect-[3/2] rounded-2xl border-2 border-dashed border-border-light dark:border-border-dark flex flex-col items-center justify-center gap-4 bg-surface-light dark:bg-surface-dark">
                <Camera size={40} className="text-text-secondary-light dark:text-text-secondary-dark opacity-40" />
                <p className="font-medium text-text-primary-light dark:text-text-primary-dark">
                  Agrega una foto
                </p>
                <div className="flex gap-3">
                  <input
                    id="camera-input"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <label
                    htmlFor="camera-input"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 text-base rounded-xl bg-primary hover:bg-primary-hover text-white font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all duration-normal cursor-pointer"
                  >
                    <Camera size={18} />
                    Tomar foto
                  </label>

                  <input
                    id="file-input"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <label
                    htmlFor="file-input"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 text-base rounded-xl border-2 border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark font-semibold hover:border-primary hover:text-primary transition-all duration-normal cursor-pointer"
                  >
                    <Upload size={18} />
                    Cargar foto
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Location */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
              Ubicación
            </label>

            {/* Clickable location row — tap pin or field to open map picker */}
            <div className="flex gap-2 items-stretch">
              {/* Pin button — main trigger */}
              <button
                type="button"
                onClick={() => setShowLocationPicker(true)}
                title="Elegir en mapa"
                className="flex items-center justify-center w-11 rounded-xl border-2 border-border-light dark:border-border-dark hover:border-primary hover:text-primary text-text-secondary-light dark:text-text-secondary-dark transition-colors flex-shrink-0 bg-surface-light dark:bg-surface-dark"
              >
                <MapPin size={20} />
              </button>

              {/* Text field — also opens map on focus if empty */}
              <input
                type="text"
                value={formData.location}
                onChange={(e) => {
                  const value = e.target.value;
                  const coordMatch = value.match(/(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)/);
                  if (coordMatch) {
                    const lat = parseFloat(coordMatch[1]);
                    const lng = parseFloat(coordMatch[2]);
                    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                      setFormData(prev => ({ ...prev, location: value, latitude: lat, longitude: lng }));
                      return;
                    }
                  }
                  setFormData(prev => ({ ...prev, location: value }));
                }}
                onFocus={() => {
                  if (!formData.location) setShowLocationPicker(true);
                }}
                placeholder="Toca el 📍 o escribe: 19.4348, -99.1891"
                className="flex-1 px-4 py-3 rounded-xl bg-surface-light dark:bg-surface-dark border-2 border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark placeholder:text-text-tertiary-light placeholder:dark:text-text-tertiary-dark focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none text-sm"
              />
            </div>

            <p className={`text-xs ${gpsStatus === 'success' ? 'text-green-600 dark:text-green-400' :
              gpsStatus === 'error' ? 'text-yellow-600 dark:text-yellow-400' :
                'text-text-secondary-light dark:text-text-secondary-dark'
              }`}>
              {gpsStatus === 'loading' && 'Obteniendo ubicación GPS...'}
              {gpsStatus === 'success' && `✅ GPS: ${formData.latitude?.toFixed(4)}, ${formData.longitude?.toFixed(4)}`}
              {gpsStatus === 'error' && 'GPS no disponible — toca 📍 para elegir el punto en el mapa'}
            </p>
          </div>

          {/* Description */}
          <div data-onboarding-create="description">
            <Textarea
              label="¿Qué pasó?"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="En unos taquitos de canasta con Ángel, hoy me pedí 5..."
              rows={6}
              required
            />
          </div>

          {/* Categories */}
          <div className="space-y-3" data-onboarding-create="categories">
            <label className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
              Categorías
            </label>
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => (
                <Chip
                  key={cat.id}
                  selected={formData.selectedCategories.includes(cat.value)}
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

          {/* People tagging */}
          <div className="space-y-3" data-onboarding-create="people">
            <Input
              label="¿Con quién estabas?"
              value={formData.people}
              onChange={(e) => setFormData(prev => ({ ...prev, people: e.target.value }))}
              placeholder="Mario, Ángel, Ana... (separa con comas)"
              helperText="Escribe los nombres de las personas en la foto"
            />
            <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
              La IA detecta caras automáticamente al guardar
            </p>
          </div>

          {/* Date picker */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark flex items-center gap-2">
              <Calendar size={15} className="text-primary" />
              Fecha del recuerdo
            </label>
            <input
              type="datetime-local"
              value={formData.memoryDate}
              onChange={e => setFormData(prev => ({ ...prev, memoryDate: e.target.value }))}
              max={new Date().toISOString().slice(0, 16)}
              className="w-full px-4 py-3 rounded-xl border-2 border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark text-text-primary-light dark:text-text-primary-dark focus:border-primary focus:outline-none transition-colors text-sm"
            />
            <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
              {formData.memoryDate ? '' : 'Por defecto: fecha y hora actuales'}
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-xl p-4">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {/* Submit button */}
          <Button
            type="submit"
            fullWidth
            size="lg"
            data-onboarding-create="submit"
            disabled={!formData.image || !formData.description || loading}
            loading={loading}
          >
            {loading ? 'Guardando...' : 'Guardar Recuerdo'}
          </Button>
        </form>
      </div>

      <TourOverlay
        open={showCreateTutorial}
        steps={createSteps}
        storageKey={createTutorialKey}
        onComplete={() => setShowCreateTutorial(false)}
        onSkip={() => setShowCreateTutorial(false)}
      />

      {/* Location Picker Modal */}
      <LocationPickerModal
        isOpen={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onConfirm={(lat, lng, locationName) => {
          setFormData(prev => ({
            ...prev,
            latitude: lat,
            longitude: lng,
            location: locationName || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
          }));
          setGpsStatus('success');
          setShowLocationPicker(false);
        }}
        initialLat={formData.latitude}
        initialLng={formData.longitude}
      />
    </div>
  );
}
