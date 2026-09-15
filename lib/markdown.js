/**
 * Markdown utilities: C-style unescape and CommonMark strip to plain text.
 */

const PUNCT_RE = /[!"#$%&'()*+,\-./:;<=>?@\[\\\]^_`{|}~]/;

function unescapeC(text) {
    const s = String(text == null ? '' : text);
    let out = '';
    for (let i = 0; i < s.length; i++) {
        if (s[i] !== '\\' || i === s.length - 1) {
            out += s[i];
            continue;
        }
        const n = s[i + 1];
        if (n >= '0' && n <= '7') {
            let oct = n;
            let j = i + 2;
            while (oct.length < 3 && j < s.length && s[j] >= '0' && s[j] <= '7') {
                oct += s[j];
                j++;
            }
            out += String.fromCharCode(parseInt(oct, 8) & 0xff);
            i = j - 1;
            continue;
        }
        if (n === 'x') {
            let hex = '';
            let hx = i + 2;
            while (hx < s.length && hex.length < 2 && /[0-9a-fA-F]/.test(s[hx])) {
                hex += s[hx];
                hx++;
            }
            if (hex) {
                out += String.fromCharCode(parseInt(hex, 16));
                i = hx - 1;
                continue;
            }
        }
        if (n === 'u' && /^[0-9a-fA-F]{4}/.test(s.slice(i + 2))) {
            out += String.fromCharCode(parseInt(s.slice(i + 2, i + 6), 16));
            i += 5;
            continue;
        }
        if (n === 'U' && /^[0-9a-fA-F]{8}/.test(s.slice(i + 2))) {
            const cp = parseInt(s.slice(i + 2, i + 10), 16);
            out += String.fromCodePoint(cp);
            i += 9;
            continue;
        }
        const simple = {
            a: '\x07', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t', v: '\v',
            '\\': '\\', "'": "'", '"': '"', '?': '?'
        };
        if (Object.prototype.hasOwnProperty.call(simple, n)) {
            out += simple[n];
            i++;
            continue;
        }
        out += '\\' + n;
        i++;
    }
    return out;
}

function isFence(line) {
    return line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
}

function isThematic(line) {
    return /^ {0,3}(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})[ \t]*$/.test(line)
        && !/[^ \t\*\-_]/.test(line);
}

function stripInline(s) {
    let text = String(s == null ? '' : s);
    text = text.replace(/(`+)([\s\S]*?)\1/g, (_, _ticks, code) => {
        let c = code;
        if (c.length >= 2 && c[0] === ' ' && c[c.length - 1] === ' ') c = c.slice(1, -1);
        return c;
    });
    text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
    text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
    text = text.replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1');
    text = text.replace(/<((?:https?:\/\/|mailto:)[^>]+)>/gi, '$1');
    text = text.replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, '$2');
    text = text.replace(/(\*|_)(?=\S)([\s\S]*?\S)\1/g, '$2');
    text = text.replace(new RegExp('\\\\(' + PUNCT_RE.source + ')', 'g'), '$1');
    return text;
}

/**
 * Unescape C sequences, then strip CommonMark syntax, leaving readable plain text.
 * @param {string} text
 * @returns {string}
 */
function stripMarkdown(text) {
    if (text == null) return '';
    const s = unescapeC(String(text)).replace(/\r\n?/g, '\n');
    const lines = s.split('\n');
    const out = [];
    let i = 0;
    while (i < lines.length) {
        const fence = isFence(lines[i]);
        if (fence) {
            const marker = fence[1][0];
            const len = fence[1].length;
            i++;
            while (i < lines.length) {
                const close = lines[i].match(/^ {0,3}(`{3,}|~{3,})[ \t]*$/);
                if (close && close[1][0] === marker && close[1].length >= len) {
                    i++;
                    break;
                }
                out.push(lines[i]);
                i++;
            }
            continue;
        }
        let line = lines[i];
        if (isThematic(line)) {
            i++;
            continue;
        }
        line = line.replace(/^ {0,3}#{1,6}[ \t]+/, '');
        line = line.replace(/[ \t]+#+\s*$/, '');
        line = line.replace(/^ {0,3}>[ \t]?/, '');
        line = line.replace(/^ {0,3}(?:[*+-]|\d+[.)])[ \t]+/, '');
        line = line.replace(/^(?: {4}|\t)/, '');
        if (/^ {0,3}(?:=+|-+)[ \t]*$/.test(line)) {
            i++;
            continue;
        }
        out.push(stripInline(line));
        i++;
    }
    return out.join('\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Strip markdown from a resolved question's prompt, answers, and correct answer.
 * Used before exporting to platforms that do not render markdown.
 * @param {object} q
 * @returns {object}
 */
function stripQuestionMarkdown(q) {
    if (!q || typeof q !== 'object') return q;
    const stripped = Object.assign({}, q);
    if (q.prompt != null) stripped.prompt = stripMarkdown(q.prompt);
    if (q.correctAnswer != null) stripped.correctAnswer = stripMarkdown(q.correctAnswer);
    if (q.correct_answer != null) stripped.correct_answer = stripMarkdown(q.correct_answer);
    if (Array.isArray(q.answers)) stripped.answers = q.answers.map((a) => stripMarkdown(a));
    return stripped;
}

module.exports = {
    unescapeC,
    stripMarkdown,
    stripQuestionMarkdown
};
