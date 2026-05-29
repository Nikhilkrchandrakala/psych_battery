/**
 * Script to add "module" tags to male_battery.json and female_battery.json
 * Run with: node server/tag_modules.cjs
 */
const fs = require('fs');
const path = require('path');

function tagModules(slides) {
  let currentModule = 'INTRO';
  
  return slides.map((slide, i) => {
    const content = (slide.content || '').replace(/'/g, '').toUpperCase();
    
    // Detect module boundaries from known title content
    if (i === 0 && content.includes('INSTRUCTIONS FOR THE PSYCH TEST')) {
      currentModule = 'INTRO';
    } else if (content.includes('THEMATIC APPERCEPTION TEST')) {
      currentModule = 'TAT';
    } else if (content.includes('INSTRUCTIONS FOR TAT')) {
      currentModule = 'TAT';
    } else if (content.includes('WORD ASSOCIATION TEST')) {
      currentModule = 'WAT';
    } else if (content.includes('INSTRUCTIONS FOR WAT')) {
      currentModule = 'WAT';
    } else if (content.includes('SITUATION REACTION TEST')) {
      currentModule = 'SRT';
    } else if (content.includes('INSTRUCTIONS FOR SRT')) {
      currentModule = 'SRT';
    } else if (content.includes('SELF DESCRIPTION TEST')) {
      currentModule = 'SDT';
    } else if (content.includes('INSTRUCTIONS FOR SD')) {
      currentModule = 'SDT';
    } else if (content.includes('THANK YOU') || content.includes('PLEASE SCAN YOUR DOSSIER')) {
      currentModule = 'CLOSING';
    }

    // Slide type overrides for unambiguous types
    if (slide.slideType === 'SITUATION') {
      currentModule = 'SRT';
    } else if (slide.slideType === 'WORD') {
      currentModule = 'WAT';
    }

    return { ...slide, module: currentModule };
  });
}

// Process both battery files
for (const filename of ['male_battery.json', 'female_battery.json']) {
  const filePath = path.join(__dirname, filename);
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${filename} - file not found`);
    continue;
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const tagged = tagModules(data);

  // Count modules
  const counts = {};
  tagged.forEach(s => { counts[s.module] = (counts[s.module] || 0) + 1; });
  console.log(`${filename}: ${tagged.length} slides tagged`);
  console.log(`  Module distribution:`, counts);

  fs.writeFileSync(filePath, JSON.stringify(tagged, null, 2) + '\n', 'utf8');
  console.log(`  Written back to ${filename}`);
}
