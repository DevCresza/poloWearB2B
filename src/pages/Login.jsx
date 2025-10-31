import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, LogIn } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await User.login(email, password);
      navigate('/PortalDashboard');
    } catch (err) {
      setError(err.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (userEmail, userPassword) => {
    setEmail(userEmail);
    setPassword(userPassword);
    setError('');
    setLoading(true);

    try {
      await User.login(userEmail, userPassword);
      navigate('/PortalDashboard');
    } catch (err) {
      setError(err.message || 'Erro ao fazer login');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-xl">
          <CardHeader className="space-y-1">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
                <LogIn className="w-8 h-8 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl text-center">Polo Wear Multimarcas</CardTitle>
            <CardDescription className="text-center">
              Entre com suas credenciais para acessar o sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  <>
                    <LogIn className="mr-2 h-4 w-4" />
                    Entrar
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-muted-foreground">
                    Ou use um dos logins rápidos
                  </span>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => handleQuickLogin('admin@polo-b2b.com', 'admin123')}
                  disabled={loading}
                >
                  <div className="flex items-center justify-between w-full">
                    <span>Login como Admin</span>
                    <span className="text-xs text-muted-foreground">admin123</span>
                  </div>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => handleQuickLogin('fornecedor@exemplo.com', 'fornecedor123')}
                  disabled={loading}
                >
                  <div className="flex items-center justify-between w-full">
                    <span>Login como Fornecedor</span>
                    <span className="text-xs text-muted-foreground">fornecedor123</span>
                  </div>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => handleQuickLogin('cliente@exemplo.com', 'cliente123')}
                  disabled={loading}
                >
                  <div className="flex items-center justify-between w-full">
                    <span>Login como Cliente</span>
                    <span className="text-xs text-muted-foreground">cliente123</span>
                  </div>
                </Button>
              </div>
            </div>

            <div className="mt-4 text-center text-sm text-muted-foreground">
              <p>Credenciais de teste:</p>
              <p className="text-xs mt-1">
                admin@polo-b2b.com / admin123<br />
                fornecedor@exemplo.com / fornecedor123<br />
                cliente@exemplo.com / cliente123
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
