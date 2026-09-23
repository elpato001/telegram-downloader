const originalFetch = window.fetch;
window.fetch = async function(...args) {
    const response = await originalFetch(...args);
    if (response.status === 401 && !args[0].includes('/api/login')) {
        const modal = document.getElementById('appLoginModal');
        if (modal) modal.style.display = 'flex';
    }
    return response;
};

document.addEventListener('DOMContentLoaded', () => {
    const appLoginModal = document.getElementById('appLoginModal');
    const appPasswordInput = document.getElementById('appPasswordInput');
    const btnAppLoginSubmit = document.getElementById('btnAppLoginSubmit');
    const appLoginError = document.getElementById('appLoginError');

    const handleAppLogin = async () => {
        if (!appLoginError) return;
        appLoginError.style.display = 'none';
        btnAppLoginSubmit.disabled = true;
        btnAppLoginSubmit.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
        
        try {
            const res = await originalFetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: appPasswordInput.value })
            });
            const data = await res.json();
            if (data.success) {
                appLoginModal.style.display = 'none';
                window.location.reload(); // Recargar para obtener los datos iniciales
            } else {
                appLoginError.textContent = data.error || "Error de inicio de sesión";
                appLoginError.style.display = 'block';
            }
        } catch (e) {
            appLoginError.textContent = "Error de red";
            appLoginError.style.display = 'block';
        } finally {
            btnAppLoginSubmit.disabled = false;
            btnAppLoginSubmit.textContent = 'Entrar';
        }
    };

    btnAppLoginSubmit?.addEventListener('click', handleAppLogin);
    appPasswordInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleAppLogin();
    });
});

const countriesData = [
    { code: 'ar', name: 'Argentina (+54)', val: '+54' },
    { code: 'bo', name: 'Bolivia (+591)', val: '+591' },
    { code: 'br', name: 'Brasil (+55)', val: '+55' },
    { code: 'cl', name: 'Chile (+56)', val: '+56' },
    { code: 'co', name: 'Colombia (+57)', val: '+57' },
    { code: 'cr', name: 'Costa Rica (+506)', val: '+506' },
    { code: 'cu', name: 'Cuba (+53)', val: '+53' },
    { code: 'ec', name: 'Ecuador (+593)', val: '+593' },
    { code: 'sv', name: 'El Salvador (+503)', val: '+503' },
    { code: 'es', name: 'España (+34)', val: '+34' },
    { code: 'us', name: 'Estados Unidos / Canadá (+1)', val: '+1' },
    { code: 'gt', name: 'Guatemala (+502)', val: '+502' },
    { code: 'hn', name: 'Honduras (+504)', val: '+504' },
    { code: 'mx', name: 'México (+52)', val: '+52' },
    { code: 'ni', name: 'Nicaragua (+505)', val: '+505' },
    { code: 'pa', name: 'Panamá (+507)', val: '+507' },
    { code: 'py', name: 'Paraguay (+595)', val: '+595' },
    { code: 'pe', name: 'Perú (+51)', val: '+51' },
    { code: 'pr', name: 'Puerto Rico (+1787)', val: '+1787' },
    { code: 'do', name: 'Rep. Dominicana (+1809)', val: '+1809' },
    { code: 'uy', name: 'Uruguay (+598)', val: '+598' },
    { code: 've', name: 'Venezuela (+58)', val: '+58' },
    { code: 'de', name: 'Alemania (+49)', val: '+49' },
    { code: 'fr', name: 'Francia (+33)', val: '+33' },
    { code: 'it', name: 'Italia (+39)', val: '+39' },
    { code: 'pt', name: 'Portugal (+351)', val: '+351' },
    { code: 'gb', name: 'Reino Unido (+44)', val: '+44' },
    { code: 'ru', name: 'Rusia (+7)', val: '+7' },
    { code: 'un', name: 'Otro país (código manual)', val: '' }
];

function initCustomCountrySelect() {
    const trigger = document.getElementById('customCountryTrigger');
    const optionsContainer = document.getElementById('customCountryOptions');
    const hiddenInput = document.getElementById('countrySelect');
    const valueContainer = document.getElementById('customCountryValue');
    const countryCodeInput = document.getElementById('countryCode');

    if (!trigger || !optionsContainer) return;

    // Render options
    optionsContainer.innerHTML = '';
    countriesData.forEach(c => {
        const opt = document.createElement('div');
        opt.className = 'custom-option';
        if (c.val === hiddenInput.value) opt.classList.add('selected');
        opt.dataset.value = c.val;
        
        let imgHtml = c.code === 'un' ? '<i class="fa-solid fa-globe" style="width:20px;text-align:center;color:#666;"></i>' : `<img src="../assets/banderas/${c.code}.png" alt="${c.code}">`;
        
        opt.innerHTML = `${imgHtml}<span>${c.name}</span>`;
        
        opt.addEventListener('click', () => {
            // Update hidden input
            hiddenInput.value = c.val;
            
            // Update UI
            valueContainer.innerHTML = `${imgHtml}<span>${c.name}</span>`;
            
            // Update selection classes
            optionsContainer.querySelectorAll('.custom-option').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            
            // Close dropdown
            optionsContainer.classList.remove('open');
            
            // Trigger change logic
            if (c.val) {
                countryCodeInput.value = c.val;
                countryCodeInput.dispatchEvent(new Event('input'));
            }
            hiddenInput.dispatchEvent(new Event('change'));
        });
        
        optionsContainer.appendChild(opt);
    });

    trigger.addEventListener('click', () => {
        optionsContainer.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
        if (!document.getElementById('customCountryWrapper').contains(e.target)) {
            optionsContainer.classList.remove('open');
        }
    });
    
    // Override hidden input setter to sync UI
    const originalDescriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    Object.defineProperty(hiddenInput, 'value', {
        get: function() { return originalDescriptor.get.call(this); },
        set: function(val) {
            originalDescriptor.set.call(this, val);
            const found = countriesData.find(c => c.val === val);
            if (found) {
                let imgHtml = found.code === 'un' ? '<i class="fa-solid fa-globe" style="width:20px;text-align:center;color:#666;"></i>' : `<img src="../assets/banderas/${found.code}.png" alt="${found.code}">`;
                valueContainer.innerHTML = `${imgHtml}<span>${found.name}</span>`;
                optionsContainer.querySelectorAll('.custom-option').forEach(o => {
                    o.classList.toggle('selected', o.dataset.value === val);
                });
            }
        }
    });
}
document.addEventListener('DOMContentLoaded', initCustomCountrySelect);


function showConfirmDialog(message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmModal');
        const msgEl = document.getElementById('confirmModalMessage');
        const btnYes = document.getElementById('btnConfirmYes');
        const btnNo = document.getElementById('btnConfirmNo');
        
        if (!modal || !msgEl || !btnYes || !btnNo) {
            resolve(window.confirm(message));
            return;
        }
        
        msgEl.textContent = message;
        modal.style.display = 'flex';
        
        const cleanup = () => {
            modal.style.display = 'none';
            btnYes.removeEventListener('click', onYes);
            btnNo.removeEventListener('click', onNo);
        };
        
        const onYes = () => { cleanup(); resolve(true); };
        const onNo = () => { cleanup(); resolve(false); };
        
        btnYes.addEventListener('click', onYes);
        btnNo.addEventListener('click', onNo);
    });
}


function showToast(message, type = 'error', duration = 9000, title = '') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const defaultTitles = {
        success: 'Éxito',
        error: 'Aviso',
        info: 'Información',
        warning: 'Atención'
    };
    const toastTitle = title || defaultTitles[type] || '';
    
    const iconMap = {
        success: 'fa-circle-check',
        error: 'fa-circle-exclamation',
        info: 'fa-circle-info',
        warning: 'fa-triangle-exclamation'
    };
    const iconClass = iconMap[type] || 'fa-bell';
    
    toast.innerHTML = `
        <img src="logo.png" alt="Logo" class="toast-logo">
        <div class="toast-content">
            ${toastTitle ? `<div class="toast-title"><i class="fa-solid ${iconClass}"></i> ${toastTitle}</div>` : ''}
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" title="Cerrar"><i class="fa-solid fa-xmark"></i></button>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 10);
    
    let timer = null;
    const dismiss = () => {
        if (timer) clearTimeout(timer);
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 350);
    };
    
    toast.querySelector('.toast-close').addEventListener('click', dismiss);
    timer = setTimeout(dismiss, duration);
}

const API_BASE = '/api';

let allScannedVideos = [];
let currentVideos = [];
let ws = null;
let phoneHash = '';

// Preset format categories and defaults
const PRESET_CATEGORIES = {
    games: ['.chd', '.iso', '.bin', '.cue', '.cso', '.pkg', '.elf', '.mdf', '.mds', '.nkit.iso', '.wbfs', '.gcm', '.nsp', '.xci'],
    archives: ['.7z', '.rar', '.zip', '.tar', '.gz', '.z01', '.z02', '.z03', '.z04', '.part1.rar', '.part2.rar'],
    videos: ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.flv', '.wmv', '.ts', '.m4v'],
    audio: ['.mp3', '.flac', '.wav', '.m4a', '.aac', '.ogg', '.opus', '.alac'],
    docs: ['.pdf', '.epub', '.cbr', '.cbz', '.txt', '.doc', '.docx']
};

const DEFAULT_ACTIVE_FORMATS = [
    '.chd', '.iso', '.bin', '.cue', '.cso', '.pkg', '.elf',
    '.7z', '.rar', '.zip', '.z01', '.z02', '.part1.rar',
    '.mp4', '.mkv', '.avi', '.mov'
];

let acceptAllFormats = localStorage.getItem('telegram_accept_all_formats') === 'true';
let activeFormats = [];
try {
    const savedFormats = localStorage.getItem('telegram_custom_formats');
    if (savedFormats) {
        activeFormats = JSON.parse(savedFormats);
    }
} catch (e) {
    console.error("Error al cargar formatos personalizados:", e);
}

if (!Array.isArray(activeFormats) || activeFormats.length === 0) {
    activeFormats = [...DEFAULT_ACTIVE_FORMATS];
}

function isFormatAllowed(filename) {
    if (acceptAllFormats) return true;
    if (!filename) return false;
    const lower = filename.toLowerCase().trim();
    return activeFormats.some(ext => {
        const clean = ext.startsWith('.') ? ext.toLowerCase() : '.' + ext.toLowerCase();
        return lower.endsWith(clean);
    });
}

// Formatea fecha ISO de Telegram a formato local legible
function formatFecha(fechaStr) {
    try {
        const d = new Date(fechaStr);
        if (isNaN(d.getTime())) return '-';
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        const hh = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
    } catch (e) {
        return '-';
    }
}

function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 B';
    const k = 1024, sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getFileIconClass(filename) {
    if (!filename) return 'fa-regular fa-file icon-generic';
    const f = filename.toLowerCase();
    if (f.endsWith('.mp4') || f.endsWith('.mkv') || f.endsWith('.avi') || f.endsWith('.mov') || f.endsWith('.webm') || f.endsWith('.flv') || f.endsWith('.wmv') || f.endsWith('.ts')) return 'fa-solid fa-file-video icon-video';
    if (f.endsWith('.zip') || f.endsWith('.rar') || f.endsWith('.7z') || f.endsWith('.tar') || f.endsWith('.gz') || f.endsWith('.part1.rar') || f.endsWith('.z01')) return 'fa-solid fa-file-zipper icon-archive';
    if (f.endsWith('.iso') || f.endsWith('.chd') || f.endsWith('.bin') || f.endsWith('.cue') || f.endsWith('.cso') || f.endsWith('.pkg') || f.endsWith('.nsp') || f.endsWith('.xci') || f.endsWith('.elf')) return 'fa-solid fa-gamepad icon-game';
    if (f.endsWith('.mp3') || f.endsWith('.flac') || f.endsWith('.wav') || f.endsWith('.ogg') || f.endsWith('.m4a') || f.endsWith('.opus') || f.endsWith('.aac')) return 'fa-solid fa-file-audio icon-audio';
    if (f.endsWith('.pdf') || f.endsWith('.epub') || f.endsWith('.doc') || f.endsWith('.docx') || f.endsWith('.txt') || f.endsWith('.cbr') || f.endsWith('.cbz')) return 'fa-solid fa-file-lines icon-doc';
    return 'fa-regular fa-file icon-generic';
}

// Variables de estado del sistema
let currentMainTab = 'descargas'; // 'descargas' | 'grabber'
let downloadsData = [];
let grabberPackages = [];
let expandedDescargas = new Set();
let expandedGrabber = new Set();
let selectedDownloads = new Set();
let selectedGrabberItems = new Set();
let selectedGrabberPackages = new Set();
let itemStates = {};
let itemFilePaths = {};
let itemSpeeds = {};
let itemProgress = {};

// DOM Elements comunes
const loginModal = document.getElementById('loginModal');
const scanError = document.getElementById('scanError');
const channelLink = document.getElementById('channelLink');
const btnScanSubmit = document.getElementById('btnScanSubmit');
const scanDatePreset = document.getElementById('scanDatePreset');
const scanCustomDateRange = document.getElementById('scanCustomDateRange');
const scanDateFrom = document.getElementById('scanDateFrom');
const scanDateTo = document.getElementById('scanDateTo');
const customDirInput = document.getElementById('customDir');
const chkIncludeDate = document.getElementById('chkIncludeDate');

function formatDateToInput(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

if (scanDatePreset) {
    scanDatePreset.addEventListener('change', () => {
        const val = scanDatePreset.value;
        const now = new Date();
        const todayStr = formatDateToInput(now);

        if (val === 'all') {
            if (scanCustomDateRange) scanCustomDateRange.style.display = 'none';
            if (scanDateFrom) scanDateFrom.value = '';
            if (scanDateTo) scanDateTo.value = '';
        } else if (val === 'today') {
            if (scanCustomDateRange) scanCustomDateRange.style.display = 'inline-flex';
            if (scanDateFrom) scanDateFrom.value = todayStr;
            if (scanDateTo) scanDateTo.value = todayStr;
        } else if (val === '7days') {
            if (scanCustomDateRange) scanCustomDateRange.style.display = 'inline-flex';
            const past7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            if (scanDateFrom) scanDateFrom.value = formatDateToInput(past7);
            if (scanDateTo) scanDateTo.value = todayStr;
        } else if (val === '30days') {
            if (scanCustomDateRange) scanCustomDateRange.style.display = 'inline-flex';
            const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            if (scanDateFrom) scanDateFrom.value = formatDateToInput(past30);
            if (scanDateTo) scanDateTo.value = todayStr;
        } else if (val === 'custom') {
            if (scanCustomDateRange) scanCustomDateRange.style.display = 'inline-flex';
            if (scanDateTo && !scanDateTo.value) scanDateTo.value = todayStr;
        }
    });

    if (scanDateFrom) {
        scanDateFrom.addEventListener('change', () => {
            if (scanDatePreset.value !== 'custom' && scanDatePreset.value !== 'all') {
                scanDatePreset.value = 'custom';
            }
        });
        scanDateFrom.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') btnScanSubmit.click();
        });
    }

    if (scanDateTo) {
        scanDateTo.addEventListener('change', () => {
            if (scanDatePreset.value !== 'custom' && scanDatePreset.value !== 'all') {
                scanDatePreset.value = 'custom';
            }
        });
        scanDateTo.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') btnScanSubmit.click();
        });
    }
}

if (chkIncludeDate) {
    chkIncludeDate.checked = localStorage.getItem('telegram_include_date') === 'true';
    chkIncludeDate.addEventListener('change', () => {
        localStorage.setItem('telegram_include_date', chkIncludeDate.checked);
    });
}

// 1. App Init
async function checkStatus(retryCount = 0) {
    try {
        const res = await fetch(`${API_BASE}/status`);
        const data = await res.json();
        
        if (data.authorized) {
            loginModal.style.display = 'none';
            stopQrPolling();
            document.getElementById('userInfoGroup').style.display = 'flex';
            document.getElementById('userInfoName').textContent = data.user.name || data.user.username;
            if (data.user.premium) {
                document.getElementById('userInfoPremium').style.display = 'inline';
            } else {
                document.getElementById('userInfoPremium').style.display = 'none';
            }
            connectWebSocket();
            loadDownloadsData();
            loadGrabberData();
        } else {
            loginModal.style.display = 'flex';
            document.getElementById('userInfoGroup').style.display = 'none';
            connectWebSocket();
            if (activeLoginTab === 'qr') {
                initQrLogin();
            }
        }
    } catch (e) {
        if (retryCount < 15) {
            // Si el servidor uvicorn está terminando de iniciar, reintentar automáticamente
            setTimeout(() => checkStatus(retryCount + 1), 1000);
        } else {
            console.error("No se pudo conectar con el servidor tras varios reintentos:", e);
        }
    }
}

document.getElementById('btnLogout').addEventListener('click', async () => {
    if(await showConfirmDialog('¿Seguro que quieres cerrar sesión?')) {
        stopQrPolling();
        await fetch(`${API_BASE}/auth/logout`, { method: 'POST' });
        checkStatus();
    }
});

// --- Gestión de Autenticación por Código QR ---
let activeLoginTab = 'qr';
let qrCodeInstance = null;
let qrPollTimer = null;
let qrIsLoading = false;

const tabBtnQr = document.getElementById('tabBtnQr');
const tabBtnPhone = document.getElementById('tabBtnPhone');
const sectionLoginQr = document.getElementById('sectionLoginQr');
const sectionLoginPhone = document.getElementById('sectionLoginPhone');
const btnLoginSubmit = document.getElementById('btnLoginSubmit');
const btnSwitchToPhone = document.getElementById('btnSwitchToPhone');
const btnSwitchToQr = document.getElementById('btnSwitchToQr');

const qrLoadingOverlay = document.getElementById('qrLoadingOverlay');
const qrExpiredOverlay = document.getElementById('qrExpiredOverlay');
const qrStatusBadge = document.getElementById('qrStatusBadge');
const qrStatusText = document.getElementById('qrStatusText');
const qr2faSection = document.getElementById('qr2faSection');
const qrGeneralError = document.getElementById('qrGeneralError');
const btnReloadQr = document.getElementById('btnReloadQr');
const btnSubmitQrPassword = document.getElementById('btnSubmitQrPassword');
const qrPasswordInput = document.getElementById('qrPasswordInput');
const qrPasswordError = document.getElementById('qrPasswordError');

function switchLoginTab(tab) {
    activeLoginTab = tab;
    if (tab === 'qr') {
        if (tabBtnQr) tabBtnQr.classList.add('active');
        if (tabBtnPhone) tabBtnPhone.classList.remove('active');
        if (sectionLoginQr) sectionLoginQr.style.display = 'block';
        if (sectionLoginPhone) sectionLoginPhone.style.display = 'none';
        if (btnLoginSubmit) btnLoginSubmit.style.display = 'none';
        initQrLogin();
    } else {
        if (tabBtnPhone) tabBtnPhone.classList.add('active');
        if (tabBtnQr) tabBtnQr.classList.remove('active');
        if (sectionLoginPhone) sectionLoginPhone.style.display = 'block';
        if (sectionLoginQr) sectionLoginQr.style.display = 'none';
        if (btnLoginSubmit) btnLoginSubmit.style.display = 'inline-block';
        stopQrPolling();
        fetch(`${API_BASE}/auth/qr/cancel`, { method: 'POST' }).catch(() => {});
    }
}

if (tabBtnQr) tabBtnQr.addEventListener('click', () => switchLoginTab('qr'));
if (tabBtnPhone) tabBtnPhone.addEventListener('click', () => switchLoginTab('phone'));
if (btnSwitchToPhone) btnSwitchToPhone.addEventListener('click', () => switchLoginTab('phone'));
if (btnSwitchToQr) btnSwitchToQr.addEventListener('click', () => switchLoginTab('qr'));

async function initQrLogin() {
    if (qrIsLoading) return;
    qrIsLoading = true;

    if (qrLoadingOverlay) qrLoadingOverlay.style.display = 'flex';
    if (qrExpiredOverlay) qrExpiredOverlay.style.display = 'none';
    if (qr2faSection) qr2faSection.style.display = 'none';
    if (qrGeneralError) {
        qrGeneralError.style.display = 'none';
        qrGeneralError.textContent = '';
    }
    if (qrStatusBadge) qrStatusBadge.style.display = 'inline-flex';
    if (qrStatusText) qrStatusText.textContent = 'Generando código QR...';

    connectWebSocket();

    try {
        const res = await fetch(`${API_BASE}/auth/qr/start`, { method: 'POST' });
        const data = await res.json();
        
        if (data.already_authorized) {
            loginModal.style.display = 'none';
            stopQrPolling();
            checkStatus();
            return;
        }

        if (data.success) {
            onQrTokenReceived(data.token_url, data.expires);
            startQrPolling();
        } else {
            onQrError(data.error);
        }
    } catch (e) {
        onQrError('No se pudo conectar con el servidor.');
    } finally {
        qrIsLoading = false;
    }
}

function onQrTokenReceived(tokenUrl, expires) {
    if (qrLoadingOverlay) qrLoadingOverlay.style.display = 'none';
    if (qrExpiredOverlay) qrExpiredOverlay.style.display = 'none';
    if (qrStatusBadge) qrStatusBadge.style.display = 'inline-flex';
    if (qrStatusText) qrStatusText.textContent = 'Esperando escaneo desde tu teléfono...';

    const canvasEl = document.getElementById('qrCanvas');
    if (canvasEl && typeof QRCode !== 'undefined') {
        canvasEl.innerHTML = '';
        try {
            qrCodeInstance = new QRCode(canvasEl, {
                text: tokenUrl,
                width: 220,
                height: 220,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.M
            });
        } catch (e) {
            console.error("Error al renderizar código QR:", e);
            onQrError("Error al generar imagen de código QR: " + (e.message || e));
        }
    } else {
        onQrError("Librería de código QR no disponible en el navegador.");
    }
}

function onQrLoginSuccess(userData) {
    stopQrPolling();
    if (qrStatusBadge) {
        qrStatusBadge.style.background = '#dff6dd';
        qrStatusBadge.style.borderColor = '#107c10';
        qrStatusBadge.innerHTML = '<i class="fa-solid fa-circle-check" style="color: #107c10;"></i> <span style="color: #107c10; font-weight: 600;">¡Conectado exitosamente!</span>';
    }
    setTimeout(() => {
        loginModal.style.display = 'none';
        checkStatus();
    }, 600);
}

function onQrNeedsPassword() {
    if (qrStatusBadge) {
        qrStatusBadge.innerHTML = '<i class="fa-solid fa-key" style="color: #b7791f;"></i> <span style="color: #b7791f;">Requiere contraseña 2FA</span>';
    }
    if (qr2faSection) {
        qr2faSection.style.display = 'block';
        if (qrPasswordInput) qrPasswordInput.focus();
    }
}

function onQrExpired() {
    if (qrExpiredOverlay) qrExpiredOverlay.style.display = 'flex';
    if (qrStatusBadge) qrStatusBadge.style.display = 'none';
}

function onQrError(errMsg) {
    if (qrLoadingOverlay) qrLoadingOverlay.style.display = 'none';
    if (qrStatusBadge) qrStatusBadge.style.display = 'none';
    if (qrGeneralError) {
        qrGeneralError.style.display = 'block';
        qrGeneralError.textContent = errMsg || 'Error al iniciar sesión con código QR.';
    }
}

function startQrPolling() {
    stopQrPolling();
    qrPollTimer = setInterval(async () => {
        if (loginModal.style.display === 'none' || activeLoginTab !== 'qr') {
            stopQrPolling();
            return;
        }
        try {
            const res = await fetch(`${API_BASE}/auth/qr/status`);
            const data = await res.json();
            if (data.status === 'success') {
                onQrLoginSuccess(data.user);
            } else if (data.status === 'needs_password') {
                onQrNeedsPassword();
            } else if (data.status === 'expired') {
                onQrExpired();
            } else if (data.status === 'error') {
                onQrError(data.error);
            }
        } catch (e) {
            // Error de red temporal en polling
        }
    }, 2500);
}

function stopQrPolling() {
    if (qrPollTimer) {
        clearInterval(qrPollTimer);
        qrPollTimer = null;
    }
}

if (btnReloadQr) {
    btnReloadQr.addEventListener('click', () => {
        initQrLogin();
    });
}

if (btnSubmitQrPassword) {
    btnSubmitQrPassword.addEventListener('click', async () => {
        const pwd = qrPasswordInput ? qrPasswordInput.value : '';
        if (!pwd) {
            if (qrPasswordError) qrPasswordError.textContent = 'Ingresa tu contraseña de dos pasos.';
            return;
        }
        if (qrPasswordError) {
            qrPasswordError.style.color = '#0078d7';
            qrPasswordError.textContent = 'Verificando contraseña...';
        }
        try {
            const res = await fetch(`${API_BASE}/auth/qr/password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: pwd })
            });
            const data = await res.json();
            if (data.success) {
                onQrLoginSuccess(data.user);
            } else {
                if (qrPasswordError) {
                    qrPasswordError.style.color = '#d92d20';
                    qrPasswordError.textContent = data.error || 'Contraseña incorrecta.';
                }
            }
        } catch (e) {
            if (qrPasswordError) {
                qrPasswordError.style.color = '#d92d20';
                qrPasswordError.textContent = 'Error de conexión.';
            }
        }
    });
}

