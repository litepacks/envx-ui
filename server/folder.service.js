const fs = require('fs');
const path = require('path');
const os = require('os');

// Config file location
const CONFIG_DIR = path.join(os.homedir(), '.envx-ui');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

// Default config
const DEFAULT_CONFIG = {
  savedFolders: [],
  recentFolders: [],
  maxRecent: 10
};

/**
 * Ensure config directory exists
 */
function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

/**
 * Load config from file
 * @returns {object} Config object
 */
function loadConfig() {
  ensureConfigDir();
  
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
    }
  } catch (err) {
    console.error('Error loading config:', err.message);
  }
  
  return { ...DEFAULT_CONFIG };
}

/**
 * Save config to file
 * @param {object} config - Config object to save
 */
function saveConfig(config) {
  ensureConfigDir();
  
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving config:', err.message);
  }
}

/**
 * Get saved folders
 * @returns {Array} List of saved folder paths
 */
function getSavedFolders() {
  const config = loadConfig();
  // Filter out folders that no longer exist
  return config.savedFolders.filter(folder => fs.existsSync(folder));
}

/**
 * Add a folder to saved folders
 * @param {string} folderPath - Folder path to save
 * @returns {boolean} Success status
 */
function addSavedFolder(folderPath) {
  const absPath = path.resolve(folderPath);
  
  if (!fs.existsSync(absPath) || !fs.statSync(absPath).isDirectory()) {
    throw new Error('Invalid folder path');
  }
  
  const config = loadConfig();
  
  if (!config.savedFolders.includes(absPath)) {
    config.savedFolders.push(absPath);
    saveConfig(config);
  }
  
  return true;
}

/**
 * Remove a folder from saved folders
 * @param {string} folderPath - Folder path to remove
 * @returns {boolean} Success status
 */
function removeSavedFolder(folderPath) {
  const absPath = path.resolve(folderPath);
  const config = loadConfig();
  
  const index = config.savedFolders.indexOf(absPath);
  if (index > -1) {
    config.savedFolders.splice(index, 1);
    saveConfig(config);
  }
  
  return true;
}

/**
 * Get recent folders
 * @returns {Array} List of recent folder paths with metadata
 */
function getRecentFolders() {
  const config = loadConfig();
  // Filter out folders that no longer exist
  return config.recentFolders
    .filter(item => fs.existsSync(item.path))
    .slice(0, config.maxRecent);
}

/**
 * Add folder to recent folders
 * @param {string} folderPath - Folder path to add
 */
function addRecentFolder(folderPath) {
  const absPath = path.resolve(folderPath);
  
  if (!fs.existsSync(absPath)) return;
  
  const config = loadConfig();
  
  // Remove if already exists
  config.recentFolders = config.recentFolders.filter(item => item.path !== absPath);
  
  // Add to beginning
  config.recentFolders.unshift({
    path: absPath,
    name: path.basename(absPath),
    lastOpened: new Date().toISOString()
  });
  
  // Trim to max
  config.recentFolders = config.recentFolders.slice(0, config.maxRecent);
  
  saveConfig(config);
}

/**
 * Validate folder path
 * @param {string} folderPath - Path to validate
 * @returns {object} Validation result
 */
function validateFolder(folderPath) {
  const absPath = path.resolve(folderPath);
  
  if (!fs.existsSync(absPath)) {
    return { valid: false, error: 'Folder does not exist' };
  }
  
  if (!fs.statSync(absPath).isDirectory()) {
    return { valid: false, error: 'Path is not a directory' };
  }
  
  return { valid: true, path: absPath };
}

/**
 * Get folder info
 * @param {string} folderPath - Folder path
 * @returns {object} Folder information
 */
function getFolderInfo(folderPath) {
  const absPath = path.resolve(folderPath);
  const config = loadConfig();
  
  return {
    path: absPath,
    name: path.basename(absPath),
    isSaved: config.savedFolders.includes(absPath)
  };
}

/**
 * List contents of a directory (folders only)
 * @param {string} dirPath - Directory path to list
 * @returns {Array} List of folder objects
 */
