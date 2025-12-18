const express = require('express');
const path = require('path');
const helmet = require('helmet');
const envService = require('./env.service');
const cryptoService = require('./crypto.service');
const folderService = require('./folder.service');

/**
 * Create and configure Express app
 * @param {string} initialCwd - Initial working directory
 * @returns {express.Application}
 */
function createApp(initialCwd) {
  const app = express();
  
  // Security middleware - protect from browser extensions and XSS
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        scriptSrcAttr: ["'unsafe-inline'"], // Allow inline event handlers
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        styleSrcElem: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: null
      }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginResourcePolicy: { policy: "same-origin" },
    originAgentCluster: true,
    referrerPolicy: { policy: "no-referrer" },
    xContentTypeOptions: true,
    xDnsPrefetchControl: { allow: false },
    xDownloadOptions: true,
    xFrameOptions: { action: "deny" },
    xPermittedCrossDomainPolicies: { permittedPolicies: "none" },
    xPoweredBy: false,
    xXssProtection: true
  }));
  
  // Middleware
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '../public')));
  
  // View engine
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '../views'));
  
  // Store cwd in app.locals (mutable)
  app.locals.cwd = initialCwd;
  
  // Add initial folder to recent
  folderService.addRecentFolder(initialCwd);
  
  // Helper to get current cwd
  const getCwd = () => app.locals.cwd;
  
  // ============================================
  // PAGE ROUTES
  // ============================================
  
  // Main page
  app.get('/', (req, res) => {
    const cwd = getCwd();
    const files = envService.scanEnvFiles(cwd);
    const hasKeys = envService.hasKeysFile(cwd);
    const folderInfo = folderService.getFolderInfo(cwd);
    const savedFolders = folderService.getSavedFolders();
    const recentFolders = folderService.getRecentFolders();
    
    res.render('index', { 
      files, 
      hasKeys,
      cwd,
      folderInfo,
      savedFolders,
      recentFolders
    });
  });
  
  // ============================================
  // FOLDER API ROUTES
  // ============================================
  
  // Get current folder info
  app.get('/api/folder', (req, res) => {
    try {
      const cwd = getCwd();
      const folderInfo = folderService.getFolderInfo(cwd);
      res.json(folderInfo);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // Change current folder
  app.post('/api/folder/change', (req, res) => {
    try {
      const { path: folderPath } = req.body;
      
      if (!folderPath) {
        return res.status(400).json({ error: 'Path is required' });
      }
      
      const validation = folderService.validateFolder(folderPath);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }
      
      // Update cwd
      app.locals.cwd = validation.path;
      
      // Add to recent
      folderService.addRecentFolder(validation.path);
      
      // Get new folder data
      const cwd = getCwd();
      const files = envService.scanEnvFiles(cwd);
      const hasKeys = envService.hasKeysFile(cwd);
      const folderInfo = folderService.getFolderInfo(cwd);
      
      res.json({ 
        success: true, 
        cwd,
        files,
        hasKeys,
        folderInfo
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // Get saved folders
  app.get('/api/folder/saved', (req, res) => {
    try {
      const folders = folderService.getSavedFolders();
      res.json({ folders });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // Add folder to saved
  app.post('/api/folder/saved', (req, res) => {
    try {
      const { path: folderPath } = req.body;
      const pathToSave = folderPath || getCwd();
      
      folderService.addSavedFolder(pathToSave);
      res.json({ success: true, path: pathToSave });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });
  
  // Remove folder from saved
  app.delete('/api/folder/saved', (req, res) => {
    try {
      const { path: folderPath } = req.body;
      
      if (!folderPath) {
        return res.status(400).json({ error: 'Path is required' });
      }
      
      folderService.removeSavedFolder(folderPath);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // Get recent folders
  app.get('/api/folder/recent', (req, res) => {
    try {
      const folders = folderService.getRecentFolders();
      res.json({ folders });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // Browse directory (list subfolders)
  app.get('/api/folder/browse', (req, res) => {
    try {
      const { path: dirPath } = req.query;
      const targetPath = dirPath || require('os').homedir();
      
      const folders = folderService.listDirectory(targetPath);
      const parent = folderService.getParentDirectory(targetPath);
      
      res.json({
        current: targetPath,
        parent,
        folders
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });
  
  // Search folders (fuzzy search)
  app.get('/api/folder/search', (req, res) => {
    try {
      const { q } = req.query;
      
      if (!q || q.length < 2) {
        return res.json({ results: [] });
      }
      
      const results = folderService.searchFolders(q, 15);
      res.json({ results });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // ============================================
  // ENV FILE API ROUTES
  // ============================================
  
  // API: List env files
  app.get('/api/files', (req, res) => {
    try {
      const cwd = getCwd();
      const files = envService.scanEnvFiles(cwd);
      const hasKeys = envService.hasKeysFile(cwd);
      res.json({ files, hasKeys, cwd });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // API: Get file content
  app.get('/api/files/:filename', (req, res) => {
    try {
      const cwd = getCwd();
      const { filename } = req.params;
      const filepath = path.join(cwd, filename);
      
      // Security: Only allow .env files
      if (!filename.startsWith('.env')) {
        return res.status(400).json({ error: 'Invalid file' });
      }
      
      const parsed = envService.parseEnvFile(filepath);
      const entries = envService.getEntries(parsed);
      
      // Try to decrypt encrypted values
      const keys = cryptoService.getKeys(cwd);
      const privateKey = cryptoService.getKeyForFile(filename, keys);
      
      // Attempt to get decrypted values using dotenvx
      let decryptedValues = null;
      if (privateKey) {
        decryptedValues = cryptoService.decryptFile(filename, cwd);
      }
      
      // Merge decrypted values with entries
      const result = entries.map(entry => {
        const decrypted = decryptedValues && decryptedValues[entry.key];
        return {
          key: entry.key,
          value: entry.value,
          encrypted: entry.encrypted,
          decryptedValue: decrypted || (entry.encrypted ? null : entry.value)
        };
      });
      
      res.json({
        filename,
        entries: result,
        hasPrivateKey: !!privateKey
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // API: Add new key
  app.post('/api/files/:filename/keys', (req, res) => {
    try {
      const cwd = getCwd();
      const { filename } = req.params;
      const { key, value } = req.body;
      
      if (!key || typeof key !== 'string') {
        return res.status(400).json({ error: 'Key is required' });
      }
      
      if (!envService.isValidKey(key)) {
        return res.status(400).json({ error: 'Invalid key format. Use alphanumeric and underscores, starting with letter or underscore.' });
      }
      
      const filepath = path.join(cwd, filename);
      const parsed = envService.parseEnvFile(filepath);
      
      envService.addEntry(parsed, key, value || '');
      envService.writeEnvFile(filepath, parsed);
      
      res.json({ success: true, key, value: value || '' });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });
  
  // API: Update key value
  app.put('/api/files/:filename/keys/:key', (req, res) => {
    try {
      const cwd = getCwd();
      const { filename, key } = req.params;
      const { value } = req.body;
      
      if (typeof value !== 'string') {
        return res.status(400).json({ error: 'Value is required' });
      }
      
      const filepath = path.join(cwd, filename);
      const parsed = envService.parseEnvFile(filepath);
      
      envService.updateEntry(parsed, key, value);
      envService.writeEnvFile(filepath, parsed);
      
      res.json({ success: true, key, value });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });
  
  // API: Delete key
  app.delete('/api/files/:filename/keys/:key', (req, res) => {
    try {
      const cwd = getCwd();
      const { filename, key } = req.params;
      const filepath = path.join(cwd, filename);
      const parsed = envService.parseEnvFile(filepath);
      
      envService.deleteEntry(parsed, key);
      envService.writeEnvFile(filepath, parsed);
      
      res.json({ success: true, key });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });
  
  // API: Encrypt file
  app.post('/api/files/:filename/encrypt', (req, res) => {
    try {
      const cwd = getCwd();
      const { filename } = req.params;
      const filepath = path.join(cwd, filename);
      
      cryptoService.encryptFile(filepath, cwd);
      
      res.json({ success: true, message: 'File encrypted successfully' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // API: Get available keys info
  app.get('/api/keys', (req, res) => {
    try {
      const cwd = getCwd();
      const privateKeys = cryptoService.getKeys(cwd);
      const publicKeys = cryptoService.getPublicKeys(cwd);
      
      res.json({
        hasKeysFile: envService.hasKeysFile(cwd),
        environments: Object.keys(privateKeys),
        publicKeyEnvironments: Object.keys(publicKeys)
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // API: Create new env file
  app.post('/api/files', (req, res) => {
    try {
      const cwd = getCwd();
      const { filename } = req.body;
      
      if (!filename || !filename.startsWith('.env')) {
        return res.status(400).json({ error: 'Invalid filename' });
      }
      
      const filepath = path.join(cwd, filename);
      
      if (require('fs').existsSync(filepath)) {
        return res.status(400).json({ error: 'File already exists' });
      }
      
      require('fs').writeFileSync(filepath, '# Environment variables\n', 'utf8');
      
      res.json({ success: true, filename });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  return app;
}

/**
 * Start the Express server
 * @param {number} port - Port to listen on
 * @param {string} cwd - Current working directory
 * @param {function} callback - Callback when server starts
 * @returns {http.Server}
 */
function startServer(port, cwd, callback) {
  const app = createApp(cwd);
  
  // Listen only on localhost (127.0.0.1) for security
  // Port 0 = OS assigns random available port
  const server = app.listen(port, '127.0.0.1', () => {
    const actualPort = server.address().port;
    if (callback) callback(actualPort);
  });
  
  return server;
}

module.exports = { createApp, startServer };
