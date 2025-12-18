/**
 * envx-ui - Client-side Application
 */

// ============================================
// State
// ============================================
const state = {
  currentFile: null,
  entries: [],
  hasPrivateKey: false,
  visibleValues: new Set(),
  editingKey: null,
  cwd: window.__INITIAL_DATA__?.cwd || '',
  folderInfo: window.__INITIAL_DATA__?.folderInfo || {},
  folderPanelOpen: false
};

// ============================================
// DOM Elements
// ============================================
const elements = {
  fileList: document.getElementById('file-list'),
  entriesBody: document.getElementById('entries-body'),
  currentFileName: document.getElementById('current-file-name'),
  btnAddKey: document.getElementById('btn-add-key'),
  btnEncrypt: document.getElementById('btn-encrypt'),
  btnNewFile: document.getElementById('btn-new-file'),
  modalAddKey: document.getElementById('modal-add-key'),
  modalNewFile: document.getElementById('modal-new-file'),
  formAddKey: document.getElementById('form-add-key'),
  formNewFile: document.getElementById('form-new-file'),
  toastContainer: document.getElementById('toast-container'),
  // Folder elements
  btnFolder: document.getElementById('btn-folder'),
  folderPanel: document.getElementById('folder-panel'),
  folderPathInput: document.getElementById('folder-path-input'),
  btnOpenFolder: document.getElementById('btn-open-folder'),
  btnSaveFolder: document.getElementById('btn-save-folder'),
  btnUnsaveFolder: document.getElementById('btn-unsave-folder'),
  currentFolderName: document.getElementById('current-folder-name'),
  savedFolders: document.getElementById('saved-folders'),
  recentFolders: document.getElementById('recent-folders')
};