if (qrPasswordInput) {
    qrPasswordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (btnSubmitQrPassword) btnSubmitQrPassword.click();
        }
    });
}

// 2. Login Logic, Country Database & Phone Validation
const countrySelect = document.getElementById('countrySelect');
const countryCodeInput = document.getElementById('countryCode');
const phoneNumberInput = document.getElementById('phoneNumber');
const phoneHint = document.getElementById('phoneHint');
const phoneDigitsCounter = document.getElementById('phoneDigitsCounter');
const phoneStatusIcon = document.getElementById('phoneStatusIcon');

const COUNTRY_RULES = {
    '+54': {
        name: 'Argentina',
        min: 10,
        max: 11,
        example: '91112345678',
        hint: 'Para Argentina incluir 9 para celulares + código de área sin 0 (ej: 9 11 1234 5678, 10 a 11 dígitos).'
    },
    '+56': {
        name: 'Chile',
        min: 9,
        max: 9,
        example: '990734259',
        hint: 'Para Chile celulares deben tener exactamente 9 dígitos empezando por 9 (ej: 9 1234 5678).'
    },
    '+52': {
        name: 'México',
        min: 10,
        max: 10,
        example: '5512345678',
        hint: 'Para México se requieren exactamente 10 dígitos (ej: 55 1234 5678).'
    },
    '+34': {
        name: 'España',
        min: 9,
        max: 9,
        example: '612345678',
        hint: 'Para España se requieren exactamente 9 dígitos (ej: 612 345 678).'
    },
    '+57': {
        name: 'Colombia',
        min: 10,
        max: 10,
        example: '3001234567',
        hint: 'Para Colombia se requieren exactamente 10 dígitos (ej: 300 123 4567).'
    },
    '+51': {
        name: 'Perú',
        min: 9,
        max: 9,
        example: '912345678',
        hint: 'Para Perú se requieren exactamente 9 dígitos (ej: 912 345 678).'
    },
    '+58': {
        name: 'Venezuela',
        min: 10,
        max: 10,
        example: '4121234567',
        hint: 'Para Venezuela se requieren exactamente 10 dígitos (ej: 412 123 4567).'
    },
    '+55': {
        name: 'Brasil',
        min: 10,
        max: 11,
        example: '11987654321',
        hint: 'Para Brasil se requieren 10 u 11 dígitos (DDD + número).'
    },
    '+598': {
        name: 'Uruguay',
        min: 8,
        max: 8,
        example: '99123456',
        hint: 'Para Uruguay se requieren 8 dígitos (ej: 99 123 456).'
    },
    '+595': {
        name: 'Paraguay',
        min: 9,
        max: 9,
        example: '981123456',
        hint: 'Para Paraguay se requieren 9 dígitos (ej: 981 123 456).'
    },
    '+591': {
        name: 'Bolivia',
        min: 8,
        max: 8,
        example: '71234567',
        hint: 'Para Bolivia se requieren 8 dígitos (ej: 7123 4567).'
    },
    '+593': {
        name: 'Ecuador',
        min: 9,
        max: 9,
        example: '991234567',
        hint: 'Para Ecuador se requieren 9 dígitos (ej: 99 123 4567).'
    },
    '+1': {
        name: 'EE.UU. / Canadá',
        min: 10,
        max: 10,
        example: '2025550123',
        hint: 'Para EE.UU. / Canadá se requieren exactamente 10 dígitos.'
    },
    '+1787': {
        name: 'Puerto Rico',
        min: 7,
        max: 10,
        example: '7871234567',
        hint: 'Para Puerto Rico se requieren 7 o 10 dígitos.'
    },
    '+1809': {
        name: 'Rep. Dominicana',
        min: 7,
        max: 10,
        example: '8091234567',
        hint: 'Para Rep. Dominicana se requieren 7 o 10 dígitos.'
    },
    '+506': {
        name: 'Costa Rica',
        min: 8,
        max: 8,
        example: '81234567',
        hint: 'Para Costa Rica se requieren 8 dígitos.'
    },
    '+503': {
        name: 'El Salvador',
        min: 8,
        max: 8,
        example: '71234567',
        hint: 'Para El Salvador se requieren 8 dígitos.'
    },
    '+502': {
        name: 'Guatemala',
        min: 8,
        max: 8,
        example: '51234567',
        hint: 'Para Guatemala se requieren 8 dígitos.'
    },
    '+504': {
        name: 'Honduras',
        min: 8,
        max: 8,
        example: '91234567',
        hint: 'Para Honduras se requieren 8 dígitos.'
    },
    '+505': {
        name: 'Nicaragua',
        min: 8,
        max: 8,
        example: '81234567',
        hint: 'Para Nicaragua se requieren 8 dígitos.'
    },
    '+507': {
        name: 'Panamá',
        min: 8,
        max: 8,
        example: '61234567',
        hint: 'Para Panamá se requieren 8 dígitos.'
    },
    '+53': {
        name: 'Cuba',
        min: 8,
        max: 8,
        example: '51234567',
        hint: 'Para Cuba se requieren 8 dígitos.'
    },
    '+49': {
        name: 'Alemania',
        min: 10,
        max: 11,
        example: '15112345678',
        hint: 'Para Alemania se requieren 10 a 11 dígitos (sin el 0 inicial).'
    },
    '+33': {
        name: 'Francia',
        min: 9,
        max: 9,
        example: '612345678',
        hint: 'Para Francia se requieren 9 dígitos (sin el 0 inicial).'
    },
    '+39': {
        name: 'Italia',
        min: 9,
        max: 10,
        example: '3123456789',
        hint: 'Para Italia se requieren 9 o 10 dígitos.'
    },
    '+351': {
        name: 'Portugal',
        min: 9,
        max: 9,
        example: '912345678',
        hint: 'Para Portugal se requieren 9 dígitos.'
    },
    '+44': {
        name: 'Reino Unido',
        min: 10,
        max: 10,
        example: '7911123456',
        hint: 'Para Reino Unido se requieren 10 dígitos (sin el 0 inicial).'
    },
    '+7': {
        name: 'Rusia',
        min: 10,
        max: 10,
        example: '9123456789',
        hint: 'Para Rusia se requieren 10 dígitos.'
    },
    'DEFAULT': {
        name: 'Internacional',
        min: 6,
        max: 15,
        example: '123456789',
        hint: 'Ingresa el número de teléfono sin el 0 inicial (de 6 a 15 dígitos).'
    }
};

function getActiveCountryRule() {
    let code = countryCodeInput ? countryCodeInput.value.trim() : '';
    if (code && !code.startsWith('+')) {
        code = '+' + code;
    }
    return COUNTRY_RULES[code] || COUNTRY_RULES['DEFAULT'];
}

function cleanRawPhoneNumber(raw) {
    if (!raw) return '';
    return raw.replace(/\D/g, '');
}

function updatePhoneValidationUI() {
    if (!phoneNumberInput || !countryCodeInput) return;
    
    let raw = phoneNumberInput.value;
    
    // Si el usuario pegó un número completo con código de país (ej: +56 9 1234 5678)
    if (raw.trim().startsWith('+')) {
        let trimmed = raw.trim();
        for (const code of Object.keys(COUNTRY_RULES)) {
            if (code !== 'DEFAULT' && trimmed.startsWith(code)) {
                countryCodeInput.value = code;
                if (countrySelect) countrySelect.value = code;
                raw = trimmed.substring(code.length);
                phoneNumberInput.value = cleanRawPhoneNumber(raw);
                break;
            }
        }
    }
    
    const rule = getActiveCountryRule();
    let digits = cleanRawPhoneNumber(phoneNumberInput.value);
    
    // Si empieza con 0 inicial (ej: 09...), removerlo automáticamente
    if (digits.startsWith('0') && digits.length > 1) {
        digits = digits.replace(/^0+/, '');
        phoneNumberInput.value = digits;
    }
    
    const count = digits.length;
    
    // Actualizar placeholder
    const expectedExample = `Ej: ${rule.example}`;
    if (phoneNumberInput.placeholder !== expectedExample) {
        phoneNumberInput.placeholder = expectedExample;
    }
    
    // Actualizar badge de contador
    if (phoneDigitsCounter) {
        const expectedText = rule.min === rule.max ? `${rule.min}` : `${rule.min}-${rule.max}`;
        phoneDigitsCounter.textContent = `${count} / ${expectedText} dígitos`;
        
        if (count === 0) {
            phoneDigitsCounter.style.color = '#888';
            phoneDigitsCounter.style.background = '#f0f0f0';
            phoneDigitsCounter.style.borderColor = '#ddd';
            phoneNumberInput.style.borderColor = '#a0a0a0';
        } else if (count >= rule.min && count <= rule.max) {
            phoneDigitsCounter.style.color = '#107c10';
            phoneDigitsCounter.style.background = '#dff6dd';
            phoneDigitsCounter.style.borderColor = '#107c10';
            phoneNumberInput.style.borderColor = '#107c10';
        } else if (count > rule.max) {
            phoneDigitsCounter.style.color = '#d92d20';
            phoneDigitsCounter.style.background = '#fde7e9';
            phoneDigitsCounter.style.borderColor = '#d92d20';
            phoneNumberInput.style.borderColor = '#d92d20';
        } else {
            phoneDigitsCounter.style.color = '#b45309';
            phoneDigitsCounter.style.background = '#fef3c7';
            phoneDigitsCounter.style.borderColor = '#f59e0b';
            phoneNumberInput.style.borderColor = '#f59e0b';
        }
    }
    
    // Actualizar texto explicativo del hint
    if (phoneHint) {
        phoneHint.textContent = rule.hint;
        if (phoneStatusIcon) {
            if (count >= rule.min && count <= rule.max) {
                phoneStatusIcon.className = 'fa-solid fa-circle-check';
                phoneStatusIcon.style.color = '#107c10';
            } else if (count > rule.max) {
                phoneStatusIcon.className = 'fa-solid fa-circle-xmark';
                phoneStatusIcon.style.color = '#d92d20';
            } else {
                phoneStatusIcon.className = 'fa-solid fa-circle-info';
                phoneStatusIcon.style.color = '#0078d7';
            }
        }
    }
}

