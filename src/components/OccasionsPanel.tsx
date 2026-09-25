import { upcomingOccasions } from '../dates';
import { useLang } from '../i18n';
import { fullName, type Person } from '../types';

interface Props {
  persons: Person[];
  onSelect: (id: string) => void;
}

export function OccasionsPanel({ persons, onSelect }: Props) {
  const { t, lang } = useLang();
  const list = upcomingOccasions(persons);
  const when = (days: number) => (days === 0 ? t.today : days === 1 ? t.tomorrow : t.inDays(days));
  const format = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'de-DE', { day: 'numeric', month: 'long' });

  return (
    <div className="panel">
      <h2>{t.occasions}</h2>
      {list.length === 0 && <p className="muted">{t.noOccasions}</p>}
      <ul className="occasions">
        {list.map((o) => (
          <li key={`${o.kind}-${o.person.id}`} className={o.days === 0 ? 'today' : ''}>
            <div className="avatar small">
              {o.person.photo_url ? <img src={o.person.photo_url} alt="" /> : <span>{o.person.first_name[0]}</span>}
            </div>
            <div>
              <button className="link" onClick={() => onSelect(o.person.id)}>
                {fullName(o.person)}
              </button>
              <div className="muted small">
                {o.kind === 'birthday' ? t.turns(o.years) : `† ${t.memorial(o.years)}`}
              </div>
            </div>
            <div className="when">
              <div>{format(o.date)}</div>
              <div className="muted small">{when(o.days)}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
