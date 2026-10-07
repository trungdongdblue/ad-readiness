# One image for API and worker (the worker needs the Chromium that ships in the Playwright base image).
# The Playwright base image must match the "playwright" version in package-lock.json.
FROM mcr.microsoft.com/playwright:v1.63.0-noble AS app
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
# tsx is a devDependency but runs the server, so install everything.
RUN npm ci --include=dev
COPY tsconfig.json ./
COPY src ./src
COPY web ./web
USER pwuser
CMD ["npx", "tsx", "src/cli/serve.ts"]

FROM app AS web-build
USER root
RUN npm run web:build

FROM nginx:1.27-alpine AS web
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=web-build /app/web/dist /usr/share/nginx/html

# Last stage = what platforms that build the final stage (Railway) get: the API/worker image. docker-compose picks its own targets.
FROM app AS railway
