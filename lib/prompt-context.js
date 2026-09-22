const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { get, all, run } = require('./db');
const config = require('./config');
const { getExtension, countWords } = require('./prompt-file-text');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'generation-prompts');
const ONE_HOUR_MS = 60 * 60 * 1000;

function ensureUploadDir() {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function normalizePromptText(text) {
    return String(text || '').trim().replace(/\r\n/g, '\n');
}

function sha256Hex(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
}

function hashBuffer(buffer) {
    return sha256Hex(buffer);
}

function comboContentHash(promptText, fileContentHashes) {
    const normalized = normalizePromptText(promptText);
    const sorted = (fileContentHashes || []).slice().map(String).sort();
    return sha256Hex(normalized + '\0' + sorted.join('\0'));
}

function storedBinaryName(contentHash, originalName) {
    const ext = getExtension(originalName) || '';
    return contentHash + ext;
}

function textSidecarPath(contentHash) {
    return path.join(UPLOAD_DIR, contentHash + '.txt');
}

function binaryPath(storedName) {
    return path.join(UPLOAD_DIR, storedName);
}

/**
 * Persist uploaded bytes + extracted text sidecars on disk (content-addressed).
 */
function writeUploadedFile({ buffer, contentHash, originalName, extractedText }) {
    ensureUploadDir();
    const storedName = storedBinaryName(contentHash, originalName);
    const binPath = binaryPath(storedName);
    if (!fs.existsSync(binPath)) {
        fs.writeFileSync(binPath, buffer);
    } else {
        try { fs.utimesSync(binPath, new Date(), new Date()); } catch (_) { /* ignore */ }
    }
    fs.writeFileSync(textSidecarPath(contentHash), String(extractedText || ''), 'utf8');
    return storedName;
}

function readExtractedText(contentHash) {
    const p = textSidecarPath(contentHash);
    if (!fs.existsSync(p)) return '';
    return fs.readFileSync(p, 'utf8');
}

function formatBytes(n) {
    const bytes = Number(n) || 0;
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function validateComboLimits({ promptText, files }) {
    const fileList = Array.isArray(files) ? files : [];
    if (fileList.length > config.promptFilesMaxCount) {
        return { ok: false, error: 'Too many files (max ' + config.promptFilesMaxCount + ').' };
    }
    let totalBytes = 0;
    let fileWords = 0;
    for (const f of fileList) {
        const bytes = Number(f.byteSize) || 0;
        if (bytes > config.promptFileMaxBytes) {
            return {
                ok: false,
                error: (f.originalName || 'File') + ' exceeds the ' + formatBytes(config.promptFileMaxBytes) + ' per-file size limit.'
            };
        }
        totalBytes += bytes;
        fileWords += Number(f.wordCount) || 0;
    }
    if (totalBytes > config.promptFilesTotalMaxBytes) {
        return {
            ok: false,
            error: 'Total file size exceeds the ' + formatBytes(config.promptFilesTotalMaxBytes) + ' limit.'
        };
    }
    const textWords = countWords(promptText);
    if (textWords + fileWords > config.promptContextMaxWords) {
        return {
            ok: false,
            error: 'Total word count exceeds limit of ' + config.promptContextMaxWords + ' words.'
        };
    }
    return { ok: true, textWords, fileWords, totalBytes };
}

/**
 * Upsert a prompt combo. Empty text + no files → returns null (nothing saved).
 * @param {{ courseId, userId, promptText, files, pin }}
 * files: [{ contentHash, originalName, storedName?, mimeType, byteSize, wordCount }]
 */
async function upsertGenerationPrompt({ courseId, userId, promptText, files, pin }) {
    const text = normalizePromptText(promptText);
    const fileList = Array.isArray(files) ? files : [];
    if (!text && fileList.length === 0) return null;

    const hashes = fileList.map(f => f.contentHash);
    const contentHash = comboContentHash(text, hashes);
    const now = new Date().toISOString();

    const existing = await get(
        'SELECT id, pinned FROM generation_prompts WHERE course_id = ? AND content_hash = ?',
        [courseId, contentHash]
    );

    if (existing) {
        const nextPinned = pin ? 1 : (existing.pinned ? 1 : 0);
        await run(
            'UPDATE generation_prompts SET last_used_at = ?, pinned = ?, user_id = ? WHERE id = ?',
            [now, nextPinned, userId, existing.id]
        );
        return { id: existing.id, contentHash, created: false, pinned: !!nextPinned };
    }

    const result = await run(
        `INSERT INTO generation_prompts (course_id, user_id, prompt_text, content_hash, pinned, last_used_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [courseId, userId, text, contentHash, pin ? 1 : 0, now, now]
    );
    const promptId = result.lastID;

    for (const f of fileList) {
        const storedName = f.storedName || storedBinaryName(f.contentHash, f.originalName);
        await run(
            `INSERT INTO generation_prompt_files
             (prompt_id, original_name, stored_name, mime_type, byte_size, word_count, content_hash)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                promptId,
                f.originalName || storedName,
                storedName,
                f.mimeType || null,
                Number(f.byteSize) || 0,
                Number(f.wordCount) || 0,
                f.contentHash
            ]
        );
    }

    return { id: promptId, contentHash, created: true, pinned: !!pin };
}

