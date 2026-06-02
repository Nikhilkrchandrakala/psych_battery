const fs = require('fs');
['male_battery.json', 'female_battery.json'].forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/"slideType": "INSTRUCTIONS"/g, '"slideType": "TEXT"');
  content = content.replace(/"slideType": "SITUATION"/g, '"slideType": "TEXT"');
  fs.writeFileSync(file, content);
  console.log(file, 'updated');
});
