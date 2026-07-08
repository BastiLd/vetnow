# VetNow Studio — optionaler Image-Build (Alternative zur docker-compose.yml).
# Baut ein Image, das das Repo beim Start klont und Studio startet.
FROM node:22-bookworm

ENV REPO_URL="https://github.com/BastiLd/vetnow.git" \
    REPO_ROOT="/repo" \
    STUDIO_DATA_DIR="/data" \
    STUDIO_PORT="3000" \
    EXPO_NO_TELEMETRY="1"

# git ist in node:22-bookworm bereits enthalten.
COPY entrypoint.sh /usr/local/bin/vetnow-entrypoint.sh
RUN chmod +x /usr/local/bin/vetnow-entrypoint.sh

VOLUME ["/repo", "/data"]
EXPOSE 3000 8081

ENTRYPOINT ["/usr/local/bin/vetnow-entrypoint.sh"]
