// Time Capsule - Zero-Knowledge Frontend
// ALL encryption/decryption happens on client
// Server NEVER sees plaintext or private keys

// Dynamic API base URL - uses the same protocol and host as the frontend
// Uses port 8443 for HTTPS, 8080 for HTTP
const API_BASE = window.location.protocol + '//' + window.location.hostname + ':' + (window.location.protocol === 'https:' ? '8443' : '8080');

// Global state
let currentUser = null;
let token = null;
let keyPair = null;
let privateKeyPEM = null;
let registrationKeyPair = null; // Store generated keys during registration
let usernameCheckTimeout = null; // For debouncing username check

// Pagination state
let paginationState = {
    capsules: [],           // Loaded capsule metadata
    page: 1,                // Current page
    limit: 20,              // Items per page
    totalCount: 0,          // Total capsules
    hasMore: true,          // Whether more pages exist
    isLoading: false,       // Loading state for initial load
    isLoadingMore: false    // Loading state for pagination
};

// Decryption state
let decryptionState = {
    decryptedContents: new Map(),     // capsule.id -> decrypted content
    queuedForDecryption: new Set(),   // capsule IDs waiting to decrypt
    decrypting: new Set(),            // capsule IDs currently decrypting
    failed: new Map()                 // capsule.id -> error message
};

// Intersection Observer
let intersectionObserver = null;
let observedElements = new Map();

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    setupEventListeners();

    // Load private key FIRST, before checking auth
    await loadPrivateKeyFromStorage();

    // Now check auth (this will call showDashboard which uses capsules)
    checkExistingAuth();

    // Show settings button on auth screen (for theme settings)
    if (!token) {
        document.getElementById('settings-btn').style.display = 'flex';
    }
});

function setupEventListeners() {
    // Auth tabs
    document.querySelectorAll('.auth-tab').forEach(btn => {
        btn.addEventListener('click', (e) => {
            switchTab(e.target.dataset.tab);
        });
    });

    // Register - username availability check
    const registerUsername = document.getElementById('register-username');
    if (registerUsername) {
        registerUsername.addEventListener('input', debounce(checkUsernameAvailability, 500));
    }

    // Register form submission
    document.getElementById('register-form').addEventListener('submit', handleRegister);

    // Login
    document.getElementById('login-form').addEventListener('submit', handleLogin);

    // Navigation
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    document.getElementById('settings-btn').addEventListener('click', () => showModal('settings-modal'));
    document.getElementById('close-settings').addEventListener('click', () => hideModal('settings-modal'));

    // Dashboard - Open Settings button
    const openSettingsKeyBtn = document.getElementById('open-settings-key-btn');
    if (openSettingsKeyBtn) {
        openSettingsKeyBtn.addEventListener('click', () => showModal('settings-modal'));
    }

    // Private key modal buttons
    const closeKeyModalBtn = document.getElementById('close-key-modal');
    if (closeKeyModalBtn) {
        closeKeyModalBtn.addEventListener('click', () => hideModal('private-key-modal'));
    }

    const copyKeyBtn = document.getElementById('copy-key-btn');
    if (copyKeyBtn) {
        copyKeyBtn.addEventListener('click', copyPrivateKeyToClipboard);
    }

    const downloadKeyModalBtn = document.getElementById('download-key-modal-btn');
    if (downloadKeyModalBtn) {
        downloadKeyModalBtn.addEventListener('click', downloadPrivateKeyFromModal);
    }

    const continueAfterKeyBtn = document.getElementById('continue-after-key-btn');
    if (continueAfterKeyBtn) {
        continueAfterKeyBtn.addEventListener('click', continueAfterRegistration);
    }

    // Settings - key method tabs
    document.querySelectorAll('[data-key-method]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const method = e.target.dataset.keyMethod;
            document.querySelectorAll('[data-key-method]').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');

            if (method === 'paste') {
                document.getElementById('key-method-paste').classList.remove('hidden');
                document.getElementById('key-method-upload').classList.add('hidden');
            } else {
                document.getElementById('key-method-paste').classList.add('hidden');
                document.getElementById('key-method-upload').classList.remove('hidden');
            }
        });
    });

    // Settings - file upload
    const fileInput = document.getElementById('private-key-file');
    if (fileInput) {
        fileInput.addEventListener('change', handlePrivateKeyUpload);
    }

    // Settings
    document.getElementById('save-private-key-btn').addEventListener('click', savePrivateKey);
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            setTheme(e.target.closest('.theme-btn').dataset.theme);
        });
    });

    // Upload
    document.getElementById('capsule-image').addEventListener('change', handleImagePreview);
    document.getElementById('upload-form').addEventListener('submit', handleUpload);

    // Key banner event listeners (if banner exists)
    const keyBannerUploadBtn = document.getElementById('key-banner-upload-btn');
    const keyBannerDismiss = document.getElementById('key-banner-dismiss');

    if (keyBannerUploadBtn) {
        keyBannerUploadBtn.addEventListener('click', () => {
            showModal('settings-modal');
        });
    }

    if (keyBannerDismiss) {
        keyBannerDismiss.addEventListener('click', () => {
            localStorage.setItem('keyBannerDismissed', 'true');
            document.getElementById('key-banner').classList.add('hidden');
        });
    }

    // Close modal on backdrop click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
            }
        });
    });
}

