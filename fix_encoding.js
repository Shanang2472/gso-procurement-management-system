import fs from 'node:fs';
const path = 'src/App.tsx';
let text = fs.readFileSync(path, 'utf8');
const pairs = {
  'â‚±': '₱',
  'âœ•': '✕',
  'âœ“': '✓',
  'â€”': '—',
  'â€¢': '•',
  'Ã—': '×',
  'Â·': '·',
  'â€¦': '…',
  'â”€': '-',
  'â€™': '’',
  'â€œ': '“',
  'â€': '”',
  'â€˜': '‘',
  'â€“': '–',
  'Â—': '—',
  'Â°': '°',
  'â€–': '–',
  'Â€': '€'
};
for (const [wrong, right] of Object.entries(pairs)) {
  text = text.split(wrong).join(right);
}
fs.writeFileSync(path, text, 'utf8');
console.log('Fixed mojibake text in ' + path);
