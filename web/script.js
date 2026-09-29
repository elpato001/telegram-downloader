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


function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}


function showReplacePrompt({ title, message, files = [], allowSkip = true }) {
    return new Promise((resolve) => {
        const modal = document.getElementById('replaceModal');
        const titleEl = document.getElementById('replaceModalTitle');
        const msgEl = document.getElementById('replaceModalMessage');
        const listContainer = document.getElementById('replaceModalListContainer');
        const fileList = document.getElementById('replaceModalFileList');
        const btnCancel = document.getElementById('btnReplaceCancel');
        const btnSkip = document.getElementById('btnReplaceSkip');
        const btnOverwrite = document.getElementById('btnReplaceOverwrite');
        const btnClose = document.getElementById('btnReplaceClose');

        if (!modal) {
            resolve('cancel');
            return;
        }

        if (titleEl) titleEl.textContent = title || 'Archivos ya descargados';
        if (msgEl) msgEl.innerHTML = message || '';

        if (fileList && files && files.length > 0) {
            fileList.innerHTML = files.slice(0, 80).map(f => {
                const name = typeof f === 'string' ? f : (f.filename || 'Archivo');
                const sz = (typeof f === 'object' && f.total_size) ? ` <span style="color: #94a3b8; font-size: 11px;">(${formatBytes(f.total_size)})</span>` : '';
                return `<li style="margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"><i class="fa-solid fa-file-circle-check" style="color: #10b981; margin-right: 5px;"></i><strong>${escapeHtml(name)}</strong>${sz}</li>`;
            }).join('') + (files.length > 80 ? `<li style="color: #94a3b8; font-style: italic; list-style: none; margin-top: 4px;">... y ${files.length - 80} archivo(s) más.</li>` : '');
            if (listContainer) listContainer.style.display = 'block';
        } else if (listContainer) {
            listContainer.style.display = 'none';
        }

        if (btnSkip) {
            btnSkip.style.display = allowSkip ? 'inline-flex' : 'none';
        }

        const cleanup = (choice) => {
            modal.style.display = 'none';
            if (btnCancel) btnCancel.onclick = null;
            if (btnSkip) btnSkip.onclick = null;
            if (btnOverwrite) btnOverwrite.onclick = null;
            if (btnClose) btnClose.onclick = null;
            resolve(choice);
        };

        if (btnCancel) btnCancel.onclick = () => cleanup('cancel');
        if (btnClose) btnClose.onclick = () => cleanup('cancel');
        if (btnSkip) btnSkip.onclick = () => cleanup('skip');
        if (btnOverwrite) btnOverwrite.onclick = () => cleanup('overwrite');

        modal.style.display = 'flex';
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
let expandedDescargasChannels = new Set();
let expandedGrabberChannels = new Set();
let descargasPkgLimits = {};
let grabberPkgLimits = {};
let selectedDownloads = new Set();
let selectedGrabberItems = new Set();
let selectedGrabberPackages = new Set();
let itemStates = {};
let itemFilePaths = {};
let itemSpeeds = {};
let itemProgress = {};

// Generadores de guías jerárquicas del árbol en cascada (alineadas exactamente debajo de la carpeta)
function getPackageBranchGuideHtml(isLastPkg) {
    return `<div class="tree-pkg-guide-wrap" style="position:relative;width:46px;height:28px;display:inline-flex;align-items:center;vertical-align:middle;flex-shrink:0;">
        <span style="position:absolute;left:30px;top:0;height:50%;width:1px;background:#94a3b8;"></span>
        ${!isLastPkg ? '<span style="position:absolute;left:30px;top:50%;bottom:0;width:1px;background:#94a3b8;"></span>' : ''}
        <span style="position:absolute;left:30px;top:50%;width:16px;height:1px;background:#94a3b8;transform:translateY(-50%);"></span>
    </div>`;
}

function getFileBranchGuideHtml(isLastPkg, isLastItem) {
    return `<div class="tree-file-guide-wrap" style="position:relative;width:110px;height:28px;display:inline-flex;align-items:center;vertical-align:middle;flex-shrink:0;">
        ${!isLastPkg ? '<span style="position:absolute;left:30px;top:0;bottom:0;width:1px;background:#94a3b8;"></span>' : ''}
        <span style="position:absolute;left:95px;top:0;height:50%;width:1px;background:#94a3b8;"></span>
        ${!isLastItem ? '<span style="position:absolute;left:95px;top:50%;bottom:0;width:1px;background:#94a3b8;"></span>' : ''}
        <span style="position:absolute;left:95px;top:50%;width:15px;height:1px;background:#94a3b8;transform:translateY(-50%);"></span>
    </div>`;
}

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
            });
            updateDescargasBadges();
            renderDescargasTable();
            connectWebSocket();
        }
    } catch (e) {
        console.error("Error al cargar historial de descargas:", e);
    }
}

let _descargasBadgesTimer = null;
function updateDescargasBadges() {
    if (_descargasBadgesTimer) return;
    _descargasBadgesTimer = setTimeout(() => {
        _descargasBadgesTimer = null;
        _doUpdateDescargasBadges();
    }, 300);
}