// ===== Theme Management =====
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'system';
    setTheme(savedTheme);
    updateThemeButtons(savedTheme);
}

function setTheme(theme) {
    let effectiveTheme = theme;
    if (theme === 'system') {
        effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    if (effectiveTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem('theme', theme);
    updateThemeButtons(theme);
}

function updateThemeButtons(theme) {
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === theme);
    });
}

// ===== State Management =====
function resetPaginationState() {
    // Clear all pagination state
    paginationState = {
        capsules: [],
        page: 1,
        limit: 20,
        totalCount: 0,
        hasMore: true,
        isLoading: false,
        isLoadingMore: false
    };

    // Clear all decryption state
    decryptionState.decryptedContents.clear();
    decryptionState.queuedForDecryption.clear();
    decryptionState.decrypting.clear();
    decryptionState.failed.clear();

    // Disconnect and clear observer
    if (intersectionObserver) {
        intersectionObserver.disconnect();
        intersectionObserver = null;
        observedElements.clear();
    }
}

function appendCapsules(newCapsules) {
    paginationState.capsules = [...paginationState.capsules, ...newCapsules];
}

function queueForDecryption(capsuleId) {
    // Only queue if not already decrypted, queued, or decrypting
    if (!decryptionState.decryptedContents.has(capsuleId) &&
        !decryptionState.queuedForDecryption.has(capsuleId) &&
        !decryptionState.decrypting.has(capsuleId)) {
        decryptionState.queuedForDecryption.add(capsuleId);
        processDecryptionQueue();
    }
}

function processDecryptionQueue() {
    // Process up to 3 concurrent decryptions
    const CONCURRENT_DECRYPTIONS = 3;

    while (decryptionState.queuedForDecryption.size > 0 &&
           decryptionState.decrypting.size < CONCURRENT_DECRYPTIONS) {
        const capsuleId = decryptionState.queuedForDecryption.values().next().value;
        decryptionState.queuedForDecryption.delete(capsuleId);
        decryptCapsule(capsuleId);
    }
}

function updateKeyBannerVisibility() {
    const banner = document.getElementById('key-banner');
    const privateKeySection = document.getElementById('private-key-section');
    const feed = document.getElementById('feed');

    if (privateKeyPEM) {
        // Key is loaded - hide banner, private key section, and show feed with decrypted capsules
        if (banner) banner.classList.add('hidden');
        if (privateKeySection) privateKeySection.classList.add('hidden');
        if (feed) feed.style.display = 'flex';
    } else {
        // No key - show private key section, hide feed (capsules not visible)
        if (banner) banner.classList.add('hidden');
        if (privateKeySection) privateKeySection.classList.remove('hidden');
        if (feed) feed.style.display = 'none';
    }

    // Update last upload indicator visibility (merged function)
    updateUploadIndicator();
}

// ===== Auth Tab Switching =====
function switchTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    if (tab === 'login') {
        document.getElementById('login-form').classList.remove('hidden');
        document.getElementById('register-form').classList.add('hidden');
    } else {
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('register-form').classList.remove('hidden');
    }
}
// ===== Key Generation Utilities =====
async function exportKeyToPEM(key, type) {
    const exported = await window.crypto.subtle.exportKey(type === 'public' ? 'spki' : 'pkcs8', key);
    const exportedAsString = String.fromCharCode.apply(null, new Uint8Array(exported));
    const exportedAsBase64 = btoa(exportedAsString);
    const pemHeader = type === 'public' ? '-----BEGIN PUBLIC KEY-----' : '-----BEGIN PRIVATE KEY-----';
    const pemFooter = type === 'public' ? '-----END PUBLIC KEY-----' : '-----END PRIVATE KEY-----';
    return pemHeader + '\n' + exportedAsBase64.match(/.{1,64}/g).join('\n') + '\n' + pemFooter;
}