if (countrySelect && countryCodeInput && phoneNumberInput) {
    const savedCountry = localStorage.getItem('telegram_country_code');
    if (savedCountry) {
        countrySelect.value = savedCountry;
        countryCodeInput.value = savedCountry;
    }

    countrySelect.addEventListener('change', () => {
        const val = countrySelect.value;
        countryCodeInput.value = val;
        if (val) {
            localStorage.setItem('telegram_country_code', val);
        }
        updatePhoneValidationUI();
    });

    countryCodeInput.addEventListener('input', () => {
        let code = countryCodeInput.value.trim();
        if (code && !code.startsWith('+')) {
            code = '+' + code;
            countryCodeInput.value = code;
        }
        let matched = false;
        for (const opt of countrySelect.options) {
            if (opt.value === code) {
                countrySelect.value = code;
                matched = true;
                break;
            }
        }
        if (!matched) {
            countrySelect.value = '';
        }
        updatePhoneValidationUI();
    });

    phoneNumberInput.addEventListener('input', () => {
        updatePhoneValidationUI();
    });

    // Ejecutar validación inicial
    updatePhoneValidationUI();
}

function validateAndGetPhone() {
    let code = countryCodeInput ? countryCodeInput.value.trim() : '';
    if (code && !code.startsWith('+')) {
        code = '+' + code;
    }
    
    if (!code || code === '+') {
        return { valid: false, error: 'Por favor ingresa o selecciona un código de país válido (ej: +56, +54).' };
    }
    
    const rule = getActiveCountryRule();
    let num = cleanRawPhoneNumber(phoneNumberInput ? phoneNumberInput.value : '');
    
    if (num.startsWith('0')) {
        num = num.replace(/^0+/, '');
    }
    
    if (!num) {
        return { valid: false, error: `Por favor ingresa tu número telefónico para ${rule.name}.` };
    }
    
    if (rule.min === rule.max) {
        if (num.length !== rule.min) {
            return {
                valid: false,
                error: `⚠️ Número inválido para ${rule.name} (${code}): debe tener exactamente ${rule.min} dígitos (ej: ${rule.example}). Ingresaste ${num.length} dígitos.`
            };
        }
    } else {
        if (num.length < rule.min || num.length > rule.max) {
            return {
                valid: false,
                error: `⚠️ Número inválido para ${rule.name} (${code}): debe tener entre ${rule.min} y ${rule.max} dígitos. Ingresaste ${num.length} dígitos.`
            };
        }
    }
    
    return {
        valid: true,
        fullPhone: `${code}${num}`
    };
}

document.getElementById('btnLoginSubmit').addEventListener('click', async () => {
    const errEl = document.getElementById('loginError');
    errEl.textContent = '';

    const validation = validateAndGetPhone();
    if (!validation.valid) {
        errEl.style.color = 'red';
        errEl.textContent = validation.error;
        return;
    }

    const phone = validation.fullPhone;
    const code = document.getElementById('authCode').value.trim();
    const password = document.getElementById('authPassword').value;

    if (!phoneHash) {
        errEl.style.color = '#0078d7';
        errEl.textContent = 'Enviando código a Telegram...';
        try {
            const res = await fetch(`${API_BASE}/auth/send_code`, {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ phone })
            });
            const data = await res.json();
            if (data.success) {
                phoneHash = data.phone_code_hash;
                document.getElementById('authCode').style.display = 'block';
                document.getElementById('btnResendCode').style.display = 'inline-block';
                errEl.style.color = '#107c10';
                errEl.textContent = '✅ Código enviado. Ingresa el código que recibiste en tu app de Telegram.';
            } else {
                errEl.style.color = 'red';
                errEl.textContent = data.error;
            }
        } catch (e) {
            errEl.style.color = 'red';
            errEl.textContent = 'Error de conexión con el servidor. ¿Está corriendo la aplicación?';
        }
    } else {
        if (!code) {
            errEl.style.color = 'red';
            errEl.textContent = 'Ingresa el código de verificación que recibiste en Telegram.';
            return;
        }
        errEl.style.color = '#0078d7';
        errEl.textContent = 'Verificando...';
        try {
            const res = await fetch(`${API_BASE}/auth/verify`, {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ phone, code, phone_code_hash: phoneHash, password })
            });
            const data = await res.json();
            
            if (data.success) {
                loginModal.style.display = 'none';
                phoneHash = '';
                document.getElementById('btnResendCode').style.display = 'none';
                checkStatus();
            } else if (data.needs_password) {
                document.getElementById('authPassword').style.display = 'block';
                errEl.style.color = '#b45309';
                errEl.textContent = 'Requiere contraseña de verificación en 2 pasos (2FA).';
            } else {
                errEl.style.color = 'red';
                errEl.textContent = data.error;
            }
        } catch (e) {
            errEl.style.color = 'red';
            errEl.textContent = 'Error de conexión con el servidor.';
        }
    }
});

// Reenviar código de verificación
document.getElementById('btnResendCode').addEventListener('click', async () => {
    const errEl = document.getElementById('loginError');
    const validation = validateAndGetPhone();
    if (!validation.valid) {
        errEl.style.color = 'red';
        errEl.textContent = validation.error;
        return;
    }
    
    phoneHash = '';
    errEl.style.color = '#0078d7';
    errEl.textContent = 'Reenviando código...';
    
    try {
        const res = await fetch(`${API_BASE}/auth/send_code`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ phone: validation.fullPhone })
        });
        const data = await res.json();
        if (data.success) {
            phoneHash = data.phone_code_hash;
            document.getElementById('authCode').value = '';
            errEl.style.color = '#107c10';
            errEl.textContent = '✅ Nuevo código enviado. Revisá tu app de Telegram.';
        } else {
            errEl.style.color = 'red';
            errEl.textContent = data.error;
        }
    } catch (e) {
        errEl.style.color = 'red';
        errEl.textContent = 'Error de conexión con el servidor.';
    }
});

// Reiniciar sesión completamente (elimina el archivo de sesión)
document.getElementById('btnResetSession').addEventListener('click', async () => {
    if (!await showConfirmDialog('¿Reiniciar la sesión? Esto eliminará la sesión guardada y podrás iniciar con un número nuevo o código QR.\n\nÚsalo si la app te da error al intentar iniciar sesión.')) {
        return;
    }
    
    stopQrPolling();
    
    const errEl = document.getElementById('loginError');
    if (errEl) {
        errEl.style.color = '#0078d7';
        errEl.textContent = 'Reiniciando sesión...';
    }
    if (qrGeneralError) {
        qrGeneralError.style.display = 'block';
        qrGeneralError.style.color = '#0078d7';
        qrGeneralError.textContent = 'Reiniciando sesión...';
    }
    
    try {
        const res = await fetch(`${API_BASE}/auth/reset`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            phoneHash = '';
            document.getElementById('authCode').style.display = 'none';
            document.getElementById('authCode').value = '';
            document.getElementById('authPassword').style.display = 'none';
            document.getElementById('authPassword').value = '';
            document.getElementById('btnResendCode').style.display = 'none';
            if (errEl) {
                errEl.style.color = '#107c10';
                errEl.textContent = '✅ ' + data.message;
            }
            if (qrGeneralError) {
                qrGeneralError.style.color = '#107c10';
                qrGeneralError.textContent = '✅ ' + data.message;
            }
            // Si está en pestaña QR, volver a inicializar QR limpio
            if (activeLoginTab === 'qr') {
                setTimeout(() => {
                    initQrLogin();
                }, 1000);
            }
        } else {
            if (errEl) {
                errEl.style.color = 'red';
                errEl.textContent = data.error || 'Error al reiniciar la sesión.';
            }
            if (qrGeneralError) {
                qrGeneralError.style.color = 'red';
                qrGeneralError.textContent = data.error || 'Error al reiniciar la sesión.';
            }
        }
    } catch (e) {
        if (errEl) {
            errEl.style.color = 'red';
            errEl.textContent = 'Error de conexión con el servidor.';
        }
        if (qrGeneralError) {
            qrGeneralError.style.color = 'red';
            qrGeneralError.textContent = 'Error de conexión con el servidor.';
        }
    }
});

// ═════════════════════════════════════════════════════════════════════════
// 2. SISTEMA DE PESTAÑAS
// ═════════════════════════════════════════════════════════════════════════

const tabDescargas = document.getElementById('tabDescargas');
const tabGrabber = document.getElementById('tabGrabber');
const tabAuto = document.getElementById('tabAuto');
const viewDescargas = document.getElementById('viewDescargas');
const viewGrabber = document.getElementById('viewGrabber');
const viewAuto = document.getElementById('viewAuto');
const badgeDescargasCount = document.getElementById('badgeDescargasCount');
const badgeGrabberCount = document.getElementById('badgeGrabberCount');

function switchMainTab(tabName) {
    currentMainTab = tabName;
    const bottomInfoPanel = document.getElementById('bottomInfoPanel');
    const bottomBarConfig = document.getElementById('bottomBarConfig');
    const infoDescargasGroup = document.getElementById('infoDescargasGroup');
    const infoGrabberGroup = document.getElementById('infoGrabberGroup');
    const statusDescargasGroup = document.getElementById('statusDescargasGroup');
    const statusGrabberGroup = document.getElementById('statusGrabberGroup');
    const statusSpeed = document.getElementById('statusSpeed');
    const statusPackagesGrabber = document.getElementById('statusPackagesGrabber');

    if (tabName === 'descargas') {
        if (tabDescargas) tabDescargas.classList.add('active');
        if (tabGrabber) tabGrabber.classList.remove('active');
        if (tabAuto) tabAuto.classList.remove('active');
        if (viewDescargas) viewDescargas.style.display = 'flex';
        if (viewGrabber) viewGrabber.style.display = 'none';
        if (viewAuto) viewAuto.style.display = 'none';

        if (bottomInfoPanel) bottomInfoPanel.style.display = 'flex';
        if (bottomBarConfig) bottomBarConfig.style.display = 'flex';
        if (infoDescargasGroup) infoDescargasGroup.style.display = 'flex';
        if (infoGrabberGroup) infoGrabberGroup.style.display = 'none';
        if (statusDescargasGroup) statusDescargasGroup.style.display = 'flex';
        if (statusGrabberGroup) statusGrabberGroup.style.display = 'none';
        if (statusSpeed) statusSpeed.style.display = 'inline';
        if (statusPackagesGrabber) statusPackagesGrabber.style.display = 'none';

        loadDownloadsData();
    } else if (tabName === 'grabber') {
        if (tabDescargas) tabDescargas.classList.remove('active');
        if (tabGrabber) tabGrabber.classList.add('active');
        if (tabAuto) tabAuto.classList.remove('active');
        if (viewDescargas) viewDescargas.style.display = 'none';
        if (viewGrabber) viewGrabber.style.display = 'flex';
        if (viewAuto) viewAuto.style.display = 'none';

        if (bottomInfoPanel) bottomInfoPanel.style.display = 'flex';
        if (bottomBarConfig) bottomBarConfig.style.display = 'flex';
        if (infoDescargasGroup) infoDescargasGroup.style.display = 'none';
        if (infoGrabberGroup) infoGrabberGroup.style.display = 'flex';
        if (statusDescargasGroup) statusDescargasGroup.style.display = 'none';
        if (statusGrabberGroup) statusGrabberGroup.style.display = 'flex';
        if (statusSpeed) statusSpeed.style.display = 'none';
        if (statusPackagesGrabber) statusPackagesGrabber.style.display = 'inline';

        loadGrabberData();
    } else if (tabName === 'auto') {
        if (tabDescargas) tabDescargas.classList.remove('active');
        if (tabGrabber) tabGrabber.classList.remove('active');
        if (tabAuto) tabAuto.classList.add('active');
        if (viewDescargas) viewDescargas.style.display = 'none';
        if (viewGrabber) viewGrabber.style.display = 'none';
        if (viewAuto) viewAuto.style.display = 'flex';

        if (bottomInfoPanel) bottomInfoPanel.style.display = 'none';
        if (bottomBarConfig) bottomBarConfig.style.display = 'none';
        if (infoDescargasGroup) infoDescargasGroup.style.display = 'none';
        if (infoGrabberGroup) infoGrabberGroup.style.display = 'none';
        if (statusDescargasGroup) statusDescargasGroup.style.display = 'none';
        if (statusGrabberGroup) statusGrabberGroup.style.display = 'none';
        if (statusSpeed) statusSpeed.style.display = 'inline';
        if (statusPackagesGrabber) statusPackagesGrabber.style.display = 'none';
        
        loadAutoChannels();
    }
}

if (tabDescargas) tabDescargas.addEventListener('click', () => switchMainTab('descargas'));
if (tabGrabber) tabGrabber.addEventListener('click', () => switchMainTab('grabber'));
if (tabAuto) tabAuto.addEventListener('click', () => switchMainTab('auto'));

// ═════════════════════════════════════════════════════════════════════════
// 3. CARGA Y GESTIÓN DE DATOS DEL CAPTURADOR DE ENLACES
// ═════════════════════════════════════════════════════════════════════════

async function loadGrabberData() {
    try {
        const res = await fetch(`${API_BASE}/grabber`);
        const data = await res.json();
        if (data.success) {
            grabberPackages = data.packages || [];
            // Por defecto, expandir todos los paquetes nuevos en el capturador
            grabberPackages.forEach(p => {
                if (!expandedGrabber.has(p.id)) {
                    expandedGrabber.add(p.id);
                }
            });
            updateGrabberBadges();
            renderGrabberTable();
        }
    } catch (e) {
        console.error("Error al cargar capturador:", e);
    }
}

function updateGrabberBadges() {
    let totalItems = 0;
    grabberPackages.forEach(p => {
        totalItems += (p.items || []).length;
    });
    if (badgeGrabberCount) {
        if (totalItems > 0) {
            badgeGrabberCount.textContent = totalItems;
            badgeGrabberCount.style.display = 'inline-block';
        } else {
            badgeGrabberCount.style.display = 'none';
        }
    }
}

// ═════════════════════════════════════════════════════════════════════════
// 4. CARGA Y GESTIÓN DE DATOS DE DESCARGAS
// ═════════════════════════════════════════════════════════════════════════

async function loadDownloadsData() {
    try {
        const res = await fetch(`${API_BASE}/history`);
        const data = await res.json();
        if (data.success) {
            downloadsData = data.history || [];
            // Registrar estados en caché
            downloadsData.forEach(item => {
                itemStates[item.db_id] = item.state;
                if (item.file_path) itemFilePaths[item.db_id] = item.file_path;
                // Por defecto, expandir los paquetes que tengan descargas
                const pkg = item.package_name || 'Descargas';
                if (!expandedDescargas.has(pkg)) {
                    expandedDescargas.add(pkg);
                }
            });
            updateDescargasBadges();
            renderDescargasTable();
            connectWebSocket();
        }
    } catch (e) {
        console.error("Error al cargar historial de descargas:", e);
    }
}

function updateDescargasBadges() {
    let activeCount = 0;
    let doneCount = 0;
    downloadsData.forEach(d => {
        const st = itemStates[d.db_id] || d.state;
        if (st === 'downloading' || st === 'pending') activeCount++;
        if (st === 'done') doneCount++;
    });

    if (badgeDescargasCount) {
        if (activeCount > 0) {
            badgeDescargasCount.textContent = activeCount;
            badgeDescargasCount.style.display = 'inline-block';
        } else {
            badgeDescargasCount.style.display = 'none';
        }
    }

    const descargasActiveCountEl = document.getElementById('descargasActiveCount');
    const descargasDoneCountEl = document.getElementById('descargasDoneCount');
    if (descargasActiveCountEl) descargasActiveCountEl.textContent = `${downloadsData.length} descargas (${activeCount} activas)`;
    if (descargasDoneCountEl) descargasDoneCountEl.textContent = `${doneCount} completadas`;
}

// ═════════════════════════════════════════════════════════════════════════
// 5. ESCANEAR ENLACE (AÑADIR AL CAPTURADOR)
// ═════════════════════════════════════════════════════════════════════════