function _doUpdateDescargasBadges() {
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
            updateGrabberBadges();
            renderGrabberTable();
            
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
    
    // Agrupar paquetes por Canal de Telegram
    const channelMap = new Map();
    grabberPackages.forEach(pkg => {
        const pkgNameLower = (pkg.name || '').toLowerCase();
        const pkgChan = (pkg.channel_name || '').trim() || 'Canal Telegram';
        const pkgChanLower = pkgChan.toLowerCase();
        const pkgMatches = !searchTerm || pkgNameLower.includes(searchTerm) || pkgChanLower.includes(searchTerm);

        const filteredItems = (pkg.items || []).filter(item => {
            if (!isFormatAllowed(item.filename)) return false;
            if (searchTerm && !pkgMatches && !item.filename.toLowerCase().includes(searchTerm)) return false;
            return true;
        });

        if (searchTerm && !pkgMatches && filteredItems.length === 0) return;

        if (!channelMap.has(pkgChan)) {
            channelMap.set(pkgChan, { channelName: pkgChan, packages: [] });
        }
        channelMap.get(pkgChan).packages.push({ pkg, filteredItems });
    });

    if (channelMap.size === 0) {
        bodyGrabber.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #6b7280; padding: 25px;">No se encontraron paquetes que coincidan con la búsqueda.</td></tr>`;
        updateGrabberSelection();
        return;
    }

    // Si hay búsqueda activa, expandir automáticamente canales y paquetes que coincidan
    if (searchTerm) {
        channelMap.forEach(({ channelName, packages }) => {
            expandedGrabberChannels.add(channelName);
            packages.forEach(({ pkg }) => expandedGrabber.add(pkg.id));
        });
    }

    channelMap.forEach(({ channelName, packages }) => {
        // Calcular estadísticas agregadas del canal
        const allChanItems = [];
        packages.forEach(({ filteredItems }) => {
            filteredItems.forEach(it => allChanItems.push(it));
        });
        const chanTotalSize = allChanItems.reduce((acc, it) => acc + (it.total_size || 0), 0);
        const allChanChecked = allChanItems.length > 0 && allChanItems.every(it => selectedGrabberItems.has(it.id));
        const someChanChecked = allChanItems.some(it => selectedGrabberItems.has(it.id));
        const isChanExpanded = expandedGrabberChannels.has(channelName);
        const latestDate = allChanItems.find(it => it.fecha)?.fecha || '';
        const channelDest = packages[0]?.pkg.custom_dir || '';

        // 1. FILA DE CANAL (NIVEL 1 - RAÍZ)
        const trChan = document.createElement('tr');
        trChan.className = 'channel-row';
        trChan.dataset.channelName = channelName;

        trChan.innerHTML = `
            <td style="text-align: center;">
                <input type="checkbox" class="chan-check-grabber" data-channel-name="${channelName}" ${allChanChecked ? 'checked' : ''}>
            </td>
            <td>
                <button type="button" class="tree-toggle-btn" data-channel-name="${channelName}" title="${isChanExpanded ? 'Contraer canal' : 'Expandir canal'}">
                    ${isChanExpanded ? '−' : '+'}
                </button>
                <i class="fa-solid ${isChanExpanded ? 'fa-folder-open' : 'fa-folder'} folder-icon"></i>
                <span class="channel-badge-pill" title="Canal de Telegram: ${channelName}">
                    <i class="fa-brands fa-telegram"></i> ${channelName}
                </span>
                <span class="package-badge-count">(${packages.length} paquetes, ${allChanItems.length} archivos)</span>
            </td>
            <td><strong>${formatBytes(chanTotalSize)}</strong></td>
            <td style="font-size: 11px; color: #555;">${latestDate ? formatFecha(latestDate) : '-'}</td>
            <td style="font-size: 11px; color: #555; overflow: hidden; text-overflow: ellipsis;" title="${channelDest || 'Ruta por defecto'}">
                <i class="fa-regular fa-folder" style="color: #888; margin-right: 4px;"></i>
                <span style="color:#0369a1; font-weight: 500;">${channelDest || 'Ruta por defecto'}</span>
            </td>
            <td style="text-align: center;">
                <div style="display: inline-flex; gap: 4px; align-items: center; justify-content: center;">
                    <button type="button" class="row-action-btn start-download-btn" onclick="handleDownloadGrabberChannel(event, '${channelName.replace(/'/g, "\\'")}')" title="Descargar todo este canal" style="padding: 3px 8px; font-size: 11px;">
                        <i class="fa-solid fa-download"></i> Descargar
                    </button>
                    <button type="button" class="row-action-btn btn-danger" onclick="handleDeleteGrabberChannel(event, '${channelName.replace(/'/g, "\\'")}')" title="Eliminar este canal y sus paquetes">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </td>
        `;

        const chanCb = trChan.querySelector('.chan-check-grabber');
        if (someChanChecked && !allChanChecked) {
            chanCb.indeterminate = true;
        }
        chanCb.addEventListener('click', (e) => {
            e.stopPropagation();
            const checked = chanCb.checked;
            allChanItems.forEach(it => {
                if (checked) selectedGrabberItems.add(it.id);
                else selectedGrabberItems.delete(it.id);
            });
            renderGrabberTable();
        });

        const toggleChanBtn = trChan.querySelector('.tree-toggle-btn');
        const handleChanToggle = (e) => {
            e.stopPropagation();
            if (expandedGrabberChannels.has(channelName)) {
                expandedGrabberChannels.delete(channelName);
            } else {
                expandedGrabberChannels.add(channelName);
            }
            renderGrabberTable();
        };
        toggleChanBtn.addEventListener('click', handleChanToggle);
        trChan.addEventListener('click', (e) => {
            if (e.target.closest('.row-action-btn') || e.target.type === 'checkbox') return;
            handleChanToggle(e);
        });

        bodyGrabber.appendChild(trChan);

        // 2. FILAS DE PAQUETES (NIVEL 2 - EN CASCADA BAJO EL CANAL)
        if (isChanExpanded) {
            packages.forEach(({ pkg, filteredItems }, pkgIdx) => {
                const isLastPkg = (pkgIdx === packages.length - 1);
                const isPkgExpanded = expandedGrabber.has(pkg.id);
                const pkgSize = filteredItems.reduce((acc, it) => acc + (it.total_size || 0), 0);
                const allPkgChecked = filteredItems.length > 0 && filteredItems.every(it => selectedGrabberItems.has(it.id));
                const somePkgChecked = filteredItems.some(it => selectedGrabberItems.has(it.id));

                const trPkg = document.createElement('tr');
                trPkg.className = 'package-row';
                trPkg.dataset.pkgId = pkg.id;

                trPkg.innerHTML = `
                    <td style="text-align: center;"></td>
                    <td>
                        ${getPackageBranchGuideHtml(isLastPkg)}
                        <input type="checkbox" class="pkg-check-grabber tree-item-checkbox" data-pkg-id="${pkg.id}" style="margin: 0 6px 0 0;" ${allPkgChecked ? 'checked' : ''}>
                        <button type="button" class="tree-toggle-btn" data-pkg-id="${pkg.id}" title="${isPkgExpanded ? 'Contraer carpeta' : 'Expandir carpeta'}">
                            ${isPkgExpanded ? '−' : '+'}
                        </button>
                        <i class="fa-solid ${isPkgExpanded ? 'fa-folder-open' : 'fa-folder'} folder-icon"></i>
                        <span class="package-name-text" title="Carpeta contenedora: ${pkg.name}">${pkg.name}</span>
                        <span class="package-badge-count">(${filteredItems.length} archivos)</span>
                        <button type="button" class="row-action-btn" onclick="handleRenameGrabberPackage(event, ${pkg.id}, '${(pkg.name || '').replace(/'/g, "\\'")}')" title="Renombrar carpeta contenedora" style="padding: 2px 5px; font-size: 10px; margin-left: 4px; opacity: 0.7;">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                    </td>
                    <td><strong>${formatBytes(pkgSize)}</strong></td>
                    <td style="font-size: 11px; color: #555;">${filteredItems.length > 0 && filteredItems[0].fecha ? formatFecha(filteredItems[0].fecha) : '-'}</td>
                    <td style="font-size: 11px; color: #555; overflow: hidden; text-overflow: ellipsis;" title="${(pkg.custom_dir || 'Ruta por defecto') + ' \\ ' + pkg.name}">
                        <i class="fa-regular fa-folder" style="color: #888; margin-right: 4px;"></i>
                        <strong>${pkg.name}</strong>
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

                const pkgCb = trPkg.querySelector('.pkg-check-grabber');
                if (somePkgChecked && !allPkgChecked) {
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

                const togglePkgBtn = trPkg.querySelector('.tree-toggle-btn');
                const handlePkgToggle = (e) => {
                    e.stopPropagation();
                    if (expandedGrabber.has(pkg.id)) {
                        expandedGrabber.delete(pkg.id);
                    } else {
                        expandedGrabber.add(pkg.id);
                    }
                    renderGrabberTable();
                };
                togglePkgBtn.addEventListener('click', handlePkgToggle);
                trPkg.addEventListener('click', (e) => {
                    if (e.target.closest('.row-action-btn') || e.target.type === 'checkbox') return;
                    handlePkgToggle(e);
                });

                bodyGrabber.appendChild(trPkg);

                // 3. FILAS DE ARCHIVOS (NIVEL 3 - EN CASCADA BAJO EL PAQUETE)
                if (isPkgExpanded) {
                    const maxVisible = grabberPkgLimits[pkg.id] || 50;
                    const visibleItems = filteredItems.slice(0, maxVisible);

                    visibleItems.forEach((item, itemIdx) => {
                        const isLastItem = (itemIdx === filteredItems.length - 1);
                        const isSelected = selectedGrabberItems.has(item.id);
                        const trItem = document.createElement('tr');
                        trItem.className = `child-file-row ${isSelected ? 'selected' : ''}`;
                        trItem.dataset.itemId = item.id;

                        trItem.innerHTML = `
                            <td style="text-align: center;"></td>
                            <td>
                                <div style="display:inline-flex;align-items:center;position:relative;height:28px;vertical-align:middle;">
                                    ${getFileBranchGuideHtml(isLastPkg, isLastItem)}
                                    <input type="checkbox" class="item-check-grabber tree-item-checkbox" data-item-id="${item.id}" style="margin: 0 6px 0 0;" ${isSelected ? 'checked' : ''}>
                                    <i class="${getFileIconClass(item.filename)} file-type-icon" style="margin-right: 6px;"></i>
                                    <span title="${item.filename}">${item.filename}</span>
                                </div>
                            </td>
                            <td>${item.tamanio_fmt || formatBytes(item.total_size)}</td>
                            <td style="font-size: 11px;">${item.fecha ? formatFecha(item.fecha) : '-'}</td>
                            <td style="font-size: 11px; color: #777;">
                                <i class="fa-solid fa-arrow-turn-up fa-rotate-90" style="color: #cbd5e1; margin-right: 4px;"></i>
                                <span>En: <strong>${pkg.name}</strong></span>
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

                    if (filteredItems.length > visibleItems.length) {
                        const trMore = document.createElement('tr');
                        trMore.className = 'child-file-row show-more-row';
                        trMore.innerHTML = `
                            <td style="text-align: center;"></td>
                            <td colspan="5" style="padding: 9px 16px; background: #f0f7ff; color: #0284c7; font-size: 12px; border-top: 1px dashed #bae6fd;">
                                <div style="display:inline-flex;align-items:center;">
                                    ${getFileBranchGuideHtml(isLastPkg, true)}
                                    <i class="fa-solid fa-layer-group" style="margin-right: 6px;"></i>
                                    <span>Mostrando <strong>${visibleItems.length}</strong> de <strong>${filteredItems.length}</strong> archivos en este paquete.</span>
                                    <button type="button" class="btn-more-grabber" style="margin-left: 10px; padding: 3px 10px; font-size: 11px; cursor: pointer; border-radius: 4px; border: 1px solid #0284c7; background: #fff; color: #0284c7; font-weight: 600;">
                                        <i class="fa-solid fa-plus"></i> Mostrar más (+50)
                                    </button>
                                    <button type="button" class="btn-all-grabber" style="margin-left: 6px; padding: 3px 10px; font-size: 11px; cursor: pointer; border-radius: 4px; border: 1px solid #64748b; background: #fff; color: #475569; font-weight: 600;">
                                        Mostrar todos
                                    </button>
                                </div>
                            </td>
                        `;
                        const btnMore = trMore.querySelector('.btn-more-grabber');
                        btnMore.addEventListener('click', (e) => {
                            e.stopPropagation();
                            grabberPkgLimits[pkg.id] = (grabberPkgLimits[pkg.id] || 50) + 50;
                            renderGrabberTable();
                        });
                        const btnAll = trMore.querySelector('.btn-all-grabber');
                        btnAll.addEventListener('click', (e) => {
                            e.stopPropagation();
                            grabberPkgLimits[pkg.id] = filteredItems.length;
                            renderGrabberTable();
                        });
                        bodyGrabber.appendChild(trMore);
                    }
                }
            });
        }
    });

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
        const allChanNames = new Set(grabberPackages.map(p => (p.channel_name || '').trim() || 'Canal Telegram'));
        const allPkgIds = grabberPackages.map(p => p.id);
        const isAllOpen = expandedGrabberChannels.size >= allChanNames.size && expandedGrabber.size >= allPkgIds.length;

        if (isAllOpen && grabberPackages.length > 0) {
            expandedGrabberChannels.clear();
            expandedGrabber.clear();
            txtExpandGrabber.textContent = "Expandir Todo";
        } else {
            allChanNames.forEach(c => expandedGrabberChannels.add(c));
            allPkgIds.forEach(id => expandedGrabber.add(id));
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
    
    // Agrupar descargas por Canal y luego por Paquete
    const channelMap = new Map();
    downloadsData.forEach(dl => {
        const dlNameLower = (dl.nombre || '').toLowerCase();
        const pkgName = dl.package_name || 'Descargas';
        const pkgNameLower = pkgName.toLowerCase();
        const chanName = (dl.channel_name || '').trim() || 'Descargas Directas';
        const chanNameLower = chanName.toLowerCase();

        if (searchTerm && !dlNameLower.includes(searchTerm) && !pkgNameLower.includes(searchTerm) && !chanNameLower.includes(searchTerm)) {
            return;
        }

        if (!channelMap.has(chanName)) {
            channelMap.set(chanName, { channelName: chanName, packages: new Map() });
        }
        const pkgs = channelMap.get(chanName).packages;
        if (!pkgs.has(pkgName)) {
            pkgs.set(pkgName, []);
        }
        pkgs.get(pkgName).push(dl);
    });

    if (channelMap.size === 0) {
        bodyDescargas.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #6b7280; padding: 25px;">No se encontraron descargas que coincidan con la búsqueda.</td></tr>`;
        updateDescargasSelection();
        return;
    }

    // Si hay búsqueda activa, expandir automáticamente canales y paquetes que coincidan
    if (searchTerm) {
        channelMap.forEach(({ channelName, packages }) => {
            expandedDescargasChannels.add(channelName);
            packages.forEach((_, pkgName) => expandedDescargas.add(`${channelName}:::${pkgName}`));
        });
    }

    channelMap.forEach(({ channelName, packages }) => {
        // Calcular estadísticas acumuladas del Canal
        const allChanItems = [];
        let chanTotalSize = 0;
        let chanDownloaded = 0;
        let chanActiveDownloading = 0;
        let chanHasPaused = false;
        let chanHasStopped = false;
        let chanHasError = false;
        let chanAllDone = true;

        packages.forEach((items) => {
            items.forEach(it => {
                allChanItems.push(it);
                chanTotalSize += (it.tamanio || 0);
                const downloaded = itemProgress[it.db_id] !== undefined ? itemProgress[it.db_id] : (it.downloaded_bytes || 0);
                chanDownloaded += downloaded;

                const st = itemStates[it.db_id] || it.state;
                if (st === 'downloading') chanActiveDownloading++;
                if (st === 'paused') chanHasPaused = true;
                if (st === 'stopped') chanHasStopped = true;
                if (st === 'error') chanHasError = true;
                if (st !== 'done') chanAllDone = false;
            });
        });

        const chanPercent = chanTotalSize > 0 ? ((chanDownloaded / chanTotalSize) * 100).toFixed(1) : 0;
        const allChanChecked = allChanItems.length > 0 && allChanItems.every(it => selectedDownloads.has(it.db_id));
        const someChanChecked = allChanItems.some(it => selectedDownloads.has(it.db_id));
        const isChanExpanded = expandedDescargasChannels.has(channelName);
        const latestDate = allChanItems.find(it => it.fecha)?.fecha || '';

        let chanStateText = 'En cola';
        let chanColor = '#666';
        if (chanAllDone) {
            chanStateText = 'Completado';
            chanColor = '#107c10';
        } else if (chanActiveDownloading > 0) {
            chanStateText = `Descargando (${chanActiveDownloading})`;
            chanColor = '#0078d7';
        } else if (chanHasPaused) {
            chanStateText = 'Pausado';
            chanColor = '#d97706';
        } else if (chanHasError) {
            chanStateText = 'Error';
            chanColor = '#d92d20';
        } else if (chanHasStopped) {
            chanStateText = 'Detenido';
            chanColor = '#d92d20';
        }

        // 1. FILA DE CANAL EN DESCARGAS (NIVEL 1 - RAÍZ)
        const trChan = document.createElement('tr');
        trChan.className = 'channel-row';
        trChan.id = `chan-dl-row-${encodeURIComponent(channelName)}`;
        trChan.dataset.channelName = channelName;

        trChan.innerHTML = `
            <td style="text-align: center;">
                <input type="checkbox" class="chan-check-descargas" data-channel-name="${channelName}" ${allChanChecked ? 'checked' : ''}>
            </td>
            <td>
                <button type="button" class="tree-toggle-btn" data-channel-name="${channelName}" title="${isChanExpanded ? 'Contraer canal' : 'Expandir canal'}">
                    ${isChanExpanded ? '−' : '+'}
                </button>
                <i class="fa-solid ${isChanExpanded ? 'fa-folder-open' : 'fa-folder'} folder-icon"></i>
                <span class="channel-badge-pill" title="Canal: ${channelName}">
                    <i class="fa-brands fa-telegram"></i> ${channelName}
                </span>
                <span class="package-badge-count">(${packages.size} carpetas, ${allChanItems.length} archivos)</span>
            </td>
            <td><strong>${formatBytes(chanTotalSize)}</strong></td>
            <td style="font-size: 11px; color: #555;">${latestDate ? formatFecha(latestDate) : '-'}</td>
            <td id="chan-comp-${encodeURIComponent(channelName)}">${formatBytes(chanDownloaded)}</td>
            <td>
                <div class="progress-bar-cell">
                    <div class="progress-bar-fill" id="chan-perc-fill-${encodeURIComponent(channelName)}" style="width: ${chanPercent}%; background-color: ${chanAllDone ? '#107c10' : '#0078d7'};"></div>
                    <div class="progress-bar-text" id="chan-perc-text-${encodeURIComponent(channelName)}">${chanPercent}%</div>
                </div>
            </td>
            <td style="font-size: 11px; font-weight: 600; color: ${chanColor};" id="chan-spd-${encodeURIComponent(channelName)}">
                ${chanStateText}
            </td>
            <td style="text-align: center;">
                <div style="display: inline-flex; gap: 4px; align-items: center; justify-content: center;">
                    <button type="button" class="row-action-btn" onclick="handleToggleChannel(event, '${channelName.replace(/'/g, "\\'")}')" title="Pausar / Reanudar canal">
                        <i class="fa-solid ${chanActiveDownloading > 0 ? 'fa-pause' : 'fa-play'}" style="color: ${chanActiveDownloading > 0 ? '#d97706' : '#107c10'};"></i>
                    </button>
                    <button type="button" class="row-action-btn btn-danger" onclick="handleDeleteChannel(event, '${channelName.replace(/'/g, "\\'")}')" title="Eliminar todo el canal del historial">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </td>
        `;

        const chanCb = trChan.querySelector('.chan-check-descargas');
        if (someChanChecked && !allChanChecked) {
            chanCb.indeterminate = true;
        }
        chanCb.addEventListener('click', (e) => {
            e.stopPropagation();
            const checked = chanCb.checked;
            allChanItems.forEach(it => {
                if (checked) selectedDownloads.add(it.db_id);
                else selectedDownloads.delete(it.db_id);
            });
            renderDescargasTable();
        });

        const toggleChanBtn = trChan.querySelector('.tree-toggle-btn');
        const handleChanToggle = (e) => {
            e.stopPropagation();
            if (expandedDescargasChannels.has(channelName)) {
                expandedDescargasChannels.delete(channelName);
            } else {
                expandedDescargasChannels.add(channelName);
            }
            renderDescargasTable();
        };
        toggleChanBtn.addEventListener('click', handleChanToggle);
        trChan.addEventListener('click', (e) => {
            if (e.target.closest('.row-action-btn') || e.target.type === 'checkbox') return;
            handleChanToggle(e);
        });

        bodyDescargas.appendChild(trChan);

        // 2. FILAS DE PAQUETES (NIVEL 2 - EN CASCADA BAJO EL CANAL)
        if (isChanExpanded) {
            const pkgEntries = Array.from(packages.entries());
            pkgEntries.forEach(([pkgName, items], pkgIdx) => {
                const isLastPkg = (pkgIdx === pkgEntries.length - 1);
                const pkgKey = `${channelName}:::${pkgName}`;
                const isPkgExpanded = expandedDescargas.has(pkgKey) || expandedDescargas.has(pkgName);

                let pkgTotalSize = 0;
                let pkgDownloadedBytes = 0;
                let activeDownloading = 0;
                let hasPaused = false;
                let hasStopped = false;
                let hasError = false;
                let allDone = true;

                items.forEach(it => {
                    pkgTotalSize += (it.tamanio || 0);
                    const downloaded = itemProgress[it.db_id] !== undefined ? itemProgress[it.db_id] : (it.downloaded_bytes || 0);
                    pkgDownloadedBytes += downloaded;

                    const st = itemStates[it.db_id] || it.state;
                    if (st === 'downloading') activeDownloading++;
                    if (st === 'paused') hasPaused = true;
                    if (st === 'stopped') hasStopped = true;
                    if (st === 'error') hasError = true;
                    if (st !== 'done') allDone = false;
                });

                const pkgPercent = pkgTotalSize > 0 ? ((pkgDownloadedBytes / pkgTotalSize) * 100).toFixed(1) : 0;
                const allItemsChecked = items.length > 0 && items.every(it => selectedDownloads.has(it.db_id));
                const someItemsChecked = items.some(it => selectedDownloads.has(it.db_id));

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
                } else if (hasError) {
                    pkgStateText = 'Error';
                    pkgColor = '#d92d20';
                } else if (hasStopped) {
                    pkgStateText = 'Detenido';
                    pkgColor = '#d92d20';
                }

                const trPkg = document.createElement('tr');
                trPkg.className = 'package-row';
                trPkg.id = `pkg-dl-row-${encodeURIComponent(pkgKey)}`;

                trPkg.innerHTML = `
                    <td style="text-align: center;"></td>
                    <td>
                        ${getPackageBranchGuideHtml(isLastPkg)}
                        <input type="checkbox" class="pkg-check-descargas tree-item-checkbox" data-pkg-key="${pkgKey}" style="margin: 0 6px 0 0;" ${allItemsChecked ? 'checked' : ''}>
                        <button type="button" class="tree-toggle-btn" data-pkg-key="${pkgKey}" title="${isPkgExpanded ? 'Contraer carpeta' : 'Expandir carpeta'}">
                            ${isPkgExpanded ? '−' : '+'}
                        </button>
                        <i class="fa-solid ${isPkgExpanded ? 'fa-folder-open' : 'fa-folder'} folder-icon"></i>
                        <span class="package-name-text">${pkgName}</span>
                        <span class="package-badge-count">(${items.length} archivos)</span>
                    </td>
                    <td><strong>${formatBytes(pkgTotalSize)}</strong></td>
                    <td style="font-size: 11px; color: #555;">${items.length > 0 && items[0].fecha ? formatFecha(items[0].fecha) : '-'}</td>
                    <td id="pkg-comp-${encodeURIComponent(pkgKey)}">${formatBytes(pkgDownloadedBytes)}</td>
                    <td>
                        <div class="progress-bar-cell">
                            <div class="progress-bar-fill" id="pkg-perc-fill-${encodeURIComponent(pkgKey)}" style="width: ${pkgPercent}%; background-color: ${allDone ? '#107c10' : '#0078d7'};"></div>
                            <div class="progress-bar-text" id="pkg-perc-text-${encodeURIComponent(pkgKey)}">${pkgPercent}%</div>
                        </div>
                    </td>
                    <td style="font-size: 11px; font-weight: 600; color: ${pkgColor};" id="pkg-spd-${encodeURIComponent(pkgKey)}">
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

                const togglePkgBtn = trPkg.querySelector('.tree-toggle-btn');
                const handlePkgToggle = (e) => {
                    e.stopPropagation();
                    if (expandedDescargas.has(pkgKey) || expandedDescargas.has(pkgName)) {
                        expandedDescargas.delete(pkgKey);
                        expandedDescargas.delete(pkgName);
                    } else {
                        expandedDescargas.add(pkgKey);
                    }
                    renderDescargasTable();
                };
                togglePkgBtn.addEventListener('click', handlePkgToggle);
                trPkg.addEventListener('click', (e) => {
                    if (e.target.closest('.row-action-btn') || e.target.type === 'checkbox') return;
                    handlePkgToggle(e);
                });

                bodyDescargas.appendChild(trPkg);

                // 3. FILAS DE ARCHIVOS EN DESCARGAS (NIVEL 3 - EN CASCADA BAJO EL PAQUETE)
                if (isPkgExpanded) {
                    const maxVisible = descargasPkgLimits[pkgKey] || descargasPkgLimits[pkgName] || 50;
                    const visibleItems = items.slice(0, maxVisible);

                    visibleItems.forEach((item, itemIdx) => {
                        const isLastItem = (itemIdx === items.length - 1);
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
                            <td style="text-align: center;"></td>
                            <td>
                                <div style="display:inline-flex;align-items:center;position:relative;height:28px;vertical-align:middle;">
                                    ${getFileBranchGuideHtml(isLastPkg, isLastItem)}
                                    <input type="checkbox" class="item-check-descargas tree-item-checkbox" data-db-id="${dbId}" style="margin: 0 6px 0 0;" ${isSelected ? 'checked' : ''}>
                                    <i class="${getFileIconClass(item.nombre)} file-type-icon" style="margin-right: 6px;"></i>
                                    <span title="${item.nombre}">${item.nombre}</span>
                                </div>
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

                    if (items.length > visibleItems.length) {
                        const trMore = document.createElement('tr');
                        trMore.className = 'child-file-row show-more-row';
                        trMore.innerHTML = `
                            <td style="text-align: center;"></td>
                            <td colspan="7" style="padding: 9px 16px; background: #f0f7ff; color: #0284c7; font-size: 12px; border-top: 1px dashed #bae6fd;">
                                <div style="display:inline-flex;align-items:center;">
                                    ${getFileBranchGuideHtml(isLastPkg, true)}
                                    <i class="fa-solid fa-layer-group" style="margin-right: 6px;"></i>
                                    <span>Mostrando <strong>${visibleItems.length}</strong> de <strong>${items.length}</strong> archivos en esta carpeta.</span>
                                    <button type="button" class="btn-more-items" style="margin-left: 10px; padding: 3px 10px; font-size: 11px; cursor: pointer; border-radius: 4px; border: 1px solid #0284c7; background: #fff; color: #0284c7; font-weight: 600;">
                                        <i class="fa-solid fa-plus"></i> Mostrar más (+50)
                                    </button>
                                    <button type="button" class="btn-all-items" style="margin-left: 6px; padding: 3px 10px; font-size: 11px; cursor: pointer; border-radius: 4px; border: 1px solid #64748b; background: #fff; color: #475569; font-weight: 600;">
                                        Mostrar todos
                                    </button>
                                </div>
                            </td>
                        `;
                        const btnMore = trMore.querySelector('.btn-more-items');
                        btnMore.addEventListener('click', (e) => {
                            e.stopPropagation();
                            descargasPkgLimits[pkgKey] = (descargasPkgLimits[pkgKey] || 50) + 50;
                            renderDescargasTable();
                        });
                        const btnAll = trMore.querySelector('.btn-all-items');
                        btnAll.addEventListener('click', (e) => {
                            e.stopPropagation();
                            descargasPkgLimits[pkgKey] = items.length;
                            renderDescargasTable();
                        });
                        bodyDescargas.appendChild(trMore);
                    }
                }
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
        const allChanNames = new Set(downloadsData.map(d => (d.channel_name || '').trim() || 'Descargas Directas'));
        const allPkgKeys = new Set(downloadsData.map(d => `${(d.channel_name || '').trim() || 'Descargas Directas'}:::${d.package_name || 'Descargas'}`));
        const isAllOpen = expandedDescargasChannels.size >= allChanNames.size && expandedDescargas.size >= allPkgKeys.size;

        if (isAllOpen && downloadsData.length > 0) {
            expandedDescargasChannels.clear();
            expandedDescargas.clear();
            txtExpandDescargas.textContent = "Expandir Todo";
        } else {
            allChanNames.forEach(c => expandedDescargasChannels.add(c));
            allPkgKeys.forEach(k => expandedDescargas.add(k));
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
        if (quickFoldersContainer && data.common) {
            quickFoldersContainer.innerHTML = '';
            data.common.forEach(item => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'quick-folder-btn';
                if (item.is_usb) {
                    btn.style.borderColor = '#86efac';
                    btn.style.color = '#15803d';
                    btn.style.background = '#f0fdf4';
                }
                const iconClass = (item.icon && item.icon.includes(' ')) ? item.icon : (item.icon ? (item.icon.startsWith('fa-') ? `fa-solid ${item.icon}` : item.icon) : 'fa-solid fa-folder');
                btn.innerHTML = `<i class="${iconClass}"></i> <span>${escapeHtml(item.name)}</span>`;
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
                    btn.innerHTML = `<i class="fa-solid fa-network-wired"></i> <span title="${escapeHtml(share.remote)}">${escapeHtml(share.name)}</span>`;
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

        // Renderizar discos USB y almacenamiento externo detectados
        const usbDrivesSection = document.getElementById('usbDrivesSection');
        const usbDrivesContainer = document.getElementById('usbDrivesContainer');
        if (usbDrivesSection && usbDrivesContainer) {
            usbDrivesContainer.innerHTML = '';
            if (data.usb_drives && data.usb_drives.length > 0) {
                usbDrivesSection.style.display = 'block';
                data.usb_drives.forEach(uDrive => {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'quick-folder-btn';
                    btn.style.borderColor = '#86efac';
                    btn.style.color = '#15803d';
                    btn.style.background = '#f0fdf4';
                    btn.innerHTML = `<i class="fa-brands fa-usb" style="font-size: 13px; color: #16a34a;"></i> <span title="${escapeHtml(uDrive.path)}">${escapeHtml(uDrive.name)}</span>`;
                    btn.addEventListener('click', () => loadDirectory(uDrive.path));
                    usbDrivesContainer.appendChild(btn);
                });
            } else {
                usbDrivesSection.style.display = 'none';
            }
        }

        // Mostrar banner informativo si está en Docker en Synology y no hay USBs montados
        const dockerUsbBanner = document.getElementById('dockerUsbBanner');
        const dockerUsbBannerText = document.getElementById('dockerUsbBannerText');
        if (dockerUsbBanner && dockerUsbBannerText) {
            if (data.docker_usb_warning) {
                dockerUsbBanner.style.display = 'block';
                dockerUsbBannerText.textContent = data.docker_usb_warning;
            } else {
                dockerUsbBanner.style.display = 'none';
            }
        }

        // Renderizar unidades de disco o volúmenes (C:\, D:\ o /, /volume1, /volumeUSB1)
        if (folderDrives && data.drives) {
            folderDrives.innerHTML = '';
            data.drives.forEach(drv => {
                const btn = document.createElement('button');
                btn.type = 'button';
                const isCurrentDrive = data.current.toLowerCase().startsWith(drv.toLowerCase());
                const isUsb = drv.toLowerCase().includes('usb') || drv.toLowerCase().includes('external');
                btn.className = `folder-drive-btn ${isCurrentDrive ? 'active' : ''}`;
                if (isUsb) {
                    btn.style.borderColor = '#86efac';
                    btn.innerHTML = `<i class="fa-brands fa-usb" style="color: #16a34a; margin-right: 3px;"></i>${escapeHtml(drv.endsWith('\\') ? drv.replace('\\', '') : drv)}`;
                } else {
                    btn.textContent = drv.endsWith('\\') ? drv.replace('\\', '') : drv;
                }
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

async function startDownloadsWithOverwritePrompt(payloadItems, customDir, includeDate, removeFromGrabber = true, triggerBtn = null) {
    if (!payloadItems || payloadItems.length === 0) {
        showToast('No hay elementos seleccionados para descargar.', 'error');
        return;
    }

    let origBtnHtml = '';
    if (triggerBtn) {
        origBtnHtml = triggerBtn.innerHTML;
        triggerBtn.disabled = true;
        triggerBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verificando...';
    }

    let alreadyDownloaded = [];
    try {
        const checkRes = await fetch(`${API_BASE}/downloads/check_existing`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                items: payloadItems,
                custom_dir: customDir
            })
        });
        const checkData = await checkRes.json();
        if (checkData.success && checkData.already_downloaded) {
            alreadyDownloaded = checkData.already_downloaded;
        }
    } catch (e) {
        console.warn('No se pudo verificar el historial:', e);
    } finally {
        if (triggerBtn) {
            triggerBtn.disabled = false;
            triggerBtn.innerHTML = origBtnHtml;
        }
    }

    let overwrite = false;
    let itemsToProcess = payloadItems;

    if (alreadyDownloaded.length > 0) {
        const total = payloadItems.length;
        const count = alreadyDownloaded.length;
        const msg = count === 1
            ? `El archivo <strong>${escapeHtml(alreadyDownloaded[0].filename)}</strong> ya figura como descargado en el historial o existe en el disco.`
            : `Se han detectado <strong>${count} de ${total} archivo(s)</strong> que ya figuran como descargados en el historial o existen en el disco.`;

        const choice = await showReplacePrompt({
            title: 'Archivos ya descargados',
            message: msg,
            files: alreadyDownloaded,
            allowSkip: true
        });

        if (choice === 'cancel') {
            return;
        } else if (choice === 'overwrite') {
            overwrite = true;
            itemsToProcess = payloadItems;
        } else if (choice === 'skip') {
            overwrite = false;
            const alreadyMsgIds = new Set(alreadyDownloaded.map(it => it.message_id));
            const alreadyNames = new Set(alreadyDownloaded.map(it => it.filename));
            itemsToProcess = payloadItems.filter(it => !alreadyMsgIds.has(it.message_id) && !alreadyNames.has(it.filename));

            if (itemsToProcess.length === 0) {
                showToast('Todos los archivos seleccionados ya fueron descargados previamente. Se omitió la descarga.', 'info');
                if (removeFromGrabber) {
                    const grabberIds = payloadItems.map(it => it.grabber_item_id).filter(Boolean);
                    if (grabberIds.length > 0) {
                        try {
                            await fetch(`${API_BASE}/grabber/delete`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ item_ids: grabberIds })
                            });
                            await loadGrabberData();
                        } catch (err) {}
                    }
                }
                return;
            }
        }
    }

    if (triggerBtn) {
        origBtnHtml = triggerBtn.innerHTML;
        triggerBtn.disabled = true;
        triggerBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Iniciando...';
    }

    try {
        const res = await fetch(`${API_BASE}/download`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                items: itemsToProcess,
                custom_dir: customDir,
                include_date: includeDate,
                remove_from_grabber: removeFromGrabber,
                overwrite: overwrite
            })
        });
        const data = await res.json();
        if (data.success) {
            itemsToProcess.forEach(it => {
                if (it.grabber_item_id) selectedGrabberItems.delete(it.grabber_item_id);
            });
            switchMainTab('descargas');
            await loadGrabberData();
            await loadDownloadsData();
        } else {
            showToast('Error al iniciar descargas: ' + (data.error || 'Desconocido'), 'error');
        }
    } catch (e) {
        showToast('Error de red al conectar con el servidor: ' + e.message, 'error');
    } finally {
        if (triggerBtn) {
            triggerBtn.disabled = false;
            triggerBtn.innerHTML = origBtnHtml;
        }
    }
}

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
        
        await startDownloadsWithOverwritePrompt(payloadItems, customDir, includeDate, true, btnStartGrabberDownloads);
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
    
    await startDownloadsWithOverwritePrompt(payloadItems, customDir, includeDate, true);
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
    
    await startDownloadsWithOverwritePrompt(payloadItems, customDir, includeDate, true);
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

window.handleToggleChannel = async function(event, chanName) {
    if (event) event.stopPropagation();
    const chanDownloads = downloadsData.filter(d => ((d.channel_name || '').trim() || 'Descargas Directas') === chanName);
    if (chanDownloads.length === 0) return;

    const isAnyDownloading = chanDownloads.some(d => (itemStates[d.db_id] || d.state) === 'downloading');
    for (const dl of chanDownloads) {
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

window.handleDeleteChannel = async function(event, chanName) {
    if (event) event.stopPropagation();
    if (!await showConfirmDialog(`¿Eliminar todo el canal "${chanName}" y todas sus descargas del historial?`)) return;
    const ids = downloadsData.filter(d => ((d.channel_name || '').trim() || 'Descargas Directas') === chanName).map(d => d.db_id);
    try {
        await fetch(`${API_BASE}/downloads/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                db_ids: ids,
                indices: ids,
                channel_name: chanName 
            })
        });
        ids.forEach(id => {
            selectedDownloads.delete(id);
            delete itemStates[id];
            delete itemFilePaths[id];
        });
        showToast(`"${chanName}" eliminado del historial.`, 'success');
        await loadDownloadsData();
    } catch (e) {
        console.error("Error al eliminar canal:", e);
        showToast('Error al eliminar canal.', 'error');
    }
};

