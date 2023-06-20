ARG NODE_VERSION=18
ARG NPM_VERSION=9.7.1

FROM node:${NODE_VERSION}-slim AS base
ARG NPM_VERSION
RUN npm install -g npm@${NPM_VERSION}

FROM base AS build
WORKDIR /opt/app/
ADD ./package.json ./package.json
ADD ./package-lock.json ./package-lock.json
ADD ./tsconfig.json ./tsconfig.json
RUN npm ci
ADD ./src ./src
RUN npm run build

FROM base AS production-packages
WORKDIR /opt/app/
ADD ./package.json ./package.json
ADD ./package-lock.json ./package-lock.json
RUN npm ci --omit=dev
COPY --from=build /opt/app/dist /opt/app/dist

FROM gcr.io/distroless/nodejs${NODE_VERSION}-debian11 AS app
WORKDIR /opt/app
COPY --from=production-packages /opt/app/package.json ./package.json
COPY --from=production-packages /opt/app/package-lock.json ./package-lock.json
COPY --from=production-packages /opt/app/node_modules ./node_modules
COPY --from=production-packages /opt/app/dist ./dist
CMD ["dist/index.js"]