// ===== Authentication =====
async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    try {
        const response = await fetch(API_BASE + '/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        if (response.ok) {
            token = data.token;
            localStorage.setItem('token', token);
            showToast('Login successful!', 'success');
            showDashboard();
        } else {
            showToast('Invalid credentials', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showToast('Login failed', 'error');
    }
}

function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('privateKey');
    token = null;
    currentUser = null;
    privateKeyPEM = null;

    // Hide username from header
    document.getElementById('header-username').style.display = 'none';

    // Hide private key section in settings (user is logged out)
    const settingsKeySection = document.getElementById('settings-private-key-section');
    if (settingsKeySection) {
        settingsKeySection.style.display = 'none';
    }

    // Clear all state and revoke blob URLs
    resetPaginationState();

    // Revoke all blob URLs to free memory
    document.querySelectorAll('.capsule-image img').forEach(img => {
        if (img.src && img.src.startsWith('blob:')) {
            URL.revokeObjectURL(img.src);
        }
    });

    document.getElementById('auth-view').classList.add('active');
    document.getElementById('dashboard-view').classList.remove('active');
    document.getElementById('logout-btn').style.display = 'none';
    document.getElementById('settings-btn').style.display = 'flex'; // Show settings on auth screen for theme
    showToast('Logged out', 'info');
}

function checkExistingAuth() {
    token = localStorage.getItem('token');
    if (token) showDashboard();
}

// ===== Dashboard =====
function showDashboard() {
    const payload = JSON.parse(atob(token.split('.')[1]));
    currentUser = payload.username;
    document.getElementById('auth-view').classList.remove('active');
    document.getElementById('dashboard-view').classList.add('active');
    document.getElementById('logout-btn').style.display = 'flex';
    document.getElementById('settings-btn').style.display = 'flex';

    // Show username in header
    const headerUsername = document.getElementById('header-username');
    headerUsername.textContent = currentUser;
    headerUsername.style.display = 'block';

    // Show private key section in settings (user is logged in)
    const settingsKeySection = document.getElementById('settings-private-key-section');
    if (settingsKeySection) {
        settingsKeySection.style.display = 'block';
    }

    // Reset state and setup
    resetPaginationState();
    setupIntersectionObserver();

    // Load initial capsules
    loadCapsules().then(() => {
        // Update banner visibility after capsules are loaded
        updateKeyBannerVisibility();
    });
}

// ===== Capsules =====
async function loadCapsules() {
    // Prevent duplicate requests
    if (paginationState.isLoading || paginationState.isLoadingMore) {
        return;
    }

    const isFirstLoad = paginationState.page === 1;
    const loadingState = isFirstLoad ? 'isLoading' : 'isLoadingMore';

    paginationState[loadingState] = true;

    try {
        const params = new URLSearchParams({
            page: paginationState.page.toString(),
            limit: paginationState.limit.toString()
        });

        const response = await fetch(
            API_BASE + '/capsule/list?' + params.toString(),
            { headers: { 'Authorization': 'Bearer ' + token } }
        );

        if (!response.ok) throw new Error('HTTP ' + response.status);

        const data = await response.json();

        // Update pagination state
        appendCapsules(data.capsules);
        paginationState.totalCount = data.total_count;
        paginationState.hasMore = data.has_more;

        // Render new capsules
        renderNewCapsules(data.capsules);

        // Setup observers for new capsules
        observeAllCapsules();

    } catch (error) {
        console.error('Load capsules error:', error);
        showToast('Failed to load capsules', 'error');
    } finally {
        paginationState[loadingState] = false;
    }
}

function loadNextPage() {
    if (paginationState.hasMore && !paginationState.isLoadingMore) {
        paginationState.page++;
        loadCapsules();
    }
}

function renderNewCapsules(newCapsules) {
    const feed = document.getElementById('feed');

    // Remove empty state if it exists
    const emptyState = feed.querySelector('.empty-state');
    if (emptyState) {
        emptyState.remove();
    }

    // If no capsules at all, show empty state
    if (paginationState.capsules.length === 0) {
        feed.innerHTML = '<div class="empty-state"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="3" y="3" width="18" height="18" rx="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg><h3>No memories yet</h3><p>Create your first encrypted memory</p></div>';
        return;
    }

    // Append new capsules
    const fragment = document.createDocumentFragment();
    newCapsules.forEach(capsule => {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = createCapsuleCard(capsule);
        fragment.appendChild(tempDiv.firstElementChild);
    });

    feed.appendChild(fragment);

    // Update upload indicator
    updateUploadIndicator();
}

