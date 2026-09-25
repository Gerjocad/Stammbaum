import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Lang = 'de' | 'tr';

const de = {
  appTitle: 'Unser Stammbaum',
  loading: 'Lädt …',
  addPerson: 'Person hinzufügen',
  kinship: 'Verwandtschaft berechnen',
  signOut: 'Abmelden',
  demoNotice:
    'Demo-Modus: Die Daten werden nur in diesem Browser gespeichert. Für die gemeinsame Familien-Website bitte Supabase einrichten (siehe README).',
  hide: '(ausblenden)',
  darkMode: 'Dunkles Design',
  lightMode: 'Helles Design',
  language: 'Sprache',

  // Baum
  emptyTitle: 'Noch keine Personen eingetragen.',
  emptyHint: 'Tippe oben rechts auf das Symbol mit dem Plus, um die erste Person anzulegen, zum Beispiel dich selbst.',
  zoomOut: 'Verkleinern',
  zoomIn: 'Vergrößern',

  // Formular
  newPerson: 'Neue Person',
  newParentOf: (n: string) => `Neues Elternteil von ${n}`,
  newChildOf: (n: string) => `Neues Kind von ${n}`,
  newPartnerOf: (n: string) => `Neue:r Partner:in von ${n}`,
  editPerson: (n: string) => `${n} bearbeiten`,
  choosePhoto: 'Foto wählen',
  removePhoto: 'Foto entfernen',
  firstName: 'Vorname',
  lastName: 'Nachname',
  birthName: 'Geburtsname / Mädchenname',
  bornAs: (n: string) => `geb. ${n}`,
  gender: 'Geschlecht',
  female: 'weiblich',
  male: 'männlich',
  diverse: 'divers / unbekannt',
  birthDate: 'Geburtsdatum',
  deathDate: 'Todesdatum',
  notes: 'Notizen',
  save: 'Speichern',
  saving: 'Speichern …',
  cancel: 'Abbrechen',
  errFirstName: 'Bitte einen Vornamen eingeben.',
  errDeathBeforeBirth: 'Das Todesdatum liegt vor dem Geburtsdatum.',
  errImage: 'Bild konnte nicht verarbeitet werden.',
  errStorageFull: 'Der Browser-Speicher ist voll. Bitte kleinere Fotos verwenden.',
  errSchemaOutdated:
    'Die Datenbank ist noch nicht auf dem neuesten Stand. Bitte in Supabase im SQL Editor die Zeilen am Ende von supabase/schema.sql ausführen.',

  // Personenansicht
  born: 'Geboren',
  died: 'Gestorben',
  edit: 'Bearbeiten',
  parents: 'Eltern',
  partners: 'Partner:innen',
  children: 'Kinder',
  noneYet: 'Keine eingetragen.',
  remove: 'entfernen',
  removeLinkTitle: 'Verbindung entfernen',
  confirmUnlink: (n: string) => `Verbindung zu ${n} entfernen? Die Person selbst bleibt erhalten.`,
  addNewParent: '+ Neue Person als Elternteil',
  addNewPartner: '+ Neue Person als Partner:in',
  addNewChild: '+ Neue Person als Kind',
  linkExisting: 'Mit vorhandener Person verbinden',
  isParentOf: (n: string) => `ist Elternteil von ${n}`,
  isChildOf: (n: string) => `ist Kind von ${n}`,
  isPartnerOf: (n: string) => `ist Partner:in von ${n}`,
  choosePerson: 'Person wählen …',
  link: 'Verbinden',
  deletePerson: 'Person löschen',
  confirmDelete: (n: string) => `${n} und alle Verbindungen dieser Person wirklich löschen?`,

  // Prüfungen
  errSelf: 'Eine Person kann nicht mit sich selbst verbunden werden.',
  errExists: 'Diese Verbindung gibt es schon.',
  errTwoParents: 'Diese Person hat schon zwei Elternteile.',
  errCycle: 'Das geht nicht: Die Person wäre dann ihr eigener Vorfahre.',

  // Verwandtschaft
  kinshipHint: 'Wähle zwei Personen hier aus oder klicke sie nacheinander im Baum an.',
  person1: 'Person 1',
  person2: 'Person 2',
  close: 'Schließen',

  // Anmeldung
  loginIntro: 'Melde dich mit deiner E-Mail-Adresse an. Du bekommst einen Link, mit dem du ohne Passwort hineinkommst.',
  email: 'E-Mail',
  sendLink: 'Anmeldelink schicken',
  linkSent: (e: string) => `Wir haben dir einen Anmeldelink an ${e} geschickt. Öffne ihn auf diesem Gerät.`,
  notInvited:
    'Diese E-Mail-Adresse ist noch nicht freigeschaltet. Bitte frag die Verwalterin des Stammbaums nach einer Einladung.',
};

export type Strings = typeof de;

