#!/usr/bin/env bash
# Stage the Next.js standalone production server into the Tauri resource dir,
# with the layout `next build` (output: 'standalone') expects at runtime:
#   kroex-server/apps/web/server.js            (entrypoint)
#   kroex-server/apps/web/.next/static/...      (static assets)
#   kroex-server/apps/web/public/...            (public assets)
#   kroex-server/node_modules/...               (minimal traced deps)
# Run by Tauri's beforeBuildCommand. Idempotent.
set -euo pipefail

DESKTOP_DIR="$(cd "$(dirname "$0")" && pwd)"
WEB_DIR="$DESKTOP_DIR/../web"
DEST="$DESKTOP_DIR/src-tauri/kroex-server"

if [ ! -f "$WEB_DIR/.next/standalone/apps/web/server.js" ]; then
  echo "stage-server: standalone build not found — run 'next build' (output: standalone) first" >&2
  exit 1
fi

rm -rf "$DEST"
mkdir -p "$DEST"
cp -R "$WEB_DIR/.next/standalone/." "$DEST/"
mkdir -p "$DEST/apps/web/.next"
cp -R "$WEB_DIR/.next/static" "$DEST/apps/web/.next/static"
if [ -d "$WEB_DIR/public" ]; then
  cp -R "$WEB_DIR/public" "$DEST/apps/web/public"
fi
echo "stage-server: staged into $DEST"
