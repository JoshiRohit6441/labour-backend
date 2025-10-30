# Use Node.js official image
FROM node:20

# Create app directory
WORKDIR /usr/src/app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy app source
COPY . .

# ✅ Add this line — generate Prisma client during build
RUN npx prisma generate

# Expose app port
EXPOSE 8000

# Run app
CMD ["npm", "start"]
