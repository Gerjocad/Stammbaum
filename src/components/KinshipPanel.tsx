import { describeKinship } from '../kinship';
import { fullName, lifeSpan, type FamilyData } from '../types';

interface Props {
  data: FamilyData;
  a: string;
  b: string;
  setA: (id: string) => void;
  setB: (id: string) => void;
  onClose: () => void;
}

export function KinshipPanel({ data, a, b, setA, setB, onClose }: Props) {
  const sorted = [...data.persons].sort((x, y) => fullName(x).localeCompare(fullName(y), 'de'));
  const options = sorted.map((p) => (
    <option key={p.id} value={p.id}>
      {fullName(p)} {lifeSpan(p) && `(${lifeSpan(p)})`}
    </option>
  ));
  const result = a && b ? describeKinship(data, a, b) : null;
  const reverse = a && b && a !== b ? describeKinship(data, b, a) : null;

  return (
    <div className="panel">
      <h2>Verwandtschaft berechnen</h2>
      <p className="muted small">Wähle zwei Personen hier aus oder klicke sie nacheinander im Baum an.</p>
      <label>
        Person 1
        <select value={a} onChange={(e) => setA(e.target.value)}>
          <option value="">Person wählen …</option>
          {options}
        </select>
      </label>
      <label>
        Person 2
        <select value={b} onChange={(e) => setB(e.target.value)}>
          <option value="">Person wählen …</option>
          {options}
        </select>
      </label>
      {result && (
        <div className="result">
          <p className="big">{result.sentence}</p>
          {result.detail && <p className="muted">{result.detail}</p>}
          {reverse && <p>{reverse.sentence}</p>}
        </div>
      )}
      <div className="actions">
        <button className="secondary" onClick={onClose}>
          Schließen
        </button>
      </div>
    </div>
  );
}
