import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Map } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    setLoading(true);
    try {
      await register(email, password, name || undefined);
      navigate('/');
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (detail === 'Email already registered') {
        setError('Este email ya está registrado');
      } else if (Array.isArray(detail)) {
        setError(detail[0]?.msg || 'Error al registrarse');
      } else {
        setError(typeof detail === 'string' ? detail : 'Error al registrarse');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary rounded-2xl mb-4">
            <Map size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark">
            MyMemo
          </h1>
          <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mt-1">
            Tus recuerdos, siempre contigo
          </p>
        </div>

        {/* Card */}
        <div className="bg-surface-light dark:bg-surface-dark rounded-2xl shadow-sm border border-border-light dark:border-border-dark p-6 space-y-4">
          <h2 className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark">
            Crear cuenta
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="name"
              label="Nombre (opcional)"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              id="email"
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              id="password"
              label="Contraseña"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              helperText="Mínimo 8 caracteres"
            />

            {error && (
              <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creando cuenta...' : 'Crear cuenta'}
            </Button>
          </form>

          <p className="text-center text-sm text-text-secondary-light dark:text-text-secondary-dark">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="text-primary hover:underline font-medium">
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
