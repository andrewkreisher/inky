const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Function to run commands and log output
function runCommand(command) {
  console.log(`Running: ${command}`);
  try {
    const output = execSync(command, { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error(`Error running command: ${command}`);
    console.error(error);
    return false;
  }
}

// Function to create file if it doesn't exist
function createFileIfNotExists(filePath, content) {
  if (!fs.existsSync(filePath)) {
    console.log(`Creating file: ${filePath}`);
    fs.writeFileSync(filePath, content);
  }
}

// Main setup function
async function setup() {
  console.log('Starting Inky game setup...');

  // 1. Install dependencies
  console.log('\nInstalling dependencies...');
  runCommand('npm install express@^4.18.2 phaser@^3.60.0 socket.io@^4.7.2 socket.io-client@^4.7.2');
  runCommand('npm install -D vite@^4.4.5 @vitejs/plugin-react@^4.0.3');

  // 2. Create vite.config.js if it doesn't exist
  createFileIfNotExists('vite.config.js', `
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true
      }
    }
  }
});
  `);

  // 3. Update package.json scripts
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  if (!packageJson.scripts.server) {
    packageJson.scripts.server = 'node server.js';
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  }

  // 4. Create start script
  createFileIfNotExists('start.js', `
const { spawn } = require('child_process');

// Start the backend server
const server = spawn('npm', ['run', 'server'], { stdio: 'inherit' });

// Start the frontend server
const frontend = spawn('npm', ['run', 'dev'], { stdio: 'inherit' });

// Handle process termination
process.on('SIGINT', () => {
  server.kill();
  frontend.kill();
  process.exit();
});

process.on('SIGTERM', () => {
  server.kill();
  frontend.kill();
  process.exit();
});
  `);

  // 5. Add start script to package.json
  if (!packageJson.scripts.start) {
    packageJson.scripts.start = 'node start.js';
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  }

  console.log('\nSetup complete!');
  console.log('\nTo start the game, run:');
  console.log('npm start');
  console.log('\nThe game will be available at: http://localhost:5173');
}

setup(); 