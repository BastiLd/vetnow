#!/usr/bin/env bash
# VetNow Studio — Entrypoint (für den Dockerfile-Weg). Klont/aktualisiert das
# Repo, installiert Studio, baut die Web-App vor und startet den Server.
set -e

REPO_URL="${REPO_URL:-https://github.com/BastiLd/vetnow.git}"
REPO_ROOT="${REPO_ROOT:-/repo}"

if [ ! -d "$REPO_ROOT/.git" ]; then
  echo "==> Klone $REPO_URL"
  git clone "$REPO_URL" "$REPO_ROOT"
else
  echo "==> Aktualisiere Repo"
  git -C "$REPO_ROOT" pull --ff-only || true
fi

echo "==> Installiere Studio-Abhängigkeiten"
( cd "$REPO_ROOT/studio" && npm install --omit=dev )

echo "==> Baue Web-App vor (saubere Version, für sofortige Vorschau)"
( cd "$REPO_ROOT/web" && npm ci && VITE_VN_CLEAN=true npm run build ) || echo "Web-Build übersprungen (später im Studio nachholbar)"

echo "==> Installiere Mobile-Abhängigkeiten (für Expo)"
( cd "$REPO_ROOT/mobile" && npm ci ) || echo "Mobile-Deps übersprungen (beim ersten Expo-Start nachholbar)"

echo "==> Avocado at Law: Web vorbauen + Expo-Deps installieren"
( cd "$REPO_ROOT/avocado/web" && mkdir -p dist && cp index.html styles.css *.jsx dist/ ) || echo "Avocado-Web übersprungen"
( cd "$REPO_ROOT/avocado/mobile" && npm install --no-audit --no-fund ) || echo "Avocado-Mobile-Deps übersprungen (beim ersten Expo-Start nachholbar)"

echo "==> Starte VetNow Studio"
exec node "$REPO_ROOT/studio/server.js"
