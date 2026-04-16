FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npx tsc -p tsconfig.agent.json
CMD ["node", "dist/agent.js"]