function updateUploadIndicator() {
    const indicator = document.getElementById('last-upload-indicator');
    const timeElement = document.getElementById('last-upload-time');

    // Only show indicator when private key is NOT loaded
    if (!privateKeyPEM) {
        if (paginationState.capsules.length > 0) {
            // Show last upload time
            const latestCapsule = paginationState.capsules[0];
            const dateObj = new Date(latestCapsule.created_at);

            const date = dateObj.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
            const time = dateObj.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });

            timeElement.textContent = `${date} at ${time}`;
            indicator.classList.remove('hidden');
        } else {
            // Show "Nothing uploaded yet"
            timeElement.textContent = 'Nothing uploaded yet';
            indicator.classList.remove('hidden');
        }
    } else {
        // Hide indicator when private key is loaded
        indicator.classList.add('hidden');
    }
}

// ===== Intersection Observer =====
function setupIntersectionObserver() {
    // Disconnect existing observer if any
    if (intersectionObserver) {
        intersectionObserver.disconnect();
        observedElements.clear();
    }

    const options = {
        // Start loading when element is 300px from entering viewport
        rootMargin: '300px',
        // Trigger when 10% of element is visible
        threshold: 0.1
    };

    intersectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const capsuleId = parseInt(entry.target.dataset.id);

            if (entry.isIntersecting) {
                // Queue for decryption if key available
                if (privateKeyPEM) {
                    queueForDecryption(capsuleId);
                }

                // Load next page if approaching bottom
                if (shouldLoadNextPage(entry.target)) {
                    loadNextPage();
                }
            }
        });
    }, options);
}

function shouldLoadNextPage(element) {
    // Check if element is in the last 25% of loaded capsules
    const feed = element.parentElement;
    const elementIndex = Array.from(feed.children).indexOf(element);
    const totalLoaded = paginationState.capsules.length;

    return elementIndex >= totalLoaded * 0.75 &&
           paginationState.hasMore &&
           !paginationState.isLoadingMore;
}

function observeAllCapsules() {
    if (!intersectionObserver) return;

    document.querySelectorAll('.capsule-card[data-id]').forEach(card => {
        const capsuleId = parseInt(card.dataset.id);
        // Only observe if not already observing
        if (!observedElements.has(capsuleId)) {
            intersectionObserver.observe(card);
            observedElements.set(capsuleId, card);
        }
    });
}

function createCapsuleCard(capsule) {
    const dateObj = new Date(capsule.created_at);
    const date = dateObj.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
    const time = dateObj.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
    const dateTime = `${date} at ${time}`;

    // Check current state
    const isDecrypted = decryptionState.decryptedContents.has(capsule.id);
    const isDecrypting = decryptionState.decrypting.has(capsule.id);
    const hasError = decryptionState.failed.has(capsule.id);
    const hasKey = !!privateKeyPEM;

    let contentState = '';

    if (isDecrypted) {
        // Already decrypted content
        const decrypted = decryptionState.decryptedContents.get(capsule.id);
        if (capsule.type === 'text') {
            contentState = '<div class="capsule-text">' + escapeHtml(decrypted.text) + '</div>';
        } else if (capsule.type === 'image') {
            contentState = '<div class="capsule-image"><img src="' + decrypted.image + '" alt="Memory"></div>';
        } else if (capsule.type === 'mixed') {
            if (decrypted.text) contentState += '<div class="capsule-text">' + escapeHtml(decrypted.text) + '</div>';
            if (decrypted.image) contentState += '<div class="capsule-image"><img src="' + decrypted.image + '" alt="Memory"></div>';
        }
        contentState = '<div class="capsule-content">' + contentState + '</div>';
    } else if (isDecrypting) {
        contentState = `
            <div class="capsule-decrypting">
                <div class="spinner"></div>
                <p>Decrypting your memory...</p>
            </div>
        `;
    } else if (hasError) {
        const error = decryptionState.failed.get(capsule.id);
        contentState = `
            <div class="capsule-error">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <p>Failed to decrypt: ${escapeHtml(error)}</p>
            </div>
        `;
    } else if (!hasKey) {
        contentState = `
            <div class="capsule-locked">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="11" width="18" height="11" rx="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                <p>Encrypted - Add your private key to view</p>
            </div>
        `;
    } else {
        // Has key, will decrypt on scroll
        contentState = `
            <div class="capsule-queued">
                <div class="spinner"></div>
                <p>Will decrypt when you scroll to it</p>
            </div>
        `;
    }

    return `
        <div class="capsule-card" data-id="${capsule.id}">
            <div class="capsule-header">
                <div class="capsule-date">${dateTime}</div>
                <span class="capsule-type-badge">${capsule.type}</span>
            </div>
            ${contentState}
        </div>
    `;
}

