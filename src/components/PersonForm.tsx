import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { errorText, useLang } from '../i18n';
import type { Gender, NewPerson, Person } from '../types';
import { CropDialog } from './CropDialog';

interface Props {
  initial?: Person;
  /** Vorauswahl für neue Personen, z. B. das andere Geschlecht beim Hinzufügen eines Partners. */
  defaultGender?: Gender;
  title: string;
  onSave: (person: NewPerson & { id?: string }, photo: Blob | null) => Promise<void>;
  onCancel: () => void;
}

export function PersonForm({ initial, defaultGender, title, onSave, onCancel }: Props) {
  const { t } = useLang();
  const [firstName, setFirstName] = useState(initial?.first_name ?? '');
  const [lastName, setLastName] = useState(initial?.last_name ?? '');
  const [birthName, setBirthName] = useState(initial?.birth_name ?? '');
  const [gender, setGender] = useState<Gender>(initial?.gender ?? defaultGender ?? 'w');
  const [birth, setBirth] = useState(initial?.birth_date ?? '');
  const [death, setDeath] = useState(initial?.death_date ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [toCrop, setToCrop] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const photoUrl = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  useEffect(() => () => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
  }, [photoUrl]);
  const preview = photoUrl ?? (removePhoto ? null : initial?.photo_url ?? null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!firstName.trim()) return setError(t.errFirstName);
    if (birth && death && death < birth) return setError(t.errDeathBeforeBirth);
    setBusy(true);
    setError(null);
    try {
      await onSave(
        {
          id: initial?.id,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          birth_name: birthName.trim() || null,
          gender,
          birth_date: birth || null,
          death_date: death || null,
          notes: notes.trim() || null,
          photo_url: removePhoto ? null : initial?.photo_url ?? null,
        },
        photo,
      );
    } catch (err) {
      setError(errorText(err, t));
      setBusy(false);
    }
  }

  return (
    <form className="panel form" onSubmit={submit}>
      {toCrop && (
        <CropDialog
          file={toCrop}
          onCancel={() => setToCrop(null)}
          onDone={(cropped) => {
            setPhoto(cropped);
            setRemovePhoto(false);
            setToCrop(null);
          }}
        />
      )}
      <h2>{title}</h2>
      <div className="photo-row">
        <div className="avatar big">{preview ? <img src={preview} alt="" /> : <span>?</span>}</div>
        <div className="photo-buttons">
          <label className="button secondary">
            {t.choosePhoto}
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                // Zurücksetzen, damit dieselbe Datei erneut gewählt werden kann.
                e.target.value = '';
                if (file) setToCrop(file);
              }}
            />
          </label>
          {preview && (
            <button
              type="button"
              className="link"
              onClick={() => {
                setPhoto(null);
                setRemovePhoto(true);
              }}
            >
              {t.removePhoto}
            </button>
          )}
        </div>
      </div>
      <label>
        {t.firstName}
        <input value={firstName} onChange={(e) => setFirstName(e.target.value)} autoFocus />
      </label>
      <label>
        {t.lastName}
        <input value={lastName} onChange={(e) => setLastName(e.target.value)} />
      </label>
      <label>
        {t.birthName}
        <input value={birthName} onChange={(e) => setBirthName(e.target.value)} />
      </label>
      <fieldset className="gender">
        <legend>{t.gender}</legend>
        {(
          [
            ['w', t.female],
            ['m', t.male],
            ['d', t.diverse],
          ] as const
        ).map(([value, label]) => (
          <label key={value} className={`g-${value}`}>
            <input
              type="radio"
              name="gender"
              value={value}
              checked={gender === value}
              onChange={() => setGender(value)}
            />
            {label}
          </label>
        ))}
      </fieldset>
      <div className="two">
        <label>
          {t.birthDate}
          <input type="date" value={birth} onChange={(e) => setBirth(e.target.value)} />
        </label>
        <label>
          {t.deathDate}
          <input type="date" value={death} onChange={(e) => setDeath(e.target.value)} />
        </label>
      </div>
      <label>
        {t.notes}
        <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      {error && <p className="error">{error}</p>}
      <div className="actions">
        <button type="submit" disabled={busy}>
          {busy ? t.saving : t.save}
        </button>
        <button type="button" className="secondary" onClick={onCancel} disabled={busy}>
          {t.cancel}
        </button>
      </div>
    </form>
  );
}
