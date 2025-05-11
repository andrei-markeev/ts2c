export function getFileSystemWrapper() {
    if (typeof process === 'object') {
        const path = require('path');
        const fs = require('fs');
        return {
            path: {
                join: path.join,
                dirname: path.dirname
            },
            fs: {
                existsSync: fs.existsSync,
                readFileSync: fs.readFileSync
            }
        }
    } else if (typeof XMLHttpRequest === 'object') {
        return {
            path: {
                join: (...parts: string[]) => parts.map(p => p.replace(/^\/+|\/+$/, '')).filter(p => p !== '').join('/'),
                dirname: (filePath: string) => filePath.substring(0, filePath.lastIndexOf('/'))
            },
            fs: {
                existsSync: checkFileExistsWithXHR,
                readFileSync: fetchFileWithXHR
            }
        }
    }
}

function fetchFileWithXHR(filePath: string) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', filePath, false);
    xhr.send();
    if (xhr.status === 200) {
        return xhr.responseText
    } else {
        console.error('Failed to load file ' + filePath + ': server returned ' + xhr.status + ' ' + xhr.responseText);
        return undefined;
    }
}

function checkFileExistsWithXHR(filePath: string) {
    var xhr = new XMLHttpRequest();
    xhr.open('HEAD', filePath, false);
    xhr.send();
    return xhr.status < 400;
}