// ===== Decryption =====
async function decryptCapsule(capsuleId) {
    if (!privateKeyPEM) {
        return; // Silently skip if no key
    }

    // Mark as decrypting
    decryptionState.decrypting.add(capsuleId);
    updateCapsuleCardState(capsuleId, 'decrypting');

    try {
        const capsule = paginationState.capsules.find(c => c.id === capsuleId);
        if (!capsule) {
            throw new Error('Capsule not found in loaded data');
        }

        // Download encrypted file
        const response = await fetch(API_BASE + '/capsule/download/' + capsule.id, {
            headers: { 'Authorization': 'Bearer ' + token }
        });

        if (!response.ok) {
            throw new Error('HTTP ' + response.status);
        }

        const encryptedFile = new Uint8Array(await response.arrayBuffer());

        // Decrypt
        const privateKey = await importKeyFromPEM(privateKeyPEM, 'private');
        const decryptedData = await decryptData(encryptedFile, privateKey);
        const content = parseDecryptedContent(decryptedData, capsule.type);

        // Store result
        decryptionState.decryptedContents.set(capsuleId, content);
        decryptionState.failed.delete(capsuleId);

        // Update UI
        updateCapsuleCardState(capsuleId, 'decrypted');

    } catch (error) {
        console.error('Failed to decrypt capsule ' + capsuleId + ':', error);

        // Sanitize error message for UI
        let userMessage = 'Failed to decrypt memory';
        if (error.message.includes('decrypt')) {
            userMessage = 'Incorrect private key';
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
            userMessage = 'Network error - check connection';
        }

        decryptionState.failed.set(capsuleId, userMessage);
        updateCapsuleCardState(capsuleId, 'error');
    } finally {
        decryptionState.decrypting.delete(capsuleId);

        // Process next in queue
        processDecryptionQueue();
    }
}

function updateCapsuleCardState(capsuleId, state) {
    const card = document.querySelector('.capsule-card[data-id="' + capsuleId + '"]');
    if (!card) return;

    const capsule = paginationState.capsules.find(c => c.id === capsuleId);
    if (!capsule) return;

    const date = new Date(capsule.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });

    let contentHTML = '';

    if (state === 'decrypting') {
        contentHTML = `
            <div class="capsule-decrypting">
                <div class="spinner"></div>
                <p>Decrypting your memory...</p>
            </div>
        `;
    } else if (state === 'error') {
        const error = decryptionState.failed.get(capsuleId);
        contentHTML = `
            <div class="capsule-error">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <p>Failed to decrypt: ${escapeHtml(error)}</p>
            </div>
        `;
    } else if (state === 'decrypted') {
        const decrypted = decryptionState.decryptedContents.get(capsuleId);

        if (capsule.type === 'text') {
            contentHTML = '<div class="capsule-text">' + escapeHtml(decrypted.text) + '</div>';
        } else if (capsule.type === 'image') {
            contentHTML = '<div class="capsule-image"><img src="' + decrypted.image + '" alt="Memory"></div>';
        } else if (capsule.type === 'mixed') {
            if (decrypted.text) contentHTML += '<div class="capsule-text">' + escapeHtml(decrypted.text) + '</div>';
            if (decrypted.image) contentHTML += '<div class="capsule-image"><img src="' + decrypted.image + '" alt="Memory"></div>';
        }
    }

    // Find and replace content section
    let contentSection = card.querySelector('.capsule-content');
    if (!contentSection) {
        contentSection = card.querySelector('.capsule-locked') ||
                         card.querySelector('.capsule-decrypting') ||
                         card.querySelector('.capsule-queued') ||
                         card.querySelector('.capsule-error');
    }

    if (contentSection) {
        contentSection.outerHTML = '<div class="capsule-content">' + contentHTML + '</div>';
    }
}

async function decryptData(encryptedFile, privateKey) {
    // With RSA-4096, the encrypted AES key is 512 bytes
    const encryptedAESKey = encryptedFile.slice(0, 512);
    const nonce = encryptedFile.slice(512, 524);
    const encryptedData = encryptedFile.slice(524);
    const aesKeyRaw = await window.crypto.subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, encryptedAESKey);
    const aesKey = await window.crypto.subtle.importKey('raw', aesKeyRaw, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
    const decryptedData = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, aesKey, encryptedData);
    return new Uint8Array(decryptedData);
}

