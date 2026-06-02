const fs = require('fs');
const data = JSON.parse(fs.readFileSync('male_battery.json', 'utf8'));
const badSlides = data.filter(s => s.module === 'SRT' && s.content && s.content.includes("'"));
console.log('Bad slides in male_battery.json (SRT):', badSlides.length);
if (badSlides.length > 0) {
    console.log('Example content:', badSlides[0].content);
}
