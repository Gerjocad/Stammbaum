import { useState, type FormEvent } from 'react';
import { useLang } from '../i18n';
import { Settings } from './Settings';

export function Login({ onSignIn }: { onSignIn: (email: string) => Promise<void> }) {
  const { t } = useLang();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await onSignIn(email.trim());
      setSent(true);
    } catch (err) {
      setError(
        err instanceof Error && /signups? not allowed|not found/i.test(err.message)
          ? t.notInvited
          : err instanceof Error
            ? err.message
            : String(err),
      );
    }
  }

  return (
    <div className="login">
      <Settings />
      <form className="panel" onSubmit={submit}>
        <h1>{t.appTitle}</h1>
        {sent ? (
          <p>{t.linkSent(email)}</p>
        ) : (
          <>
            <p>{t.loginIntro}</p>
            <label>
              {t.email}
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
            </label>
            {error && <p className="error">{error}</p>}
            <div className="actions">
              <button type="submit">{t.sendLink}</button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
