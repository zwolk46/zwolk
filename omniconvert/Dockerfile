FROM node:24-bookworm-slim

WORKDIR /app

# Optional but recommended: install common converters to maximize coverage.
# This image is intentionally "batteries included" and may be large.
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      ffmpeg \
      imagemagick \
      pandoc \
      ghostscript \
      p7zip-full \
      inkscape \
      libreoffice \
      calibre \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src
COPY web ./web
COPY test ./test

RUN npm run build

ENV HOST=0.0.0.0
ENV PORT=3099

EXPOSE 3099

CMD ["node", "dist/server.js"]

