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

// DOM Elements
const loginModal = document.getElementById('loginModal');
const tableBody = document.getElementById('tableBody');
const btnScanSubmit = document.getElementById('btnScanSubmit');
const channelLink = document.getElementById('channelLink');
const btnDownload = document.getElementById('btnDownload');
const btnPauseAll = document.getElementById('btnPauseAll');
const btnResumeAll = document.getElementById('btnResumeAll');
const btnStopAll = document.getElementById('btnStopAll');
const selectAll = document.getElementById('selectAll');
const customDirInput = document.getElementById('customDir');
const chkIncludeDate = document.getElementById('chkIncludeDate');

if (chkIncludeDate) {
    chkIncludeDate.checked = localStorage.getItem('telegram_include_date') === 'true';
    chkIncludeDate.addEventListener('change', () => {
        localStorage.setItem('telegram_include_date', chkIncludeDate.checked);
    });
}

let itemStates = {};
let itemFilePaths = {};

// Info Panel
const infoName = document.getElementById('infoName');
const statusSelection = document.getElementById('statusSelection');
const statusTotalSize = document.getElementById('statusTotalSize');
const statusSpeed = document.getElementById('statusSpeed');

// 1. App Init
async function checkStatus() {
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
        } else {
            loginModal.style.display = 'flex';
            document.getElementById('userInfoGroup').style.display = 'none';
            connectWebSocket();
            if (activeLoginTab === 'qr') {
                initQrLogin();
            }
        }
    } catch (e) {
        console.error("Error", e);
    }
}

document.getElementById('btnLogout').addEventListener('click', async () => {
    if(confirm('¿Seguro que querés cerrar sesión?')) {
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
            if (qrPasswordError) qrPasswordError.textContent = 'Ingresá tu contraseña de dos pasos.';
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
        hint: 'Ingresá el número de teléfono sin el 0 inicial (de 6 a 15 dígitos).'
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
        return { valid: false, error: 'Por favor ingresá o seleccioná un código de país válido (ej: +56, +54).' };
    }
    
    const rule = getActiveCountryRule();
    let num = cleanRawPhoneNumber(phoneNumberInput ? phoneNumberInput.value : '');
    
    if (num.startsWith('0')) {
        num = num.replace(/^0+/, '');
    }
    
    if (!num) {
        return { valid: false, error: `Por favor ingresá tu número telefónico para ${rule.name}.` };
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
                errEl.textContent = '✅ Código enviado. Ingresá el código que recibiste en tu app de Telegram.';
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
            errEl.textContent = 'Ingresá el código de verificación que recibiste en Telegram.';
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
    if (!confirm('¿Reiniciar la sesión? Esto eliminará la sesión guardada y podrás iniciar con un número nuevo o código QR.\n\nUsá esto si la app te da error al intentar iniciar sesión.')) {
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

// 3. Scan Link
btnScanSubmit.addEventListener('click', async () => {
    const link = channelLink.value;
    if (!link) return;
    
    scanError.style.display = 'block';
    scanError.textContent = 'Escaneando enlace, por favor espera...';
    scanError.style.backgroundColor = '#fff4ce';
    scanError.style.color = '#795548';
    
    try {
        const res = await fetch(`${API_BASE}/scan`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ link })
        });
        const data = await res.json();
        
        if (data.success) {
            allScannedVideos = data.videos || [];
            applyFormatFilter();
            if (allScannedVideos.length === 0) {
                scanError.style.display = 'block';
                scanError.textContent = 'No se encontraron archivos en este enlace. Si es un canal privado o con temas/hilos, asegúrate de estar unido o ingresar el enlace directo.';
                scanError.style.backgroundColor = '#fff4ce';
                scanError.style.color = '#795548';
            } else {
                scanError.style.display = 'none';
            }
        } else {
            scanError.textContent = 'Error: ' + data.error;
            scanError.style.backgroundColor = '#fde7e9';
            scanError.style.color = '#a80000';
        }
    } catch (e) {
        scanError.textContent = 'Error de red';
    }
});

// Permitir Enter en el input
channelLink.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        btnScanSubmit.click();
    }
});