function listDirectory(dirPath) {
  const absPath = path.resolve(dirPath);
  
  if (!fs.existsSync(absPath)) {
    throw new Error('Directory does not exist');
  }
  
  if (!fs.statSync(absPath).isDirectory()) {
    throw new Error('Path is not a directory');
  }
  
  try {
    const items = fs.readdirSync(absPath);
    const folders = [];
    
    for (const item of items) {
      // Skip hidden files/folders (starting with .)
      if (item.startsWith('.')) continue;
      
      const itemPath = path.join(absPath, item);
      try {
        const stat = fs.statSync(itemPath);
        if (stat.isDirectory()) {
          folders.push({
            name: item,
            path: itemPath
          });
        }
      } catch (err) {
        // Skip items we can't read (permission denied, etc.)
        continue;
      }
    }
    
    // Sort alphabetically
    folders.sort((a, b) => a.name.localeCompare(b.name));
    
    return folders;
  } catch (err) {
    throw new Error('Cannot read directory: ' + err.message);
  }
}

/**
 * Get parent directory path
 * @param {string} dirPath - Current directory path
 * @returns {string|null} Parent path or null if at root
 */
function getParentDirectory(dirPath) {
  const absPath = path.resolve(dirPath);
  const parent = path.dirname(absPath);
  
  // Check if we're at root
  if (parent === absPath) {
    return null;
  }
  
  return parent;
}

/**
 * Fuzzy search for folders
 * @param {string} query - Search query
 * @param {number} maxResults - Maximum results to return
 * @returns {Array} List of matching folder paths
 */
function searchFolders(query, maxResults = 20) {
  const homeDir = os.homedir();
  const searchRoots = [
    path.join(homeDir, 'projects'),
    path.join(homeDir, 'Projects'),
    path.join(homeDir, 'Documents'),
    path.join(homeDir, 'Desktop'),
    path.join(homeDir, 'dev'),
    path.join(homeDir, 'Development'),
    path.join(homeDir, 'code'),
    path.join(homeDir, 'Code'),
    path.join(homeDir, 'workspace'),
    path.join(homeDir, 'Workspace'),
    homeDir
  ];
  
  const results = [];
  const seen = new Set();
  const queryLower = query.toLowerCase();
  
  // Search each root directory
  for (const root of searchRoots) {
    if (!fs.existsSync(root)) continue;
    
    try {
      searchDirectory(root, queryLower, results, seen, 0, 3, maxResults);
    } catch (err) {
      // Ignore errors
    }
    
    if (results.length >= maxResults) break;
  }
  
  // Sort by relevance (exact match first, then starts with, then contains)
  results.sort((a, b) => {
    const aName = path.basename(a.path).toLowerCase();
    const bName = path.basename(b.path).toLowerCase();
    
    // Exact match
    if (aName === queryLower && bName !== queryLower) return -1;
    if (bName === queryLower && aName !== queryLower) return 1;
    
    // Starts with
    if (aName.startsWith(queryLower) && !bName.startsWith(queryLower)) return -1;
    if (bName.startsWith(queryLower) && !aName.startsWith(queryLower)) return 1;
    
    // Shorter paths first
    return a.path.length - b.path.length;
  });
  
  return results.slice(0, maxResults);
}

function searchDirectory(dir, query, results, seen, depth, maxDepth, maxResults) {
  if (depth > maxDepth || results.length >= maxResults) return;
  
  try {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      if (results.length >= maxResults) return;
      
      // Skip hidden folders and common non-project folders
      if (item.startsWith('.') || 
          item === 'node_modules' || 
          item === 'vendor' ||
          item === '__pycache__' ||
          item === 'venv' ||
          item === '.git') continue;
      
      const fullPath = path.join(dir, item);
      
      try {
        const stat = fs.statSync(fullPath);
        if (!stat.isDirectory()) continue;
        
        // Check if folder name matches query
        const itemLower = item.toLowerCase();
        if (itemLower.includes(query)) {
          if (!seen.has(fullPath)) {
            seen.add(fullPath);
            results.push({
              name: item,
              path: fullPath,
              parent: dir
            });
          }
        }
        
        // Recurse into subdirectories
        if (depth < maxDepth) {
          searchDirectory(fullPath, query, results, seen, depth + 1, maxDepth, maxResults);
        }
      } catch (err) {
        // Skip folders we can't access
      }
    }
  } catch (err) {
    // Skip directories we can't read
  }
}

module.exports = {
  getSavedFolders,
  addSavedFolder,
  removeSavedFolder,
  getRecentFolders,
  addRecentFolder,
  validateFolder,
  getFolderInfo,
  loadConfig,
  saveConfig,
  listDirectory,
  getParentDirectory,
  searchFolders
};