const tr: Strings = {
  appTitle: 'Soy Ağacımız',
  loading: 'Yükleniyor …',
  addPerson: 'Kişi ekle',
  kinship: 'Akrabalığı hesapla',
  signOut: 'Çıkış yap',
  demoNotice:
    'Deneme modu: Veriler yalnızca bu tarayıcıda saklanır. Ailece kullanılan site için Supabase kurulmalıdır (README’ye bakın).',
  hide: '(gizle)',
  darkMode: 'Koyu tema',
  lightMode: 'Açık tema',
  language: 'Dil',

  emptyTitle: 'Henüz kimse eklenmedi.',
  emptyHint: 'İlk kişiyi eklemek için sağ üstteki artı işaretli simgeye dokun, örneğin kendinle başla.',
  zoomOut: 'Uzaklaştır',
  zoomIn: 'Yakınlaştır',

  newPerson: 'Yeni kişi',
  newParentOf: (n: string) => `${n} için yeni ebeveyn`,
  newChildOf: (n: string) => `${n} için yeni çocuk`,
  newPartnerOf: (n: string) => `${n} için yeni eş`,
  editPerson: (n: string) => `${n} düzenle`,
  choosePhoto: 'Fotoğraf seç',
  removePhoto: 'Fotoğrafı kaldır',
  firstName: 'Ad',
  lastName: 'Soyad',
  birthName: 'Kızlık soyadı',
  bornAs: (n: string) => `kızlık soyadı: ${n}`,
  gender: 'Cinsiyet',
  female: 'kadın',
  male: 'erkek',
  diverse: 'diğer / bilinmiyor',
  birthDate: 'Doğum tarihi',
  deathDate: 'Ölüm tarihi',
  notes: 'Notlar',
  save: 'Kaydet',
  saving: 'Kaydediliyor …',
  cancel: 'Vazgeç',
  errFirstName: 'Lütfen bir ad girin.',
  errDeathBeforeBirth: 'Ölüm tarihi doğum tarihinden önce.',
  errImage: 'Fotoğraf işlenemedi.',
  errStorageFull: 'Tarayıcı belleği dolu. Lütfen daha küçük fotoğraflar kullanın.',
  errSchemaOutdated:
    'Veritabanı güncel değil. Lütfen Supabase SQL Editor’de supabase/schema.sql dosyasının sonundaki satırları çalıştırın.',

  born: 'Doğum',
  died: 'Ölüm',
  edit: 'Düzenle',
  parents: 'Ebeveynler',
  partners: 'Eşler',
  children: 'Çocuklar',
  noneYet: 'Henüz yok.',
  remove: 'kaldır',
  removeLinkTitle: 'Bağlantıyı kaldır',
  confirmUnlink: (n: string) => `${n} ile bağlantı kaldırılsın mı? Kişinin kendisi silinmez.`,
  addNewParent: '+ Yeni kişiyi ebeveyn olarak ekle',
  addNewPartner: '+ Yeni kişiyi eş olarak ekle',
  addNewChild: '+ Yeni kişiyi çocuk olarak ekle',
  linkExisting: 'Mevcut bir kişiyle bağla',
  isParentOf: (n: string) => `${n} kişisinin ebeveyni`,
  isChildOf: (n: string) => `${n} kişisinin çocuğu`,
  isPartnerOf: (n: string) => `${n} kişisinin eşi`,
  choosePerson: 'Kişi seç …',
  link: 'Bağla',
  deletePerson: 'Kişiyi sil',
  confirmDelete: (n: string) => `${n} ve tüm bağlantıları gerçekten silinsin mi?`,

  errSelf: 'Bir kişi kendisiyle bağlanamaz.',
  errExists: 'Bu bağlantı zaten var.',
  errTwoParents: 'Bu kişinin zaten iki ebeveyni var.',
  errCycle: 'Bu olmaz: Kişi kendi atası olurdu.',

  kinshipHint: 'İki kişiyi buradan seç ya da ağaçta sırayla üzerlerine tıkla.',
  person1: '1. kişi',
  person2: '2. kişi',
  close: 'Kapat',

  loginIntro: 'E-posta adresinle giriş yap. Şifresiz giriş için sana bir bağlantı gönderilir.',
  email: 'E-posta',
  sendLink: 'Giriş bağlantısı gönder',
  linkSent: (e: string) => `${e} adresine bir giriş bağlantısı gönderdik. Bağlantıyı bu cihazda aç.`,
  notInvited: 'Bu e-posta adresi henüz yetkilendirilmedi. Lütfen soy ağacının yöneticisinden davet iste.',
};

export const STRINGS: Record<Lang, Strings> = { de, tr };

const LANG_KEY = 'stammbaum-lang';

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'de' || saved === 'tr') return saved;
  } catch {
    // ignorieren
  }
  return navigator.language?.toLowerCase().startsWith('tr') ? 'tr' : 'de';
}

interface LangContext {
  lang: Lang;
  t: Strings;
  setLang: (l: Lang) => void;
}

const Ctx = createContext<LangContext>({ lang: 'de', t: de, setLang: () => {} });

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = STRINGS[lang].appTitle;
  }, [lang]);
  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(LANG_KEY, l);
    } catch {
      // ignorieren
    }
  };
  return <Ctx.Provider value={{ lang, t: STRINGS[lang], setLang }}>{children}</Ctx.Provider>;
}

export function useLang() {
  return useContext(Ctx);
}

/** Macht aus einem beliebigen Fehler eine verständliche Meldung in der gewählten Sprache. */
export function errorText(err: unknown, t: Strings): string {
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === 'object' && err && 'message' in err
        ? String((err as { message: unknown }).message)
        : String(err);
  if (msg === 'storage-full') return t.errStorageFull;
  if (msg === 'image-failed') return t.errImage;
  if (msg === 'schema-outdated') return t.errSchemaOutdated;
  return msg;
}
