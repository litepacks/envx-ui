const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Check if a value is encrypted (starts with "encrypted:")
 * @param {string} value - Value to check
 * @returns {boolean}
 */
function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith('encrypted:');
}

/**
 * Parse .env.keys file to get available keys
 * @param {string} cwd - Current working directory
 * @returns {object} - Object with environment keys
 */
function getKeys(cwd) {
  const keysPath = path.join(cwd, '.env.keys');
  const keys = {};
  
  if (!fs.existsSync(keysPath)) {
    return keys;
  }
  
  try {
    const content = fs.readFileSync(keysPath, 'utf8');
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('#') || trimmed === '') continue;
      
      const eqIndex = line.indexOf('=');
      if (eqIndex !== -1) {
        const key = line.substring(0, eqIndex).trim();
        let value = line.substring(eqIndex + 1).trim();
        
        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        
        // Parse key name to get environment (e.g., DOTENV_PRIVATE_KEY_PRODUCTION)
        const match = key.match(/^DOTENV_PRIVATE_KEY(?:_(.+))?$/);
        if (match) {
          const env = match[1] || 'default';
          keys[env.toLowerCase()] = value;
        }
      }
    }
  } catch (err) {
    console.error('Error reading .env.keys:', err.message);
  }
  
  return keys;
}

/**
 * Get the appropriate key for a given env file
 * @param {string} filename - Env file name (e.g., .env.production)
 * @param {object} keys - Keys object from getKeys()
 * @returns {string|null} - The private key or null
 */
function getKeyForFile(filename, keys) {
  // Extract environment from filename
  // .env -> default
  // .env.production -> production
  // .env.local -> local
  
  if (filename === '.env') {
    return keys['default'] || keys['development'] || null;
  }
  
  const match = filename.match(/^\.env\.(.+)$/);
  if (match) {
    const env = match[1].toLowerCase();
    return keys[env] || null;
  }
  
  return null;
}

/**
 * Decrypt a single encrypted value using dotenvx
 * @param {string} encryptedValue - The encrypted value (with "encrypted:" prefix)
 * @param {string} privateKey - The private key for decryption
 * @returns {string} - Decrypted value or original if decryption fails
 */
function decrypt(encryptedValue, privateKey) {
  if (!isEncrypted(encryptedValue)) {
    return encryptedValue;
  }
  
  if (!privateKey) {
    return encryptedValue; // Return as-is if no key
  }
  
  try {
    // Use dotenvx CLI for decryption
    const result = execSync(
      `npx @dotenvx/dotenvx decrypt -s "${encryptedValue}"`,
      {
        encoding: 'utf8',
        env: { ...process.env, DOTENV_PRIVATE_KEY: privateKey },
        stdio: ['pipe', 'pipe', 'pipe']
      }
    );
    return result.trim();
  } catch (err) {
    console.error('Decryption failed:', err.message);
    return encryptedValue; // Return original on error
  }
}

/**
 * Encrypt a plain value using dotenvx
 * @param {string} plainValue - The plain text value
 * @param {string} publicKey - The public key for encryption (DOTENV_PUBLIC_KEY)
 * @returns {string} - Encrypted value with "encrypted:" prefix
 */
function encrypt(plainValue, publicKey) {
  if (isEncrypted(plainValue)) {
    return plainValue; // Already encrypted
  }
  
  if (!publicKey) {
    throw new Error('Public key required for encryption');
  }
  
  try {
    // Use dotenvx CLI for encryption
    const result = execSync(
      `npx @dotenvx/dotenvx encrypt -s "${plainValue.replace(/"/g, '\\"')}"`,
      {
        encoding: 'utf8',
        env: { ...process.env, DOTENV_PUBLIC_KEY: publicKey },
        stdio: ['pipe', 'pipe', 'pipe']
      }
    );
    return result.trim();
  } catch (err) {
    console.error('Encryption failed:', err.message);
    throw new Error('Encryption failed: ' + err.message);
  }
}

/**
 * Get public keys from .env.keys file
 * @param {string} cwd - Current working directory
 * @returns {object} - Object with public keys by environment
 */
function getPublicKeys(cwd) {
  const keysPath = path.join(cwd, '.env.keys');
  const keys = {};
  
  if (!fs.existsSync(keysPath)) {
    return keys;
  }
  
  try {
    const content = fs.readFileSync(keysPath, 'utf8');
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('#') || trimmed === '') continue;
      
      const eqIndex = line.indexOf('=');
      if (eqIndex !== -1) {
        const key = line.substring(0, eqIndex).trim();
        let value = line.substring(eqIndex + 1).trim();
        
        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        
        // Parse key name to get environment (e.g., DOTENV_PUBLIC_KEY_PRODUCTION)
        const match = key.match(/^DOTENV_PUBLIC_KEY(?:_(.+))?$/);
        if (match) {
          const env = match[1] || 'default';
          keys[env.toLowerCase()] = value;
        }
      }
    }
  } catch (err) {
    console.error('Error reading public keys:', err.message);
  }
  
  return keys;
}

/**
 * Encrypt entire env file using dotenvx CLI
 * @param {string} filepath - Path to the env file
 * @param {string} cwd - Current working directory
 * @returns {boolean} - Success status
 */
function encryptFile(filepath, cwd) {
  try {
    execSync(`npx @dotenvx/dotenvx encrypt -f "${filepath}"`, {
      cwd,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return true;
  } catch (err) {
    console.error('File encryption failed:', err.message);
    throw new Error('Encryption failed: ' + err.message);
  }
}

/**
 * Decrypt entire env file in memory using dotenvx
 * @param {string} filename - Env file name
 * @param {string} cwd - Current working directory
 * @returns {object|null} - Decrypted key-value pairs or null
 */
function decryptFile(filename, cwd) {
  const filepath = path.join(cwd, filename);
  
  try {
    // Use dotenvx to decrypt and get values
    const result = execSync(`npx @dotenvx/dotenvx get -f "${filepath}" --format json`, {
      cwd,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return JSON.parse(result);
  } catch (err) {
    // If decryption fails, return null
    console.error('File decryption failed:', err.message);
    return null;
  }
}

module.exports = {
  isEncrypted,
  getKeys,
  getPublicKeys,
  getKeyForFile,
  decrypt,
  encrypt,
  encryptFile,
  decryptFile
};