function parseDecryptedContent(data, type) {
    if (type === 'text') {
        return { text: new TextDecoder().decode(data) };
    } else if (type === 'image') {
        const blob = new Blob([data], { type: 'image/jpeg' });
        return { image: URL.createObjectURL(blob) };
    } else if (type === 'mixed') {
        const jsonStr = new TextDecoder().decode(data);
        const contentObj = JSON.parse(jsonStr);
        const result = {};
        if (contentObj.text) result.text = contentObj.text;
        if (contentObj.image) {
            const binaryString = atob(contentObj.image);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
            const blob = new Blob([bytes], { type: 'image/jpeg' });
            result.image = URL.createObjectURL(blob);
        }
        return result;
    }
}

async function importKeyFromPEM(pem, type) {
    const pemHeader = type === 'public' ? '-----BEGIN PUBLIC KEY-----' : '-----BEGIN PRIVATE KEY-----';
    const pemFooter = type === 'public' ? '-----END PUBLIC KEY-----' : '-----END PRIVATE KEY-----';

    // Find headers
    const pemHeaderIndex = pem.indexOf(pemHeader);
    const pemFooterIndex = pem.indexOf(pemFooter);

    if (pemHeaderIndex === -1 || pemFooterIndex === -1) {
        throw new Error('Invalid PEM format: missing ' + type + ' key headers');
    }

    // Extract base64 content between headers
    const pemContents = pem.substring(pemHeaderIndex + pemHeader.length, pemFooterIndex);

    // Remove all whitespace and newlines from base64 content
    const base64 = pemContents.replace(/[\s\n\r]/g, '');

    if (base64.length === 0) {
        throw new Error('Invalid PEM format: empty key data');
    }

    const binaryDerString = atob(base64);
    const binaryDer = new Uint8Array(binaryDerString.length);
    for (let i = 0; i < binaryDerString.length; i++) {
        binaryDer[i] = binaryDerString.charCodeAt(i);
    }

    return await window.crypto.subtle.importKey(
        type === 'public' ? 'spki' : 'pkcs8',
        binaryDer.buffer,
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        true,
        [type === 'public' ? 'encrypt' : 'decrypt']
    );
}

// ===== Settings =====
function handlePrivateKeyUpload(e) {
    const file = e.target.files[0];
    const fileNameDisplay = document.getElementById('uploaded-file-name');

    if (file) {
        fileNameDisplay.textContent = 'Selected: ' + file.name;

        const reader = new FileReader();
        reader.onload = (event) => {
            document.getElementById('settings-private-key').value = event.target.result;
        };
        reader.readAsText(file);
    } else {
        fileNameDisplay.textContent = '';
    }
}

function loadPrivateKeyFromStorage() {
    const savedKey = localStorage.getItem('privateKey');
    if (savedKey) {
        privateKeyPEM = savedKey;
        document.getElementById('settings-private-key').value = savedKey;
    }
}

async function savePrivateKey() {
    const keyInput = document.getElementById('settings-private-key').value.trim();
    const keyStatus = document.getElementById('key-status');

    if (!keyInput) {
        keyStatus.innerHTML = 'Please enter your private key';
        keyStatus.className = 'key-status error';
        return;
    }

    if (!keyInput.includes('-----BEGIN PRIVATE KEY-----') || !keyInput.includes('-----END PRIVATE KEY-----')) {
        keyStatus.innerHTML = 'Invalid private key format. Must include BEGIN/END headers.';
        keyStatus.className = 'key-status error';
        return;
    }

    // Try to validate the key by attempting to import it
    try {
        await importKeyFromPEM(keyInput, 'private');
        keyStatus.innerHTML = 'Validating key...';
        keyStatus.className = 'key-status';
    } catch (error) {
        keyStatus.innerHTML = 'Invalid private key: ' + error.message;
        keyStatus.className = 'key-status error';
        return;
    }

    privateKeyPEM = keyInput;
    localStorage.setItem('privateKey', keyInput);

    // Update UI: hide key banner and show feed
    updateKeyBannerVisibility();

    // Close the settings modal
    hideModal('settings-modal');

    // Update all locked cards to decrypting state
    document.querySelectorAll('.capsule-locked').forEach(card => {
        const capsuleId = parseInt(card.dataset.id);
        card.className = 'capsule-decrypting';
        card.innerHTML = '<div class="spinner"></div><p>Decrypting your memory...</p>';
        queueForDecryption(capsuleId);
    });

    // Update all queued cards to decrypting
    document.querySelectorAll('.capsule-queued').forEach(card => {
        const capsuleId = parseInt(card.dataset.id);
        queueForDecryption(capsuleId);
    });

    // Show success message
    showToast('Key loaded! Your memories are being decrypted...', 'success');
}

