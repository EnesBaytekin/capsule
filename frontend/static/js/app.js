// Time Capsule - Zero-Knowledge Frontend
// ALL encryption/decryption happens on client
// Server NEVER sees plaintext or private keys

const API_BASE = 'http://localhost:8080';

// Global state
let currentUser = null;
let token = null;
let keyPair = null;
let privateKeyPEM = null;
let capsules = [];
let decryptedContents = new Map();

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setupEventListeners();
    checkExistingAuth();
    loadPrivateKeyFromStorage();
});

function setupEventListeners() {
    // Auth tabs
    document.querySelectorAll('.auth-tab').forEach(btn => {
        btn.addEventListener('click', (e) => {
            switchTab(e.target.dataset.tab);
        });
    });

    // Register
    document.getElementById('generate-keys-btn').addEventListener('click', generateKeyPair);
    document.getElementById('download-key-btn').addEventListener('click', downloadPrivateKey);
    document.getElementById('register-form').addEventListener('submit', handleRegister);

    // Login
    document.getElementById('login-form').addEventListener('submit', handleLogin);

    // Navigation
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    document.getElementById('settings-btn').addEventListener('click', () => showModal('settings-modal'));
    document.getElementById('close-settings').addEventListener('click', () => hideModal('settings-modal'));

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
// ===== Key Generation =====
async function generateKeyPair() {
    try {
        showToast('Generating encryption keys...', 'info');
        keyPair = await window.crypto.subtle.generateKey(
            { name: 'RSA-OAEP', modulusLength: 4096, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
            true, ['encrypt', 'decrypt']
        );
        const publicKeyPEM = await exportKeyToPEM(keyPair.publicKey, 'public');
        privateKeyPEM = await exportKeyToPEM(keyPair.privateKey, 'private');
        document.getElementById('private-key-display').value = privateKeyPEM;
        document.getElementById('key-display').classList.remove('hidden');
        document.getElementById('register-submit-btn').disabled = false;
        showToast('Keys generated! Save your private key!', 'success');
    } catch (error) {
        console.error('Key generation error:', error);
        showToast('Failed to generate keys', 'error');
    }
}

async function exportKeyToPEM(key, type) {
    const exported = await window.crypto.subtle.exportKey(type === 'public' ? 'spki' : 'pkcs8', key);
    const exportedAsString = String.fromCharCode.apply(null, new Uint8Array(exported));
    const exportedAsBase64 = btoa(exportedAsString);
    const pemHeader = type === 'public' ? '-----BEGIN PUBLIC KEY-----' : '-----BEGIN PRIVATE KEY-----';
    const pemFooter = type === 'public' ? '-----END PUBLIC KEY-----' : '-----END PRIVATE KEY-----';
    return pemHeader + '\n' + exportedAsBase64.match(/.{1,64}/g).join('\n') + '\n' + pemFooter;
}

function downloadPrivateKey() {
    const blob = new Blob([privateKeyPEM], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'capsule_private_key.txt';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Private key downloaded! Keep it safe!', 'success');
}

// ===== Authentication =====
async function handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById('register-username').value;
    const password = document.getElementById('register-password').value;
    if (!keyPair || !privateKeyPEM) {
        showToast('Please generate encryption keys first', 'error');
        return;
    }
    try {
        const publicKeyPEM = await exportKeyToPEM(keyPair.publicKey, 'public');
        const response = await fetch(API_BASE + '/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, public_key: publicKeyPEM })
        });
        const data = await response.json();
        if (response.ok) {
            token = data.token;
            localStorage.setItem('token', token);
            localStorage.setItem('privateKey', privateKeyPEM);
            showToast('Registration successful!', 'success');
            showDashboard();
        } else {
            showToast(data.error || 'Registration failed', 'error');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showToast('Registration failed', 'error');
    }
}

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
    capsules = [];
    decryptedContents.clear();
    document.getElementById('auth-view').classList.add('active');
    document.getElementById('dashboard-view').classList.remove('active');
    document.getElementById('logout-btn').style.display = 'none';
    document.getElementById('settings-btn').style.display = 'none';
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
    loadCapsules();
}

// ===== Capsules =====
async function loadCapsules() {
    try {
        const response = await fetch(API_BASE + '/capsule/list', { headers: { 'Authorization': 'Bearer ' + token } });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        capsules = await response.json();
        renderFeed();
        if (privateKeyPEM) decryptAllCapsules();
    } catch (error) {
        console.error('Load capsules error:', error);
        showToast('Failed to load capsules', 'error');
    }
}

function renderFeed() {
    const feed = document.getElementById('feed');
    if (capsules.length === 0) {
        feed.innerHTML = '<div class="empty-state"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="3" y="3" width="18" height="18" rx="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg><h3>No memories yet</h3><p>Create your first encrypted memory</p></div>';
        return;
    }
    feed.innerHTML = capsules.map(c => createCapsuleCard(c)).join('');
}

function createCapsuleCard(capsule) {
    const decrypted = decryptedContents.get(capsule.id);
    const date = new Date(capsule.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    if (!decrypted) {
        return '<div class="capsule-card" data-id="' + capsule.id + '"><div class="capsule-header"><div class="capsule-avatar">' + currentUser.charAt(0).toUpperCase() + '</div><div class="capsule-meta"><div class="capsule-author">' + currentUser + '</div><div class="capsule-date">' + date + '</div></div><span class="capsule-type-badge">' + capsule.type + '</span></div><div class="capsule-locked"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg><p>Encrypted - Add your private key in settings</p></div></div>';
    }
    let contentHTML = '';
    if (capsule.type === 'text') {
        contentHTML = '<div class="capsule-text">' + escapeHtml(decrypted.text) + '</div>';
    } else if (capsule.type === 'image') {
        contentHTML = '<div class="capsule-image"><img src="' + decrypted.image + '" alt="Memory"></div>';
    } else if (capsule.type === 'mixed') {
        if (decrypted.text) contentHTML += '<div class="capsule-text">' + escapeHtml(decrypted.text) + '</div>';
        if (decrypted.image) contentHTML += '<div class="capsule-image"><img src="' + decrypted.image + '" alt="Memory"></div>';
    }
    return '<div class="capsule-card" data-id="' + capsule.id + '"><div class="capsule-header"><div class="capsule-avatar">' + currentUser.charAt(0).toUpperCase() + '</div><div class="capsule-meta"><div class="capsule-author">' + currentUser + '</div><div class="capsule-date">' + date + '</div></div><span class="capsule-type-badge">' + capsule.type + '</span></div><div class="capsule-content">' + contentHTML + '</div></div>';
}
// ===== Decryption =====
async function decryptAllCapsules() {
    if (!privateKeyPEM) {
        const keyStatus = document.getElementById('key-status');
        if (keyStatus) {
            keyStatus.innerHTML = 'No private key provided';
            keyStatus.className = 'key-status error';
        }
        return;
    }

    if (capsules.length === 0) {
        const keyStatus = document.getElementById('key-status');
        if (keyStatus) {
            keyStatus.innerHTML = 'No memories to decrypt yet. Create your first memory!';
            keyStatus.className = 'key-status';
        }
        return;
    }

    const keyStatus = document.getElementById('key-status');
    keyStatus.innerHTML = 'Decrypting memories...';
    keyStatus.className = 'key-status';

    try {
        const privateKey = await importKeyFromPEM(privateKeyPEM, 'private');
        let successCount = 0;
        let failCount = 0;

        for (const capsule of capsules) {
            if (!decryptedContents.has(capsule.id)) {
                try {
                    const response = await fetch(API_BASE + '/capsule/download/' + capsule.id, {
                        headers: { 'Authorization': 'Bearer ' + token }
                    });

                    if (!response.ok) {
                        const errorText = await response.text();
                        console.error('Failed to download capsule ' + capsule.id + ': HTTP ' + response.status + ' - ' + errorText);
                        failCount++;
                        continue;
                    }

                    const encryptedFile = new Uint8Array(await response.arrayBuffer());
                    const decryptedData = await decryptData(encryptedFile, privateKey);
                    const content = parseDecryptedContent(decryptedData, capsule.type);
                    decryptedContents.set(capsule.id, content);
                    successCount++;
                } catch (error) {
                    console.error('Failed to decrypt capsule ' + capsule.id + ':', error);
                    failCount++;
                }
            }
        }

        renderFeed();

        if (failCount === 0) {
            keyStatus.innerHTML = '✓ All ' + successCount + ' memories decrypted!';
            keyStatus.className = 'key-status success';
            showToast('All memories decrypted!', 'success');
        } else {
            keyStatus.innerHTML = '✓ Decrypted ' + successCount + ' memories (' + failCount + ' failed)';
            keyStatus.className = 'key-status';
            showToast('Some memories could not be decrypted', 'info');
        }
    } catch (error) {
        console.error('Decryption error:', error);
        keyStatus.innerHTML = '✗ Decryption failed: ' + error.message;
        keyStatus.className = 'key-status error';
        showToast('Decryption failed: ' + error.message, 'error');
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

    // Clear previous decrypted contents and re-decrypt everything
    decryptedContents.clear();
    await decryptAllCapsules();
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
            loadCapsules();
        } else {
            showToast('Upload failed', 'error');
        }
    } catch (error) {
        console.error('Upload error:', error);
        showToast('Upload failed', 'error');
    }
}

async function encryptData(data) {
    const aesKey = await window.crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    const nonce = window.crypto.getRandomValues(new Uint8Array(12));
    const encryptedData = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, data);
    const aesKeyRaw = await window.crypto.subtle.exportKey('raw', aesKey);
    const response = await fetch(API_BASE + '/keys/public', { headers: { 'Authorization': 'Bearer ' + token } });
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