btnScanSubmit.addEventListener('click', async () => {
    const link = channelLink.value.trim();
    if (!link) return;
    
    // Validar y obtener rango de fechas
    const datePreset = scanDatePreset ? scanDatePreset.value : 'all';
    let dateFromVal = null;
    let dateToVal = null;

    if (datePreset !== 'all') {
        if (scanDateFrom && scanDateFrom.value) dateFromVal = scanDateFrom.value.trim();
        if (scanDateTo && scanDateTo.value) dateToVal = scanDateTo.value.trim();

        if (dateFromVal && dateToVal && dateFromVal > dateToVal) {
            showToast('La fecha de inicio (Desde) no puede ser posterior a la fecha de fin (Hasta).', 'error');
            return;
        }
    }

    scanError.style.display = 'block';
    if (dateFromVal || dateToVal) {
        const rangeText = (dateFromVal && dateToVal) ? `${dateFromVal} al ${dateToVal}` : (dateFromVal ? `desde ${dateFromVal}` : `hasta ${dateToVal}`);
        scanError.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Escaneando enlace [${rangeText}], por favor espera...`;
    } else {
        scanError.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Escaneando enlace y recolectando archivos, por favor espera...';
    }
    scanError.style.backgroundColor = '#fff4ce';
    scanError.style.color = '#795548';
    btnScanSubmit.disabled = true;
    
    try {
        const customDir = customDirInput ? customDirInput.value.trim() : '';
        const payload = {
            link,
            custom_dir: customDir,
            date_from: dateFromVal || null,
            date_to: dateToVal || null
        };
        const res = await fetch(`${API_BASE}/scan`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        
        if (data.success) {
            grabberPackages = data.packages || [];
            if (data.package_id) {
                expandedGrabber.add(data.package_id);
            }
            updateGrabberBadges();
            
            // Cambiar automáticamente a la pestaña del capturador para ver el paquete añadido
            switchMainTab('grabber');
            
            scanError.style.display = 'none';
            if (data.videos && data.videos.length > 0) {
                showToast(`✅ Paquete <strong>"${data.package_name}"</strong> añadido al Capturador con ${data.videos.length} archivo(s).`, 'success');
            } else {
                showToast(`ℹ️ Escaneo completado: No se encontraron archivos para capturar${dateFromVal || dateToVal ? ' en el rango de fechas seleccionado' : ''}.`, 'info');
            }
            
            setTimeout(() => {
                if (scanError.style.backgroundColor === 'rgb(230, 255, 250)') {
                    scanError.style.display = 'none';
                }
            }, 5000);
            
            channelLink.value = '';
        } else {
            scanError.style.display = 'none';
            showToast('Error: ' + data.error, 'error');
        }
    } catch (e) {
        scanError.style.display = 'none';
        showToast('Error de red al conectar con el servidor.', 'error');
    } finally {
        btnScanSubmit.disabled = false;
    }
});

channelLink.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        btnScanSubmit.click();
    }
});

// ═════════════════════════════════════════════════════════════════════════
// 6. RENDERIZADO DE TABLA: CAPTURADOR DE ENLACES (Árbol por paquetes)
// ═════════════════════════════════════════════════════════════════════════

const bodyGrabber = document.getElementById('bodyGrabber');
const searchGrabberInput = document.getElementById('searchGrabberInput');
const selectAllGrabber = document.getElementById('selectAllGrabber');
const btnExpandAllGrabber = document.getElementById('btnExpandAllGrabber');
const txtExpandGrabber = document.getElementById('txtExpandGrabber');
const statusSelectionGrabber = document.getElementById('statusSelectionGrabber');
const statusSizeGrabber = document.getElementById('statusSizeGrabber');
const statusPackagesGrabber = document.getElementById('statusPackagesGrabber');
const infoGrabberText = document.getElementById('infoGrabberText');

let grabberDisplayLimit = 100;

function renderGrabberTable() {
    if (!bodyGrabber) return;
    bodyGrabber.innerHTML = '';
    
    if (grabberPackages.length === 0) {
        bodyGrabber.innerHTML = `<tr>
            <td colspan="6" class="empty-state-cell">
                <i class="fa-solid fa-folder-open empty-icon"></i>
                <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">El Capturador de Enlaces está vacío</div>
                <div class="empty-subtitle">Pega un enlace de canal o mensaje de Telegram en la barra superior y haz clic en "Escanear Enlace". Puedes añadir múltiples canales y quedarán organizados aquí en carpetas hasta que decidas descargarlos o borrarlos.</div>
            </td>
        </tr>`;
        updateGrabberSelection();
        return;
    }
    
    const searchTerm = searchGrabberInput ? searchGrabberInput.value.toLowerCase().trim() : '';
    
    // Filtrar paquetes y sus items
    const matchingPackages = [];
    grabberPackages.forEach(pkg => {
        const pkgNameLower = (pkg.name || '').toLowerCase();
        const pkgChanLower = (pkg.channel_name || '').toLowerCase();
        const pkgMatches = !searchTerm || pkgNameLower.includes(searchTerm) || pkgChanLower.includes(searchTerm);

        const filteredItems = (pkg.items || []).filter(item => {
            if (!isFormatAllowed(item.filename)) return false;
            if (searchTerm && !pkgMatches && !item.filename.toLowerCase().includes(searchTerm)) return false;
            return true;
        });

        if (searchTerm && !pkgMatches && filteredItems.length === 0) return;
        matchingPackages.push({ pkg, filteredItems });
    });

    if (matchingPackages.length === 0) {
        bodyGrabber.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #6b7280; padding: 25px;">No se encontraron paquetes que coincidan con la búsqueda.</td></tr>`;
        updateGrabberSelection();
        return;
    }

    const packagesToRender = matchingPackages.slice(0, grabberDisplayLimit);
    
    packagesToRender.forEach(({ pkg, filteredItems }) => {
        
        const isExpanded = expandedGrabber.has(pkg.id);
        const pkgSize = filteredItems.reduce((acc, it) => acc + (it.total_size || 0), 0);
        const allItemsChecked = filteredItems.length > 0 && filteredItems.every(it => selectedGrabberItems.has(it.id));
        const someItemsChecked = filteredItems.some(it => selectedGrabberItems.has(it.id));
        
        // 1. Fila del Paquete / Carpeta
        const trPkg = document.createElement('tr');
        trPkg.className = 'package-row';
        trPkg.dataset.pkgId = pkg.id;
        
        trPkg.innerHTML = `
            <td style="text-align: center;">
                <input type="checkbox" class="pkg-check-grabber" data-pkg-id="${pkg.id}" ${allItemsChecked ? 'checked' : ''}>
            </td>
            <td>
                <button type="button" class="tree-toggle-btn" data-pkg-id="${pkg.id}" title="${isExpanded ? 'Contraer carpeta' : 'Expandir carpeta'}">
                    ${isExpanded ? '−' : '+'}
                </button>
                <i class="fa-solid ${isExpanded ? 'fa-folder-open' : 'fa-folder'} folder-icon"></i>
                <span style="font-weight: 600; color: #1e3a5f;" title="Carpeta contenedora: ${pkg.name}">${pkg.name}</span>
                <span class="package-badge-count">(${filteredItems.length} archivos)</span>
                ${pkg.channel_name ? `<span class="channel-badge" style="background: #e0f2fe; color: #0369a1; padding: 2px 7px; border-radius: 4px; font-size: 11px; margin-left: 6px; font-weight: 500;" title="Canal de Telegram: ${pkg.channel_name}"><i class="fa-brands fa-telegram"></i> ${pkg.channel_name}</span>` : ''}
                <button type="button" class="row-action-btn" onclick="handleRenameGrabberPackage(event, ${pkg.id}, '${(pkg.name || '').replace(/'/g, "\\'")}')" title="Renombrar carpeta contenedora" style="padding: 2px 5px; font-size: 10px; margin-left: 4px; opacity: 0.7;">
                    <i class="fa-solid fa-pen"></i>
                </button>
            </td>
            <td><strong>${formatBytes(pkgSize)}</strong></td>
            <td style="font-size: 11px; color: #555;">${filteredItems.length > 0 && filteredItems[0].fecha ? formatFecha(filteredItems[0].fecha) : '-'}</td>
            <td style="font-size: 11px; color: #555; overflow: hidden; text-overflow: ellipsis;" title="${(pkg.custom_dir || 'Ruta por defecto') + (pkg.channel_name ? ' \\ ' + pkg.channel_name : '') + ' \\ ' + pkg.name}">
                <i class="fa-regular fa-folder" style="color: #888; margin-right: 4px;"></i>
                ${pkg.channel_name ? `<span style="color:#0369a1;">${pkg.channel_name}</span> \\ ` : ''}<strong>${pkg.name}</strong>
            </td>
            <td style="text-align: center;">
                <div style="display: inline-flex; gap: 4px; align-items: center; justify-content: center;">
                    <button type="button" class="row-action-btn start-download-btn" onclick="handleDownloadGrabberPackage(event, ${pkg.id})" title="Descargar todo este paquete" style="padding: 3px 8px; font-size: 11px;">
                        <i class="fa-solid fa-download"></i> Descargar
                    </button>
                    <button type="button" class="row-action-btn btn-danger" onclick="handleDeleteGrabberPackage(event, ${pkg.id})" title="Eliminar paquete del capturador">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </td>
        `;
        
        // Manejar checkbox del paquete
        const pkgCb = trPkg.querySelector('.pkg-check-grabber');
        if (someItemsChecked && !allItemsChecked) {
            pkgCb.indeterminate = true;
        }
        pkgCb.addEventListener('click', (e) => {
            e.stopPropagation();
            const checked = pkgCb.checked;
            filteredItems.forEach(it => {
                if (checked) selectedGrabberItems.add(it.id);
                else selectedGrabberItems.delete(it.id);
            });
            renderGrabberTable();
        });
        
        // Manejar clic en botón expandir o en la fila de paquete
        const toggleBtn = trPkg.querySelector('.tree-toggle-btn');
        const handleToggle = (e) => {
            e.stopPropagation();
            if (expandedGrabber.has(pkg.id)) {
                expandedGrabber.delete(pkg.id);
            } else {
                expandedGrabber.add(pkg.id);
            }
            renderGrabberTable();
        };
        toggleBtn.addEventListener('click', handleToggle);
        trPkg.addEventListener('click', (e) => {
            if (e.target.closest('.row-action-btn') || e.target.type === 'checkbox') return;
            handleToggle(e);
        });
        
        bodyGrabber.appendChild(trPkg);
        
        // 2. Filas de Archivos Hijas (si la carpeta está expandida)
        if (isExpanded) {
            filteredItems.forEach(item => {
                const isSelected = selectedGrabberItems.has(item.id);
                const trItem = document.createElement('tr');
                trItem.className = `child-file-row ${isSelected ? 'selected' : ''}`;
                trItem.dataset.itemId = item.id;
                
                trItem.innerHTML = `
                    <td></td>
                    <td>
                        <span class="child-indent"></span>
                        <input type="checkbox" class="item-check-grabber tree-item-checkbox" data-item-id="${item.id}" ${isSelected ? 'checked' : ''}>
                        <i class="${getFileIconClass(item.filename)} file-type-icon"></i>
                        <span title="${item.filename}">${item.filename}</span>
                    </td>
                    <td>${item.tamanio_fmt || formatBytes(item.total_size)}</td>
                    <td style="font-size: 11px;">${item.fecha ? formatFecha(item.fecha) : '-'}</td>
                    <td style="font-size: 11px; color: #777;">
                        <i class="fa-solid fa-arrow-turn-up fa-rotate-90" style="color: #cbd5e1; margin-right: 4px;"></i>
                        <span>En: ${pkg.channel_name ? '<span style=\"color:#0369a1;\">' + pkg.channel_name + '</span> \\ ' : ''}<strong>${pkg.name}</strong></span>
                    </td>
                    <td style="text-align: center;">
                        <div style="display: inline-flex; gap: 4px; align-items: center; justify-content: center;">
                            <button type="button" class="row-action-btn" onclick="handleDownloadSingleGrabberItem(event, ${item.id})" title="Descargar este archivo">
                                <i class="fa-solid fa-download" style="color: #107c10;"></i>
                            </button>
                            <button type="button" class="row-action-btn btn-danger" onclick="handleDeleteSingleGrabberItem(event, ${item.id})" title="Quitar del capturador">
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                    </td>
                `;
                
                const itemCb = trItem.querySelector('.item-check-grabber');
                itemCb.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (itemCb.checked) selectedGrabberItems.add(item.id);
                    else selectedGrabberItems.delete(item.id);
                    updateGrabberSelection();
                });
                
                trItem.addEventListener('click', (e) => {
                    if (e.target.closest('.row-action-btn') || e.target.type === 'checkbox') return;
                    itemCb.checked = !itemCb.checked;
                    if (itemCb.checked) selectedGrabberItems.add(item.id);
                    else selectedGrabberItems.delete(item.id);
                    updateGrabberSelection();
                });
                
                bodyGrabber.appendChild(trItem);
            });
        }
    });

    if (matchingPackages.length > packagesToRender.length) {
        const trMore = document.createElement('tr');
        trMore.className = 'grabber-pagination-row';
        trMore.innerHTML = `
            <td colspan="6" style="text-align: center; padding: 14px; background: #f8fafc; border-top: 1px solid #e2e8f0;">
                <span style="font-size: 12px; color: #475569; margin-right: 14px; font-weight: 500;">
                    Mostrando <strong>${packagesToRender.length}</strong> de <strong>${matchingPackages.length.toLocaleString()}</strong> carpetas
                </span>
                <button type="button" class="toolbar-btn" id="btnLoadMoreGrabber" style="padding: 4px 14px; font-size: 11px; display: inline-flex; align-items: center; gap: 5px; cursor: pointer;">
                    <i class="fa-solid fa-arrow-down"></i> Mostrar 100 más
                </button>
                <button type="button" class="toolbar-btn" id="btnLoadAllGrabber" style="padding: 4px 14px; font-size: 11px; margin-left: 8px; display: inline-flex; align-items: center; gap: 5px; cursor: pointer;">
                    Mostrar todas
                </button>
            </td>
        `;
        bodyGrabber.appendChild(trMore);
        trMore.querySelector('#btnLoadMoreGrabber').addEventListener('click', (e) => {
            e.stopPropagation();
            grabberDisplayLimit += 100;
            renderGrabberTable();
        });
        trMore.querySelector('#btnLoadAllGrabber').addEventListener('click', (e) => {
            e.stopPropagation();
            grabberDisplayLimit = matchingPackages.length;
            renderGrabberTable();
        });
    }

    updateGrabberSelection();
}

function updateGrabberSelection() {
    let count = 0;
    let totalBytesSelected = 0;
    
    grabberPackages.forEach(pkg => {
        (pkg.items || []).forEach(item => {
            if (selectedGrabberItems.has(item.id)) {
                count++;
                totalBytesSelected += (item.total_size || 0);
            }
        });
    });
    
    if (statusSelectionGrabber) {
        statusSelectionGrabber.textContent = `${count} elementos seleccionados`;
    }
    if (statusSizeGrabber) {
        statusSizeGrabber.textContent = `Tamaño total seleccionado: ${formatBytes(totalBytesSelected)}`;
    }
    if (statusPackagesGrabber) {
        statusPackagesGrabber.textContent = `${grabberPackages.length} paquetes`;
    }
    if (infoGrabberText) {
        if (count === 1) infoGrabberText.textContent = "1 archivo seleccionado para descargar";
        else if (count > 1) infoGrabberText.textContent = `${count} archivos seleccionados de distintos paquetes`;
        else infoGrabberText.textContent = `${grabberPackages.length} paquetes disponibles en el capturador`;
    }
}

if (searchGrabberInput) {
    searchGrabberInput.addEventListener('input', () => {
        grabberDisplayLimit = 100;
        renderGrabberTable();
    });
}

if (selectAllGrabber) {
    selectAllGrabber.addEventListener('change', () => {
        const checked = selectAllGrabber.checked;
        grabberPackages.forEach(pkg => {
            (pkg.items || []).forEach(item => {
                if (checked && isFormatAllowed(item.filename)) {
                    selectedGrabberItems.add(item.id);
                } else {
                    selectedGrabberItems.delete(item.id);
                }
            });
        });
        renderGrabberTable();
    });
}

if (btnExpandAllGrabber && txtExpandGrabber) {
    btnExpandAllGrabber.addEventListener('click', () => {
        if (expandedGrabber.size === grabberPackages.length && grabberPackages.length > 0) {
            expandedGrabber.clear();
            txtExpandGrabber.textContent = "Expandir Todo";
        } else {
            grabberPackages.forEach(p => expandedGrabber.add(p.id));
            txtExpandGrabber.textContent = "Contraer Todo";
        }
        renderGrabberTable();
    });
}

// ═════════════════════════════════════════════════════════════════════════
// 7. RENDERIZADO DE TABLA: DESCARGAS (Árbol por carpetas/paquetes)
// ═════════════════════════════════════════════════════════════════════════

const bodyDescargas = document.getElementById('bodyDescargas');
const searchDescargasInput = document.getElementById('searchDescargasInput');
const selectAllDescargas = document.getElementById('selectAllDescargas');
const btnExpandAllDescargas = document.getElementById('btnExpandAllDescargas');
const txtExpandDescargas = document.getElementById('txtExpandDescargas');
const statusSelectionDescargas = document.getElementById('statusSelectionDescargas');
const statusSizeDescargas = document.getElementById('statusSizeDescargas');
const infoDescargasText = document.getElementById('infoDescargasText');