// ===== Upload =====
function handleImagePreview(e) {
    const file = e.target.files[0];
    const preview = document.getElementById('image-preview');
    const fileName = document.getElementById('file-name');
    if (file) {
        fileName.textContent = file.name;
        const reader = new FileReader();
        reader.onload = (ev) => { preview.innerHTML = '<img src="' + ev.target.result + '" alt="Preview">'; };
        reader.readAsDataURL(file);
    } else {
        fileName.textContent = '';
        preview.innerHTML = '';
    }
}

async function handleUpload(e) {
    e.preventDefault();
    const text = document.getElementById('capsule-text').value.trim();
    const fileInput = document.getElementById('capsule-image');
    const hasText = text.length > 0;
    const hasImage = fileInput.files.length > 0;
    if (!hasText && !hasImage) {
        showToast('Please enter text or select an image', 'error');
        return;
    }
    try {
        let capsuleType, dataToEncrypt;
        if (hasText && hasImage) {
            capsuleType = 'mixed';
            const imageData = await fileInput.files[0].arrayBuffer();
            const imageBase64 = btoa(String.fromCharCode(...new Uint8Array(imageData)));
            const combinedContent = JSON.stringify({ text, image: imageBase64 });
            dataToEncrypt = new TextEncoder().encode(combinedContent);
        } else if (hasText) {
            capsuleType = 'text';
            dataToEncrypt = new TextEncoder().encode(text);
        } else {
            capsuleType = 'image';
            dataToEncrypt = await fileInput.files[0].arrayBuffer();
        }
        const { encryptedData, encryptedAESKey, nonce } = await encryptData(dataToEncrypt);
        const response = await fetch(API_BASE + '/capsule/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({ type: capsuleType, encrypted_data: Array.from(encryptedData), encrypted_aes_key: Array.from(encryptedAESKey), nonce: Array.from(nonce) })
        });
        if (response.ok) {
            showToast('Memory encrypted and saved!', 'success');
            document.getElementById('upload-form').reset();
            document.getElementById('image-preview').innerHTML = '';
            document.getElementById('file-name').textContent = '';

            // Reset pagination and reload capsules from page 1
            paginationState.page = 1;
            paginationState.capsules = [];
            paginationState.hasMore = true;
            paginationState.isLoading = false;
            paginationState.isLoadingMore = false;

            // Clear the feed
            const feed = document.getElementById('feed');
            feed.innerHTML = '';

            loadCapsules();
        } else {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            console.error('Upload failed:', response.status, errorData);
            showToast('Upload failed: ' + (errorData.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        console.error('Upload error:', error);
        showToast('Upload failed: ' + error.message, 'error');
    }
}

async function encryptData(data) {
    const aesKey = await window.crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    const nonce = window.crypto.getRandomValues(new Uint8Array(12));
    const encryptedData = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, data);
    const aesKeyRaw = await window.crypto.subtle.exportKey('raw', aesKey);
    const response = await fetch(API_BASE + '/keys/public', { headers: { 'Authorization': 'Bearer ' + token } });
    if (!response.ok) {
        throw new Error('Failed to fetch public key: HTTP ' + response.status);
    }
    const { public_key: publicKeyPEM } = await response.json();
    const publicKey = await importKeyFromPEM(publicKeyPEM, 'public');
    const encryptedAESKey = await window.crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, aesKeyRaw);
    return { encryptedData: new Uint8Array(encryptedData), encryptedAESKey: new Uint8Array(encryptedAESKey), nonce };
}

// ===== Utilities =====
function showModal(modalId) { document.getElementById(modalId).classList.remove('hidden'); }
function hideModal(modalId) { document.getElementById(modalId).classList.add('hidden'); }

function showToast(message, type) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== Debounce Utility =====
function debounce(func, wait) {
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(usernameCheckTimeout);
            func(...args);
        };
        clearTimeout(usernameCheckTimeout);
        usernameCheckTimeout = setTimeout(later, wait);
    };
}