window.handleDownloadGrabberChannel = async function(event, chanName) {
    if (event) event.stopPropagation();
    const pkgs = grabberPackages.filter(p => ((p.channel_name || '').trim() || 'Canal Telegram') === chanName);
    const items = [];
    pkgs.forEach(pkg => {
        (pkg.items || []).forEach(it => {
            if (isFormatAllowed(it.filename)) {
                items.push({ ...it, package_name: pkg.name, channel_name: pkg.channel_name || chanName });
            }
        });
    });
    if (items.length === 0) {
        showToast('No hay archivos válidos para descargar en este canal.', 'info');
        return;
    }
    const customDir = customDirInput ? customDirInput.value.trim() : '';
    const includeDate = chkIncludeDate ? chkIncludeDate.checked : false;
    const payloadItems = items.map(it => ({
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
    await startDownloadsWithOverwritePrompt(payloadItems, customDir, includeDate, true);
};

window.handleDeleteGrabberChannel = async function(event, chanName) {
    if (event) event.stopPropagation();
    if (!await showConfirmDialog(`¿Eliminar todos los paquetes del canal "${chanName}" del capturador?`)) return;
    const pkgs = grabberPackages.filter(p => ((p.channel_name || '').trim() || 'Canal Telegram') === chanName);
    for (const pkg of pkgs) {
        await fetch(`${API_BASE}/grabber/package/${pkg.id}`, { method: 'DELETE' });
    }
    await loadGrabberData();
};

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
        let overwrite = false;
        if (state === 'done') {
            const confirmed = await showConfirmDialog('Este archivo ya figura como completado en el historial. ¿Deseas volver a descargarlo y reemplazar el archivo existente?');
            if (!confirmed) return;
            overwrite = true;
        }
        itemStates[dbId] = 'pending';
        updateDownloadRowUI(dbId, 'pending');
        connectWebSocket();
        await fetch(`${API_BASE}/download`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ indices: [dbId], is_resume: true, overwrite: overwrite })
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

// Actualiza el progreso agregado y estado de la fila del paquete padre en Descargas con throttling
const _pendingPkgRowUpdates = new Set();
let _pkgRowUpdateTimer = null;

function updatePackageRowUI(pkgName) {
    if (!pkgName) return;
    _pendingPkgRowUpdates.add(pkgName);
    if (!_pkgRowUpdateTimer) {
        _pkgRowUpdateTimer = setTimeout(() => {
            _pkgRowUpdateTimer = null;
            const toUpdate = Array.from(_pendingPkgRowUpdates);
            _pendingPkgRowUpdates.clear();
            toUpdate.forEach(p => _doUpdatePackageRowUI(p));
        }, 250);
    }
}

function _doUpdatePackageRowUI(pkgName) {
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
    const chanName = (items[0]?.channel_name || '').trim() || 'Descargas Directas';
    const pkgKey = `${chanName}:::${pkgName}`;

    const pkgCompEl = document.getElementById(`pkg-comp-${encodeURIComponent(pkgKey)}`) || document.getElementById(`pkg-comp-${encodeURIComponent(pkgName)}`);
    const pkgFillEl = document.getElementById(`pkg-perc-fill-${encodeURIComponent(pkgKey)}`) || document.getElementById(`pkg-perc-fill-${encodeURIComponent(pkgName)}`);
    const pkgTextEl = document.getElementById(`pkg-perc-text-${encodeURIComponent(pkgKey)}`) || document.getElementById(`pkg-perc-text-${encodeURIComponent(pkgName)}`);
    const pkgSpdEl = document.getElementById(`pkg-spd-${encodeURIComponent(pkgKey)}`) || document.getElementById(`pkg-spd-${encodeURIComponent(pkgName)}`);
    
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
    if (chanName) {
        updateChannelRowUI(chanName);
    }
}

// Actualiza el progreso agregado y estado de la fila del Canal en Descargas con throttling
const _pendingChanRowUpdates = new Set();
let _chanRowUpdateTimer = null;

function updateChannelRowUI(chanName) {
    if (!chanName) return;
    _pendingChanRowUpdates.add(chanName);
    if (!_chanRowUpdateTimer) {
        _chanRowUpdateTimer = setTimeout(() => {
            _chanRowUpdateTimer = null;
            const toUpdate = Array.from(_pendingChanRowUpdates);
            _pendingChanRowUpdates.clear();
            toUpdate.forEach(c => _doUpdateChannelRowUI(c));
        }, 250);
    }
}

function _doUpdateChannelRowUI(chanName) {
    if (!chanName) return;
    const items = downloadsData.filter(d => ((d.channel_name || '').trim() || 'Descargas Directas') === chanName);
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
    const chanCompEl = document.getElementById(`chan-comp-${encodeURIComponent(chanName)}`);
    const chanFillEl = document.getElementById(`chan-perc-fill-${encodeURIComponent(chanName)}`);
    const chanTextEl = document.getElementById(`chan-perc-text-${encodeURIComponent(chanName)}`);
    const chanSpdEl = document.getElementById(`chan-spd-${encodeURIComponent(chanName)}`);

    if (chanCompEl) chanCompEl.textContent = formatBytes(downloadedBytes);
    if (chanFillEl) {
        chanFillEl.style.width = `${percent}%`;
        chanFillEl.style.backgroundColor = allDone ? '#107c10' : '#0078d7';
    }
    if (chanTextEl) chanTextEl.textContent = `${percent}%`;

    if (chanSpdEl) {
        if (allDone) {
            chanSpdEl.textContent = 'Completado';
            chanSpdEl.style.color = '#107c10';
        } else if (activeDownloading > 0) {
            chanSpdEl.textContent = `Descargando (${activeDownloading})`;
            chanSpdEl.style.color = '#0078d7';
        } else if (hasPaused) {
            chanSpdEl.textContent = 'Pausado';
            chanSpdEl.style.color = '#d97706';
        } else if (hasStopped) {
            chanSpdEl.textContent = 'Detenido';
            chanSpdEl.style.color = '#d92d20';
        } else {
            chanSpdEl.textContent = 'En cola';
            chanSpdEl.style.color = '#666';
        }
    }
}

// ═════════════════════════════════════════════════════════════════════════
// 10. WEBSOCKET Y SINCRONIZACIÓN EN TIEMPO REAL
// ═════════════════════════════════════════════════════════════════════════

let lastWsMessageTime = Date.now();

function connectWebSocket() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        return;
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    try {
        ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    } catch (e) {
        console.warn("Error creando WebSocket:", e);
        return;
    }

    ws.onopen = () => {
        lastWsMessageTime = Date.now();
    };

    ws.onerror = (err) => {
        console.warn("WebSocket aviso:", err);
    };
    
    ws.onmessage = (event) => {
        lastWsMessageTime = Date.now();
        if (typeof event.data === 'string' && (event.data === 'pong' || event.data === 'ping')) {
            return;
        }
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
                if (data.channel_name) updateChannelRowUI(data.channel_name);
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
                if (data.channel_name) {
                    updateChannelRowUI(data.channel_name);
                }
            } else if (data.type === 'status_change') {
                const dbId = data.db_id || data.index;
                itemStates[dbId] = data.state;
                if (data.file_path) itemFilePaths[dbId] = data.file_path;
                updateDownloadRowUI(dbId, data.state);
                if (data.package_name) updatePackageRowUI(data.package_name);
                if (data.channel_name) updateChannelRowUI(data.channel_name);
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
                if (data.channel_name) updateChannelRowUI(data.channel_name);
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
        // Reintentar conexión automáticamente
        setTimeout(() => {
            connectWebSocket();
        }, 2000);
    };
}

// ─── Mecanismo de Respaldo: Heartbeat y Polling Inteligente ───
// Si el websocket se corta o no transmite, sincroniza el progreso sin necesidad de F5
setInterval(async () => {
    // 1. Keep-alive ping si está conectado
    if (ws && ws.readyState === WebSocket.OPEN) {
        try {
            ws.send("ping");
        } catch (e) {}
    } else {
        connectWebSocket();
    }

    // 2. Polling de respaldo cuando hay descargas activas o en cola
    if (currentMainTab === 'descargas') {
        const hasActive = downloadsData.some(d => {
            const st = itemStates[d.db_id] || d.state;
            return st === 'downloading' || st === 'pending';
        });
        if (hasActive) {
            const now = Date.now();
            // Si el websocket está desconectado o no ha recibido eventos de progreso en 2.5s
            if (!ws || ws.readyState !== WebSocket.OPEN || (now - lastWsMessageTime > 2500)) {
                await loadDownloadsData();
            }
        }
    }
}, 2000);

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

        let overwrite = false;
        if (downloadExisting) {
            try {
                const checkRes = await fetch(`${API_BASE}/downloads/check_existing`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        channel_url: url,
                        custom_dir: dirInput.value.trim()
                    })
                });
                const checkData = await checkRes.json();
                if (checkData.success && checkData.channel_completed_count > 0) {
                    const cName = checkData.channel_name || url;
                    const choice = await showReplacePrompt({
                        title: 'Historial de descargas detectado',
                        message: `El canal <strong>${escapeHtml(cName)}</strong> ya cuenta con <strong>${checkData.channel_completed_count} archivo(s)</strong> registrados como descargados en el historial.<br><br>¿Deseas volver a descargarlos y reemplazar los archivos existentes, u omitir los ya descargados y procesar únicamente archivos nuevos?`,
                        allowSkip: true
                    });
                    if (choice === 'cancel') {
                        return;
                    }
                    overwrite = (choice === 'overwrite');
                }
            } catch (err) {
                console.warn("No se pudo verificar el historial del canal:", err);
            }
        }

        const res = await fetch(`${API_BASE}/autochannels/add`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                url: url,
                custom_dir: dirInput.value.trim(),
                download_existing: downloadExisting,
                file_types: fileTypesStr,
                subfolder_mode: subfolderMode,
                overwrite: overwrite
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


// ─── Modal de Configuración Global ───────────────
const btnOpenSettings = document.getElementById('btnOpenSettings');
const settingsModal = document.getElementById('settingsModal');
const btnCloseSettingsModal = document.getElementById('btnCloseSettingsModal');
const btnCancelSettings = document.getElementById('btnCancelSettings');
const btnSaveSettings = document.getElementById('btnSaveSettings');
const btnTestWebhook = document.getElementById('btnTestWebhook');
const settingMaxConcurrent = document.getElementById('settingMaxConcurrent');
const lblMaxConcurrentVal = document.getElementById('lblMaxConcurrentVal');
const settingDownloadTimeout = document.getElementById('settingDownloadTimeout');
const settingMaxBandwidth = document.getElementById('settingMaxBandwidth');
const settingMaxAutoRetries = document.getElementById('settingMaxAutoRetries');
const settingWebhookUrl = document.getElementById('settingWebhookUrl');

// Elementos de Conexión con App Android
const txtServerIpUrl = document.getElementById('txtServerIpUrl');
const btnCopyServerIp = document.getElementById('btnCopyServerIp');
const lblCopyText = document.getElementById('lblCopyText');
const btnToggleQrCode = document.getElementById('btnToggleQrCode');
const containerQrAndroid = document.getElementById('containerQrAndroid');
const qrCodeAndroid = document.getElementById('qrCodeAndroid');
const lblServerPort = document.getElementById('lblServerPort');
const extraIpsContainer = document.getElementById('extraIpsContainer');
const lblExtraIps = document.getElementById('lblExtraIps');

if (settingMaxConcurrent && lblMaxConcurrentVal) {
    settingMaxConcurrent.addEventListener('input', () => {
        lblMaxConcurrentVal.textContent = settingMaxConcurrent.value;
    });
}

function openSettingsModal() {
    fetch('/api/settings')
        .then(res => res.json())
        .then(data => {
            // Cargar datos de red para App Android
            const port = data.port || window.location.port || '8000';
            if (lblServerPort) lblServerPort.textContent = port;

            let targetUrl = data.primary_url;
            if (!targetUrl || targetUrl.includes('127.0.0.1') || targetUrl.includes('localhost')) {
                if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
                    targetUrl = window.location.protocol + '//' + window.location.host;
                } else if (data.local_ips && data.local_ips.length > 0) {
                    targetUrl = 'http://' + data.local_ips[0] + ':' + port;
                }
            }
            if (txtServerIpUrl) txtServerIpUrl.value = targetUrl || ('http://' + window.location.host);

            // Generar código QR de conexión de inmediato
            if (qrCodeAndroid && typeof QRCode !== 'undefined') {
                qrCodeAndroid.innerHTML = '';
                const urlParaQr = txtServerIpUrl ? txtServerIpUrl.value : ('http://' + window.location.host);
                try {
                    new QRCode(qrCodeAndroid, {
                        text: urlParaQr,
                        width: 108,
                        height: 108,
                        colorDark: "#0f172a",
                        colorLight: "#ffffff",
                        correctLevel: QRCode.CorrectLevel.M
                    });
                } catch (e) {
                    console.error("Error generando QR Android:", e);
                }
            }

            if (data.local_ips && data.local_ips.length > 1 && extraIpsContainer && lblExtraIps) {
                extraIpsContainer.style.display = 'block';
                lblExtraIps.textContent = data.local_ips.slice(1).map(ip => `http://${ip}:${port}`).join(', ');
            } else if (extraIpsContainer) {
                extraIpsContainer.style.display = 'none';
            }

            if (settingMaxConcurrent) {
                settingMaxConcurrent.value = data.max_concurrent_downloads || 2;
                if (lblMaxConcurrentVal) lblMaxConcurrentVal.textContent = settingMaxConcurrent.value;
            }
            if (settingDownloadTimeout) {
                settingDownloadTimeout.value = data.download_timeout || 60;
            }
            if (settingMaxBandwidth) {
                settingMaxBandwidth.value = data.max_bandwidth_mbps !== undefined ? data.max_bandwidth_mbps : 0;
            }
            if (settingMaxAutoRetries) {
                settingMaxAutoRetries.value = data.max_auto_retries !== undefined ? data.max_auto_retries : 2;
            }
            if (settingWebhookUrl) {
                settingWebhookUrl.value = data.webhook_url || '';
            }
            if (settingsModal) settingsModal.style.display = 'flex';
        })
        .catch(err => {
            console.error("Error cargando configuración:", err);
            showToast("No se pudo cargar la configuración del servidor.", "error");
        });
}

