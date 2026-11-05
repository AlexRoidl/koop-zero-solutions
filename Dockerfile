# Meme generator — editor + /overview gallery.
FROM node:20-alpine

WORKDIR /app

# Zero runtime dependencies — just copy the source.
COPY . .

# Reverse proxy must reach the server, so bind all interfaces in the container.
ENV HOST=0.0.0.0
ENV PORT=3000
# Saved memes live on a mounted volume.
ENV DATA_DIR=/data

EXPOSE 3000

CMD ["node", "server.js"]
