import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Camera, Upload, MapPin, Loader2, Map } from 'lucide-react';
import { Button, Input, Textarea, Chip } from '../components/ui';
import { memoryAPI, categoriesAPI } from '../services/api';
import FaceTagModal from '../components/FaceTagModal';
import LocationPickerModal from '../components/LocationPickerModal';

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
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadStep, setUploadStep] = useState(null); // 'prepare' | 'upload' | 'ai'
  const [error, setError] = useState('');
  const [gpsStatus, setGpsStatus] = useState('loading'); // 'loading', 'success', 'error'
  const [showFaceTagModal, setShowFaceTagModal] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [createdMemoryId, setCreatedMemoryId] = useState(null);
  const [createdMemoryUrl, setCreatedMemoryUrl] = useState(null);
  const [formData, setFormData] = useState({
    image: null,
    imagePreview: null,
    location: '',
    latitude: null,
    longitude: null,
    description: '',
    selectedCategories: [],
    people: '', // Comma-separated names
  });

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

  const convertImageToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Convert to canvas to normalize format (no flip - keep original for face detection)
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, img.width, img.height);

          // Convert canvas to base64 JPEG at high quality
          const base64 = canvas.toDataURL('image/jpeg', 0.92);
          resolve(base64);
        };
        img.onerror = reject;
        img.src = e.target.result;
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
      };

      // Step 2: Upload to backend
      setUploadStep('upload');
      const response = await memoryAPI.create(payload);

      // Step 3: IA kicked off
      setUploadStep('ai');
      await new Promise(r => setTimeout(r, 800)); // brief visual pause

      // Store memory ID and image URL, then show face tagging modal
      setCreatedMemoryId(response.id);
      setCreatedMemoryUrl(response.image_url || null);
      setShowFaceTagModal(true);

    } catch (err) {
      console.error('Error creating memory:', err);
      setError(err.response?.data?.detail || 'Error al subir el recuerdo. Intenta de nuevo.');
    } finally {
      setLoading(false);
      setUploadStep(null);
    }
  };

  const handleFaceTagComplete = () => {
    // Navigate to home after face tagging
    navigate('/');
    window.location.reload();
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
          <div className="space-y-3">
            {formData.imagePreview ? (
              <div className="relative aspect-[3/2] rounded-2xl overflow-hidden">
                <img
                  src={formData.imagePreview}
                  alt="Preview"
                  className="w-full h-full object-cover"
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
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Input
                  label="Ubicación"
                  value={formData.location}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Intenta parsear coordenadas del texto (ej: "19.4348, -99.1891" o "📍 GPS: 19.4348, -99.1891")
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
                  placeholder="Taquería de canasta, CDMX  ó  19.4348, -99.1891"
                  startIcon={<MapPin size={18} />}
                />
              </div>
              <button
                type="button"
                onClick={() => setShowLocationPicker(true)}
                title="Seleccionar en mapa"
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border-2 border-border-light dark:border-border-dark hover:border-primary hover:text-primary text-text-secondary-light dark:text-text-secondary-dark transition-colors text-sm font-medium flex-shrink-0 mb-[1px]"
              >
                <Map size={16} />
                <span className="hidden sm:inline">Mapa</span>
              </button>
            </div>
            <p className={`text-xs ${gpsStatus === 'success' ? 'text-green-600 dark:text-green-400' :
              gpsStatus === 'error' ? 'text-yellow-600 dark:text-yellow-400' :
                'text-text-secondary-light dark:text-text-secondary-dark'
              }`}>
              {gpsStatus === 'loading' && 'Obteniendo ubicación...'}
              {gpsStatus === 'success' && `GPS: ${formData.latitude?.toFixed(4)}, ${formData.longitude?.toFixed(4)}`}
              {gpsStatus === 'error' && 'GPS no disponible — toca el botón Mapa para elegir el punto'}
            </p>
          </div>

          {/* Description */}
          <Textarea
            label="¿Qué pasó?"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="En unos taquitos de canasta con Ángel, hoy me pedí 5..."
            rows={6}
            required
          />

          {/* Categories */}
          <div className="space-y-3">
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
            </div>
          </div>

          {/* People tagging */}
          <div className="space-y-3">
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
            disabled={!formData.image || !formData.description || loading}
            loading={loading}
          >
            {loading ? 'Guardando...' : 'Guardar Recuerdo'}
          </Button>
        </form>
      </div>

      {/* Location Picker Modal */}
      <LocationPickerModal
        isOpen={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onConfirm={(lat, lng) => {
          setFormData(prev => ({
            ...prev,
            latitude: lat,
            longitude: lng,
            location: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
          }));
          setGpsStatus('success');
          setShowLocationPicker(false);
        }}
        initialLat={formData.latitude}
        initialLng={formData.longitude}
      />

      {/* Face Tagging Modal */}
      <FaceTagModal
        isOpen={showFaceTagModal}
        onClose={() => { setShowFaceTagModal(false); navigate('/'); }}
        memoryId={createdMemoryId}
        memoryImageUrl={createdMemoryUrl}
        onComplete={handleFaceTagComplete}
        prefilledNames={formData.people ? formData.people.split(',').map(n => n.trim()) : []}
      />
    </div>
  );
}