let sortConfig = { key: null, direction: 'asc' };

// 4. Table Logic
function renderTable() {
    tableBody.innerHTML = '';
    
    if(currentVideos.length === 0) {
        if (allScannedVideos.length > 0) {
            tableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #6b7280; padding: 25px 20px;">
                <i class="fa-solid fa-filter-circle-xmark" style="font-size: 22px; color: #0078d4; margin-bottom: 8px; display: block;"></i>
                Se encontraron ${allScannedVideos.length} archivos en el canal, pero ninguno coincide con los formatos activos seleccionados.<br>
                <button type="button" class="btn primary-btn" id="btnOpenModalFromEmpty" style="margin-top: 10px; font-size: 11px;">
                    <i class="fa-solid fa-pen-to-square"></i> Editar formatos permitidos
                </button>
            </td></tr>`;
            const btnOpenEmpty = document.getElementById('btnOpenModalFromEmpty');
            if (btnOpenEmpty) {
                btnOpenEmpty.addEventListener('click', openFormatsModal);
            }
        } else {
            tableBody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #6b7280; padding: 20px;">No se encontraron archivos en este enlace.</td></tr>';
        }
        return;
    }
    
    currentVideos.forEach((v, displayIdx) => {
        const oIdx = v.original_idx;
        const state = itemStates[oIdx] || 'idle';
        const tr = document.createElement('tr');
        tr.id = `row-${oIdx}`;
        const fechaFmt = v.fecha ? formatFecha(v.fecha) : '-';
        tr.innerHTML = `
            <td><input type="checkbox" class="row-check" data-id="${oIdx}"></td>
            <td title="${v.nombre}">${v.nombre}</td>
            <td>${v.tamanio_fmt}</td>
            <td title="${v.fecha || ''}" style="font-size: 11px; white-space: nowrap;">${fechaFmt}</td>
            <td id="comp-${oIdx}">0 B</td>
            <td>
                <div class="progress-bar-cell">
                    <div class="progress-bar-fill" id="perc-fill-${oIdx}"></div>
                    <div class="progress-bar-text" id="perc-text-${oIdx}">0%</div>
                </div>
            </td>
            <td id="spd-${oIdx}">-</td>
            <td style="text-align: center;">
                <div style="display: inline-flex; gap: 4px; align-items: center; justify-content: center;">
                    <button type="button" class="row-action-btn" id="btn-toggle-${oIdx}" onclick="handleToggleItem(event, ${oIdx})" title="Iniciar / Pausar / Reanudar">
                        <i class="fa-solid fa-play"></i>
                    </button>
                    <button type="button" class="row-action-btn btn-danger" id="btn-stop-${oIdx}" onclick="handleStopItem(event, ${oIdx})" title="Detener" style="display: none;">
                        <i class="fa-solid fa-stop"></i>
                    </button>
                </div>
            </td>
        `;
        
        tr.addEventListener('click', (e) => {
            if (e.target.closest('.row-action-btn') || e.target.type === 'checkbox') return;
            const cb = tr.querySelector('.row-check');
            cb.checked = !cb.checked;
            updateSelection();
        });

        tr.addEventListener('dblclick', (e) => {
            if (itemStates[oIdx] === 'done') {
                handleOpenFolder(e, oIdx);
            }
        });
        
        tableBody.appendChild(tr);
        updateRowUI(oIdx, state);
    });
}

// Sorting logic
function sortData(key) {
    if (sortConfig.key === key) {
        sortConfig.direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
    } else {
        sortConfig.key = key;
        sortConfig.direction = 'asc';
    }
    
    currentVideos.sort((a, b) => {
        let valA = a[key];
        let valB = b[key];
        
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });
    
    updateSortIcons();
    renderTable();
    updateSelection();
}

function updateSortIcons() {
    const iconName = document.querySelector('#sortName i');
    const iconSize = document.querySelector('#sortSize i');
    const iconFecha = document.querySelector('#sortFecha i');
    
    iconName.className = 'fa-solid fa-sort';
    iconSize.className = 'fa-solid fa-sort';
    if (iconFecha) iconFecha.className = 'fa-solid fa-sort';
    
    const iconMap = { 'nombre': iconName, 'tamanio': iconSize, 'fecha': iconFecha };
    const activeIcon = iconMap[sortConfig.key] || null;
    if (activeIcon) {
        activeIcon.className = sortConfig.direction === 'asc' ? 'fa-solid fa-sort-up' : 'fa-solid fa-sort-down';
    }
}

document.getElementById('sortName').addEventListener('click', () => sortData('nombre'));
document.getElementById('sortSize').addEventListener('click', () => sortData('tamanio'));
document.getElementById('sortFecha').addEventListener('click', () => sortData('fecha'));

function updateSelection() {
    let count = 0;
    let totalBytesSelected = 0;
    const checks = document.querySelectorAll('.row-check');
    let lastSelectedName = "-";

    const videoMap = {};
    const sourceList = allScannedVideos.length > 0 ? allScannedVideos : currentVideos;
    sourceList.forEach(v => {
        videoMap[v.original_idx] = v;
    });

    checks.forEach((cb) => {
        const oIdx = parseInt(cb.dataset.id);
        const tr = document.getElementById(`row-${oIdx}`);
        if (cb.checked) {
            if (tr) tr.classList.add('selected');
            count++;
            const v = videoMap[oIdx];
            if (v) {
                totalBytesSelected += (v.tamanio || 0);
                lastSelectedName = v.nombre;
            }
        } else {
            if (tr) tr.classList.remove('selected');
        }
    });
    
    btnDownload.disabled = count === 0;
    statusSelection.textContent = `${count} elementos seleccionados`;
    if (statusTotalSize) {
        statusTotalSize.textContent = `Tamaño total: ${formatBytes(totalBytesSelected)}`;
    }

    if (count === 1) {
        infoName.textContent = lastSelectedName;
    } else if (count > 1) {
        infoName.textContent = "(Múltiples archivos seleccionados)";
    } else {
        infoName.textContent = "Esperando selección...";
    }
}

selectAll.addEventListener('change', (e) => {
    document.querySelectorAll('.row-check').forEach(cb => cb.checked = e.target.checked);
    updateSelection();
});

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

let pickerCurrentPath = '';
let pickerParentPath = null;

async function openFolderPicker(initialPath = '') {
    if (!folderPickerModal) return;
    folderPickerModal.style.display = 'flex';
    const startPath = initialPath || (customDirInput ? customDirInput.value.trim() : '');
    await loadDirectory(startPath);
}

function closeFolderPicker() {
    if (folderPickerModal) folderPickerModal.style.display = 'none';
}

async function loadDirectory(targetPath = '') {
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

        // Renderizar unidades de disco (C:\, D:\)
        if (folderDrives && data.drives) {
            folderDrives.innerHTML = '';
            data.drives.forEach(drv => {
                const btn = document.createElement('button');
                btn.type = 'button';
                const isCurrentDrive = data.current.toLowerCase().startsWith(drv.toLowerCase());
                btn.className = `folder-drive-btn ${isCurrentDrive ? 'active' : ''}`;
                btn.textContent = drv.replace('\\', '');
                btn.addEventListener('click', () => loadDirectory(drv));
                folderDrives.appendChild(btn);
            });
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
                    const sep = pickerCurrentPath.endsWith('\\') ? '' : '\\';
                    const nextPath = pickerCurrentPath + sep + sub;
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
        if (pickerCurrentPath && customDirInput) {
            customDirInput.value = pickerCurrentPath;
            localStorage.setItem('telegram_download_dir', pickerCurrentPath);
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
                if (customDirInput) {
                    customDirInput.value = data.path;
                }
                localStorage.setItem('telegram_download_dir', data.path);
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

function openFormatsModal() {
    tempActiveFormats = [...activeFormats];
    tempAcceptAll = acceptAllFormats;
    if (chkAcceptAllFormats) {
        chkAcceptAllFormats.checked = tempAcceptAll;
    }
    updateModalSectionVisibility();
    renderFormatTags();
    if (inputNewExtension) inputNewExtension.value = '';
    if (formatsModal) formatsModal.style.display = 'flex';
}

function closeFormatsModal() {
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
        acceptAllFormats = chkAcceptAllFormats ? chkAcceptAllFormats.checked : false;
        activeFormats = [...tempActiveFormats];
        
        localStorage.setItem('telegram_accept_all_formats', acceptAllFormats ? 'true' : 'false');
        localStorage.setItem('telegram_custom_formats', JSON.stringify(activeFormats));
        
        closeFormatsModal();
        applyFormatFilter();
    });
}

// Inicializar texto de formatos en barra inferior
updateFormatsSummaryUI();

// 5. Downloading and Controls
btnDownload.addEventListener('click', async () => {
    const selectedIds = Array.from(document.querySelectorAll('.row-check:checked')).map(cb => parseInt(cb.dataset.id));
    if (selectedIds.length === 0) return;
    
    const customDir = customDirInput ? customDirInput.value.trim() : '';
    const includeDate = chkIncludeDate ? chkIncludeDate.checked : false;
    
    selectedIds.forEach(idx => {
        itemStates[idx] = 'pending';
        updateRowUI(idx, 'pending');
    });
    setGlobalButtonsState('downloading');
    
    connectWebSocket();
    
    await fetch(`${API_BASE}/download`, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ indices: selectedIds, custom_dir: customDir, include_date: includeDate })
    });
});

if (btnPauseAll) {
    btnPauseAll.addEventListener('click', async () => {
        await fetch(`${API_BASE}/download/pause`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ index: 'all' })
        });
        setGlobalButtonsState('paused');
    });
}

if (btnResumeAll) {
    btnResumeAll.addEventListener('click', async () => {
        await fetch(`${API_BASE}/download/resume`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ index: 'all' })
        });
        setGlobalButtonsState('downloading');
    });
}

if (btnStopAll) {
    btnStopAll.addEventListener('click', async () => {
        await fetch(`${API_BASE}/download/stop`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ index: 'all' })
        });
        setGlobalButtonsState('stopped');
    });
}

window.handleToggleItem = async function(event, idx) {
    if (event) event.stopPropagation();
    const state = itemStates[idx] || 'idle';
    
    if (state === 'downloading') {
        await fetch(`${API_BASE}/download/pause`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ index: idx })
        });
    } else if (state === 'paused') {
        await fetch(`${API_BASE}/download/resume`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ index: idx })
        });
    } else {
        const customDir = customDirInput ? customDirInput.value.trim() : '';
        const includeDate = chkIncludeDate ? chkIncludeDate.checked : false;
        itemStates[idx] = 'pending';
        updateRowUI(idx, 'pending');
        setGlobalButtonsState('downloading');
        connectWebSocket();
        await fetch(`${API_BASE}/download`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ indices: [idx], custom_dir: customDir, include_date: includeDate })
        });
    }
};

window.handleStopItem = async function(event, idx) {
    if (event) event.stopPropagation();
    await fetch(`${API_BASE}/download/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index: idx })
    });
};

