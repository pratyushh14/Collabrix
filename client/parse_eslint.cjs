const fs = require('fs');
const data = JSON.parse(fs.readFileSync('eslint2.json', 'utf8'));
let out = '';
data.forEach(file => {
  if (file.errorCount > 0 || file.warningCount > 0) {
    out += '\n### ' + file.filePath + '\n';
    file.messages.forEach(m => {
      out += 'Line ' + m.line + ': ' + m.message + ' [' + m.ruleId + ']\n';
    });
  }
});
fs.writeFileSync('lint-report.txt', out);
