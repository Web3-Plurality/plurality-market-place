FROM node:20
WORKDIR /app
# Only package.json — the committed package-lock.json was generated on Windows
# and its optional deps are pruned to win32, so it omits the platform rollup
# binary this linux image needs (@rollup/rollup-linux-x64-gnu). Resolving fresh
# here lets npm pick the correct one. See npm/cli#4828.
COPY package.json ./
RUN npm install --legacy-peer-deps
COPY . .
ENV NODE_OPTIONS=--max-old-space-size=4096
RUN npm run build
RUN npm install -g serve
EXPOSE 3001
CMD ["serve", "-s", "dist", "-l", "3001"]