// handleOpenFolder removed

function updateRowUI(idx, state) {
    const btnToggle = document.getElementById(`btn-toggle-${idx}`);
    const btnStop = document.getElementById(`btn-stop-${idx}`);
    const percFill = document.getElementById(`perc-fill-${idx}`);
    const percText = document.getElementById(`perc-text-${idx}`);
    const spdEl = document.getElementById(`spd-${idx}`);

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
        if (percText && percText.textContent !== '100%') percText.textContent = 'Detenido';
        if (percFill) percFill.style.backgroundColor = '#d92d20';
    } else if (state === 'done') {
        btnToggle.style.display = 'none';
        if (btnStop) btnStop.style.display = 'none';
        if (spdEl) spdEl.textContent = '-';
        if (percText) percText.textContent = 'Completado';
        if (percFill) {
            percFill.style.width = '100%';
            percFill.style.backgroundColor = '#107c10';
        }
    } else {
        // idle
        btnToggle.innerHTML = '<i class="fa-solid fa-play" style="color: #0078d7;"></i>';
        btnToggle.title = 'Descargar este archivo';
        btnToggle.style.display = 'inline-flex';
        if (btnStop) btnStop.style.display = 'none';
    }
}

function setGlobalButtonsState(state) {
    if (!btnPauseAll || !btnResumeAll || !btnStopAll) return;
    
    if (state === 'downloading') {
        btnPauseAll.style.display = 'inline-flex';
        btnPauseAll.disabled = false;
        btnResumeAll.style.display = 'none';
        btnStopAll.style.display = 'inline-flex';
        btnStopAll.disabled = false;
        btnDownload.disabled = true;
    } else if (state === 'paused') {
        btnPauseAll.style.display = 'none';
        btnResumeAll.style.display = 'inline-flex';
        btnResumeAll.disabled = false;
        btnStopAll.style.display = 'inline-flex';
        btnStopAll.disabled = false;
        btnDownload.disabled = true;
        statusSpeed.textContent = 'D: 0 MB/s (Pausado)';
    } else if (state === 'stopped' || state === 'idle') {
        btnPauseAll.style.display = 'none';
        btnResumeAll.style.display = 'none';
        btnStopAll.style.display = 'none';
        btnDownload.disabled = false;
        updateSelection();
        statusSpeed.textContent = 'D: 0 MB/s';
    }
}

