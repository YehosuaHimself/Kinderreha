# Wissens-Hub · Tagesbetreuung Kinderreha

**Pädagogisches Knowledge-Ecosystem** für das Erzieher-Team der Fachklinik Prinzregent Luitpold (Scheidegg) — Single Source of Truth, Onboarding-Pfad, Schulungs-Curriculum und auditierbarer Bestandteil des Qualitätsmanagements.

Träger: Katholische Jugendfürsorge der Diözese Augsburg e.V. (KJF).
Zielgruppe: Erzieherinnen und Erzieher in der pädagogischen Tagesbetreuung von Kindern (5–12 Jahre) mit psychischen und psychosomatischen Indikationen.

---

## Was hier ist

| Datei | Inhalt |
|---|---|
| `index.html` | Der interaktive Wissens-Hub als Progressive Web App — Login-Gate, Onboarding, sechs Lernpfade mit 29 Modulen, sieben Diagnose-Karten, 26 Wissensartikel, 12 FAQ, Notfall-Modul mit QR-Picker, Volltextsuche, Mobile-Install-Gate. |
| `sw.js` | Service Worker — network-first für HTML, cache-first für Assets, force-reload aller Clients beim Update. |
| `qr.js` | Eigenständiger QR-Code-Encoder (Project-Nayuki-Algorithmus, byte-mode, ECC-M). Erzeugt zur Laufzeit den dynamischen Notfall-QR. |
| `manifest.webmanifest` | PWA-Manifest mit Icons, Theme-Color, Shortcuts (Notfall · Diagnose · Lernen). |
| `icon-*.png`, `apple-touch-icon.png`, `favicon.*` | Vollständiges Icon-Set in allen Größen — 192/512/maskable/180/multi-res favicon. |
| `Paedagogisches_Konzept_Tagesbetreuung_Kinderreha.docx` | Schriftliches Voll-Konzept · 14 Kapitel · 21 Seiten · QM-tauglich. Word-Original. |
| `Paedagogisches_Konzept_Tagesbetreuung_Kinderreha.pdf` | Dasselbe als PDF — auditierbar, druckbar, archivierbar. |

---

## Architektur

**Single-Page-Anwendung als PWA.** Login via Session-Cookie. Inhalte client-seitig gerendert aus JS-Daten-Strukturen. Suche client-seitig über vier Index-Quellen (Sektionen, Lernpfade, Diagnose-Karten, KB-Artikel, FAQ).

**Mobile Install Gate.** Auf mobilen Browsern (`max-width: 980px`) wird ein Vollbild-Gate gezeigt, das zur Installation als PWA auffordert (iOS Safari: „Zum Home-Bildschirm hinzufügen"; Android Chrome: `beforeinstallprompt`-Button). PWA-Modus (`display-mode: standalone`) blendet das Gate automatisch aus.

**Notfall-Flow.** Im Hub erreichbar über den Notfall-Button in der Top-Bar. Auf Desktop: QR-Code, der beim Scannen mit der Smartphone-Kamera eine URL mit `#notfall-picker` öffnet → Picker mit allen Notfall-Nummern → `tel:`-Link → nativer Dialer. Auf Mobile: direkt Picker.

**Methodischer Rahmen.** Marte Meo (nach Maria Aarts) als Beziehungsleitlinie · Trauma-informierte Pädagogik als Querschnittshaltung · Christliche Werteorientierung der KJF · Institutionelles Schutzkonzept nach Präventionsordnung der Deutschen Bischofskonferenz, § 8a und § 72a SGB VIII.

---

## Deployment

PWA-Features (Service Worker, Install-Prompt, Offline) funktionieren **nur über HTTPS oder localhost** — `file://` triggert keinen Install-Prompt. Für den Echtbetrieb müssen alle Dateien (`index.html`, `sw.js`, `qr.js`, `manifest.webmanifest`, alle Icons) im gleichen Ordner auf einem Webserver liegen.

Für interne Klinik-Nutzung: Intranet-HTTPS-Server der Klinik / KJF. Keine externen Tracker, keine externen Fonts, keine externen CDNs — vollständig autark.

---

## Zugang

Internes Tool · ausschließlich für Mitarbeitende der pädagogischen Tagesbetreuung. Login-Gate mit Team-Zugangsdaten. Nicht für externe Weitergabe.

---

## Version

`v2.0` · Stand Mai 2026 · Wartung jährlich oder anlassbezogen früher.

