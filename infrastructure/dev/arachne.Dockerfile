# infrastructure/dev/arachne.Dockerfile
# Dev image for Arachne with live-reload (air) and Chromium
# Pattern: root user, bind-mounted code from host, hot reload via Air

FROM golang:1.23-alpine

# Install dependencies for headless Chromium, SQLite FTS5 (via CGO), and build tools
RUN apk --no-cache add \
    ca-certificates \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ttf-freefont \
    git \
    bash \
    build-base \
    sqlite-dev \
    sqlite-libs

# Enable automatic toolchain download (allows Air requiring newer Go)
ENV GOTOOLCHAIN=auto
# Enable CGO for sqlite_fts5
ENV CGO_ENABLED=1

# Install air for live reloading
RUN go install github.com/air-verse/air@latest

# Chrome paths
ENV CHROME_BIN=/usr/bin/chromium-browser
ENV CHROME_PATH=/usr/lib/chromium/

WORKDIR /app

# Expose service port
EXPOSE 8080

# Dev runs as root - code is bind-mounted from host, needs write access for:
# - /app/tmp (Air temp files)
# - /app/data (runtime data)
# - Go build cache
# Non-root user is used in production Dockerfile only.

# Air binary is in /go/bin from go install
ENV PATH="/go/bin:${PATH}"

CMD ["air"]
