import React from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider';
import { api } from '../lib/api';
import { ShieldCheck, LogIn } from 'lucide-react';

const LoginPage: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = React.useState<string | null>(null);

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [isRegistering, setIsRegistering] = React.useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const data = isRegistering 
        ? await api.auth.register({ name: email.split('@')[0], email, password })
        : await api.auth.login({ email, password });
      
      localStorage.setItem('auth_token', data.token);
      window.location.href = '/';
    } catch (err: any) {
      setError(err?.message || 'Authentication failed.');
    }
  };

  return (
    <div className="min-h-screen bg-app-bg flex items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-app-accent/5 rounded-full blur-[120px] -mr-64 -mt-64" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-app-accent/5 rounded-full blur-[120px] -ml-64 -mb-64" />

      <div className="max-w-md w-full bg-app-sidebar rounded-[2.5rem] shadow-2xl overflow-hidden border border-app-border relative z-10">
        <div className="px-10 pt-16 pb-10 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-app-accent to-transparent opacity-50" />
          <div className="inline-flex items-center justify-center w-20 h-20 bg-app-card rounded-3xl mb-8 border border-app-border shadow-inner group transition-all">
            <ShieldCheck size={44} className="text-app-accent group-hover:scale-110 transition-transform" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-app-text-bright mb-3">
            SSB<span className="text-app-text-muted">PSYCH</span>
          </h1>
          <p className="text-app-text-muted text-sm uppercase font-black tracking-[0.2em]">Secure Evaluation Portal</p>
        </div>
        
        <div className="px-10 pb-12 space-y-8">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
              <div className="p-1 bg-red-500/20 rounded-lg shrink-0">
                <LogIn size={16} className="text-red-400 rotate-180" />
              </div>
              <p className="text-xs font-bold text-red-400 leading-tight">
                {error}
              </p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">Identify (Email)</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-app-card border border-app-border rounded-xl p-4 text-xs font-bold focus:outline-none focus:border-app-accent transition-all text-app-text-bright"
                placeholder="candidate@protocol.ia"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-app-text-muted uppercase tracking-widest ml-1">Passphrase</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-app-card border border-app-border rounded-xl p-4 text-xs font-bold focus:outline-none focus:border-app-accent transition-all text-app-text-bright"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-br from-[#C5A028] to-[#8C6A0F] text-white py-4 px-6 rounded-2xl font-black uppercase tracking-widest hover:opacity-90 transition-all active:scale-[0.98] shadow-lg shadow-app-accent/25"
            >
              {isRegistering ? 'Initialize Session' : 'Establish Link'}
            </button>
          </form>

          <div className="text-center space-y-4">
            <button 
              onClick={() => setIsRegistering(!isRegistering)}
              className="text-[10px] font-black text-app-text-muted uppercase tracking-widest hover:text-app-accent transition-colors"
            >
              {isRegistering ? 'Already have an identity? Login' : 'New candidate? Register identity'}
            </button>

            {!isRegistering && (
              <div className="p-4 bg-app-card/30 border border-app-border rounded-xl space-y-2">
                <p className="text-[9px] font-black text-app-text-muted uppercase tracking-widest">Test Credentials</p>
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[10px] font-bold">
                    <span className="text-app-text-muted">Email:</span>
                    <button 
                      onClick={() => { setEmail('candidate@test.com'); setPassword('password123'); }}
                      className="text-app-accent hover:underline"
                    >
                      candidate@test.com
                    </button>
                  </div>
                  <div className="flex justify-between text-[10px] font-bold">
                    <span className="text-app-text-muted">Passphrase:</span>
                    <span className="text-app-text-bright">password123</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="pt-6 border-t border-app-border flex items-center justify-between text-[11px] font-black text-app-text-muted uppercase tracking-widest">
            <span>Enterprise Grade</span>
            <span className="w-1.5 h-1.5 bg-app-accent rounded-full animate-pulse" />
            <span>Encrypted Data</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