function renderDescargasTable() {
    if (!bodyDescargas) return;
    bodyDescargas.innerHTML = '';
    
    if (downloadsData.length === 0) {
        bodyDescargas.innerHTML = `<tr>
            <td colspan="8" class="empty-state-cell">
                <i class="fa-solid fa-inbox empty-icon"></i>
                <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">No hay descargas en la lista</div>
                <div class="empty-subtitle">Abre la pestaña <strong>"Capturador de Enlaces"</strong> para escanear y agregar descargas desde canales de Telegram.</div>
            </td>
        </tr>`;
        updateDescargasSelection();
        return;
    }
    
    const searchTerm = searchDescargasInput ? searchDescargasInput.value.toLowerCase().trim() : '';
    
    // Agrupar descargas por nombre de paquete
    const grouped = {};
    downloadsData.forEach(dl => {
        if (searchTerm && !dl.nombre.toLowerCase().includes(searchTerm) && !(dl.package_name || '').toLowerCase().includes(searchTerm)) {
            return;
        }
        const pkgName = dl.package_name || 'Descargas';
        if (!grouped[pkgName]) grouped[pkgName] = [];
        grouped[pkgName].push(dl);
    });
    
    const packageNames = Object.keys(grouped);
    if (packageNames.length === 0) {
        bodyDescargas.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #6b7280; padding: 25px;">No se encontraron descargas que coincidan con la búsqueda.</td></tr>`;
        updateDescargasSelection();
        return;
    }
    
    packageNames.forEach(pkgName => {
        const items = grouped[pkgName];
        const isExpanded = expandedDescargas.has(pkgName);
        
        let pkgTotalSize = 0;
        let pkgDownloadedBytes = 0;
        let activeDownloading = 0;
        let hasPaused = false;
        let hasStopped = false;
        let allDone = true;
        
        items.forEach(it => {
            pkgTotalSize += (it.tamanio || 0);
            const downloaded = itemProgress[it.db_id] !== undefined ? itemProgress[it.db_id] : (it.downloaded_bytes || 0);
            pkgDownloadedBytes += downloaded;
            
            const st = itemStates[it.db_id] || it.state;
            if (st === 'downloading') activeDownloading++;
            if (st === 'paused') hasPaused = true;
            if (st === 'stopped') hasStopped = true;
            if (st !== 'done') allDone = false;
        });
        
        const pkgPercent = pkgTotalSize > 0 ? ((pkgDownloadedBytes / pkgTotalSize) * 100).toFixed(1) : 0;
        const allItemsChecked = items.every(it => selectedDownloads.has(it.db_id));
        const someItemsChecked = items.some(it => selectedDownloads.has(it.db_id));
        
        // Determinar estado agregado del paquete
        let pkgStateText = 'En cola';
        let pkgColor = '#666';
        if (allDone) {
            pkgStateText = 'Completado';
            pkgColor = '#107c10';
        } else if (activeDownloading > 0) {
            pkgStateText = `Descargando (${activeDownloading})`;
            pkgColor = '#0078d7';
        } else if (hasPaused) {
            pkgStateText = 'Pausado';
            pkgColor = '#d97706';
        } else if (hasStopped) {
            pkgStateText = 'Detenido';
            pkgColor = '#d92d20';
        }
        
        // 1. Fila de Paquete en Descargas
        const trPkg = document.createElement('tr');
        trPkg.className = 'package-row';
        trPkg.id = `pkg-dl-row-${encodeURIComponent(pkgName)}`;
        
        trPkg.innerHTML = `
            <td style="text-align: center;">
                <input type="checkbox" class="pkg-check-descargas" data-pkg-name="${pkgName}" ${allItemsChecked ? 'checked' : ''}>
            </td>
            <td>
                <button type="button" class="tree-toggle-btn" data-pkg-name="${pkgName}" title="${isExpanded ? 'Contraer carpeta' : 'Expandir carpeta'}">
                    ${isExpanded ? '−' : '+'}
                </button>
                <i class="fa-solid ${isExpanded ? 'fa-folder-open' : 'fa-folder'} folder-icon"></i>
                <span style="font-weight: 600; color: #1e3a5f;">${pkgName}</span>
                <span class="package-badge-count">(${items.length} archivos)</span>
                ${items[0] && items[0].channel_name ? `<span class="channel-badge" style="background: #e0f2fe; color: #0369a1; padding: 2px 7px; border-radius: 4px; font-size: 11px; margin-left: 6px; font-weight: 500;" title="Canal de Telegram: ${items[0].channel_name}"><i class="fa-brands fa-telegram"></i> ${items[0].channel_name}</span>` : ''}
            </td>
            <td><strong>${formatBytes(pkgTotalSize)}</strong></td>
            <td style="font-size: 11px; color: #555;">${items.length > 0 && items[0].fecha ? formatFecha(items[0].fecha) : '-'}</td>
            <td id="pkg-comp-${encodeURIComponent(pkgName)}">${formatBytes(pkgDownloadedBytes)}</td>
            <td>
                <div class="progress-bar-cell">
                    <div class="progress-bar-fill" id="pkg-perc-fill-${encodeURIComponent(pkgName)}" style="width: ${pkgPercent}%; background-color: ${allDone ? '#107c10' : '#0078d7'};"></div>
                    <div class="progress-bar-text" id="pkg-perc-text-${encodeURIComponent(pkgName)}">${pkgPercent}%</div>
                </div>
            </td>
            <td style="font-size: 11px; font-weight: 600; color: ${pkgColor};" id="pkg-spd-${encodeURIComponent(pkgName)}">
                ${pkgStateText}
            </td>
            <td style="text-align: center;">
                <div style="display: inline-flex; gap: 4px; align-items: center; justify-content: center;">
                    <button type="button" class="row-action-btn" onclick="handleTogglePackage(event, '${pkgName.replace(/'/g, "\\'")}')" title="Pausar / Reanudar paquete">
                        <i class="fa-solid ${activeDownloading > 0 ? 'fa-pause' : 'fa-play'}" style="color: ${activeDownloading > 0 ? '#d97706' : '#107c10'};"></i>
                    </button>
                    <button type="button" class="row-action-btn btn-danger" onclick="handleDeletePackage(event, '${pkgName.replace(/'/g, "\\'")}')" title="Eliminar paquete de la lista">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </td>
        `;
        
        const pkgCb = trPkg.querySelector('.pkg-check-descargas');
        if (someItemsChecked && !allItemsChecked) {
            pkgCb.indeterminate = true;
        }
        pkgCb.addEventListener('click', (e) => {
            e.stopPropagation();
            const checked = pkgCb.checked;
            items.forEach(it => {
                if (checked) selectedDownloads.add(it.db_id);
                else selectedDownloads.delete(it.db_id);
            });
            renderDescargasTable();
        });
        
        const toggleBtn = trPkg.querySelector('.tree-toggle-btn');
        const handleToggle = (e) => {
            e.stopPropagation();
            if (expandedDescargas.has(pkgName)) {
                expandedDescargas.delete(pkgName);
            } else {
                expandedDescargas.add(pkgName);
            }
            renderDescargasTable();
        };
        toggleBtn.addEventListener('click', handleToggle);
        trPkg.addEventListener('click', (e) => {
            if (e.target.closest('.row-action-btn') || e.target.type === 'checkbox') return;
            handleToggle(e);
        });
        
        bodyDescargas.appendChild(trPkg);
        
        // 2. Filas de Archivos en Descargas (si la carpeta está expandida)
        if (isExpanded) {
            items.forEach(item => {
                const dbId = item.db_id;
                const isSelected = selectedDownloads.has(dbId);
                const state = itemStates[dbId] || item.state;
                const downloaded = itemProgress[dbId] !== undefined ? itemProgress[dbId] : (item.downloaded_bytes || 0);
                const percent = item.total_size > 0 ? ((downloaded / item.total_size) * 100).toFixed(1) : 0;
                
                const trItem = document.createElement('tr');
                trItem.className = `child-file-row ${isSelected ? 'selected' : ''}`;
                trItem.id = `row-dl-${dbId}`;
                trItem.dataset.dbId = dbId;
                
                trItem.innerHTML = `
                    <td></td>
                    <td>
                        <span class="child-indent"></span>
                        <input type="checkbox" class="item-check-descargas tree-item-checkbox" data-db-id="${dbId}" ${isSelected ? 'checked' : ''}>
                        <i class="${getFileIconClass(item.nombre)} file-type-icon"></i>
                        <span title="${item.nombre}">${item.nombre}</span>
                    </td>
                    <td>${item.tamanio_fmt || formatBytes(item.total_size)}</td>
                    <td style="font-size: 11px; white-space: nowrap;">${item.fecha ? formatFecha(item.fecha) : '-'}</td>
                    <td id="comp-dl-${dbId}">${formatBytes(downloaded)}</td>
                    <td>
                        <div class="progress-bar-cell">
                            <div class="progress-bar-fill" id="perc-fill-dl-${dbId}" style="width: ${state === 'done' ? 100 : percent}%;"></div>
                            <div class="progress-bar-text" id="perc-text-dl-${dbId}">${state === 'done' ? '100%' : percent + '%'}</div>
                        </div>
                    </td>
                    <td id="spd-dl-${dbId}">-</td>
                    <td style="text-align: center;">
                        <div style="display: inline-flex; gap: 4px; align-items: center; justify-content: center;">
                            <button type="button" class="row-action-btn" id="btn-toggle-dl-${dbId}" onclick="handleToggleDownload(event, ${dbId})" title="Iniciar / Pausar / Reanudar">
                                <i class="fa-solid fa-play"></i>
                            </button>
                            <button type="button" class="row-action-btn btn-danger" id="btn-stop-dl-${dbId}" onclick="handleStopDownload(event, ${dbId})" title="Detener" style="display: none;">
                                <i class="fa-solid fa-stop"></i>
                            </button>
                            <button type="button" class="row-action-btn btn-danger" id="btn-del-dl-${dbId}" onclick="handleDeleteDownload(event, ${dbId})" title="Eliminar del historial">
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                    </td>
                `;
                
                const itemCb = trItem.querySelector('.item-check-descargas');
                itemCb.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (itemCb.checked) selectedDownloads.add(dbId);
                    else selectedDownloads.delete(dbId);
                    updateDescargasSelection();
                });
                
                trItem.addEventListener('click', (e) => {
                    if (e.target.closest('.row-action-btn') || e.target.type === 'checkbox') return;
                    itemCb.checked = !itemCb.checked;
                    if (itemCb.checked) selectedDownloads.add(dbId);
                    else selectedDownloads.delete(dbId);
                    updateDescargasSelection();
                });
                
                bodyDescargas.appendChild(trItem);
                updateDownloadRowUI(dbId, state);
            });
        }
    });
    
    updateDescargasSelection();
}

function updateDescargasSelection() {
    let count = 0;
    let totalBytesSelected = 0;
    let lastSelectedName = "-";
    
    downloadsData.forEach(item => {
        if (selectedDownloads.has(item.db_id)) {
            count++;
            totalBytesSelected += (item.total_size || 0);
            lastSelectedName = item.nombre;
        }
    });
    
    if (statusSelectionDescargas) {
        statusSelectionDescargas.textContent = `${count} elementos seleccionados`;
    }
    if (statusSizeDescargas) {
        statusSizeDescargas.textContent = `Tamaño total: ${formatBytes(totalBytesSelected)}`;
    }
    if (infoDescargasText) {
        if (count === 1) infoDescargasText.textContent = lastSelectedName;
        else if (count > 1) infoDescargasText.textContent = `(${count} descargas seleccionadas)`;
        else infoDescargasText.textContent = "Sin descargas seleccionadas";
    }
}

if (searchDescargasInput) {
    searchDescargasInput.addEventListener('input', renderDescargasTable);
}

if (selectAllDescargas) {
    selectAllDescargas.addEventListener('change', () => {
        const checked = selectAllDescargas.checked;
        downloadsData.forEach(item => {
            if (checked) selectedDownloads.add(item.db_id);
            else selectedDownloads.delete(item.db_id);
        });
        renderDescargasTable();
    });
}

if (btnExpandAllDescargas && txtExpandDescargas) {
    btnExpandAllDescargas.addEventListener('click', () => {
        const allPackageNames = [...new Set(downloadsData.map(d => d.package_name || 'Descargas'))];
        if (expandedDescargas.size === allPackageNames.length && allPackageNames.length > 0) {
            expandedDescargas.clear();
            txtExpandDescargas.textContent = "Expandir Todo";
        } else {
            allPackageNames.forEach(name => expandedDescargas.add(name));
            txtExpandDescargas.textContent = "Contraer Todo";
        }
        renderDescargasTable();
    });
}

// 4.1 Selector de carpeta de destino y persistencia
const btnBrowseDir = document.getElementById('btnBrowseDir');

const savedDir = localStorage.getItem('telegram_download_dir');
if (savedDir && customDirInput) {
    customDirInput.value = savedDir;
}

if (customDirInput) {
    customDirInput.addEventListener('input', () => {
        localStorage.setItem('telegram_download_dir', customDirInput.value.trim());
    });
}

// --- Gestor del Selector Visual de Carpetas ---
const folderPickerModal = document.getElementById('folderPickerModal');
const btnCloseFolderPickerX = document.getElementById('btnCloseFolderPickerX');
const btnCancelFolderPicker = document.getElementById('btnCancelFolderPicker');
const btnConfirmFolderPicker = document.getElementById('btnConfirmFolderPicker');
const quickFoldersContainer = document.getElementById('quickFoldersContainer');
const networkSharesSection = document.getElementById('networkSharesSection');
const networkSharesContainer = document.getElementById('networkSharesContainer');
const btnFolderUp = document.getElementById('btnFolderUp');
const folderDrives = document.getElementById('folderDrives');
const folderCurrentPathInput = document.getElementById('folderCurrentPathInput');
const btnGoToPath = document.getElementById('btnGoToPath');
const folderList = document.getElementById('folderList');
const folderSelectedDisplay = document.getElementById('folderSelectedDisplay');
const btnClassicWinDialog = document.getElementById('btnClassicWinDialog');
const btnNewFolderModal = document.getElementById('btnNewFolderModal');
const btnNewFolderModalBottom = document.getElementById('btnNewFolderModalBottom');
const newFolderRow = document.getElementById('newFolderRow');
const newFolderNameInput = document.getElementById('newFolderNameInput');
const btnConfirmNewFolder = document.getElementById('btnConfirmNewFolder');
const btnCancelNewFolder = document.getElementById('btnCancelNewFolder');

let pickerCurrentPath = '';
let pickerParentPath = null;
let folderPickerCallback = null;

function showNewFolderInput() {
    if (!newFolderRow || !newFolderNameInput) return;
    newFolderRow.style.display = 'flex';
    newFolderNameInput.value = 'Nueva carpeta';
    newFolderNameInput.focus();
    newFolderNameInput.select();
}

function hideNewFolderInput() {
    if (!newFolderRow) return;
    newFolderRow.style.display = 'none';
    if (newFolderNameInput) newFolderNameInput.value = '';
}

async function createNewFolder() {
    if (!newFolderNameInput) return;
    const folderName = newFolderNameInput.value.trim();
    if (!folderName) {
        showToast("Debes ingresar un nombre para la carpeta.", "error");
        newFolderNameInput.focus();
        return;
    }

    if (!pickerCurrentPath) {
        showToast("No hay una ruta actual seleccionada.", "error");
        return;
    }

    const origBtnHtml = btnConfirmNewFolder ? btnConfirmNewFolder.innerHTML : '';
    if (btnConfirmNewFolder) {
        btnConfirmNewFolder.disabled = true;
        btnConfirmNewFolder.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creando...';
    }

    try {
        const res = await fetch(`${API_BASE}/create_dir`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                parent_dir: pickerCurrentPath,
                folder_name: folderName
            })
        });
        const data = await res.json();
        if (data.success) {
            showToast(data.message || `Carpeta "${folderName}" creada exitosamente.`, "success");
            hideNewFolderInput();
            // Cargar directamente la nueva carpeta para que quede seleccionada
            await loadDirectory(data.path);
        } else {
            showToast(data.error || "No se pudo crear la carpeta.", "error");
            newFolderNameInput.focus();
        }
    } catch (e) {
        showToast(`Error de conexión al crear carpeta: ${e.message}`, "error");
    } finally {
        if (btnConfirmNewFolder) {
            btnConfirmNewFolder.disabled = false;
            btnConfirmNewFolder.innerHTML = origBtnHtml;
        }
    }
}

async function openFolderPicker(initialPath = '', onSelect = null) {
    if (!folderPickerModal) return;
    folderPickerCallback = onSelect;
    folderPickerModal.style.display = 'flex';
    hideNewFolderInput();
    const startPath = initialPath || (customDirInput ? customDirInput.value.trim() : '');
    await loadDirectory(startPath);
}

function closeFolderPicker() {
    folderPickerCallback = null;
    hideNewFolderInput();
    if (folderPickerModal) folderPickerModal.style.display = 'none';
}

async function loadDirectory(targetPath = '') {
    hideNewFolderInput();
    if (!folderList) return;
    folderList.innerHTML = '<div style="padding: 20px; text-align: center; color: #888; font-size: 11px;"><i class="fa-solid fa-spinner fa-spin"></i> Cargando carpetas...</div>';
    
    try {
        const url = `${API_BASE}/list_dirs?path=${encodeURIComponent(targetPath)}`;
        const res = await fetch(url);
        const data = await res.json();
        
        pickerCurrentPath = data.current;
        pickerParentPath = data.parent;
        
        if (folderCurrentPathInput) folderCurrentPathInput.value = data.current;
        if (folderSelectedDisplay) folderSelectedDisplay.textContent = data.current;
        
        if (btnFolderUp) {
            btnFolderUp.disabled = !data.parent;
            btnFolderUp.style.opacity = data.parent ? '1' : '0.4';
        }

        // Renderizar accesos rápidos locales
        if (quickFoldersContainer && quickFoldersContainer.children.length === 0 && data.common) {
            data.common.forEach(item => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'quick-folder-btn';
                btn.innerHTML = `<i class="fa-solid ${item.icon}"></i> <span>${item.name}</span>`;
                btn.addEventListener('click', () => loadDirectory(item.path));
                quickFoldersContainer.appendChild(btn);
            });
        }

        // Renderizar carpetas y unidades de red (NAS / Compartidos)
        if (networkSharesSection && networkSharesContainer && data.network_shares) {
            networkSharesContainer.innerHTML = '';
            if (data.network_shares.length > 0) {
                networkSharesSection.style.display = 'block';
                data.network_shares.forEach(share => {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'quick-folder-btn';
                    btn.style.borderColor = '#7dd3fc';
                    btn.style.color = '#0284c7';
                    btn.innerHTML = `<i class="fa-solid fa-network-wired"></i> <span title="${share.remote}">${share.name}</span>`;
                    btn.addEventListener('click', () => {
                        const targetDriveOrUnc = share.drive || share.remote;
                        loadDirectory(targetDriveOrUnc);
                    });
                    networkSharesContainer.appendChild(btn);
                });
            } else {
                networkSharesSection.style.display = 'none';
            }
        }

        // Renderizar unidades de disco o volúmenes (C:\, D:\ o /, /volume1)
        if (folderDrives && data.drives) {
            folderDrives.innerHTML = '';
            data.drives.forEach(drv => {
                const btn = document.createElement('button');
                btn.type = 'button';
                const isCurrentDrive = data.current.toLowerCase().startsWith(drv.toLowerCase());
                btn.className = `folder-drive-btn ${isCurrentDrive ? 'active' : ''}`;
                btn.textContent = drv.endsWith('\\') ? drv.replace('\\', '') : drv;
                btn.addEventListener('click', () => loadDirectory(drv));
                folderDrives.appendChild(btn);
            });
        }

        // Ocultar botón de diálogo clásico de Windows si estamos en Linux/Synology
        if (btnClassicWinDialog && typeof data.is_win !== 'undefined') {
            btnClassicWinDialog.style.display = data.is_win ? 'inline-flex' : 'none';
        }

        // Renderizar subcarpetas o mostrar error de acceso
        folderList.innerHTML = '';
        if (data.error) {
            folderList.innerHTML = `<div style="padding: 15px; text-align: center; color: #d92d20; font-size: 11px;">
                <i class="fa-solid fa-triangle-exclamation" style="font-size: 16px; margin-bottom: 5px; display: block;"></i>
                ${data.error}
            </div>`;
            return;
        }

        if (!data.subdirs || data.subdirs.length === 0) {
            folderList.innerHTML = '<div style="padding: 20px; text-align: center; color: #999; font-size: 11px; font-style: italic;">(Carpeta vacía o sin subcarpetas)</div>';
        } else {
            data.subdirs.forEach(sub => {
                const item = document.createElement('div');
                item.className = 'folder-item';
                item.innerHTML = `<i class="fa-solid fa-folder" style="color: #eab308; font-size: 13px;"></i> <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${sub}</span>`;
                item.addEventListener('click', () => {
                    const isUnix = pickerCurrentPath.startsWith('/') || (!pickerCurrentPath.includes('\\') && pickerCurrentPath.includes('/'));
                    let nextPath;
                    if (isUnix) {
                        const sep = pickerCurrentPath.endsWith('/') ? '' : '/';
                        nextPath = pickerCurrentPath + sep + sub;
                    } else {
                        const sep = pickerCurrentPath.endsWith('\\') ? '' : '\\';
                        nextPath = pickerCurrentPath + sep + sub;
                    }
                    loadDirectory(nextPath);
                });
                folderList.appendChild(item);
            });
        }
    } catch (e) {
        folderList.innerHTML = `<div style="padding: 15px; text-align: center; color: #d92d20; font-size: 11px;">Error cargando directorio: ${e.message}</div>`;
    }
}

