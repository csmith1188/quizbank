/**
 * CommonMark parser with C-style escape sequences.
 * Use: Markdown.parse(text), Markdown.parseInline(text), Markdown.strip(text)
 * Markup: elements with data-markdown (block) or data-markdown="inline".
 */
(function (root) {
    'use strict';

    var PUNCT_RE = /[!"#$%&'()*+,\-./:;<=>?@\[\\\]^_`{|}~]/;

    function unescapeC(str) {
        var s = String(str == null ? '' : str);
        var out = '';
        for (var i = 0; i < s.length; i++) {
            if (s.charAt(i) !== '\\' || i === s.length - 1) {
                out += s.charAt(i);
                continue;
            }
            var n = s.charAt(i + 1);
            if (n >= '0' && n <= '7') {
                var oct = n;
                var j = i + 2;
                while (oct.length < 3 && j < s.length && s.charAt(j) >= '0' && s.charAt(j) <= '7') {
                    oct += s.charAt(j);
                    j++;
                }
                out += String.fromCharCode(parseInt(oct, 8) & 0xff);
                i = j - 1;
                continue;
            }
            if (n === 'x') {
                var hex = '';
                var hx = i + 2;
                while (hx < s.length && hex.length < 2 && /[0-9a-fA-F]/.test(s.charAt(hx))) {
                    hex += s.charAt(hx);
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
                var cp = parseInt(s.slice(i + 2, i + 10), 16);
                out += String.fromCodePoint ? String.fromCodePoint(cp) : String.fromCharCode(cp);
                i += 9;
                continue;
            }
            var simple = {
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

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function isWs(ch) {
        return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f' || ch === '\v' || ch === '';
    }

    function isPunct(ch) {
        return PUNCT_RE.test(ch);
    }

    function sanitizeUrl(url) {
        var u = String(url || '').trim();
        if (!u) return '';
        var check = u;
        try { check = decodeURIComponent(u.replace(/\s+/g, '')); } catch (e) { /* keep original */ }
        var lower = check.toLowerCase();
        if (/^(javascript|vbscript|file):/.test(lower)) return '';
        if (/^data:/i.test(lower) && !/^data:image\//i.test(lower)) return '';
        return u;
    }

    function countRun(src, i, ch) {
        var n = 0;
        while (i + n < src.length && src.charAt(i + n) === ch) n++;
        return n;
    }

    function flanking(src, i, delim) {
        var len = countRun(src, i, delim);
        var before = i === 0 ? '\n' : src.charAt(i - 1);
        var after = i + len >= src.length ? '\n' : src.charAt(i + len);
        var afterWs = isWs(after);
        var afterP = isPunct(after);
        var beforeWs = isWs(before);
        var beforeP = isPunct(before);
        var left = !afterWs && (!afterP || beforeWs || beforeP);
        var right = !beforeWs && (!beforeP || afterWs || afterP);
        return { len: len, left: left, right: right };
    }

    function parseInline(src) {
        src = String(src == null ? '' : src);
        var out = '';
        var i = 0;
        while (i < src.length) {
            var ch = src.charAt(i);

            if (ch === '\\' && i + 1 < src.length) {
                var next = src.charAt(i + 1);
                if (next === '\n') {
                    out += '<br>\n';
                    i += 2;
                    continue;
                }
                if (isPunct(next)) {
                    out += escapeHtml(next);
                    i += 2;
                    continue;
                }
            }

            if (ch === '`') {
                var tickLen = countRun(src, i, '`');
                var search = i + tickLen;
                var close = -1;
                while (search < src.length) {
                    if (src.charAt(search) === '`') {
                        var clen = countRun(src, search, '`');
                        if (clen === tickLen) {
                            close = search;
                            break;
                        }
                        search += clen;
                    } else {
                        search++;
                    }
                }
                if (close !== -1) {
                    var code = src.slice(i + tickLen, close);
                    if (code.length >= 2 && code.charAt(0) === ' ' && code.charAt(code.length - 1) === ' ') {
                        code = code.slice(1, -1);
                    }
                    out += '<code>' + escapeHtml(code) + '</code>';
                    i = close + tickLen;
                    continue;
                }
            }

            if (ch === '!' && src.charAt(i + 1) === '[') {
                var img = parseLinkLike(src, i + 1, true);
                if (img) {
                    out += img.html;
                    i = img.end;
                    continue;
                }
            }

            if (ch === '[') {
                var link = parseLinkLike(src, i, false);
                if (link) {
                    out += link.html;
                    i = link.end;
                    continue;
                }
            }

            if (ch === '<') {
                var auto = src.slice(i).match(/^<((?:https?:\/\/|mailto:)[^>\s]+)>/i);
                if (auto) {
                    var href = sanitizeUrl(auto[1]);
                    if (href) {
                        out += '<a href="' + escapeHtml(href) + '">' + escapeHtml(auto[1]) + '</a>';
                        i += auto[0].length;
                        continue;
                    }
                }
                var email = src.slice(i).match(/^<([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>/);
                if (email) {
                    out += '<a href="mailto:' + escapeHtml(email[1]) + '">' + escapeHtml(email[1]) + '</a>';
                    i += email[0].length;
                    continue;
                }
            }

            if (ch === '*' || ch === '_') {
                var em = parseEmphasis(src, i);
                if (em) {
                    out += em.html;
                    i = em.end;
                    continue;
                }
            }

            if (ch === '\n') {
                var hard = i >= 2 && src.charAt(i - 1) === ' ' && src.charAt(i - 2) === ' ';
                if (hard) {
                    if (out.slice(-2) === '  ') out = out.slice(0, -2);
                    else if (out.slice(-6) === '&nbsp;') out = out.slice(0, -6);
                    out += '<br>\n';
                } else {
                    out += '\n';
                }
                i++;
                continue;
            }

            out += escapeHtml(ch);
            i++;
        }
        return out;
    }

    function parseLinkLike(src, i, isImage) {
        if (src.charAt(i) !== '[') return null;
        var depth = 1;
        var j = i + 1;
        while (j < src.length) {
            if (src.charAt(j) === '\\') {
                j += 2;
                continue;
            }
            if (src.charAt(j) === '[') depth++;
            else if (src.charAt(j) === ']') {
                depth--;
                if (depth === 0) break;
            }
            j++;
        }
        if (depth !== 0 || src.charAt(j) !== ']') return null;
        var label = src.slice(i + 1, j);
        if (src.charAt(j + 1) !== '(') return null;
        var k = j + 2;
        while (k < src.length && (src.charAt(k) === ' ' || src.charAt(k) === '\n')) k++;
        var dest = '';
        if (src.charAt(k) === '<') {
            k++;
            while (k < src.length && src.charAt(k) !== '>') {
                dest += src.charAt(k);
                k++;
            }
            if (src.charAt(k) !== '>') return null;
            k++;
        } else {
            var ddepth = 0;
            while (k < src.length) {
                var c = src.charAt(k);
                if (c === '\\') {
                    dest += src.charAt(k + 1) || '';
                    k += 2;
                    continue;
                }
                if (c === '(') ddepth++;
                if (c === ')') {
                    if (ddepth === 0) break;
                    ddepth--;
                }
                if ((c === ' ' || c === '\n') && ddepth === 0) break;
                dest += c;
                k++;
            }
        }
        while (k < src.length && (src.charAt(k) === ' ' || src.charAt(k) === '\n')) k++;
        if (src.charAt(k) === '"' || src.charAt(k) === "'") {
            var q = src.charAt(k);
            k++;
            while (k < src.length && src.charAt(k) !== q) k++;
            if (src.charAt(k) === q) k++;
            while (k < src.length && (src.charAt(k) === ' ' || src.charAt(k) === '\n')) k++;
        }
        if (src.charAt(k) !== ')') return null;
        var url = sanitizeUrl(dest);
        var inner = parseInline(label);
        var html;
        if (isImage) {
            html = url
                ? '<img src="' + escapeHtml(url) + '" alt="' + escapeHtml(label) + '">'
                : escapeHtml(label);
        } else {
            html = url
                ? '<a href="' + escapeHtml(url) + '">' + inner + '</a>'
                : inner;
        }
        return { html: html, end: k + 1 };
    }

    function parseEmphasis(src, i) {
        var delim = src.charAt(i);
        var info = flanking(src, i, delim);
        if (!info.left || info.len === 0) return null;
        var openerLen = info.len >= 2 ? 2 : 1;
        var j = i + openerLen;
        while (j < src.length) {
            if (src.charAt(j) === '`') {
                var ticks = countRun(src, j, '`');
                var seek = j + ticks;
                var found = false;
                while (seek < src.length) {
                    if (src.charAt(seek) === '`') {
                        var cl = countRun(src, seek, '`');
                        if (cl === ticks) {
                            j = seek + cl;
                            found = true;
                            break;
                        }
                        seek += cl;
                    } else seek++;
                }
                if (!found) j++;
                continue;
            }
            if (src.charAt(j) === delim) {
                var close = flanking(src, j, delim);
                if (close.right && close.len >= openerLen) {
                    var inner = parseInline(src.slice(i + openerLen, j));
                    var tag = openerLen === 2 ? 'strong' : 'em';
                    return { html: '<' + tag + '>' + inner + '</' + tag + '>', end: j + openerLen };
                }
                j += close.len || 1;
                continue;
            }
            j++;
        }
        return null;
    }

    function peekIndent(line) {
        var n = 0;
        var i = 0;
        while (i < line.length) {
            if (line.charAt(i) === ' ') n++;
            else if (line.charAt(i) === '\t') n += 4 - (n % 4);
            else break;
            i++;
        }
        return { spaces: n, rest: line.slice(i) };
    }

    function isBlank(line) {
        return /^\s*$/.test(line);
    }

    function isFence(line) {
        return line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    }

    function isAtx(line) {
        return line.match(/^ {0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*#*[ \t]*$/);
    }

    function isThematic(line) {
        return /^ {0,3}(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})[ \t]*$/.test(line)
            && !/[^ \t\*\-_]/.test(line);
    }

    function isSetext(line) {
        var m = line.match(/^ {0,3}(=+|-+)[ \t]*$/);
        if (!m) return 0;
        return m[1].charAt(0) === '=' ? 1 : 2;
    }

    function isQuote(line) {
        return /^ {0,3}>/.test(line);
    }

    function isList(line) {
        return line.match(/^ {0,3}([*+-]|(\d+)[.)])([ \t]+)(.*)$/);
    }

    function isIndentedCode(line) {
        var ind = peekIndent(line);
        return ind.spaces >= 4 && !isBlank(line);
    }

    function parseBlocks(src) {
        var lines = String(src == null ? '' : src).replace(/\r\n?/g, '\n').split('\n');
        var html = [];
        var i = 0;

        function consumeFence(start) {
            var open = isFence(lines[start]);
            var marker = open[1].charAt(0);
            var len = open[1].length;
            var info = open[2].trim().split(/\s+/)[0] || '';
            var body = [];
            var j = start + 1;
            while (j < lines.length) {
                var close = lines[j].match(/^ {0,3}(`{3,}|~{3,})[ \t]*$/);
                if (close && close[1].charAt(0) === marker && close[1].length >= len) {
                    j++;
                    break;
                }
                body.push(lines[j]);
                j++;
            }
            var cls = info ? ' class="language-' + escapeHtml(info.replace(/[^a-zA-Z0-9_+-]/g, '')) + '"' : '';
            html.push('<pre><code' + cls + '>' + escapeHtml(body.join('\n')) + '</code></pre>');
            return j;
        }

        function consumeQuote(start) {
            var chunk = [];
            var j = start;
            while (j < lines.length) {
                if (isBlank(lines[j])) {
                    if (j + 1 < lines.length && isQuote(lines[j + 1])) {
                        chunk.push('');
                        j++;
                        continue;
                    }
                    break;
                }
                if (!isQuote(lines[j]) && chunk.length && !isBlank(lines[j]) && !isFence(lines[j]) && !isList(lines[j]) && !isAtx(lines[j]) && !isThematic(lines[j])) {
                    chunk.push(lines[j]);
                    j++;
                    continue;
                }
                if (!isQuote(lines[j])) break;
                chunk.push(lines[j].replace(/^ {0,3}>[ \t]?/, ''));
                j++;
            }
            html.push('<blockquote>' + parseBlocks(chunk.join('\n')) + '</blockquote>');
            return j;
        }

        function consumeList(start) {
            var first = isList(lines[start]);
            var ordered = !!first[2];
            var startNum = ordered ? parseInt(first[2], 10) : null;
            var items = [];
            var j = start;
            var itemRe = ordered ? /^ {0,3}\d+[.)]([ \t]+)(.*)$/ : /^ {0,3}[*+-]([ \t]+)(.*)$/;

            while (j < lines.length) {
                var m = lines[j].match(itemRe);
                if (!m) break;
                var itemLines = [m[2]];
                j++;
                while (j < lines.length) {
                    if (isBlank(lines[j])) {
                        if (j + 1 < lines.length && (lines[j + 1].match(itemRe) || peekIndent(lines[j + 1]).spaces >= 2)) {
                            itemLines.push('');
                            j++;
                            continue;
                        }
                        break;
                    }
                    if (lines[j].match(itemRe)) break;
                    var ind = peekIndent(lines[j]);
                    if (ind.spaces >= 2) {
                        itemLines.push(ind.rest);
                        j++;
                        continue;
                    }
                    if (!isAtx(lines[j]) && !isFence(lines[j]) && !isThematic(lines[j]) && !isQuote(lines[j])) {
                        itemLines.push(lines[j]);
                        j++;
                        continue;
                    }
                    break;
                }
                var joined = itemLines.join('\n');
                var inner = parseBlocks(joined);
                if (!inner) inner = parseInline(joined);
                else if (!/\n\s*\n/.test(joined) && inner.indexOf('<p>') === 0 && inner.lastIndexOf('</p>') === inner.length - 4) {
                    inner = inner.slice(3, -4);
                }
                items.push('<li>' + inner + '</li>');
            }
            var tag = ordered ? 'ol' : 'ul';
            var startAttr = ordered && startNum > 1 ? ' start="' + startNum + '"' : '';
            html.push('<' + tag + startAttr + '>' + items.join('') + '</' + tag + '>');
            return j;
        }

        function consumeIndented(start) {
            var body = [];
            var j = start;
            while (j < lines.length) {
                if (isIndentedCode(lines[j])) {
                    body.push(peekIndent(lines[j]).rest ? lines[j].replace(/^(?: {4}|\t)/, '') : '');
                    j++;
                    continue;
                }
                if (isBlank(lines[j]) && j + 1 < lines.length && isIndentedCode(lines[j + 1])) {
                    body.push('');
                    j++;
                    continue;
                }
                break;
            }
            html.push('<pre><code>' + escapeHtml(body.join('\n')) + '</code></pre>');
            return j;
        }

        function consumeParagraph(start) {
            var para = [lines[start]];
            var j = start + 1;
            while (j < lines.length) {
                if (isBlank(lines[j])) break;
                if (isFence(lines[j]) || isAtx(lines[j]) || isThematic(lines[j]) || isQuote(lines[j]) || isList(lines[j])) break;
                var setext = isSetext(lines[j]);
                if (setext && para.length === 1) {
                    html.push('<h' + setext + '>' + parseInline(para[0]) + '</h' + setext + '>');
                    return j + 1;
                }
                para.push(lines[j]);
                j++;
            }
            html.push('<p>' + parseInline(para.join('\n')) + '</p>');
            return j;
        }

        while (i < lines.length) {
            if (isBlank(lines[i])) {
                i++;
                continue;
            }
            if (isFence(lines[i])) {
                i = consumeFence(i);
                continue;
            }
            if (isAtx(lines[i])) {
                var atx = isAtx(lines[i]);
                var level = atx[1].length;
                var text = (atx[2] || '').replace(/[ \t]+#+$/, '').trim();
                html.push('<h' + level + '>' + parseInline(text) + '</h' + level + '>');
                i++;
                continue;
            }
            if (isThematic(lines[i])) {
                html.push('<hr>');
                i++;
                continue;
            }
            if (isQuote(lines[i])) {
                i = consumeQuote(i);
                continue;
            }
            if (isList(lines[i])) {
                i = consumeList(i);
                continue;
            }
            if (isIndentedCode(lines[i])) {
                i = consumeIndented(i);
                continue;
            }
            i = consumeParagraph(i);
        }
        return html.join('');
    }

    function stripInline(s) {
        s = String(s == null ? '' : s);
        s = s.replace(/(`+)([\s\S]*?)\1/g, function (_, _t, code) {
            var c = code;
            if (c.length >= 2 && c.charAt(0) === ' ' && c.charAt(c.length - 1) === ' ') c = c.slice(1, -1);
            return c;
        });
        s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
        s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
        s = s.replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1');
        s = s.replace(/<((?:https?:\/\/|mailto:)[^>]+)>/gi, '$1');
        s = s.replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, '$2');
        s = s.replace(/(\*|_)(?=\S)([\s\S]*?\S)\1/g, '$2');
        s = s.replace(/\\([!"#$%&'()*+,\-./:;<=>?@\[\\\]^_`{|}~])/g, '$1');
        return s;
    }

    function strip(text) {
        if (text == null) return '';
        var s = unescapeC(String(text)).replace(/\r\n?/g, '\n');
        var lines = s.split('\n');
        var out = [];
        var i = 0;
        while (i < lines.length) {
            var fence = isFence(lines[i]);
            if (fence) {
                var marker = fence[1].charAt(0);
                var len = fence[1].length;
                i++;
                while (i < lines.length) {
                    var close = lines[i].match(/^ {0,3}(`{3,}|~{3,})[ \t]*$/);
                    if (close && close[1].charAt(0) === marker && close[1].length >= len) {
                        i++;
                        break;
                    }
                    out.push(lines[i]);
                    i++;
                }
                continue;
            }
            var line = lines[i];
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

    function parse(text, opts) {
        var src = unescapeC(String(text == null ? '' : text));
        if (opts && opts.inline) return parseInline(src);
        return parseBlocks(src);
    }

    function parseInlinePublic(text) {
        return parse(text, { inline: true });
    }

    function render(el, text, opts) {
        if (!el) return;
        el.innerHTML = parse(text, opts);
    }

    function hydrate(root) {
        var scope = root || document;
        if (!scope.querySelectorAll) return;
        var nodes = scope.querySelectorAll('[data-markdown]');
        for (var i = 0; i < nodes.length; i++) {
            var el = nodes[i];
            var mode = el.getAttribute('data-markdown');
            var src = el.getAttribute('data-markdown-src');
            var text = src != null ? src : el.textContent;
            el.innerHTML = parse(text, { inline: mode === 'inline' });
        }
        var strips = scope.querySelectorAll('[data-markdown-strip]');
        for (var j = 0; j < strips.length; j++) {
            var node = strips[j];
            var raw = node.getAttribute('data-markdown-src');
            if (raw == null) raw = node.textContent;
            var max = parseInt(node.getAttribute('data-markdown-strip'), 10);
            var plain = strip(raw);
            if (max > 0 && plain.length > max) plain = plain.substring(0, max) + '...';
            node.textContent = plain;
        }
    }

    function onReady(fn) {
        if (typeof document === 'undefined') return;
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
        else fn();
    }

    var api = {
        unescapeC: unescapeC,
        parse: parse,
        parseInline: parseInlinePublic,
        strip: strip,
        render: render,
        hydrate: hydrate
    };

    root.Markdown = api;
    onReady(function () { hydrate(document); });
})(typeof window !== 'undefined' ? window : this);