function connectWebSocket() {
    if (ws) ws.close();
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'qr_update') {
            onQrTokenReceived(data.token_url, data.expires);
        } else if (data.type === 'qr_success') {
            onQrLoginSuccess(data.user);
        } else if (data.type === 'qr_needs_password') {
            onQrNeedsPassword();
        } else if (data.type === 'qr_expired') {
            onQrExpired();
        } else if (data.type === 'qr_error') {
            onQrError(data.error);
        } else if (data.type === 'scan_progress') {
            const scanError = document.getElementById('scanError');
            if (scanError) {
                scanError.style.display = 'block';
                scanError.textContent = `Escaneando... (Revisados ${data.scanned} mensajes, ${data.found} archivos encontrados)`;
                scanError.style.backgroundColor = '#e8f0fe';
                scanError.style.color = '#1a73e8';
            }
        } else if (data.type === 'start') {
            infoName.textContent = `Descargando: ${data.filename}`;
            itemStates[data.index] = 'downloading';
            updateRowUI(data.index, 'downloading');
            setGlobalButtonsState('downloading');
        } else if (data.type === 'progress') {
            const idx = data.index;
            const percent = ((data.downloaded / data.total_size) * 100).toFixed(1);
            
            const compEl = document.getElementById(`comp-${idx}`);
            const percFill = document.getElementById(`perc-fill-${idx}`);
            const percText = document.getElementById(`perc-text-${idx}`);
            const spdEl = document.getElementById(`spd-${idx}`);

            if (compEl) compEl.textContent = formatBytes(data.downloaded);
            if (percFill) percFill.style.width = `${percent}%`;
            if (percText) percText.textContent = `${percent}%`;
            
            if (data.state === 'paused') {
                if (spdEl) spdEl.textContent = 'Pausado';
                updateRowUI(idx, 'paused');
            } else {
                if (spdEl) spdEl.textContent = `${data.speed_mbps} MB/s`;
                statusSpeed.textContent = `D: ${data.speed_mbps} MB/s`;
                updateRowUI(idx, 'downloading');
            }
        } else if (data.type === 'status_change') {
            itemStates[data.index] = data.state;
            if (data.file_path) itemFilePaths[data.index] = data.file_path;
            updateRowUI(data.index, data.state);
        } else if (data.type === 'global_status') {
            setGlobalButtonsState(data.state);
        } else if (data.type === 'done') {
            const idx = data.index;
            itemStates[idx] = 'done';
            if (data.file_path) itemFilePaths[idx] = data.file_path;
            updateRowUI(idx, 'done');
        } else if (data.type === 'finish_all') {
            infoName.textContent = "Descargas finalizadas.";
            setGlobalButtonsState('idle');
        }
    };
}

function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 B';
    const k = 1024, sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

const searchInput = document.getElementById('searchInput');
if (searchInput) {
    searchInput.addEventListener('input', applyFormatFilter);
}

checkStatus();