if (btnGoToPath && folderCurrentPathInput) {
    const handleGo = () => {
        const val = folderCurrentPathInput.value.trim();
        if (val) loadDirectory(val);
    };
    btnGoToPath.addEventListener('click', handleGo);
    folderCurrentPathInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleGo();
        }
    });
}

if (btnBrowseDir) {
    btnBrowseDir.addEventListener('click', () => {
        openFolderPicker(customDirInput ? customDirInput.value.trim() : '');
    });
}

if (btnCloseFolderPickerX) btnCloseFolderPickerX.addEventListener('click', closeFolderPicker);
if (btnCancelFolderPicker) btnCancelFolderPicker.addEventListener('click', closeFolderPicker);

if (btnFolderUp) {
    btnFolderUp.addEventListener('click', () => {
        if (pickerParentPath) loadDirectory(pickerParentPath);
    });
}

if (btnConfirmFolderPicker) {
    btnConfirmFolderPicker.addEventListener('click', () => {
        if (pickerCurrentPath) {
            if (typeof folderPickerCallback === 'function') {
                folderPickerCallback(pickerCurrentPath);
            } else if (customDirInput) {
                customDirInput.value = pickerCurrentPath;
                localStorage.setItem('telegram_download_dir', pickerCurrentPath);
            }
        }
        closeFolderPicker();
    });
}

if (btnClassicWinDialog) {
    btnClassicWinDialog.addEventListener('click', async () => {
        const orig = btnClassicWinDialog.innerHTML;
        btnClassicWinDialog.disabled = true;
        btnClassicWinDialog.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Abriendo...';
        try {
            const res = await fetch(`${API_BASE}/select_folder`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ current_dir: pickerCurrentPath })
            });
            const data = await res.json();
            if (data && data.path) {
                pickerCurrentPath = data.path;
                if (typeof folderPickerCallback === 'function') {
                    folderPickerCallback(data.path);
                } else if (customDirInput) {
                    customDirInput.value = data.path;
                    localStorage.setItem('telegram_download_dir', data.path);
                }
                closeFolderPicker();
            }
        } catch (e) {
            console.error(e);
        } finally {
            btnClassicWinDialog.disabled = false;
            btnClassicWinDialog.innerHTML = orig;
        }
    });
}

if (folderPickerModal) {
    folderPickerModal.addEventListener('click', (e) => {
        if (e.target === folderPickerModal) closeFolderPicker();
    });
}

if (btnNewFolderModal) {
    btnNewFolderModal.addEventListener('click', () => {
        if (newFolderRow && newFolderRow.style.display === 'flex') {
            hideNewFolderInput();
        } else {
            showNewFolderInput();
        }
    });
}

if (btnNewFolderModalBottom) {
    btnNewFolderModalBottom.addEventListener('click', () => {
        if (newFolderRow && newFolderRow.style.display === 'flex') {
            hideNewFolderInput();
        } else {
            showNewFolderInput();
        }
    });
}

if (btnCancelNewFolder) {
    btnCancelNewFolder.addEventListener('click', hideNewFolderInput);
}

if (btnConfirmNewFolder) {
    btnConfirmNewFolder.addEventListener('click', createNewFolder);
}

if (newFolderNameInput) {
    newFolderNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            createNewFolder();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            hideNewFolderInput();
        }
    });
}

// Removed btnOpenCurrentDir listener

// 4.2 Formatos soportados y Modal de Configuración
const formatsSummary = document.getElementById('formatsSummary');
const btnEditFormats = document.getElementById('btnEditFormats');
const formatsModal = document.getElementById('formatsModal');
const btnCloseFormats = document.getElementById('btnCloseFormats');
const btnCloseFormatsX = document.getElementById('btnCloseFormatsX');
const chkAcceptAllFormats = document.getElementById('chkAcceptAllFormats');
const formatsCustomSection = document.getElementById('formatsCustomSection');
const inputNewExtension = document.getElementById('inputNewExtension');
const btnAddExtension = document.getElementById('btnAddExtension');
const btnClearAllFormats = document.getElementById('btnClearAllFormats');
const btnResetFormats = document.getElementById('btnResetFormats');
const btnSaveFormats = document.getElementById('btnSaveFormats');
const formatTagsContainer = document.getElementById('formatTagsContainer');
const formatsCount = document.getElementById('formatsCount');

let tempActiveFormats = [];
let tempAcceptAll = false;
let formatsModalCallback = null;

function updateFormatsSummaryUI() {
    if (!formatsSummary) return;
    
    if (acceptAllFormats) {
        formatsSummary.textContent = 'Todos los archivos (sin filtro)';
        formatsSummary.title = 'Aceptando cualquier tipo de extensión';
        formatsSummary.style.color = '#0078d4';
        return;
    }
    
    if (!activeFormats || activeFormats.length === 0) {
        formatsSummary.textContent = 'Ninguno seleccionado (0)';
        formatsSummary.title = 'Haz clic en Editar para agregar extensiones permitidas';
        formatsSummary.style.color = '#d92d20';
        return;
    }
    
    formatsSummary.style.color = '#333';
    const displayList = activeFormats.map(ext => ext.toLowerCase());
    if (displayList.length <= 6) {
        formatsSummary.textContent = displayList.join(', ');
    } else {
        const firstSix = displayList.slice(0, 6).join(', ');
        formatsSummary.textContent = `${firstSix} (+${displayList.length - 6} más)`;
    }
    formatsSummary.title = `Formatos permitidos (${displayList.length}): ${displayList.join(', ')}`;
}

function applyFormatFilter() {
    if (allScannedVideos.length > 0) {
        const searchInput = document.getElementById('searchInput');
        const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
        
        currentVideos = allScannedVideos.filter(v => {
            if (!isFormatAllowed(v.nombre)) return false;
            if (searchTerm && !v.nombre.toLowerCase().includes(searchTerm)) return false;
            return true;
        });
        if (sortConfig.key) {
            currentVideos.sort((a, b) => {
                let valA = a[sortConfig.key];
                let valB = b[sortConfig.key];
                if (typeof valA === 'string') valA = valA.toLowerCase();
                if (typeof valB === 'string') valB = valB.toLowerCase();
                if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
    }
    updateFormatsSummaryUI();
    renderTable();
    updateSelection();
}

function openFormatsModal(customAcceptAll = null, customFormats = null, onSave = null) {
    if (typeof onSave === 'function') {
        formatsModalCallback = onSave;
        tempAcceptAll = customAcceptAll !== null ? customAcceptAll : false;
        tempActiveFormats = Array.isArray(customFormats) ? [...customFormats] : [];
    } else {
        formatsModalCallback = null;
        tempActiveFormats = [...activeFormats];
        tempAcceptAll = acceptAllFormats;
    }

    if (chkAcceptAllFormats) {
        chkAcceptAllFormats.checked = tempAcceptAll;
    }
    updateModalSectionVisibility();
    renderFormatTags();
    if (inputNewExtension) inputNewExtension.value = '';
    if (formatsModal) formatsModal.style.display = 'flex';
}

function closeFormatsModal() {
    formatsModalCallback = null;
    if (formatsModal) formatsModal.style.display = 'none';
}

function updateModalSectionVisibility() {
    if (!formatsCustomSection || !chkAcceptAllFormats) return;
    if (chkAcceptAllFormats.checked) {
        formatsCustomSection.style.opacity = '0.45';
        formatsCustomSection.style.pointerEvents = 'none';
    } else {
        formatsCustomSection.style.opacity = '1';
        formatsCustomSection.style.pointerEvents = 'auto';
    }
}

function renderFormatTags() {
    if (!formatTagsContainer) return;
    formatTagsContainer.innerHTML = '';
    if (formatsCount) formatsCount.textContent = tempActiveFormats.length;
    
    if (tempActiveFormats.length === 0) {
        formatTagsContainer.innerHTML = '<span style="font-size: 11px; color: #999; font-style: italic;">No hay extensiones añadidas. No se filtrará ningún archivo a menos que añadas extensiones o actives "Aceptar todos".</span>';
        return;
    }
    
    tempActiveFormats.forEach((ext, idx) => {
        const tag = document.createElement('span');
        tag.className = 'format-tag';
        tag.innerHTML = `
            <span>${ext.toLowerCase()}</span>
            <button type="button" class="format-tag-remove" data-idx="${idx}" title="Eliminar ${ext}">&times;</button>
        `;
        formatTagsContainer.appendChild(tag);
    });

    formatTagsContainer.querySelectorAll('.format-tag-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.dataset.idx);
            tempActiveFormats.splice(idx, 1);
            renderFormatTags();
        });
    });
}

function addExtensionFromInput() {
    if (!inputNewExtension) return;
    const raw = inputNewExtension.value.trim();
    if (!raw) return;
    
    const parts = raw.split(/[,\s]+/).map(p => p.trim()).filter(Boolean);
    let added = false;
    parts.forEach(part => {
        let clean = part.toLowerCase();
        if (!clean.startsWith('.')) clean = '.' + clean;
        if (clean.length > 1 && !tempActiveFormats.includes(clean)) {
            tempActiveFormats.push(clean);
            added = true;
        }
    });
    
    if (added) {
        inputNewExtension.value = '';
        renderFormatTags();
    }
}

if (btnEditFormats) {
    btnEditFormats.addEventListener('click', openFormatsModal);
}
if (btnCloseFormats) {
    btnCloseFormats.addEventListener('click', closeFormatsModal);
}
if (btnCloseFormatsX) {
    btnCloseFormatsX.addEventListener('click', closeFormatsModal);
}
if (formatsModal) {
    formatsModal.addEventListener('click', (e) => {
        if (e.target === formatsModal) closeFormatsModal();
    });
}

if (chkAcceptAllFormats) {
    chkAcceptAllFormats.addEventListener('change', (e) => {
        tempAcceptAll = e.target.checked;
        updateModalSectionVisibility();
    });
}

if (btnAddExtension) {
    btnAddExtension.addEventListener('click', addExtensionFromInput);
}
if (inputNewExtension) {
    inputNewExtension.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addExtensionFromInput();
        }
    });
}

document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const catKey = btn.dataset.category;
        const list = PRESET_CATEGORIES[catKey] || [];
        let added = false;
        list.forEach(ext => {
            const clean = ext.toLowerCase();
            if (!tempActiveFormats.includes(clean)) {
                tempActiveFormats.push(clean);
                added = true;
            }
        });
        if (added) {
            renderFormatTags();
        }
    });
});

if (btnClearAllFormats) {
    btnClearAllFormats.addEventListener('click', () => {
        tempActiveFormats = [];
        renderFormatTags();
    });
}

if (btnResetFormats) {
    btnResetFormats.addEventListener('click', () => {
        tempActiveFormats = [...DEFAULT_ACTIVE_FORMATS];
        tempAcceptAll = false;
        if (chkAcceptAllFormats) chkAcceptAllFormats.checked = false;
        updateModalSectionVisibility();
        renderFormatTags();
    });
}

if (btnSaveFormats) {
    btnSaveFormats.addEventListener('click', () => {
        const acceptAll = chkAcceptAllFormats ? chkAcceptAllFormats.checked : false;
        const formats = [...tempActiveFormats];
        
        if (typeof formatsModalCallback === 'function') {
            const cb = formatsModalCallback;
            formatsModalCallback = null;
            closeFormatsModal();
            cb({ acceptAll, formats });
        } else {
            acceptAllFormats = acceptAll;
            activeFormats = formats;
            
            localStorage.setItem('telegram_accept_all_formats', acceptAllFormats ? 'true' : 'false');
            localStorage.setItem('telegram_custom_formats', JSON.stringify(activeFormats));
            
            closeFormatsModal();
            updateFormatsSummaryUI();
            applyFormatFilter();
        }
    });
}

// Inicializar texto de formatos en barra inferior
updateFormatsSummaryUI();

// ═════════════════════════════════════════════════════════════════════════
// 8. ACCIONES DEL CAPTURADOR DE ENLACES (Link Grabber Actions)
// ═════════════════════════════════════════════════════════════════════════

const btnStartGrabberDownloads = document.getElementById('btnStartGrabberDownloads');
const btnDeleteSelectedGrabber = document.getElementById('btnDeleteSelectedGrabber');
const btnClearGrabber = document.getElementById('btnClearGrabber');

if (btnStartGrabberDownloads) {
    btnStartGrabberDownloads.addEventListener('click', async () => {
        // Recolectar elementos a descargar
        let itemsToDownload = [];
        
        if (selectedGrabberItems.size > 0) {
            grabberPackages.forEach(pkg => {
                (pkg.items || []).forEach(item => {
                    if (selectedGrabberItems.has(item.id)) {
                        itemsToDownload.push({ ...item, package_name: pkg.name, channel_name: pkg.channel_name || '' });
                    }
                });
            });
        } else {
            // Si no hay ninguno seleccionado expresamente, descargar todos los que cumplan con el filtro de formato
            grabberPackages.forEach(pkg => {
                (pkg.items || []).forEach(item => {
                    if (isFormatAllowed(item.filename)) {
                        itemsToDownload.push({ ...item, package_name: pkg.name, channel_name: pkg.channel_name || '' });
                    }
                });
            });
        }
        
        if (itemsToDownload.length === 0) {
            showToast('No hay elementos seleccionados ni disponibles para descargar en el Capturador.', 'error');
            return;
        }
        
        const customDir = customDirInput ? customDirInput.value.trim() : '';
        const includeDate = chkIncludeDate ? chkIncludeDate.checked : false;
        
        const payloadItems = itemsToDownload.map(it => ({
            message_id: it.message_id,
            entity_id: it.entity_id || '',
            filename: it.filename,
            total_size: it.total_size,
            fecha: it.fecha || '',
            custom_dir: it.custom_dir || customDir,
            package_name: it.package_name || 'Descargas',
            channel_name: it.channel_name || '',
            grabber_item_id: it.id
        }));
        
        btnStartGrabberDownloads.disabled = true;
        const origHtml = btnStartGrabberDownloads.innerHTML;
        btnStartGrabberDownloads.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Iniciando...';
        
        try {
            const res = await fetch(`${API_BASE}/download`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: payloadItems,
                    custom_dir: customDir,
                    include_date: includeDate,
                    remove_from_grabber: true
                })
            });
            const data = await res.json();
            
            if (data.success) {
                // Quitar de seleccionados
                itemsToDownload.forEach(it => selectedGrabberItems.delete(it.id));
                // Cambiar a la pestaña de Descargas para ver el progreso en tiempo real
                switchMainTab('descargas');
                await loadGrabberData();
                await loadDownloadsData();
            } else {
                showToast('Error al iniciar descargas: ' + (data.error || 'Desconocido'), 'error');
            }
        } catch (e) {
            showToast('Error de red al conectar con el servidor: ' + e.message, 'error');
        } finally {
            btnStartGrabberDownloads.disabled = false;
            btnStartGrabberDownloads.innerHTML = origHtml;
        }
    });
}

const btnReorganizeGrabber = document.getElementById('btnReorganizeGrabber');
if (btnReorganizeGrabber) {
    btnReorganizeGrabber.addEventListener('click', async () => {
        if (!grabberPackages || grabberPackages.length === 0) {
            showToast('El Capturador de Enlaces está vacío.', 'info');
            return;
        }
        if (!await showConfirmDialog('¿Deseas reorganizar todos los archivos en carpetas separadas por modelo/esquemático?')) return;

        const origHtml = btnReorganizeGrabber.innerHTML;
        btnReorganizeGrabber.disabled = true;
        btnReorganizeGrabber.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Organizando...';

        try {
            const res = await fetch(`${API_BASE}/grabber/reorganize`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                showToast(`¡Listo! Se organizaron los archivos en ${data.packages_count.toLocaleString()} paquetes por modelo.`, 'success');
                await loadGrabberData();
            } else {
                showToast('Error al reorganizar: ' + (data.error || 'Desconocido'), 'error');
            }
        } catch (e) {
            showToast('Error de red al conectar con el servidor: ' + e.message, 'error');
        } finally {
            btnReorganizeGrabber.disabled = false;
            btnReorganizeGrabber.innerHTML = origHtml;
        }
    });
}

