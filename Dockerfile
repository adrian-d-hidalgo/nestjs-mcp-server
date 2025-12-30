FROM node:22.14

# Set working directory
WORKDIR /package

# Install required system dependencies
RUN apt-get update && \
  apt-get install -y --no-install-recommends \
  git \
  curl \
  && rm -rf /var/lib/apt/lists/*

# Install PNPM and NestJS CLI globally
RUN npm install -g pnpm@10 @nestjs/cli

# Set ownership of workdir to node user before copying files
RUN chown -R node:node /package

# Copy package files with correct ownership
COPY --chown=node:node package.json pnpm-lock.yaml ./

# Switch to node user for dependency installation
USER node

# Install dependencies as node user
RUN pnpm install

# Copy the rest of the application code with correct ownership
COPY --chown=node:node . .

EXPOSE 3000 9229 6277

# Command to start development server
CMD ["tail", "-f", "/dev/null"]
