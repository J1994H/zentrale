# Zentrale

Meine persönliche Schaltzentrale fürs iPhone, gebaut als Web-App (PWA).

- **Heute**: Suche, Claude fragen, 3 Aufgaben für heute, die nächsten 7 Tage, Schnellzugriff auf Apps
- **Brain-Dump**: Gedanken loswerden, die App sortiert sie (Aufgabe, Liste, Obsidian)
- **Listen**: To-do, Packlisten, Einkauf, Essensplan, mit Vorlagen

## Datenschutz

- Alle Daten bleiben auf dem Gerät (im Browser-Speicher). In diesem Repository liegen keine persönlichen Daten.
- Keine externen Dienste, keine Statistik, keine fremden Schriften oder Bibliotheken.
- Eine Content Security Policy blockiert Verbindungen zu fremden Servern.
- Sichern und Wiederherstellen unter **Einstellungen → Deine Daten**.

## Auf dem iPhone installieren

1. Die GitHub-Pages-Adresse in **Safari** öffnen.
2. **Teilen** → **Zum Home-Bildschirm**.

## Lokal testen (Windows)

```
powershell -NoProfile -ExecutionPolicy Bypass -File tools/serve.ps1 -Port 8080
```

Dann `http://localhost:8080` öffnen.

## Neue Version veröffentlichen

In `sw.js` die Nummer bei `CACHE` erhöhen (z. B. `zentrale-v4`), damit das iPhone die neuen Dateien lädt.
