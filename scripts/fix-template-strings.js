import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, fileList);
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      fileList.push(path.relative(rootDir, filePath));
    }
  });
  return fileList;
}

// Encontrar todos os arquivos JS e JSX
const files = getAllFiles(path.join(rootDir, 'src'));

let fixedCount = 0;

files.forEach(file => {
  const filePath = path.join(rootDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;

  // Fix template strings with single quotes
  // toast.error('text ${var} text') -> toast.error(`text ${var} text`)
  content = content.replace(
    /toast\.(error|success|info|warning)\('([^']*\$\{[^}]+\}[^']*)'\)/g,
    (match, method, msg) => `toast.${method}(\`${msg}\`)`
  );

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ ${file}`);
    fixedCount++;
  }
});

console.log(`\n✨ ${fixedCount} arquivos corrigidos!`);
