import { useState, type FormEvent } from 'react';
import { errorText, useLang } from '../i18n';
import { Settings } from './Settings';

interface Props {
  onSignIn: (email: string) => Promise<void>;
  onRegister: (email: string, name: string) => Promise<void>;
}

export function Login({ onSignIn, onRegister }: Props) {
  const { t } = useLang();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (mode === 'register') await onRegister(email.trim(), name.trim());
      else await onSignIn(email.trim());
      setSent(true);
    } catch (err) {
      const msg = errorText(err, t);
      // Supabase meldet ein fehlendes Konto beim Anmelden als "Signups not allowed for otp".
      if (/signups? not allowed/i.test(msg)) setError(mode === 'register' ? t.signupsOff : t.notRegistered);
      else setError(msg);
    }
  }

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setError(null);
  };

  return (
    <div className="login">
      <Settings />
      <form className="panel" onSubmit={submit}>
        <h1>{t.appTitle}</h1>
        {sent ? (
          <p>{t.linkSent(email)}</p>
        ) : (
          <>
            <p>{mode === 'register' ? t.registerIntro : t.loginIntro}</p>
            {mode === 'register' && (
              <label>
                {t.name}
                <input required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" autoFocus />
              </label>
            )}
            <label>
              {t.email}
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                autoFocus={mode === 'login'}
              />
            </label>
            {error && <p className="error">{error}</p>}
            <div className="actions">
              <button type="submit">{mode === 'register' ? t.register : t.sendLink}</button>
            </div>
            <button type="button" className="link" onClick={switchMode}>
              {mode === 'login' ? t.toRegister : t.toLogin}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