// ============================================
// API Functions
// ============================================
async function api(endpoint, options = {}) {
  const response = await fetch(`/api${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'API request failed');
  }
  
  return data;
}

async function fetchFiles() {
  return api('/files');
}

async function fetchFileContent(filename) {
  return api(`/files/${encodeURIComponent(filename)}`);
}

async function addKey(filename, key, value) {
  return api(`/files/${encodeURIComponent(filename)}/keys`, {
    method: 'POST',
    body: JSON.stringify({ key, value })
  });
}

async function updateKey(filename, key, value) {
  return api(`/files/${encodeURIComponent(filename)}/keys/${encodeURIComponent(key)}`, {
    method: 'PUT',
    body: JSON.stringify({ value })
  });
}

async function deleteKey(filename, key) {
  return api(`/files/${encodeURIComponent(filename)}/keys/${encodeURIComponent(key)}`, {
    method: 'DELETE'
  });
}

async function encryptFile(filename) {
  return api(`/files/${encodeURIComponent(filename)}/encrypt`, {
    method: 'POST'
  });
}

async function createFile(filename) {
  return api('/files', {
    method: 'POST',
    body: JSON.stringify({ filename })
  });
}

// Folder API functions
async function changeFolder(folderPath) {
  return api('/folder/change', {
    method: 'POST',
    body: JSON.stringify({ path: folderPath })
  });
}

async function saveFolder(folderPath) {
  return api('/folder/saved', {
    method: 'POST',
    body: JSON.stringify({ path: folderPath })
  });
}

async function unsaveFolder(folderPath) {
  return api('/folder/saved', {
    method: 'DELETE',
    body: JSON.stringify({ path: folderPath })
  });
}

async function fetchSavedFolders() {
  return api('/folder/saved');
}

async function fetchRecentFolders() {
  return api('/folder/recent');
}

// ============================================
// UI Functions
// ============================================
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  elements.toastContainer.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 200);
  }, 3000);
}

function openModal(modal) {
  modal.classList.remove('hidden');
  const input = modal.querySelector('input');
  if (input) {
    setTimeout(() => input.focus(), 100);
  }
}

function closeModal(modal) {
  modal.classList.add('hidden');
  const form = modal.querySelector('form');
  if (form) form.reset();
}

function maskValue(value, length = 8) {
  return '•'.repeat(Math.min(length, value.length || 8));
}

function renderFileList(files) {
  if (files.length === 0) {
    elements.fileList.innerHTML = '<p class="empty-state">No .env files found</p>';
    return;
  }
  
  elements.fileList.innerHTML = files.map((file, index) => `
    <button 
      class="file-item ${file === state.currentFile ? 'active' : ''}" 
      data-file="${file}"
    >
      <span class="file-icon">📄</span>
      <span class="file-name">${file}</span>
    </button>
  `).join('');
}

function renderEntries() {
  if (!state.currentFile || state.entries.length === 0) {
    elements.entriesBody.innerHTML = `
      <tr class="empty-row">
        <td colspan="3">
          <div class="empty-state">
            ${state.currentFile 
              ? 'No environment variables in this file' 
              : 'Select a file from the sidebar to view environment variables'}
          </div>
        </td>
      </tr>
    `;
    return;
  }
  
  elements.entriesBody.innerHTML = state.entries.map(entry => {
    const isVisible = state.visibleValues.has(entry.key);
    const isEditing = state.editingKey === entry.key;
    const displayValue = entry.decryptedValue || entry.value;
    const isEncrypted = entry.encrypted;
    
    return `
      <tr data-key="${entry.key}">
        <td>
          <span class="entry-key">
            ${isEncrypted ? '<span class="encrypted-icon" title="Encrypted">🔐</span>' : ''}
            ${entry.key}
          </span>
        </td>
        <td>
          <div class="entry-value">
            ${isEditing ? `
              <input 
                type="text" 
                class="value-input" 
                value="${escapeHtml(displayValue)}"
                data-key="${entry.key}"
              >
              <button class="btn btn-sm btn-success" onclick="saveEdit('${entry.key}')">Save</button>
              <button class="btn btn-sm btn-ghost" onclick="cancelEdit()">Cancel</button>
            ` : `
              <span class="value-display ${isVisible ? '' : 'masked'} ${isEncrypted && !entry.decryptedValue ? 'encrypted' : ''}">
                ${isVisible 
                  ? escapeHtml(displayValue) 
                  : (isEncrypted && !entry.decryptedValue ? escapeHtml(entry.value.substring(0, 40) + '...') : maskValue(displayValue))}
              </span>
            `}
          </div>
        </td>
        <td>
          <div class="entry-actions">
            ${!isEditing ? `
              <button 
                class="btn btn-icon btn-ghost" 
                onclick="toggleVisibility('${entry.key}')"
                title="${isVisible ? 'Hide value' : 'Show value'}"
              >
                ${isVisible ? '🙈' : '👁'}
              </button>
              <button 
                class="btn btn-icon btn-ghost" 
                onclick="startEdit('${entry.key}')"
                title="Edit value"
                ${isEncrypted && !entry.decryptedValue ? 'disabled' : ''}
              >
                ✏️
              </button>
              <button 
                class="btn btn-icon btn-danger" 
                onclick="confirmDelete('${entry.key}')"
                title="Delete key"
              >
                🗑
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================
// Folder Panel Functions
// ============================================
function toggleFolderPanel() {
  state.folderPanelOpen = !state.folderPanelOpen;
  elements.folderPanel.classList.toggle('hidden', !state.folderPanelOpen);
  elements.btnFolder.classList.toggle('active', state.folderPanelOpen);
  
  if (state.folderPanelOpen) {
    elements.folderPathInput.focus();
  }
}

function closeFolderPanel() {
  state.folderPanelOpen = false;
  elements.folderPanel.classList.add('hidden');
  elements.btnFolder.classList.remove('active');
}

function renderFolderList(containerId, folders, isRecent = false) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  container.innerHTML = folders.map(folder => {
    const path = isRecent ? folder.path : folder;
    const name = isRecent ? folder.name : path.split('/').pop();
    
    return `
      <button class="folder-item" data-path="${escapeHtml(path)}">
        <span class="folder-item-icon">📁</span>
        <span class="folder-item-name" title="${escapeHtml(path)}">${escapeHtml(name)}</span>
        <span class="folder-item-path">${escapeHtml(path)}</span>
      </button>
    `;
  }).join('');
  
  // Add click handlers
  container.querySelectorAll('.folder-item').forEach(item => {
    item.addEventListener('click', () => {
      handleFolderChange(item.dataset.path);
    });
  });
}

function updateFolderUI(folderInfo) {
  state.folderInfo = folderInfo;
  state.cwd = folderInfo.path;
  
  // Update folder name display
  if (elements.currentFolderName) {
    elements.currentFolderName.textContent = folderInfo.name;
  }
  
  // Update save/unsave button
  const saveBtn = document.getElementById('btn-save-folder');
  const unsaveBtn = document.getElementById('btn-unsave-folder');
  
  if (folderInfo.isSaved) {
    if (saveBtn) saveBtn.style.display = 'none';
    if (unsaveBtn) unsaveBtn.style.display = 'inline-flex';
  } else {
    if (saveBtn) saveBtn.style.display = 'inline-flex';
    if (unsaveBtn) unsaveBtn.style.display = 'none';
  }
}

async function handleFolderChange(folderPath) {
  try {
    const data = await changeFolder(folderPath);
    
    // Update state
    state.cwd = data.cwd;
    state.currentFile = null;
    state.entries = [];
    state.visibleValues.clear();
    state.editingKey = null;
    
    // Update UI
    updateFolderUI(data.folderInfo);
    renderFileList(data.files);
    renderEntries();
    
    // Disable buttons until file is selected
    elements.btnAddKey.disabled = true;
    elements.btnEncrypt.disabled = true;
    elements.currentFileName.textContent = 'Select a file';
    
    // Close folder panel
    closeFolderPanel();
    
    // Refresh folder lists
    refreshFolderLists();
    
    // Auto-select first file if available
    if (data.files.length > 0) {
      selectFile(data.files[0]);
    }
    
    showToast(`Opened ${data.folderInfo.name}`);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleSaveFolder() {
  try {
    await saveFolder(state.cwd);
    state.folderInfo.isSaved = true;
    updateFolderUI(state.folderInfo);
    refreshFolderLists();
    showToast('Folder saved');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleUnsaveFolder() {
  try {
    await unsaveFolder(state.cwd);
    state.folderInfo.isSaved = false;
    updateFolderUI(state.folderInfo);
    refreshFolderLists();
    showToast('Folder removed from saved');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function refreshFolderLists() {
  try {
    const [savedData, recentData] = await Promise.all([
      fetchSavedFolders(),
      fetchRecentFolders()
    ]);
    
    renderFolderList('saved-folders', savedData.folders, false);
    renderFolderList('recent-folders', recentData.folders, true);
  } catch (err) {
    console.error('Failed to refresh folder lists:', err);
  }
}

// ============================================
// Folder Search (Fuzzy)
// ============================================
let searchTimeout = null;
let selectedSearchIndex = -1;

async function searchFolders(query) {
  if (!query || query.length < 2) {
    hideSearchResults();
    return;
  }
  
  const resultsContainer = document.getElementById('folder-search-results');
  if (!resultsContainer) return;
  
  resultsContainer.innerHTML = '<div class="folder-search-loading">Searching...</div>';
  resultsContainer.classList.remove('hidden');
  
  try {
    const response = await api(`/folder/search?q=${encodeURIComponent(query)}`);
    
    if (response.results && response.results.length > 0) {
      renderSearchResults(response.results);
    } else {
      resultsContainer.innerHTML = '<div class="folder-search-empty">No folders found</div>';
    }
  } catch (err) {
    resultsContainer.innerHTML = `<div class="folder-search-empty">Error: ${escapeHtml(err.message)}</div>`;
  }
}

function renderSearchResults(results) {
  const resultsContainer = document.getElementById('folder-search-results');
  if (!resultsContainer) return;
  
  selectedSearchIndex = -1;
  
  resultsContainer.innerHTML = results.map((folder, index) => `
    <button class="folder-search-item" data-path="${escapeHtml(folder.path)}" data-index="${index}">
      <span class="folder-search-item-name">
        <span>📁</span>
        ${escapeHtml(folder.name)}
      </span>
      <span class="folder-search-item-path">${escapeHtml(folder.path)}</span>
    </button>
  `).join('');
  
  // Add click handlers (use mousedown to beat blur event)
  resultsContainer.querySelectorAll('.folder-search-item').forEach(item => {
    item.addEventListener('mousedown', (e) => {
      e.preventDefault(); // Prevent blur
      selectSearchResult(item.dataset.path);
    });
  });
}

function selectSearchResult(path) {
  hideSearchResults();
  const searchInput = document.getElementById('folder-search-input');
  if (searchInput) searchInput.value = '';
  handleFolderChange(path);
}

function hideSearchResults() {
  const resultsContainer = document.getElementById('folder-search-results');
  if (resultsContainer) {
    resultsContainer.classList.add('hidden');
  }
  selectedSearchIndex = -1;
}

function navigateSearchResults(direction) {
  const resultsContainer = document.getElementById('folder-search-results');
  if (!resultsContainer || resultsContainer.classList.contains('hidden')) return;
  
  const items = resultsContainer.querySelectorAll('.folder-search-item');
  if (items.length === 0) return;
  
  // Remove previous selection
  items.forEach(item => item.classList.remove('selected'));
  
  // Calculate new index
  if (direction === 'down') {
    selectedSearchIndex = (selectedSearchIndex + 1) % items.length;
  } else {
    selectedSearchIndex = selectedSearchIndex <= 0 ? items.length - 1 : selectedSearchIndex - 1;
  }
  
  // Apply selection
  items[selectedSearchIndex].classList.add('selected');
  items[selectedSearchIndex].scrollIntoView({ block: 'nearest' });
}

function selectCurrentSearchResult() {
  const resultsContainer = document.getElementById('folder-search-results');
  if (!resultsContainer || resultsContainer.classList.contains('hidden')) return false;
  
  const items = resultsContainer.querySelectorAll('.folder-search-item');
  if (selectedSearchIndex >= 0 && selectedSearchIndex < items.length) {
    selectSearchResult(items[selectedSearchIndex].dataset.path);
    return true;
  }
  return false;
}

// ============================================
// Actions
// ============================================
async function selectFile(filename) {
  if (state.currentFile === filename) return;
  
  state.currentFile = filename;
  state.visibleValues.clear();
  state.editingKey = null;
  
  // Update UI
  elements.currentFileName.textContent = filename;
  elements.btnAddKey.disabled = false;
  elements.btnEncrypt.disabled = false;
  
  // Update active state in file list
  document.querySelectorAll('.file-item').forEach(item => {
    item.classList.toggle('active', item.dataset.file === filename);
  });
  
  // Show loading state
  elements.entriesBody.innerHTML = `
    <tr class="empty-row">
      <td colspan="3">
        <div class="empty-state">
          <span class="spinner"></span> Loading...
        </div>
      </td>
    </tr>
  `;
  
  try {
    const data = await fetchFileContent(filename);
    state.entries = data.entries;
    state.hasPrivateKey = data.hasPrivateKey;
    renderEntries();
  } catch (err) {
    showToast(err.message, 'error');
    state.entries = [];
    renderEntries();
  }
}

function toggleVisibility(key) {
  if (state.visibleValues.has(key)) {
    state.visibleValues.delete(key);
  } else {
    state.visibleValues.add(key);
  }
  renderEntries();
}

function startEdit(key) {
  state.editingKey = key;
  renderEntries();
  
  // Focus the input
  setTimeout(() => {
    const input = document.querySelector(`.value-input[data-key="${key}"]`);
    if (input) {
      input.focus();
      input.select();
    }
  }, 50);
}

function cancelEdit() {
  state.editingKey = null;
  renderEntries();
}

async function saveEdit(key) {
  const input = document.querySelector(`.value-input[data-key="${key}"]`);
  if (!input) return;
  
  const newValue = input.value;
  
  try {
    await updateKey(state.currentFile, key, newValue);
    
    // Update local state
    const entry = state.entries.find(e => e.key === key);
    if (entry) {
      entry.value = newValue;
      entry.decryptedValue = newValue;
      entry.encrypted = newValue.startsWith('encrypted:');
    }
    
    state.editingKey = null;
    renderEntries();
    showToast(`Updated ${key}`);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function confirmDelete(key) {
  if (!confirm(`Delete "${key}"?`)) return;
  
  try {
    await deleteKey(state.currentFile, key);
    state.entries = state.entries.filter(e => e.key !== key);
    renderEntries();
    showToast(`Deleted ${key}`);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleAddKey(e) {
  e.preventDefault();
  
  const keyInput = document.getElementById('new-key-name');
  const valueInput = document.getElementById('new-key-value');
  
  const key = keyInput.value.trim();
  const value = valueInput.value;
  
  if (!key) {
    showToast('Key name is required', 'error');
    return;
  }
  
  try {
    await addKey(state.currentFile, key, value);
    
    state.entries.push({
      key,
      value,
      encrypted: false,
      decryptedValue: value
    });
    
    closeModal(elements.modalAddKey);
    renderEntries();
    showToast(`Added ${key}`);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleNewFile(e) {
  e.preventDefault();
  
  const nameInput = document.getElementById('new-file-name');
  const filename = nameInput.value.trim();
  
  if (!filename || !filename.startsWith('.env')) {
    showToast('Invalid filename', 'error');
    return;
  }
  
  try {
    await createFile(filename);
    
    // Refresh file list
    const data = await fetchFiles();
    renderFileList(data.files);
    
    closeModal(elements.modalNewFile);
    showToast(`Created ${filename}`);
    
    // Select the new file
    selectFile(filename);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleEncrypt() {
  if (!state.currentFile) return;
  
  if (!confirm(`Encrypt all values in ${state.currentFile}?\n\nThis will encrypt all plain text values using dotenvx.`)) {
    return;
  }
  
  try {
    elements.btnEncrypt.disabled = true;
    elements.btnEncrypt.innerHTML = '<span class="spinner"></span> Encrypting...';
    
    await encryptFile(state.currentFile);
    
    // Refresh file content
    const data = await fetchFileContent(state.currentFile);
    state.entries = data.entries;
    renderEntries();
    
    showToast('File encrypted successfully');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    elements.btnEncrypt.disabled = false;
    elements.btnEncrypt.innerHTML = '<span class="icon">🔐</span> Encrypt';
  }
}

// ============================================
// Event Listeners
// ============================================
function initEventListeners() {
  // File selection
  elements.fileList.addEventListener('click', (e) => {
    const fileItem = e.target.closest('.file-item');
    if (fileItem) {
      selectFile(fileItem.dataset.file);
    }
  });
  
  // Add key button
  elements.btnAddKey.addEventListener('click', () => {
    openModal(elements.modalAddKey);
  });
  
  // New file button
  elements.btnNewFile.addEventListener('click', () => {
    openModal(elements.modalNewFile);
  });
  
  // Encrypt button
  elements.btnEncrypt.addEventListener('click', handleEncrypt);
  
  // Add key form
  elements.formAddKey.addEventListener('submit', handleAddKey);
  
  // New file form
  elements.formNewFile.addEventListener('submit', handleNewFile);
  
  // Modal close buttons
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.modal');
      if (modal) closeModal(modal);
    });
  });
  
  // Modal backdrop click
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', () => {
      const modal = backdrop.closest('.modal');
      if (modal) closeModal(modal);
    });
  });
  
  // Folder panel toggle
  if (elements.btnFolder) {
    elements.btnFolder.addEventListener('click', toggleFolderPanel);
  }
  
  // Open folder button
  if (elements.btnOpenFolder) {
    elements.btnOpenFolder.addEventListener('click', () => {
      const path = elements.folderPathInput.value.trim();
      if (path) {
        handleFolderChange(path);
      }
    });
  }
  
  // Folder path input enter key
  if (elements.folderPathInput) {
    elements.folderPathInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const path = elements.folderPathInput.value.trim();
        if (path) {
          handleFolderChange(path);
        }
      }
    });
  }
  
  // Folder search input
  const folderSearchInput = document.getElementById('folder-search-input');
  if (folderSearchInput) {
    // Debounced search on input
    folderSearchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        searchFolders(e.target.value.trim());
      }, 200);
    });
    
    // Keyboard navigation
    folderSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        navigateSearchResults('down');
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        navigateSearchResults('up');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (!selectCurrentSearchResult()) {
          // If no selection, treat input as path
          const path = folderSearchInput.value.trim();
          if (path) {
            handleFolderChange(path);
          }
        }
      } else if (e.key === 'Escape') {
        hideSearchResults();
      }
    });
    
    // Hide results when input loses focus
    folderSearchInput.addEventListener('blur', () => {
      // Small delay to allow click on results
      setTimeout(hideSearchResults, 200);
    });
  }
  
  // Save folder button
  const saveBtn = document.getElementById('btn-save-folder');
  if (saveBtn) {
    saveBtn.addEventListener('click', handleSaveFolder);
  }
  
  // Unsave folder button
  const unsaveBtn = document.getElementById('btn-unsave-folder');
  if (unsaveBtn) {
    unsaveBtn.addEventListener('click', handleUnsaveFolder);
  }
  
  // Folder list item clicks (using event delegation)
  if (elements.folderPanel) {
    elements.folderPanel.addEventListener('click', (e) => {
      const folderItem = e.target.closest('.folder-item');
      if (folderItem) {
        const path = folderItem.dataset.path;
        if (path) {
          handleFolderChange(path);
        }
      }
    });
  }
  
  // Close folder panel when clicking outside
  document.addEventListener('click', (e) => {
    if (state.folderPanelOpen) {
      const isInsidePanel = elements.folderPanel.contains(e.target);
      const isToggleButton = elements.btnFolder.contains(e.target);
      
      if (!isInsidePanel && !isToggleButton) {
        closeFolderPanel();
      }
    }
  });
  
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Escape to cancel edit or close modal/panel
    if (e.key === 'Escape') {
      if (state.folderPanelOpen) {
        closeFolderPanel();
      } else if (state.editingKey) {
        cancelEdit();
      } else {
        document.querySelectorAll('.modal:not(.hidden)').forEach(modal => {
          closeModal(modal);
        });
      }
    }
    
    // Enter to save edit
    if (e.key === 'Enter' && state.editingKey) {
      const input = document.querySelector('.value-input:focus');
      if (input) {
        e.preventDefault();
        saveEdit(state.editingKey);
      }
    }
    
    // Ctrl+S to save current edit
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      if (state.editingKey) {
        e.preventDefault();
        saveEdit(state.editingKey);
      }
    }
    
    // Ctrl+N to add new key
    if ((e.ctrlKey || e.metaKey) && e.key === 'n' && state.currentFile) {
      e.preventDefault();
      openModal(elements.modalAddKey);
    }
    
    // Ctrl+O to open folder panel
    if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
      e.preventDefault();
      toggleFolderPanel();
    }
  });
}

// ============================================
// Initialize
// ============================================
function init() {
  initEventListeners();
  
  // Initialize folder info
  if (window.__INITIAL_DATA__?.folderInfo) {
    updateFolderUI(window.__INITIAL_DATA__.folderInfo);
  }
  
  // Select first file if available
  if (window.__INITIAL_DATA__?.files?.length > 0) {
    selectFile(window.__INITIAL_DATA__.files[0]);
  }
}

// Start app
document.addEventListener('DOMContentLoaded', init);