if (btnDeleteSelectedGrabber) {
    btnDeleteSelectedGrabber.addEventListener('click', async () => {
        if (selectedGrabberItems.size === 0) {
            showToast('No hay elementos seleccionados en el Capturador.', 'error');
            return;
        }
        if (!await showConfirmDialog(`¿Eliminar ${selectedGrabberItems.size} elemento(s) del capturador?`)) return;
        
        try {
            await fetch(`${API_BASE}/grabber/delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ item_ids: Array.from(selectedGrabberItems) })
            });
            selectedGrabberItems.clear();
            await loadGrabberData();
        } catch (e) {
            console.error(e);
        }
    });
}

if (btnClearGrabber) {
    btnClearGrabber.addEventListener('click', async () => {
        if (grabberPackages.length === 0) return;
        if (!await showConfirmDialog('¿Seguro que quieres vaciar todos los paquetes y enlaces del Capturador?')) return;
        
        try {
            await fetch(`${API_BASE}/grabber/clear`, { method: 'POST' });
            selectedGrabberItems.clear();
            await loadGrabberData();
        } catch (e) {
            console.error(e);
        }
    });
}

window.handleRenameGrabberPackage = async function(event, pkgId, currentName) {
    if (event) event.stopPropagation();
    const newName = prompt("Nuevo nombre para la carpeta contenedora:", currentName);
    if (!newName || newName.trim() === "" || newName.trim() === currentName) return;
    try {
        const res = await fetch(`${API_BASE}/grabber/rename`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ package_id: pkgId, name: newName.trim() })
        });
        const data = await res.json();
        if (data.success) {
            await loadGrabberData();
        }
    } catch (e) {
        showToast("Error al renombrar carpeta: " + e.message, 'error');
    }
};

window.handleDownloadGrabberPackage = async function(event, pkgId) {
    if (event) event.stopPropagation();
    const pkg = grabberPackages.find(p => p.id === pkgId);
    if (!pkg || !pkg.items || pkg.items.length === 0) return;
    
    const customDir = pkg.custom_dir || (customDirInput ? customDirInput.value.trim() : '');
    const includeDate = chkIncludeDate ? chkIncludeDate.checked : false;
    
    const items = pkg.items.filter(it => isFormatAllowed(it.filename));
    if (items.length === 0) {
        showToast('Ningún archivo en este paquete coincide con los formatos activos.', 'error');
        return;
    }
    
    const payloadItems = items.map(it => ({
        message_id: it.message_id,
        entity_id: it.entity_id || '',
        filename: it.filename,
        total_size: it.total_size,
        fecha: it.fecha || '',
        custom_dir: it.custom_dir || customDir,
        package_name: pkg.name,
        channel_name: pkg.channel_name || '',
        grabber_item_id: it.id
    }));
    
    try {
        const res = await fetch(`${API_BASE}/download`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                items: payloadItems,
                custom_dir: customDir,
                include_date: includeDate,
                remove_from_grabber: true
            })
        });
        const data = await res.json();
        if (data.success) {
            items.forEach(it => selectedGrabberItems.delete(it.id));
            switchMainTab('descargas');
            await loadGrabberData();
            await loadDownloadsData();
        }
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
};

window.handleDeleteGrabberPackage = async function(event, pkgId) {
    if (event) event.stopPropagation();
    if (!await showConfirmDialog('¿Eliminar este paquete del capturador de enlaces?')) return;
    try {
        await fetch(`${API_BASE}/grabber/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ package_ids: [pkgId] })
        });
        await loadGrabberData();
    } catch (e) {
        console.error(e);
    }
};

window.handleDownloadSingleGrabberItem = async function(event, itemId) {
    if (event) event.stopPropagation();
    let targetItem = null;
    let targetPkg = null;
    
    for (const pkg of grabberPackages) {
        const found = (pkg.items || []).find(it => it.id === itemId);
        if (found) {
            targetItem = found;
            targetPkg = pkg;
            break;
        }
    }
    if (!targetItem) return;
    
    const customDir = targetItem.custom_dir || targetPkg.custom_dir || (customDirInput ? customDirInput.value.trim() : '');
    const includeDate = chkIncludeDate ? chkIncludeDate.checked : false;
    
    const payloadItems = [{
        message_id: targetItem.message_id,
        entity_id: targetItem.entity_id || '',
        filename: targetItem.filename,
        total_size: targetItem.total_size,
        fecha: targetItem.fecha || '',
        custom_dir: customDir,
        package_name: targetPkg.name,
        channel_name: targetPkg.channel_name || '',
        grabber_item_id: targetItem.id
    }];
    
    try {
        const res = await fetch(`${API_BASE}/download`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                items: payloadItems,
                custom_dir: customDir,
                include_date: includeDate,
                remove_from_grabber: true
            })
        });
        const data = await res.json();
        if (data.success) {
            selectedGrabberItems.delete(targetItem.id);
            switchMainTab('descargas');
            await loadGrabberData();
            await loadDownloadsData();
        }
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
};

window.handleDeleteSingleGrabberItem = async function(event, itemId) {
    if (event) event.stopPropagation();
    try {
        await fetch(`${API_BASE}/grabber/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item_ids: [itemId] })
        });
        selectedGrabberItems.delete(itemId);
        await loadGrabberData();
    } catch (e) {
        console.error(e);
    }
};

// ═════════════════════════════════════════════════════════════════════════
// 9. ACCIONES DE LA PESTAÑA DESCARGAS (Downloads Actions)
// ═════════════════════════════════════════════════════════════════════════

const btnClearCompleted = document.getElementById('btnClearCompleted');
const btnDeleteSelectedDownloads = document.getElementById('btnDeleteSelectedDownloads');
const btnResumeAll = document.getElementById('btnResumeAll');
const btnPauseAll = document.getElementById('btnPauseAll');
const btnStopAll = document.getElementById('btnStopAll');

if (btnClearCompleted) {
    btnClearCompleted.addEventListener('click', async () => {
        try {
            await fetch(`${API_BASE}/downloads/clear_completed`, { method: 'POST' });
            await loadDownloadsData();
        } catch (e) {
            console.error(e);
        }
    });
}

if (btnDeleteSelectedDownloads) {
    btnDeleteSelectedDownloads.addEventListener('click', async () => {
        if (selectedDownloads.size === 0) {
            showToast('No hay descargas seleccionadas.', 'error');
            return;
        }
        if (!await showConfirmDialog(`¿Eliminar ${selectedDownloads.size} descarga(s) del historial?`)) return;
        
        try {
            await fetch(`${API_BASE}/downloads/delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ db_ids: Array.from(selectedDownloads) })
            });
            selectedDownloads.clear();
            await loadDownloadsData();
        } catch (e) {
            console.error(e);
        }
    });
}

if (btnResumeAll) {
    btnResumeAll.addEventListener('click', async () => {
        await fetch(`${API_BASE}/download/resume`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ index: 'all' })
        });
        connectWebSocket();
    });
}

if (btnPauseAll) {
    btnPauseAll.addEventListener('click', async () => {
        await fetch(`${API_BASE}/download/pause`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ index: 'all' })
        });
    });
}

if (btnStopAll) {
    btnStopAll.addEventListener('click', async () => {
        await fetch(`${API_BASE}/download/stop`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ index: 'all' })
        });
    });
}

window.handleTogglePackage = async function(event, pkgName) {
    if (event) event.stopPropagation();
    const pkgDownloads = downloadsData.filter(d => (d.package_name || 'Descargas') === pkgName);
    if (pkgDownloads.length === 0) return;
    
    // Si alguna se está descargando, pausamos todas las del paquete
    const isAnyDownloading = pkgDownloads.some(d => (itemStates[d.db_id] || d.state) === 'downloading');
    
    for (const dl of pkgDownloads) {
        if (isAnyDownloading) {
            if ((itemStates[dl.db_id] || dl.state) === 'downloading') {
                await fetch(`${API_BASE}/download/pause`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ index: dl.db_id })
                });
            }
        } else {
            const st = itemStates[dl.db_id] || dl.state;
            if (st === 'paused') {
                await fetch(`${API_BASE}/download/resume`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ index: dl.db_id })
                });
            } else if (st !== 'done') {
                await fetch(`${API_BASE}/download`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ indices: [dl.db_id], is_resume: true })
                });
            }
        }
    }
    connectWebSocket();
};

window.handleDeletePackage = async function(event, pkgName) {
    if (event) event.stopPropagation();
    if (!await showConfirmDialog(`¿Eliminar el paquete "${pkgName}" y todas sus descargas del historial?`)) return;
    try {
        await fetch(`${API_BASE}/downloads/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ package_names: [pkgName] })
        });
        await loadDownloadsData();
    } catch (e) {
        console.error(e);
    }
};

window.handleToggleDownload = async function(event, dbId) {
    if (event) event.stopPropagation();
    const state = itemStates[dbId] || 'idle';
    
    if (state === 'downloading') {
        await fetch(`${API_BASE}/download/pause`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ index: dbId })
        });
    } else if (state === 'paused') {
        await fetch(`${API_BASE}/download/resume`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ index: dbId })
        });
        connectWebSocket();
    } else {
        itemStates[dbId] = 'pending';
        updateDownloadRowUI(dbId, 'pending');
        connectWebSocket();
        await fetch(`${API_BASE}/download`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ indices: [dbId], is_resume: true })
        });
    }
};

window.handleStopDownload = async function(event, dbId) {
    if (event) event.stopPropagation();
    await fetch(`${API_BASE}/download/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index: dbId })
    });
};

