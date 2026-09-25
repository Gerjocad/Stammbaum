# Unser Stammbaum

Eine Website, auf der die Familie gemeinsam ihren Stammbaum ansieht und pflegt.

- Personen mit Vorname, Nachname, Geschlecht, Geburts- und Todesdatum, Foto und Notizen anlegen und bearbeiten
- Eltern, Kinder und Partner:innen verbinden, auch direkt beim Anlegen („+ Neue Person als Kind“)
- Stammbaum als Grafik, Generation für Generation, mit Zoom
- Verwandtschaftsgrad zwischen zwei beliebigen Personen berechnen (z. B. „Emre ist der Cousin 1. Grades von Cemre“), inklusive Schwieger-, Stief- und angeheirateter Verwandtschaft
- Anmeldung per E-Mail-Link, nur für eingeladene Familienmitglieder
- Oberfläche auf Deutsch oder Türkisch, mit türkischen Verwandtschaftsbegriffen (Amca, Dayı, Hala, Teyze, Babaanne, Anneanne, Enişte, Yenge …)
- Helles und dunkles Design zum Umschalten

Technik: React + TypeScript mit Vite. Daten, Fotos und Anmeldung liegen bei [Supabase](https://supabase.com) (kostenloser Tarif reicht). Die Website selbst wird über GitHub Pages veröffentlicht.

## Ausprobieren ohne Einrichtung

```bash
npm install
npm run dev
```

Ohne Supabase-Zugangsdaten läuft die App im **Demo-Modus**: Alles wird nur im eigenen Browser gespeichert.

## Einrichten für die Familie (einmalig)

1. **Supabase-Projekt anlegen** auf [supabase.com](https://supabase.com) (kostenlos, Region z. B. Frankfurt).
2. Im Dashboard unter **SQL Editor** den Inhalt von [`supabase/schema.sql`](supabase/schema.sql) einfügen und ausführen. Das legt die Tabellen, die Zugriffsregeln und den Foto-Speicher an.
3. Unter **Authentication → Sign In / Providers** die Option **„Allow new users to sign up“ ausschalten**. So kommen nur Leute hinein, die du einlädst.
4. Unter **Authentication → URL Configuration** als *Site URL* und unter *Redirect URLs* die Adresse der Website eintragen, z. B. `https://gerjocad.github.io/Stammbaum/`.
5. Familienmitglieder unter **Authentication → Users → Invite user** per E-Mail einladen.
6. Unter **Project Settings → API** die *Project URL* und den *anon public key* kopieren und im GitHub-Repository unter **Settings → Secrets and variables → Actions → Variables** als `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` eintragen. (Der anon key ist für den Browser gedacht; geschützt werden die Daten durch die Zugriffsregeln aus Schritt 2.)
7. Im GitHub-Repository unter **Settings → Pages** als Quelle **GitHub Actions** wählen.

Danach wird die Website bei jeder Änderung auf `main` automatisch neu gebaut und veröffentlicht.

Für die lokale Entwicklung mit echten Daten `.env.example` nach `.env` kopieren und die beiden Werte eintragen.

## Gut zu wissen

- Fotos werden vor dem Hochladen auf 600 Pixel verkleinert. Sie liegen unter einer zufälligen Adresse, die nur kennt, wer eingeloggt ist, sind aber technisch ohne Login abrufbar, wenn jemand die Adresse hat.
- Jede Person kann höchstens zwei Elternteile haben, und niemand kann sein eigener Vorfahre werden.
- GitHub Pages ist für öffentliche Repositories kostenlos. Die Familiendaten liegen nicht im Repository, sondern bei Supabase.

## Entwicklung

```bash
npm test        # Tests für die Verwandtschaftsberechnung
npm run build   # Typprüfung und Produktions-Build
```

Aufbau:

- `src/kinship.ts` – Verwandtschaftsgrad zwischen zwei Personen
- `src/layout.ts` – Anordnung des Baums (Generationen, Paare, Linien)
- `src/store.ts` – Speicherung in Supabase bzw. im Browser (Demo)
- `src/i18n.tsx` – Texte auf Deutsch und Türkisch
- `src/components/` – Baum, Personenansicht, Formular, Verwandtschaftsrechner, Anmeldung
