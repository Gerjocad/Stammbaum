import { useState, type FormEvent } from 'react';

export function Login({ onSignIn }: { onSignIn: (email: string) => Promise<void> }) {
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
          ? 'Diese E-Mail-Adresse ist noch nicht freigeschaltet. Bitte frag die Verwalterin des Stammbaums nach einer Einladung.'
          : err instanceof Error
            ? err.message
            : String(err),
      );
    }
  }

  return (
    <div className="login">
      <form className="panel" onSubmit={submit}>
        <h1>Unser Stammbaum</h1>
        {sent ? (
          <p>Wir haben dir einen Anmeldelink an {email} geschickt. Öffne ihn auf diesem Gerät.</p>
        ) : (
          <>
            <p>Melde dich mit deiner E-Mail-Adresse an. Du bekommst einen Link, mit dem du ohne Passwort hineinkommst.</p>
            <label>
              E-Mail
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
            </label>
            {error && <p className="error">{error}</p>}
            <div className="actions">
              <button type="submit">Anmeldelink schicken</button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