async function touchPrompt(promptId) {
    const now = new Date().toISOString();
    await run('UPDATE generation_prompts SET last_used_at = ? WHERE id = ?', [now, promptId]);
}

/**
 * Build additionalContext string for the question generator from text + file extracts.
 * Truncates file text to remaining word budget.
 */
function buildAdditionalContext(promptText, files) {
    const text = normalizePromptText(promptText);
    const fileList = Array.isArray(files) ? files : [];
    const maxWords = config.promptContextMaxWords;
    let remaining = maxWords - countWords(text);
    if (remaining < 0) remaining = 0;

    const fileBlocks = [];
    for (const f of fileList) {
        if (remaining <= 0) break;
        let extracted = readExtractedText(f.contentHash);
        if (!extracted) continue;
        const words = extracted.trim().split(/\s+/).filter(Boolean);
        if (words.length > remaining) {
            extracted = words.slice(0, remaining).join(' ');
            remaining = 0;
        } else {
            remaining -= words.length;
        }
        const name = f.originalName || f.contentHash;
        fileBlocks.push('--- File: ' + name + ' ---\n' + extracted);
    }

    let out = '';
    if (text) out += text;
    if (fileBlocks.length) {
        if (out) out += '\n\n';
        out += 'FILE CONTEXT (use as source material / constraints):\n' + fileBlocks.join('\n\n');
    }
    return out || undefined;
}

function listReferencedStoredNames(rows) {
    const set = new Set();
    for (const r of rows || []) {
        if (r.stored_name) set.add(r.stored_name);
        if (r.content_hash) set.add(r.content_hash + '.txt');
    }
    return set;
}

/**
 * Delete prompts unused for more than one hour; remove orphaned disk files older than one hour.
 */
async function cleanupUnusedGenerationPrompts() {
    ensureUploadDir();
    const cutoff = new Date(Date.now() - ONE_HOUR_MS).toISOString();

    const stale = await all(
        'SELECT id FROM generation_prompts WHERE last_used_at < ? OR last_used_at IS NULL',
        [cutoff]
    );
    for (const row of stale) {
        await run('DELETE FROM generation_prompt_files WHERE prompt_id = ?', [row.id]);
        await run('DELETE FROM generation_prompts WHERE id = ?', [row.id]);
    }

    const referenced = await all('SELECT stored_name, content_hash FROM generation_prompt_files');
    const keep = listReferencedStoredNames(referenced);
    const now = Date.now();

    let entries = [];
    try {
        entries = fs.readdirSync(UPLOAD_DIR);
    } catch (_) {
        return { deletedPrompts: stale.length, deletedFiles: 0 };
    }

    let deletedFiles = 0;
    for (const name of entries) {
        if (keep.has(name)) continue;
        const full = path.join(UPLOAD_DIR, name);
        let stat;
        try {
            stat = fs.statSync(full);
        } catch (_) {
            continue;
        }
        if (!stat.isFile()) continue;
        if (now - stat.mtimeMs < ONE_HOUR_MS) continue;
        try {
            fs.unlinkSync(full);
            deletedFiles += 1;
        } catch (_) { /* ignore */ }
    }

    return { deletedPrompts: stale.length, deletedFiles };
}

module.exports = {
    UPLOAD_DIR,
    ensureUploadDir,
    normalizePromptText,
    hashBuffer,
    comboContentHash,
    storedBinaryName,
    writeUploadedFile,
    readExtractedText,
    formatBytes,
    validateComboLimits,
    upsertGenerationPrompt,
    touchPrompt,
    buildAdditionalContext,
    cleanupUnusedGenerationPrompts,
    countWords
};