function closeSettingsModal() {
    if (settingsModal) settingsModal.style.display = 'none';
    if (containerQrAndroid) containerQrAndroid.style.display = 'none';
}

if (btnCopyServerIp && txtServerIpUrl) {
    btnCopyServerIp.addEventListener('click', () => {
        const text = txtServerIpUrl.value;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                if (lblCopyText) lblCopyText.textContent = "¡Copiado!";
                setTimeout(() => { if (lblCopyText) lblCopyText.textContent = "Copiar"; }, 2000);
                showToast("Dirección copiada para la app de Android", "success", 2000, "App Android");
            }).catch(() => fallbackCopy(text));
        } else {
            fallbackCopy(text);
        }
    });
}

function fallbackCopy(text) {
    if (txtServerIpUrl) {
        txtServerIpUrl.select();
        document.execCommand('copy');
        if (lblCopyText) lblCopyText.textContent = "¡Copiado!";
        setTimeout(() => { if (lblCopyText) lblCopyText.textContent = "Copiar"; }, 2000);
        showToast("Dirección copiada para la app de Android", "success", 2000, "App Android");
    }
}

if (btnToggleQrCode && containerQrAndroid) {
    btnToggleQrCode.addEventListener('click', () => {
        const isHidden = containerQrAndroid.style.display === 'none';
        if (isHidden) {
            containerQrAndroid.style.display = 'block';
            if (qrCodeAndroid && typeof QRCode !== 'undefined') {
                qrCodeAndroid.innerHTML = '';
                const url = txtServerIpUrl ? txtServerIpUrl.value : window.location.origin;
                try {
                    new QRCode(qrCodeAndroid, {
                        text: url,
                        width: 140,
                        height: 140,
                        colorDark: "#0f172a",
                        colorLight: "#ffffff",
                        correctLevel: QRCode.CorrectLevel.M
                    });
                } catch (e) {
                    console.error("Error generando QR:", e);
                }
            }
        } else {
            containerQrAndroid.style.display = 'none';
        }
    });
}

