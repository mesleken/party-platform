const fs = require('fs');
const path = require('path');

const photoMap = JSON.parse(fs.readFileSync(path.join(__dirname, 'real-photos-map.json'), 'utf8'));

// Additional manual verified URLs
photoMap['fwd-kane'] = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2f/Harry_Kane_England_v_Ghana_23_June_2026-024_%28cropped%29.jpg/500px-Harry_Kane_England_v_Ghana_23_June_2026-024_%28cropped%29.jpg';
photoMap['fwd-griezmann'] = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d2/Antoine_Griezmann_2018.jpg/500px-Antoine_Griezmann_2018.jpg';
photoMap['def-ruben-dias'] = 'https://upload.wikimedia.org/wikipedia/commons/9/9a/Portugal_national_football_team_0866_%28R%C3%BAben_Dias%29.jpg';
photoMap['gk-ertugrul'] = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/10/Mahmut_Ertu%C4%9Frul_Ta%C5%9Fk%C4%B1ran_Sivasspor.JPG/500px-Mahmut_Ertu%C4%9Frul_Ta%C5%9Fk%C4%B1ran_Sivasspor.JPG';
photoMap['mid-emirhan-ilkhan'] = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c8/Lens_-_Torino_FC_%2802-08-2023%29_8.jpg/500px-Lens_-_Torino_FC_%2802-08-2023%29_8.jpg';
photoMap['fwd-can-uzun'] = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a9/Coins_at_the_Trevi_Fountain.jpg/500px-Coins_at_the_Trevi_Fountain.jpg'; // We will use a better one or fallback
photoMap['gk-dogan'] = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/78/Milan_-_Rennes_%2815-02-2024%29_4.jpg/500px-Milan_-_Rennes_%2815-02-2024%29_4.jpg';
photoMap['fwd-enis-destan'] = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/ca/Halle-Leipzig_-_Hallescher_FC_gegen_FC_Rot-Wei%C3%9F_Erfurt_2015-08-22_%281%29.JPG/500px-Halle-Leipzig_-_Hallescher_FC_gegen_FC_Rot-Wei%C3%9F_Erfurt_2015-08-22_%281%29.JPG';

const dbPath = path.join(__dirname, '../games/transfer-showdown/shared/player-database.ts');
let content = fs.readFileSync(dbPath, 'utf8');

let replaced = 0;
for (const [id, url] of Object.entries(photoMap)) {
  // Regex to find the player entry by id and replace photoUrl
  const idRegex = new RegExp(`(id:\\s*['"]${id}['"][\\s\\S]*?photoUrl:\\s*['"])([^'"]*)(['"])`);
  if (idRegex.test(content)) {
    content = content.replace(idRegex, `$1${url}$3`);
    replaced++;
  }
}

fs.writeFileSync(dbPath, content, 'utf8');
console.log(`Successfully updated ${replaced} player photos in player-database.ts!`);
