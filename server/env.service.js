const fs = require('fs');
const path = require('path');

// Supported env file patterns
const ENV_FILE_PATTERNS = [
  '.env',
  '.env.local',
  '.env.development',
  '.env.staging',
  '.env.production',
  '.env.test'
];

/**
 * Scan directory for env files
 * @param {string} cwd - Current working directory
 * @returns {string[]} - List of found env file names
 */
function scanEnvFiles(cwd) {
  const files = [];
  
  try {
    const dirContents = fs.readdirSync(cwd);
    
    for (const file of dirContents) {
      // Match exact patterns or .env.* pattern
      if (ENV_FILE_PATTERNS.includes(file) || /^\.env\.[a-zA-Z0-9_-]+$/.test(file)) {
        // Exclude .env.keys as it's for encryption keys
        if (file !== '.env.keys') {
          const filePath = path.join(cwd, file);
          if (fs.statSync(filePath).isFile()) {
            files.push(file);
          }
        }
      }
    }
  } catch (err) {
    console.error('Error scanning directory:', err.message);
  }
  
  // Sort: .env first, then alphabetically
  return files.sort((a, b) => {
    if (a === '.env') return -1;
    if (b === '.env') return 1;
    return a.localeCompare(b);
  });
}

/**
 * Check if .env.keys file exists
 * @param {string} cwd - Current working directory
 * @returns {boolean}
 */
function hasKeysFile(cwd) {
  return fs.existsSync(path.join(cwd, '.env.keys'));
}

/**
 * Parse an env file preserving structure (comments, empty lines)
 * @param {string} filepath - Full path to env file
 * @returns {object} - Parsed structure with lines array
 */
function parseEnvFile(filepath) {
  const result = {
    filepath,
    lines: []
  };
  
  try {
    const content = fs.readFileSync(filepath, 'utf8');
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const trimmed = raw.trim();
      
      // Empty line
      if (trimmed === '') {
        result.lines.push({ type: 'empty', raw });
        continue;
      }
      
      // Comment line
      if (trimmed.startsWith('#')) {
        result.lines.push({ type: 'comment', raw });
        continue;
      }
      
      // Key-value pair
      const eqIndex = raw.indexOf('=');
      if (eqIndex !== -1) {
        const key = raw.substring(0, eqIndex).trim();
        let value = raw.substring(eqIndex + 1);
        
        // Handle quoted values
        const trimmedValue = value.trim();
        let parsedValue = value;
        
        if ((trimmedValue.startsWith('"') && trimmedValue.endsWith('"')) ||
            (trimmedValue.startsWith("'") && trimmedValue.endsWith("'"))) {
          // Remove quotes
          parsedValue = trimmedValue.slice(1, -1);
        } else {
          parsedValue = trimmedValue;
        }
        
        // Check if value is encrypted
        const encrypted = parsedValue.startsWith('encrypted:');
        
        result.lines.push({
          type: 'entry',
          key,
          value: parsedValue,
          encrypted,
          raw
        });
      } else {
        // Invalid line, keep as-is
        result.lines.push({ type: 'unknown', raw });
      }
    }
  } catch (err) {
    console.error('Error parsing env file:', err.message);
    throw err;
  }
  
  return result;
}

/**
 * Get only the key-value entries from parsed file
 * @param {object} parsed - Parsed env file structure
 * @returns {Array} - Array of entry objects
 */
function getEntries(parsed) {
  return parsed.lines
    .filter(line => line.type === 'entry')
    .map(line => ({
      key: line.key,
      value: line.value,
      encrypted: line.encrypted
    }));
}

/**
 * Write env file back preserving structure
 * @param {string} filepath - Full path to env file
 * @param {object} parsed - Parsed structure to write
 */
function writeEnvFile(filepath, parsed) {
  const lines = parsed.lines.map(line => {
    if (line.type === 'entry') {
      // Determine if we need quotes
      const needsQuotes = line.value.includes(' ') || 
                          line.value.includes('#') ||
                          line.value.includes('\n') ||
                          line.value.includes('"') ||
                          line.value.includes("'");
      
      if (needsQuotes) {
        // Escape double quotes and wrap in double quotes
        const escaped = line.value.replace(/"/g, '\\"');
        return `${line.key}="${escaped}"`;
      }
      return `${line.key}=${line.value}`;
    }
    return line.raw;
  });
  
  fs.writeFileSync(filepath, lines.join('\n'), 'utf8');
}

/**
 * Add a new key to parsed structure
 * @param {object} parsed - Parsed env file structure
 * @param {string} key - New key name
 * @param {string} value - New value
 * @returns {object} - Updated parsed structure
 */
function addEntry(parsed, key, value) {
  // Check if key already exists
  const existing = parsed.lines.find(l => l.type === 'entry' && l.key === key);
  if (existing) {
    throw new Error(`Key "${key}" already exists`);
  }
  
  const encrypted = value.startsWith('encrypted:');
  
  parsed.lines.push({
    type: 'entry',
    key,
    value,
    encrypted,
    raw: `${key}=${value}`
  });
  
  return parsed;
}

/**
 * Update an existing key's value
 * @param {object} parsed - Parsed env file structure
 * @param {string} key - Key to update
 * @param {string} newValue - New value
 * @returns {object} - Updated parsed structure
 */
function updateEntry(parsed, key, newValue) {
  const entry = parsed.lines.find(l => l.type === 'entry' && l.key === key);
  if (!entry) {
    throw new Error(`Key "${key}" not found`);
  }
  
  entry.value = newValue;
  entry.encrypted = newValue.startsWith('encrypted:');
  entry.raw = `${key}=${newValue}`;
  
  return parsed;
}

/**
 * Delete a key from parsed structure
 * @param {object} parsed - Parsed env file structure
 * @param {string} key - Key to delete
 * @returns {object} - Updated parsed structure
 */
function deleteEntry(parsed, key) {
  const index = parsed.lines.findIndex(l => l.type === 'entry' && l.key === key);
  if (index === -1) {
    throw new Error(`Key "${key}" not found`);
  }
  
  parsed.lines.splice(index, 1);
  return parsed;
}

/**
 * Validate key name
 * @param {string} key - Key to validate
 * @returns {boolean}
 */
function isValidKey(key) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(key);
}

module.exports = {
  scanEnvFiles,
  hasKeysFile,
  parseEnvFile,
  getEntries,
  writeEnvFile,
  addEntry,
  updateEntry,
  deleteEntry,
  isValidKey
};

