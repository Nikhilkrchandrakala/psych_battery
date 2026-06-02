const fs = require('fs');
const data = JSON.parse(fs.readFileSync('male_battery.json', 'utf8'));
const s = data.find(s => s.module === 'SRT' && s.content && s.content.includes("'"));
console.log(s.content.substring(0, 500));