window.handleDeleteDownload = async function(event, dbId) {
    if (event) event.stopPropagation();
    try {
        await fetch(`${API_BASE}/downloads/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ db_ids: [dbId] })
        });
        selectedDownloads.delete(dbId);
        await loadDownloadsData();
    } catch (e) {
        console.error(e);
    }
};

// Actualiza el aspecto de una fila de descarga individual
function updateDownloadRowUI(dbId, state) {
    const btnToggle = document.getElementById(`btn-toggle-dl-${dbId}`);
    const btnStop = document.getElementById(`btn-stop-dl-${dbId}`);
    const percFill = document.getElementById(`perc-fill-dl-${dbId}`);
    const percText = document.getElementById(`perc-text-dl-${dbId}`);
    const spdEl = document.getElementById(`spd-dl-${dbId}`);

    if (!btnToggle) return;

    if (state === 'downloading') {
        btnToggle.innerHTML = '<i class="fa-solid fa-pause" style="color: #d97706;"></i>';
        btnToggle.title = 'Pausar descarga';
        btnToggle.style.display = 'inline-flex';
        if (btnStop) {
            btnStop.style.display = 'inline-flex';
            btnStop.disabled = false;
        }
        if (percFill) percFill.style.backgroundColor = '#0078d7';
    } else if (state === 'pending') {
        btnToggle.innerHTML = '<i class="fa-solid fa-pause" style="color: #d97706;"></i>';
        btnToggle.title = 'En cola (Pausar)';
        btnToggle.style.display = 'inline-flex';
        if (btnStop) {
            btnStop.style.display = 'inline-flex';
            btnStop.disabled = false;
        }
        if (spdEl) spdEl.textContent = 'En cola';
    } else if (state === 'paused') {
        btnToggle.innerHTML = '<i class="fa-solid fa-play" style="color: #107c10;"></i>';
        btnToggle.title = 'Reanudar descarga';
        btnToggle.style.display = 'inline-flex';
        if (btnStop) {
            btnStop.style.display = 'inline-flex';
            btnStop.disabled = false;
        }
        if (spdEl) spdEl.textContent = 'Pausado';
        if (percFill) percFill.style.backgroundColor = '#d97706';
    } else if (state === 'stopped') {
        btnToggle.innerHTML = '<i class="fa-solid fa-rotate-right" style="color: #0078d7;"></i>';
        btnToggle.title = 'Reiniciar descarga';
        btnToggle.style.display = 'inline-flex';
        if (btnStop) btnStop.style.display = 'none';
        if (spdEl) spdEl.textContent = 'Detenido';
        if (percFill) percFill.style.backgroundColor = '#d92d20';
    } else if (state === 'done') {
        btnToggle.style.display = 'none';
        if (btnStop) btnStop.style.display = 'none';
        if (spdEl) spdEl.textContent = 'Completado';
        if (percText) percText.textContent = '100%';
        if (percFill) {
            percFill.style.width = '100%';
            percFill.style.backgroundColor = '#107c10';
        }
    } else {
        btnToggle.innerHTML = '<i class="fa-solid fa-play" style="color: #0078d7;"></i>';
        btnToggle.title = 'Descargar este archivo';
        btnToggle.style.display = 'inline-flex';
        if (btnStop) btnStop.style.display = 'none';
    }
}

// Actualiza el progreso agregado y estado de la fila del paquete padre en Descargas
function updatePackageRowUI(pkgName) {
    if (!pkgName) return;
    const items = downloadsData.filter(d => (d.package_name || 'Descargas') === pkgName);
    if (items.length === 0) return;
    
    let totalSize = 0;
    let downloadedBytes = 0;
    let activeDownloading = 0;
    let hasPaused = false;
    let hasStopped = false;
    let allDone = true;
    
    items.forEach(it => {
        totalSize += (it.tamanio || 0);
        const downloaded = itemProgress[it.db_id] !== undefined ? itemProgress[it.db_id] : (it.downloaded_bytes || 0);
        downloadedBytes += downloaded;
        
        const st = itemStates[it.db_id] || it.state;
        if (st === 'downloading') activeDownloading++;
        if (st === 'paused') hasPaused = true;
        if (st === 'stopped') hasStopped = true;
        if (st !== 'done') allDone = false;
    });
    
    const percent = totalSize > 0 ? ((downloadedBytes / totalSize) * 100).toFixed(1) : 0;
    const pkgCompEl = document.getElementById(`pkg-comp-${encodeURIComponent(pkgName)}`);
    const pkgFillEl = document.getElementById(`pkg-perc-fill-${encodeURIComponent(pkgName)}`);
    const pkgTextEl = document.getElementById(`pkg-perc-text-${encodeURIComponent(pkgName)}`);
    const pkgSpdEl = document.getElementById(`pkg-spd-${encodeURIComponent(pkgName)}`);
    
    if (pkgCompEl) pkgCompEl.textContent = formatBytes(downloadedBytes);
    if (pkgFillEl) {
        pkgFillEl.style.width = `${percent}%`;
        pkgFillEl.style.backgroundColor = allDone ? '#107c10' : '#0078d7';
    }
    if (pkgTextEl) pkgTextEl.textContent = `${percent}%`;
    
    if (pkgSpdEl) {
        if (allDone) {
            pkgSpdEl.textContent = 'Completado';
            pkgSpdEl.style.color = '#107c10';
        } else if (activeDownloading > 0) {
            pkgSpdEl.textContent = `Descargando (${activeDownloading})`;
            pkgSpdEl.style.color = '#0078d7';
        } else if (hasPaused) {
            pkgSpdEl.textContent = 'Pausado';
            pkgSpdEl.style.color = '#d97706';
        } else if (hasStopped) {
            pkgSpdEl.textContent = 'Detenido';
            pkgSpdEl.style.color = '#d92d20';
        } else {
            pkgSpdEl.textContent = 'En cola';
            pkgSpdEl.style.color = '#666';
        }
    }
}

// ═════════════════════════════════════════════════════════════════════════
// 10. WEBSOCKET Y SINCRONIZACIÓN EN TIEMPO REAL
// ═════════════════════════════════════════════════════════════════════════

function connectWebSocket() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        return;
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    
    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'qr_update') {
                if (typeof onQrTokenReceived === 'function') onQrTokenReceived(data.token_url, data.expires);
            } else if (data.type === 'qr_success') {
                if (typeof onQrLoginSuccess === 'function') onQrLoginSuccess(data.user);
            } else if (data.type === 'qr_needs_password') {
                if (typeof onQrNeedsPassword === 'function') onQrNeedsPassword();
            } else if (data.type === 'qr_expired') {
                if (typeof onQrExpired === 'function') onQrExpired();
            } else if (data.type === 'qr_error') {
                if (typeof onQrError === 'function') onQrError(data.error);
            } else if (data.type === 'scan_progress') {
                const scanErr = document.getElementById('scanError');
                if (scanErr) {
                    scanErr.style.display = 'block';
                    scanErr.textContent = `Escaneando... (Revisados ${data.scanned} mensajes, ${data.found} archivos encontrados)`;
                    scanErr.style.backgroundColor = '#e8f0fe';
                    scanErr.style.color = '#1a73e8';
                }
            } else if (data.type === 'start') {
                const dbId = data.db_id || data.index;
                itemStates[dbId] = 'downloading';
                updateDownloadRowUI(dbId, 'downloading');
                if (data.package_name) updatePackageRowUI(data.package_name);
                updateDescargasBadges();
                
                const infoDescargasText = document.getElementById('infoDescargasText');
                if (infoDescargasText) infoDescargasText.textContent = `Descargando: ${data.filename}`;
            } else if (data.type === 'progress') {
                const dbId = data.db_id || data.index;
                itemProgress[dbId] = data.downloaded;
                const percent = data.total_size > 0 ? ((data.downloaded / data.total_size) * 100).toFixed(1) : 0;
                
                const compEl = document.getElementById(`comp-dl-${dbId}`);
                const percFill = document.getElementById(`perc-fill-dl-${dbId}`);
                const percText = document.getElementById(`perc-text-dl-${dbId}`);
                const spdEl = document.getElementById(`spd-dl-${dbId}`);

                if (compEl) compEl.textContent = formatBytes(data.downloaded);
                if (percFill) percFill.style.width = `${percent}%`;
                if (percText) percText.textContent = `${percent}%`;
                
                const statusSpeed = document.getElementById('statusSpeed');
                if (data.state === 'paused') {
                    if (spdEl) spdEl.textContent = 'Pausado';
                    itemStates[dbId] = 'paused';
                    updateDownloadRowUI(dbId, 'paused');
                } else {
                    if (spdEl) spdEl.textContent = `${data.speed_mbps} MB/s`;
                    if (statusSpeed) statusSpeed.textContent = `D: ${data.speed_mbps} MB/s`;
                    itemStates[dbId] = 'downloading';
                    updateDownloadRowUI(dbId, 'downloading');
                }
                
                if (data.package_name) {
                    updatePackageRowUI(data.package_name);
                }
            } else if (data.type === 'status_change') {
                const dbId = data.db_id || data.index;
                itemStates[dbId] = data.state;
                if (data.file_path) itemFilePaths[dbId] = data.file_path;
                updateDownloadRowUI(dbId, data.state);
                if (data.package_name) updatePackageRowUI(data.package_name);
                updateDescargasBadges();
            } else if (data.type === 'done') {
                const dbId = data.db_id || data.index;
                itemStates[dbId] = 'done';
                if (data.file_path) itemFilePaths[dbId] = data.file_path;
                
                const percFill = document.getElementById(`perc-fill-dl-${dbId}`);
                const percText = document.getElementById(`perc-text-dl-${dbId}`);
                const spdEl = document.getElementById(`spd-dl-${dbId}`);
                if (percFill) {
                    percFill.style.width = '100%';
                    percFill.style.backgroundColor = '#107c10';
                }
                if (percText) percText.textContent = '100%';
                if (spdEl) spdEl.textContent = 'Completado';
                
                updateDownloadRowUI(dbId, 'done');
                if (data.package_name) updatePackageRowUI(data.package_name);
                updateDescargasBadges();
            } else if (data.type === 'history_update' || data.type === 'downloads_update') {
                loadDownloadsData();
            } else if (data.type === 'finish_all') {
                const infoDescargasText = document.getElementById('infoDescargasText');
                if (infoDescargasText) infoDescargasText.textContent = "Todas las descargas han finalizado.";
                const statusSpeed = document.getElementById('statusSpeed');
                if (statusSpeed) statusSpeed.textContent = 'D: 0 MB/s';
                updateDescargasBadges();
                loadDownloadsData();
            } else if (data.type === 'toast') {
                showToast(data.message, data.toast_type || 'info', data.duration || 9000, data.title || '');
            }
        } catch (err) {
            console.error("Error procesando mensaje WebSocket:", err);
        }
    };
    
    ws.onclose = () => {
        // Reintentar conexión silenciosamente si la app sigue activa
        setTimeout(() => {
            if (currentMainTab === 'descargas') connectWebSocket();
        }, 5000);
    };
}

// ═════════════════════════════════════════════════════════════════════════
// 11. INICIALIZACIÓN DE LA APLICACIÓN
// ═════════════════════════════════════════════════════════════════════════

checkStatus();

// ═════════════════════════════════════════════════════════════════════════
// 12. SISTEMA DE AUTO-DESCARGAS
// ═════════════════════════════════════════════════════════════════════════

async function loadAutoChannels() {
    try {
        const res = await fetch(`${API_BASE}/autochannels`);
        const data = await res.json();
        if (data.status === 'ok') {
            renderAutoChannels(data.channels || []);
        }
    } catch (e) {
        console.error("Error al cargar autochannels", e);
    }
}

// Helper para resumir texto de formatos en tabla de canales
function getChannelFormatsSummary(fileTypesStr) {
    if (!fileTypesStr || fileTypesStr === 'all') {
        return { text: 'Todos los archivos', title: 'Aceptando cualquier tipo de archivo (sin filtro)', isAll: true };
    }
    if (fileTypesStr === 'videos') return { text: 'Solo Videos', title: 'Videos (.mp4, .mkv, .avi...)', isAll: false };
    if (fileTypesStr === 'photos') return { text: 'Solo Fotos', title: 'Fotos e imágenes (.jpg, .png...)', isAll: false };
    if (fileTypesStr === 'media') return { text: 'Videos y Fotos', title: 'Videos y Fotos', isAll: false };
    if (fileTypesStr === 'audio') return { text: 'Solo Audio', title: 'Audio y música (.mp3, .flac...)', isAll: false };
    if (fileTypesStr === 'archives') return { text: 'Comprimidos', title: 'Comprimidos (.zip, .rar, .7z...)', isAll: false };
    if (fileTypesStr === 'docs') return { text: 'Documentos', title: 'Documentos (.pdf, .epub...)', isAll: false };

    const raw = fileTypesStr.startsWith('custom:') ? fileTypesStr.replace('custom:', '') : fileTypesStr;
    const parts = raw.split(',').map(p => p.trim()).filter(Boolean);
    if (parts.length === 0) {
        return { text: 'Todos los archivos', title: 'Todos los archivos (sin filtro)', isAll: true };
    }
    if (parts.length <= 3) {
        return { text: parts.join(', '), title: parts.join(', '), isAll: false };
    }
    return { text: `${parts.slice(0, 3).join(', ')} (+${parts.length - 3})`, title: parts.join(', '), isAll: false };
}

function getChannelSubfolderSummary(mode) {
    if (mode === 'channel_model') {
        return { text: 'Canal / Modelo', title: 'Descargas en: Carpeta/NombreCanal/NombreModelo/archivo.ext', icon: 'fa-folder-tree', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' };
    }
    if (mode === 'channel_only') {
        return { text: 'Solo Canal', title: 'Descargas en: Carpeta/NombreCanal/archivo.ext', icon: 'fa-folder', color: '#0284c7', bg: '#e0f2fe', border: '#bae6fd' };
    }
    if (mode === 'flat') {
        return { text: 'Plana (Directa)', title: 'Descargas guardadas directamente en la carpeta destino sin subcarpetas', icon: 'fa-file', color: '#475569', bg: '#f1f5f9', border: '#cbd5e1' };
    }
    // Default: channel_date
    return { text: 'Canal / Fecha', title: 'Descargas en: Carpeta/NombreCanal/DD-MM-YYYY/archivo.ext', icon: 'fa-calendar-days', color: '#4338ca', bg: '#eef2ff', border: '#c7d2fe' };
}

window.changeAutoChannelSubfolderMode = async function(channelId, currentMode) {
    const nextModes = {
        'channel_model': 'channel_date',
        'channel_date': 'channel_only',
        'channel_only': 'flat',
        'flat': 'channel_model'
    };
    const nextMode = nextModes[currentMode] || 'channel_model';
    try {
        const res = await fetch(`${API_BASE}/autochannels/update_subfolder_mode`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: channelId, subfolder_mode: nextMode })
        });
        const data = await res.json();
        if (data.status === 'ok') {
            await loadAutoChannels();
        }
    } catch (e) {
        showToast("Error al actualizar modo de organización: " + e.message, "error");
    }
};

function renderAutoChannels(channels) {
    const tbody = document.getElementById('bodyAutoChannels');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (channels.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state-cell">
                    <i class="fa-solid fa-robot empty-icon"></i>
                    <div>No hay canales monitorizados.</div>
                    <div class="empty-subtitle">Agrega un canal arriba para descargar automáticamente los nuevos archivos.</div>
                </td>
            </tr>
        `;
        return;
    }

    channels.forEach(ch => {
        const tr = document.createElement('tr');
        
        const stateColor = ch.active ? '#107c10' : '#8e8e8e';
        const fmtInfo = getChannelFormatsSummary(ch.file_types);
        const badgeColor = fmtInfo.isAll ? '#0284c7' : '#059669';
        const badgeBg = fmtInfo.isAll ? '#e0f2fe' : '#ecfdf5';
        const badgeBorder = fmtInfo.isAll ? '#bae6fd' : '#a7f3d0';
        const subInfo = getChannelSubfolderSummary(ch.subfolder_mode || 'channel_model');

        tr.innerHTML = `
            <td style="font-weight: 500;">
                <i class="fa-solid fa-satellite-dish" style="color: ${stateColor}; margin-right: 6px;"></i> 
                ${ch.channel_name || ch.channel_url}
            </td>
            <td style="color: #666; font-size: 11px;">
                <span title="${ch.custom_dir || 'Global (carpeta por defecto)'}">
                    <i class="fa-regular fa-folder" style="color: #eab308;"></i> ${ch.custom_dir || 'Global'}
                </span>
                <button type="button" class="action-icon" onclick="changeAutoChannelDir(${ch.id}, '${encodeURIComponent(ch.custom_dir || '')}')" title="Cambiar carpeta de destino" style="margin-left: 6px; font-size: 11px; color: #0284c7;">
                    <i class="fa-solid fa-pen-to-square"></i>
                </button>
            </td>
            <td style="font-size: 11px;">
                <span title="${subInfo.title}" style="display: inline-flex; align-items: center; gap: 4px; color: ${subInfo.color}; font-weight: 600; background: ${subInfo.bg}; border: 1px solid ${subInfo.border}; padding: 2px 6px; border-radius: 4px;">
                    <i class="fa-solid ${subInfo.icon}"></i> ${subInfo.text}
                </span>
                <button type="button" class="action-icon" onclick="changeAutoChannelSubfolderMode(${ch.id}, '${ch.subfolder_mode || 'channel_model'}')" title="Cambiar modo de organización (clic para alternar)" style="margin-left: 6px; font-size: 11px; color: #4338ca;">
                    <i class="fa-solid fa-arrows-rotate"></i>
                </button>
            </td>
            <td style="font-size: 11px;">
                <span title="${fmtInfo.title}" style="display: inline-block; max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: middle; color: ${badgeColor}; font-weight: 600; background: ${badgeBg}; border: 1px solid ${badgeBorder}; padding: 2px 6px; border-radius: 4px;">
                    ${fmtInfo.text}
                </span>
                <button type="button" class="action-icon" onclick="editAutoChannelFormats(${ch.id}, '${encodeURIComponent(ch.file_types || 'all')}')" title="Editar formatos soportados para este canal" style="margin-left: 6px; font-size: 11px; color: #0284c7;">
                    <i class="fa-solid fa-pen-to-square"></i>
                </button>
            </td>
            <td style="color: #666; font-size: 11px;">${ch.created_at.substring(0, 10)}</td>
            <td style="text-align: center;">
                <label class="switch" style="transform: scale(0.8);">
                    <input type="checkbox" onchange="toggleAutoChannel(${ch.id}, this.checked)" ${ch.active ? 'checked' : ''}>
                    <span class="slider round"></span>
                </label>
            </td>
            <td style="text-align: center; white-space: nowrap;">
                <button class="action-icon" onclick="syncAutoChannel(${ch.id})" title="Sincronizar y buscar nuevos archivos ahora" style="color: #24a1de; margin-right: 4px;">
                    <i class="fa-solid fa-rotate"></i>
                </button>
                <button class="action-icon action-delete" onclick="deleteAutoChannel(${ch.id})" title="Eliminar">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Estado de formatos para el nuevo canal a añadir
let newChannelAcceptAllFormats = true;
let newChannelActiveFormats = [...DEFAULT_ACTIVE_FORMATS];

function updateAutoChannelFormatsSummaryUI() {
    const summaryEl = document.getElementById('autoChannelFormatsSummary');
    if (!summaryEl) return;
    
    if (newChannelAcceptAllFormats) {
        summaryEl.textContent = 'Todos los archivos';
        summaryEl.title = 'Aceptando cualquier tipo de archivo (sin filtro)';
        summaryEl.style.color = '#0078d4';
        return;
    }
    
    if (!newChannelActiveFormats || newChannelActiveFormats.length === 0) {
        summaryEl.textContent = 'Ninguno seleccionado (0)';
        summaryEl.title = 'Haz clic en Editar para agregar extensiones permitidas';
        summaryEl.style.color = '#d92d20';
        return;
    }
    
    summaryEl.style.color = '#059669';
    const displayList = newChannelActiveFormats.map(ext => ext.toLowerCase());
    if (displayList.length <= 4) {
        summaryEl.textContent = displayList.join(', ');
    } else {
        const firstFour = displayList.slice(0, 4).join(', ');
        summaryEl.textContent = `${firstFour} (+${displayList.length - 4} más)`;
    }
    summaryEl.title = `Formatos permitidos (${displayList.length}): ${displayList.join(', ')}`;
}

// Botón editar formatos del nuevo canal (barra superior)
const btnEditAutoChannelFormats = document.getElementById('btnEditAutoChannelFormats');
if (btnEditAutoChannelFormats) {
    btnEditAutoChannelFormats.addEventListener('click', () => {
        openFormatsModal(
            newChannelAcceptAllFormats,
            newChannelActiveFormats,
            ({ acceptAll, formats }) => {
                newChannelAcceptAllFormats = acceptAll;
                newChannelActiveFormats = formats;
                updateAutoChannelFormatsSummaryUI();
            }
        );
    });
}

async function addAutoChannel() {
    const input = document.getElementById('autoChannelLink');
    const dirInput = document.getElementById('autoChannelDir');
    const chkExisting = document.getElementById('autoChannelDownloadExisting');
    const url = input.value.trim();
    if (!url) {
        showToast("Debes ingresar un enlace válido.", "error");
        return;
    }
    
    let fileTypesStr = "all";
    if (!newChannelAcceptAllFormats) {
        fileTypesStr = (newChannelActiveFormats && newChannelActiveFormats.length > 0)
            ? newChannelActiveFormats.join(', ')
            : "all";
    }

    const btn = document.getElementById('btnAddAutoChannel');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verificando...';
    }
    
    try {
        const downloadExisting = chkExisting ? chkExisting.checked : true;
        const subfolderSelect = document.getElementById('autoChannelSubfolderMode');
        const subfolderMode = subfolderSelect ? subfolderSelect.value : 'channel_model';

        const res = await fetch(`${API_BASE}/autochannels/add`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                url: url,
                custom_dir: dirInput.value.trim(),
                download_existing: downloadExisting,
                file_types: fileTypesStr,
                subfolder_mode: subfolderMode
            })
        });
        const data = await res.json();
        
        if (data.status === 'ok') {
            input.value = '';
            dirInput.value = '';
            if (subfolderSelect) subfolderSelect.value = 'channel_model';
            newChannelAcceptAllFormats = true;
            newChannelActiveFormats = [...DEFAULT_ACTIVE_FORMATS];
            updateAutoChannelFormatsSummaryUI();

            const msg = (data.enqueued && data.enqueued > 0)
                ? `Canal añadido correctamente. Se encolaron ${data.enqueued} archivo(s) existentes.`
                : "Canal añadido correctamente a la lista de monitoreo.";
            showToast(msg, "success");
            loadAutoChannels();
            loadDownloadsData();
        } else {
            showToast(`Error: ${data.message}`, "error");
        }
    } catch (e) {
        showToast("Error de red al añadir canal.", "error");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-plus"></i> Añadir Canal';
        }
    }
}

async function syncAutoChannel(id) {
    showToast("Sincronizando canal...", "info");
    try {
        const res = await fetch(`${API_BASE}/autochannels/sync`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ id })
        });
        const data = await res.json();
        if (data.status === 'ok') {
            if (data.enqueued && data.enqueued > 0) {
                showToast(`Sincronización completa: ${data.enqueued} archivo(s) nuevo(s) encolados.`, "success");
            } else {
                showToast("El canal ya está al día. No hay archivos nuevos pendientes con el filtro actual.", "info");
            }
            loadDownloadsData();
        } else {
            showToast(`Error al sincronizar: ${data.message}`, "error");
        }
    } catch (e) {
        showToast("Error de red al sincronizar canal.", "error");
    }
}

async function toggleAutoChannel(id, active) {
    await fetch(`${API_BASE}/autochannels/toggle`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ id, active: active ? 1 : 0 })
    });
    loadAutoChannels();
}

async function deleteAutoChannel(id) {
    if (!confirm("¿Seguro que quieres eliminar este canal de la lista de monitorización?")) return;
    await fetch(`${API_BASE}/autochannels/delete`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ id })
    });
    loadAutoChannels();
}

// Cambiar carpeta de destino de un canal existente
function changeAutoChannelDir(id, currentDirEncoded) {
    const currentDir = decodeURIComponent(currentDirEncoded || '');
    const startPath = currentDir || (customDirInput ? customDirInput.value.trim() : '');
    openFolderPicker(startPath, async (selectedPath) => {
        try {
            const res = await fetch(`${API_BASE}/autochannels/update_dir`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ id, custom_dir: selectedPath })
            });
            const data = await res.json();
            if (data.status === 'ok') {
                showToast("Carpeta de destino actualizada correctamente.", "success");
                loadAutoChannels();
            } else {
                showToast(`Error al actualizar carpeta: ${data.message}`, "error");
            }
        } catch (e) {
            showToast("Error de red al actualizar carpeta.", "error");
        }
    });
}

// Editar formatos soportados de un canal existente usando el modal de formatos
function editAutoChannelFormats(id, currentTypesEncoded) {
    const raw = decodeURIComponent(currentTypesEncoded || 'all');
    let initAcceptAll = false;
    let initFormats = [];

    if (!raw || raw === 'all') {
        initAcceptAll = true;
        initFormats = [...DEFAULT_ACTIVE_FORMATS];
    } else {
        const clean = raw.startsWith('custom:') ? raw.replace('custom:', '') : raw;
        initFormats = clean.split(',').map(p => p.trim()).filter(Boolean);
        initAcceptAll = false;
    }

    openFormatsModal(
        initAcceptAll,
        initFormats,
        async ({ acceptAll, formats }) => {
            const finalStr = acceptAll ? 'all' : (formats.length > 0 ? formats.join(', ') : 'all');
            try {
                const res = await fetch(`${API_BASE}/autochannels/update_types`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ id, file_types: finalStr })
                });
                const data = await res.json();
                if (data.status === 'ok') {
                    showToast("Formatos actualizados correctamente para el canal.", "success");
                    loadAutoChannels();
                } else {
                    showToast(`Error: ${data.message || 'No se pudo actualizar'}`, "error");
                }
            } catch (e) {
                showToast("Error de red al actualizar formatos.", "error");
            }
        }
    );
}

// Botón añadir canal
const btnAddAutoChannel = document.getElementById('btnAddAutoChannel');
if (btnAddAutoChannel) {
    btnAddAutoChannel.addEventListener('click', addAutoChannel);
}

// Selector de carpeta para el input de añadir AutoChannel
const btnSelectAutoDir = document.getElementById('btnSelectAutoDir');
if (btnSelectAutoDir) {
    btnSelectAutoDir.addEventListener('click', () => {
        const autoInput = document.getElementById('autoChannelDir');
        const startPath = (autoInput && autoInput.value.trim()) || (customDirInput ? customDirInput.value.trim() : '');
        openFolderPicker(startPath, (selectedPath) => {
            if (autoInput) {
                autoInput.value = selectedPath;
            }
        });
    });
}

// Inicializar texto de formatos para auto-canal
updateAutoChannelFormatsSummaryUI();



