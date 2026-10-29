# --- Stage 1: build the React frontend ---
FROM node:22 AS client
WORKDIR /build
COPY client/package.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# --- Stage 2: run the Fastify backend, serving the built frontend ---
FROM node:22
WORKDIR /app
COPY server/package.json server/
RUN cd server && npm install --omit=dev
COPY server/ server/
RUN cd server && npx prisma generate
COPY --from=client /build/dist client/dist
RUN mkdir -p certs && openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
    -keyout certs/key.pem -out certs/cert.pem -subj "/C=FR/O=42/CN=localhost"
ENV CERT_DIR=/app/certs CLIENT_DIR=/app/client/dist
EXPOSE 8443
WORKDIR /app/server
CMD ["sh", "-c", "npx prisma db push --skip-generate && node src/index.js"]
