import { useEffect, useMemo, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { errorText, useLang } from '../i18n';
import { cropImage } from '../image';

interface Props {
  file: File;
  onDone: (cropped: Blob) => void;
  onCancel: () => void;
}

/** Vollbild-Fenster zum Zuschneiden eines Fotos: ziehen zum Verschieben, Pinch/Mausrad/Regler zum Zoomen. */
export function CropDialog({ file, onDone, onCancel }: Props) {
  const { t } = useLang();
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  async function apply() {
    if (!area) return;
    setBusy(true);
    try {
      onDone(await cropImage(file, area));
    } catch (err) {
      setError(errorText(err, t));
      setBusy(false);
    }
  }

  return (
    <div className="crop-overlay" role="dialog" aria-modal="true" aria-label={t.cropTitle}>
      <div className="crop-area">
        <Cropper
          image={url}
          crop={crop}
          zoom={zoom}
          maxZoom={5}
          aspect={1}
          cropShape="round"
          showGrid={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={(_, pixels) => setArea(pixels)}
        />
      </div>
      <div className="crop-controls">
        <p className="small">{t.cropHint}</p>
        <input
          type="range"
          min={1}
          max={5}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          aria-label={t.zoomIn}
        />
        {error && <p className="error">{error}</p>}
        <div className="actions">
          <button type="button" onClick={apply} disabled={!area || busy}>
            {t.cropApply}
          </button>
          <button type="button" className="secondary" onClick={onCancel} disabled={busy}>
            {t.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}
