const fs = require('fs');
const text = fs.readFileSync('C:\\Users\\kholifah\\.gemini\\antigravity\\brain\\3eeadb83-a756-4ade-826c-a260505a4926\\.system_generated\\steps\\2811\\content.md', 'utf8');
const regex = /"id":\s*"([^"]*gemini[^"]*flash[^"]*)"/g;
let match;
const models = new Set();
while ((match = regex.exec(text)) !== null) {
  models.add(match[1]);
}
console.log([...models]);
