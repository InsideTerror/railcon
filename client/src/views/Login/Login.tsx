import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { Train, Lock, AlertCircle } from 'lucide-react';

export function Login() {
  const [pin, setPin] = useState('');
  const [forteId, setForteId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(pin, forteId);
      navigate('/driver');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-rail-bg p-4">
      <div className="w-full max-w-md">
        <div className="panel p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-rail-gold/10 mb-4">
              <Train className="w-8 h-8 text-rail-gold" />
            </div>
            <h1 className="text-2xl font-bold text-rail-text">C.O.R.E. OBU</h1>
            <p className="text-rail-textMuted mt-1">On-Board Unit Driver Interface</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="forteId" className="block text-sm font-medium text-rail-textMuted mb-1">
                Forte ID
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-rail-textDim" />
                <input
                  id="forteId"
                  type="text"
                  value={forteId}
                  onChange={(e) => setForteId(e.target.value.toUpperCase())}
                  className="input pl-10 uppercase tracking-wide"
                  placeholder="DRV001"
                  required
                  autoComplete="username"
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label htmlFor="pin" className="block text-sm font-medium text-rail-textMuted mb-1">
                PIN (6 digits)
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-rail-textDim" />
                <input
                  id="pin"
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="input pl-10 letter-spacing-wider"
                  placeholder="123456"
                  required
                  minLength={6}
                  maxLength={6}
                  autoComplete="current-password"
                  disabled={loading}
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-rail-red/10 border border-rail-red/30 rounded-lg text-rail-red text-sm animate-in">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className="btn-primary w-full py-3 text-lg mt-2"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-rail-textDim">
            <p>Demo credentials:</p>
            <p className="font-mono">DRV001 / 123456</p>
            <p className="font-mono">DSP001 / 123456</p>
            <p className="font-mono">SYS001 / 123456</p>
          </div>
        </div>
      </div>
    </div>
  );
}
