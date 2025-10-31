FROM node:lts-alpine
WORKDIR /app

# Copy package files and install dependencies
COPY package.json ./
COPY tsconfig.json ./
RUN npm install --ignore-scripts

# Copy the rest of the source code and build
COPY . .
RUN npm run build

# Expose MCP default port if needed (MCP over stdio, so not exposing ports)

# Default command: Expecting user to provide Mixpanel credentials
CMD ["node", "build/index.js", "YOUR_SERVICE_ACCOUNT_USERNAME", "YOUR_SERVICE_ACCOUNT_PASSWORD", "YOUR_PROJECT_ID"]