if (btnOpenSettings) btnOpenSettings.addEventListener('click', openSettingsModal);
if (btnCloseSettingsModal) btnCloseSettingsModal.addEventListener('click', closeSettingsModal);
if (btnCancelSettings) btnCancelSettings.addEventListener('click', closeSettingsModal);

if (btnTestWebhook) {
    btnTestWebhook.addEventListener('click', () => {
        const url = settingWebhookUrl ? settingWebhookUrl.value.trim() : '';
        if (!url) {
            showToast("Ingresa una URL de Webhook para realizar la prueba.", "error");
            return;
        }
        btnTestWebhook.disabled = true;
        fetch('/api/settings/test_webhook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ webhook_url: url })
        })
        .then(res => res.json())
        .then(data => {
            btnTestWebhook.disabled = false;
            if (data.success) {
                showToast(data.message || "Notificación de prueba enviada.", "success", 4000, "Webhook");
            } else {
                showToast(data.error || "No se pudo enviar el Webhook de prueba.", "error");
            }
        })
        .catch(err => {
            btnTestWebhook.disabled = false;
            showToast("Error al conectar con el servidor.", "error");
        });
    });
}

if (btnSaveSettings) {
    btnSaveSettings.addEventListener('click', () => {
        const maxConcurrent = parseInt(settingMaxConcurrent ? settingMaxConcurrent.value : 2, 10);
        const timeout = parseInt(settingDownloadTimeout ? settingDownloadTimeout.value : 60, 10);
        const maxBandwidth = parseFloat(settingMaxBandwidth ? settingMaxBandwidth.value : 0);
        const maxRetries = parseInt(settingMaxAutoRetries ? settingMaxAutoRetries.value : 2, 10);
        const webhookUrl = settingWebhookUrl ? settingWebhookUrl.value.trim() : '';

        fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                max_concurrent_downloads: maxConcurrent,
                download_timeout: timeout,
                max_bandwidth_mbps: maxBandwidth,
                max_auto_retries: maxRetries,
                webhook_url: webhookUrl
            })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showToast("Configuración guardada correctamente.", "success", 4000, "Configuración");
                closeSettingsModal();
            } else {
                showToast(data.error || "Error al guardar configuración.", "error");
            }
        })
        .catch(err => {
            console.error("Error guardando configuración:", err);
            showToast("No se pudieron guardar los cambios.", "error");
        });
    });
}




