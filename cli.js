#!/usr/bin/env node

/**
 * envx-ui - CLI Entry Point
 * 
 * A minimal local UI for managing dotenvx environment files.
 * 
 * Usage:
 *   node cli.js [--port PORT]
 *   npx envx-ui
 */

const { startServer } = require('./server');

// ============================================
// Parse Arguments
// ============================================
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    port: 0, // 0 = OS assigns random available port
    cwd: process.cwd()
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--port' || arg === '-p') {
      const portArg = args[i + 1];
      if (portArg && !portArg.startsWith('-')) {
        const port = parseInt(portArg, 10);
        if (!isNaN(port) && port > 0 && port < 65536) {
          config.port = port;
        }
        i++;
      }
    }
    
    if (arg === '--help' || arg === '-h') {
      showHelp();
      process.exit(0);
    }
    
    if (arg === '--version' || arg === '-v') {
      const pkg = require('./package.json');
      console.log(`envx-ui v${pkg.version}`);
      process.exit(0);
    }
  }
  
  return config;
}

function showHelp() {
  console.log(`
envx-ui - Local UI for managing dotenvx environment files

Usage:
  node cli.js [options]
  npx envx-ui [options]

Options:
  -p, --port PORT   Port to run server on (default: random)
  -h, --help        Show this help message
  -v, --version     Show version number

Examples:
  node cli.js                    # Start on random port (more secure)
  node cli.js --port 8080        # Start on specific port
  npx envx-ui                    # Run via npx

Security:
  - Uses random port by default to prevent browser extension attacks
  - Protected with helmet.js security headers
  - Only accessible from localhost

The UI will automatically open in your default browser.
Press Ctrl+C to stop the server.
`);
}

// ============================================
// Browser Launch
// ============================================
async function openBrowser(url) {
  try {
    // Dynamic import for ESM module
    const open = await import('open');
    await open.default(url);
  } catch (err) {
    // Fallback if open package fails
    console.log(`\n  Open in browser: ${url}\n`);
  }
}

// ============================================
// Main
// ============================================
async function main() {
  const config = parseArgs();
  
  console.log('\n  ⚡ envx-ui\n');
  
  try {
    // Start server (port 0 = OS assigns random available port)
    const server = startServer(config.port, config.cwd, async (actualPort) => {
      const url = `http://127.0.0.1:${actualPort}`;
      console.log(`  Server running at: ${url}`);
      console.log('  Press Ctrl+C to stop\n');
      
      // Open browser
      await openBrowser(url);
    });
    
    // Graceful shutdown
    const shutdown = () => {
      console.log('\n  Shutting down...');
      server.close(() => {
        console.log('  Server stopped\n');
        process.exit(0);
      });
      
      // Force exit after timeout
      setTimeout(() => {
        console.log('  Forced exit');
        process.exit(1);
      }, 3000);
    };
    
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    
  } catch (err) {
    console.error(`  Error: ${err.message}\n`);
    process.exit(1);
  }
}

// Run
main();
