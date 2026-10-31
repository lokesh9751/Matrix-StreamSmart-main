const fs = require('fs');
const path = require('path');
const parser = require('../client/node_modules/@babel/parser');
const traverse = require('../client/node_modules/@babel/traverse').default;

const standardGlobals = new Set([
  'window', 'document', 'navigator', 'console', 'setTimeout', 'clearTimeout',
  'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame',
  'fetch', 'Headers', 'Request', 'Response', 'URL', 'URLSearchParams',
  'localStorage', 'sessionStorage', 'Math', 'Date', 'JSON', 'Object', 'Array',
  'String', 'Number', 'Boolean', 'RegExp', 'Map', 'Set', 'WeakMap', 'WeakSet',
  'Promise', 'Error', 'TypeError', 'RangeError', 'SyntaxError', 'ReferenceError',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURI', 'encodeURIComponent',
  'decodeURI', 'decodeURIComponent', 'btoa', 'atob', 'performance', 'PerformanceObserver',
  'Event', 'CustomEvent', 'EventTarget', 'HTMLElement', 'HTMLVideoElement', 'HTMLMediaElement', 'Element',
  'Node', 'MutationObserver', 'ResizeObserver', 'IntersectionObserver', 'FormData',
  'Blob', 'File', 'FileReader', 'FileReaderSync', 'WebSocket', 'Worker',
  'Audio', 'Image', 'Option', 'Infinity', 'NaN', 'undefined', 'null', 'globalThis',
  'Symbol', 'Proxy', 'Reflect', 'Intl', 'ArrayBuffer', 'Uint8Array', 'Uint16Array',
  'Uint32Array', 'Int8Array', 'Int16Array', 'Int32Array', 'Float32Array', 'Float64Array',
  'process', 'confirm', 'alert', 'prompt'
]);

function getAllFiles(dir, exts = ['.js', '.jsx']) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllFiles(fullPath, exts));
    } else if (exts.includes(path.extname(fullPath))) {
      results.push(fullPath);
    }
  }
  return results;
}

const clientSrcDir = path.resolve(__dirname, '../client/src');
const files = getAllFiles(clientSrcDir);

let realIssues = [];

for (const file of files) {
  const code = fs.readFileSync(file, 'utf8');
  let ast;
  try {
    ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'classProperties', 'objectRestSpread', 'optionalChaining', 'nullishCoalescingOperator']
    });
  } catch (err) {
    console.error(`PARSE ERROR in ${file}:`, err.message);
    continue;
  }

  const undeclared = [];

  traverse(ast, {
    JSXOpeningElement(p) {
      if (p.node.name.type === 'JSXIdentifier') {
        const name = p.node.name.name;
        if (/^[a-z]/.test(name)) return;
        if (!p.scope.hasBinding(name) && !standardGlobals.has(name)) {
          undeclared.push({ name, line: p.node.loc?.start?.line, type: 'JSXComponent' });
        }
      }
    },
    ReferencedIdentifier(p) {
      const name = p.node.name;
      if (standardGlobals.has(name)) return;
      if (name === 'React') return; // React 17+ jsx transform allows implicit React or explicit
      if (!p.scope.hasBinding(name)) {
        undeclared.push({ name, line: p.node.loc?.start?.line, type: 'Reference' });
      }
    }
  });

  if (undeclared.length > 0) {
    console.log(`\nIn ${path.relative(clientSrcDir, file)}:`);
    for (const u of undeclared) {
      console.log(`  Line ${u.line}: Undefined ${u.type} "${u.name}"`);
    }
    realIssues.push({ file: path.relative(clientSrcDir, file), undeclared });
  }
}

console.log(`\nScan complete: ${realIssues.reduce((a, b) => a + b.undeclared.length, 0)} real issues found in ${realIssues.length} files.`);