// ===== Username Availability Check =====
async function checkUsernameAvailability(e) {
    const username = e.target.value.trim();
    const statusDiv = document.getElementById('username-status');
    const submitBtn = document.getElementById('register-submit-btn');

    // Reset if username is too short
    if (username.length < 3) {
        statusDiv.textContent = 'Username must be at least 3 characters';
        statusDiv.className = 'username-status username-unavailable';
        submitBtn.disabled = true;
        return;
    }

    // Show checking state
    statusDiv.textContent = 'Checking availability...';
    statusDiv.className = 'username-status username-checking';
    submitBtn.disabled = true;

    try {
        const response = await fetch(API_BASE + '/auth/check-username?username=' + encodeURIComponent(username));

        if (response.status === 404) {
            // Username is available!
            statusDiv.textContent = '✓ Username is available';
            statusDiv.className = 'username-status username-available';
            submitBtn.disabled = false;
        } else if (response.ok) {
            // Username exists - not available
            statusDiv.textContent = '✗ Username is already taken';
            statusDiv.className = 'username-status username-unavailable';
            submitBtn.disabled = true;
        } else {
            throw new Error('HTTP ' + response.status);
        }
    } catch (error) {
        console.error('Username check error:', error);
        statusDiv.textContent = 'Could not check username. Try again.';
        statusDiv.className = 'username-status username-unavailable';
        submitBtn.disabled = true;
    }
}

// ===== Registration with Key Generation =====
async function handleRegister(e) {
    e.preventDefault();

    const username = document.getElementById('register-username').value.trim();
    const password = document.getElementById('register-password').value;
    const submitBtn = document.getElementById('register-submit-btn');

    // Disable button and show loading state
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<div class="spinner" style="width: 16px; height: 16px; margin: 0; border-width: 2px;"></div> Generating Keys...';

    try {
        // Step 1: Generate RSA-4096 key pair
        showToast('Generating encryption keys...', 'info');
        registrationKeyPair = await window.crypto.subtle.generateKey(
            { name: 'RSA-OAEP', modulusLength: 4096, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
            true, ['encrypt', 'decrypt']
        );

        // Export keys to PEM format
        const publicKeyPEM = await exportKeyToPEM(registrationKeyPair.publicKey, 'public');
        const privateKeyPEM = await exportKeyToPEM(registrationKeyPair.privateKey, 'private');

        // Step 2: Register with public key
        submitBtn.innerHTML = '<div class="spinner" style="width: 16px; height: 16px; margin: 0; border-width: 2px;"></div> Registering...';

        const response = await fetch(API_BASE + '/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, public_key: publicKeyPEM })
        });

        const data = await response.json();

        if (!response.ok) {
            showToast(data.error || 'Registration failed', 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px;">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                Generate Keys & Register
            `;
            return;
        }

        // Step 3: Store token and private key temporarily
        token = data.token;
        localStorage.setItem('token', token);

        // Display private key in modal
        document.getElementById('modal-private-key').value = privateKeyPEM;

        // Store private key in memory (NOT in localStorage yet)
        window.tempPrivateKey = privateKeyPEM;

        // Show private key modal
        showModal('private-key-modal');

        // Reset button
        submitBtn.disabled = false;
        submitBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px;">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            Generate Keys & Register
        `;

    } catch (error) {
        console.error('Registration error:', error);
        showToast('Registration failed: ' + error.message, 'error');

        // Reset button
        submitBtn.disabled = false;
        submitBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px;">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            Generate Keys & Register
        `;
    }
}

// ===== Private Key Modal Functions =====
async function copyPrivateKeyToClipboard() {
    const privateKey = document.getElementById('modal-private-key').value;

    try {
        await navigator.clipboard.writeText(privateKey);
        showToast('Private key copied to clipboard!', 'success');

        // Update button text temporarily
        const btn = document.getElementById('copy-key-btn');
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '✓ Copied!';
        setTimeout(() => {
            btn.innerHTML = originalHTML;
        }, 2000);
    } catch (error) {
        console.error('Copy error:', error);
        showToast('Failed to copy to clipboard', 'error');
    }
}

function downloadPrivateKeyFromModal() {
    const privateKey = document.getElementById('modal-private-key').value;

    // Get username from token
    let username = 'user';
    try {
        if (token) {
            const payload = JSON.parse(atob(token.split('.')[1]));
            username = payload.username;
        }
    } catch (error) {
        console.error('Error parsing token:', error);
    }

    const blob = new Blob([privateKey], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `capsule_private_key_of_${username}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    showToast('Private key downloaded! Keep it safe!', 'success');

    // Update button text temporarily
    const btn = document.getElementById('download-key-modal-btn');
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '✓ Downloaded!';
    setTimeout(() => {
        btn.innerHTML = originalHTML;
    }, 2000);
}

async function continueAfterRegistration() {
    // Clean up temporary private key (do NOT save it)
    if (window.tempPrivateKey) {
        delete window.tempPrivateKey;
    }

    // Hide modal
    hideModal('private-key-modal');

    // Show success message with reminder
    showToast('Registration successful! You\'ll need to add your private key to view memories.', 'success');

    // Show dashboard (without private key loaded)
    showDashboard();
}
