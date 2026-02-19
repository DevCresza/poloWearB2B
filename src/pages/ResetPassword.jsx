import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, KeyRound, CheckCircle, AlertTriangle } from 'lucide-react';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [sessionReady, setSessionReady] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const initRecovery = async () => {
      try {
        // 1. Tentar trocar código PKCE por sessão (fluxo padrão v2.77+)
        const code = searchParams.get('code');
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (!exchangeError && !cancelled) {
            setSessionReady(true);
            setChecking(false);
            return;
          }
          if (exchangeError) {
            console.warn('[ResetPassword] Erro ao trocar código PKCE:', exchangeError.message);
          }
        }

        // 2. Verificar hash na URL (fluxo implicit - fallback)
        const hash = window.location.hash;
        if (hash && hash.includes('type=recovery')) {
          // detectSessionInUrl já processou o hash - aguardar sessão
          await new Promise(resolve => setTimeout(resolve, 1000));
          const { data: { session } } = await supabase.auth.getSession();
          if (session && !cancelled) {
            setSessionReady(true);
            setChecking(false);
            return;
          }
        }

        // 3. Escutar evento PASSWORD_RECOVERY (pode disparar durante processamento)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
          if (event === 'PASSWORD_RECOVERY' && !cancelled) {
            setSessionReady(true);
            setChecking(false);
          }
        });

        // 4. Fallback final: checar sessão existente (pode já ter sido processada)
        await new Promise(resolve => setTimeout(resolve, 2000));
        if (!cancelled) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            setSessionReady(true);
          }
          setChecking(false);
        }

        // Cleanup
        return () => {
          subscription.unsubscribe();
        };
      } catch (err) {
        console.error('[ResetPassword] Erro na inicialização:', err);
        if (!cancelled) {
          setChecking(false);
        }
      }
    };

    initRecovery();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) throw updateError;

      setSuccess(true);
      setTimeout(() => navigate('/Login'), 3000);
    } catch (err) {
      setError(err.message || 'Erro ao redefinir senha');
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-gray-600">Verificando link de recuperação...</span>
        </div>
      </div>
    );
  }

  if (!sessionReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center space-y-4">
            <AlertTriangle className="w-12 h-12 text-orange-500 mx-auto" />
            <h2 className="text-xl font-bold text-gray-900">Link Expirado ou Inválido</h2>
            <p className="text-gray-600">
              O link de recuperação de senha expirou ou é inválido. Solicite um novo link na tela de login.
            </p>
            <Button onClick={() => navigate('/Login')} className="w-full">
              Voltar ao Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto bg-blue-100 p-3 rounded-full w-fit mb-4">
            <KeyRound className="w-8 h-8 text-blue-600" />
          </div>
          <CardTitle className="text-2xl">Redefinir Senha</CardTitle>
          <p className="text-gray-500 mt-2">Digite sua nova senha</p>
        </CardHeader>

        <CardContent>
          {success ? (
            <div className="text-center space-y-4">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
              <h3 className="text-lg font-semibold text-green-800">Senha Redefinida!</h3>
              <p className="text-gray-600">
                Sua senha foi alterada com sucesso. Você será redirecionado ao login.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertDescription className="text-red-800">{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="password">Nova Senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                  minLength={6}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  required
                  minLength={6}
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Redefinindo...
                  </>
                ) : (
                  'Redefinir Senha'
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
