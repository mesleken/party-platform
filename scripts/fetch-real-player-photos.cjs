const fs = require('fs');
const https = require('https');
const path = require('path');

// Özel Wikipedia Başlık Eşleştirmeleri (Disambiguation veya takma adlar için)
const WIKI_TITLE_OVERRIDES = {
  'gk-yashin': 'Lev_Yashin',
  'gk-buffon': 'Gianluigi_Buffon',
  'gk-casillas': 'Iker_Casillas',
  'gk-neuer': 'Manuel_Neuer',
  'gk-courtois': 'Thibaut_Courtois',
  'gk-alisson': 'Alisson_Becker',
  'gk-ter-stegen': 'Marc-André_ter_Stegen',
  'gk-oblak': 'Jan_Oblak',
  'gk-donnarumma': 'Gianluigi_Donnarumma',
  'gk-ederson': 'Ederson_(footballer,_born_1993)',
  'gk-maignan': 'Mike_Maignan',
  'gk-martinez': 'Emiliano_Martínez',
  'gk-sommer': 'Yann_Sommer',
  'gk-kobel': 'Gregor_Kobel',
  'gk-raya': 'David_Raya',
  'gk-simon': 'Unai_Simón',
  'gk-vicario': 'Guglielmo_Vicario',
  'gk-muslera': 'Fernando_Muslera',
  'gk-livakovic': 'Dominik_Livaković',
  'gk-pickford': 'Jordan_Pickford',
  'gk-ugurcan': 'Uğurcan_Çakır',
  'gk-mert': 'Mert_Günok',
  'gk-lunin': 'Andriy_Lunin',
  'gk-altay': 'Altay_Bayındır',
  'gk-berke': 'Berke_Özer',
  'gk-gunay': 'Günay_Güvenç',
  'gk-ersin': 'Ersin_Destanoğlu',
  'gk-dogan': 'Doğan_Alemdar',
  'gk-bilal': 'Bilal_Bayazıt',
  'gk-ertugrul': 'Ertuğrul_Taşkıran',

  'def-maldini': 'Paolo_Maldini',
  'def-beckenbauer': 'Franz_Beckenbauer',
  'def-roberto-carlos': 'Roberto_Carlos',
  'def-cafu': 'Cafu',
  'def-ramos': 'Sergio_Ramos',
  'def-van-dijk': 'Virgil_van_Dijk',
  'def-ruben-dias': 'Rúben_Dias',
  'def-saliba': 'William_Saliba',
  'def-hakimi': 'Achraf_Hakimi',
  'def-theo': 'Theo_Hernandez',
  'def-rudiger': 'Antonio_Rüdiger',
  'def-marquinhos': 'Marquinhos',
  'def-gabriel': 'Gabriel_Magalhães',
  'def-kounde': 'Jules_Koundé',
  'def-bastoni': 'Alessandro_Bastoni',
  'def-dimarco': 'Federico_Dimarco',
  'def-walker': 'Kyle_Walker',
  'def-davinson': 'Davinson_Sánchez',
  'def-ferdi': 'Ferdi_Kadıoğlu',
  'def-abdulkerim': 'Abdülkerim_Bardakcı',
  'def-merih': 'Merih_Demiral',
  'def-caglar': 'Çağlar_Söyüncü',
  'def-zeki': 'Zeki_Çelik',
  'def-kaan': 'Kaan_Ayhan',
  'def-samet': 'Samet_Akaydin',
  'def-eren-elmali': 'Evren_Eren_Elmalı',
  'def-jayden': 'Jayden_Oosterwolde',
  'def-emirhan-topcu': 'Emirhan_Topçu',
  'def-yasin-ozcan': 'Yasin_Özcan',
  'def-serdar-saatci': 'Serdar_Saatçı',
  'def-ravil': 'Ravil_Tagir',
  'def-kazimcan': 'Kâzımcan_Karataş',
  'def-bunyamin': 'Bünyamin_Balcı',
  'def-ahmet-oguz': 'Ahmet_Oğuz',
  'def-ugur-ciftci': 'Uğur_Çiftçi',

  'mid-zidane': 'Zinedine_Zidane',
  'mid-ronaldinho': 'Ronaldinho',
  'mid-iniesta': 'Andrés_Iniesta',
  'mid-xavi': 'Xavi',
  'mid-pirlo': 'Andrea_Pirlo',
  'mid-kdb': 'Kevin_De_Bruyne',
  'mid-rodri': 'Rodri_(footballer,_born_1996)',
  'mid-bellingham': 'Jude_Bellingham',
  'mid-modric': 'Luka_Modrić',
  'mid-valverde': 'Federico_Valverde',
  'mid-odegaard': 'Martin_Ødegaard',
  'mid-bernardo': 'Bernardo_Silva',
  'mid-rice': 'Declan_Rice',
  'mid-de-jong': 'Frenkie_de_Jong',
  'mid-barella': 'Nicolò_Barella',
  'mid-bruno': 'Bruno_Fernandes',
  'mid-camavinga': 'Eduardo_Camavinga',
  'mid-hakan': 'Hakan_Çalhanoğlu',
  'mid-ilkay': 'İlkay_Gündoğan',
  'mid-mac-allister': 'Alexis_Mac_Allister',
  'mid-ismail': 'İsmail_Yüksek',
  'mid-torreira': 'Lucas_Torreira',
  'mid-gedson': 'Gedson_Fernandes',
  'mid-fred': 'Fred_(footballer,_born_1993)',
  'mid-orkun': 'Orkun_Kökçü',
  'mid-salih-ozcan': 'Salih_Özcan',
  'mid-irfan-can': 'İrfan_Kahveci',
  'mid-berkan': 'Berkan_Kutlu',
  'mid-berat': 'Berat_Özdemir',
  'mid-emirhan-ilkhan': 'Emirhan_İlkhan',
  'mid-bartug': 'Bartuğ_Elmaz',
  'mid-demir-ege': 'Demir_Ege_Tıknaz',
  'mid-eyup-aydin': 'Eyüp_Aydın',
  'mid-efe-akman': 'Efe_Akman',
  'mid-mehmet-ozcan': 'Mehmet_Özcan_(footballer,_born_1998)',

  'fwd-pele': 'Pelé',
  'fwd-maradona': 'Diego_Maradona',
  'fwd-cruyff': 'Johan_Cruyff',
  'fwd-r9': 'Ronaldo_(Brazilian_footballer)',
  'fwd-messi': 'Lionel_Messi',
  'fwd-cr7': 'Cristiano_Ronaldo',
  'fwd-haaland': 'Erling_Haaland',
  'fwd-mbappe': 'Kylian_Mbappé',
  'fwd-vinicius': 'Vinícius_Júnior',
  'fwd-kane': 'Harry_Kane',
  'fwd-salah': 'Mohamed_Salah',
  'fwd-lewandowski': 'Robert_Lewandowski',
  'fwd-lautaro': 'Lautaro_Martínez',
  'fwd-saka': 'Bukayo_Saka',
  'fwd-foden': 'Phil_Foden',
  'fwd-yamal': 'Lamine_Yamal',
  'fwd-griezmann': 'Antoine_Griezmann',
  'fwd-son': 'Son_Heung-min',
  'fwd-rodrygo': 'Rodrygo',
  'fwd-osimhen': 'Victor_Osimhen',
  'fwd-icardi': 'Mauro_Icardi',
  'fwd-dzeko': 'Edin_Džeko',
  'fwd-immobile': 'Ciro_Immobile',
  'fwd-baris-alper': 'Barış_Alper_Yılmaz',
  'fwd-kerem': 'Kerem_Aktürkoğlu',
  'fwd-arda-guler': 'Arda_Güler',
  'fwd-kenan-yildiz': 'Kenan_Yıldız',
  'fwd-semih': 'Semih_Kılıçsoy',
  'fwd-yunus': 'Yunus_Akgün',
  'fwd-enes-unal': 'Enes_Ünal',
  'fwd-cenk': 'Cenk_Tosun',
  'fwd-can-uzun': 'Can_Uzun',
  'fwd-ahmed-kutucu': 'Ahmed_Kutucu',
  'fwd-bertug': 'Bertuğ_Yıldırım',
  'fwd-mustafa-hekimoglu': 'Mustafa_Erhan_Hekimoğlu'
};

function fetchWikipediaSummary(wikiTitle) {
  return new Promise((resolve) => {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiTitle)}`;
    https.get(url, { headers: { 'User-Agent': 'PartyPlatform/1.0 (dev@partyplatform.local)' } }, (res) => {
      let body = '';
      res.on('data', (d) => (body += d));
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (json.thumbnail && json.thumbnail.source) {
            resolve({ title: json.title, thumb: json.thumbnail.source });
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

function fetchWikipediaSearch(query) {
  return new Promise((resolve) => {
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;
    https.get(url, { headers: { 'User-Agent': 'PartyPlatform/1.0 (dev@partyplatform.local)' } }, (res) => {
      let body = '';
      res.on('data', (d) => (body += d));
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (json.query && json.query.search && json.query.search.length > 0) {
            resolve(json.query.search[0].title);
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

async function getPhotoForPlayer(id, name) {
  let title = WIKI_TITLE_OVERRIDES[id];
  if (!title) {
    title = name.replace(/ /g, '_');
  }

  // 1. Try direct summary
  let res = await fetchWikipediaSummary(title);
  if (res && res.thumb) return res.thumb;

  // 2. Try search
  const searchedTitle = await fetchWikipediaSearch(name + ' footballer');
  if (searchedTitle) {
    res = await fetchWikipediaSummary(searchedTitle.replace(/ /g, '_'));
    if (res && res.thumb) return res.thumb;
  }

  return null;
}

async function main() {
  const { PLAYER_DATABASE } = require('../games/transfer-showdown/dist/shared/player-database.js');
  console.log(`Starting real photo collection for ${PLAYER_DATABASE.length} players...`);

  const photoMap = {};
  let foundCount = 0;

  for (let i = 0; i < PLAYER_DATABASE.length; i++) {
    const p = PLAYER_DATABASE[i];
    const photo = await getPhotoForPlayer(p.id, p.name);
    if (photo) {
      photoMap[p.id] = photo;
      foundCount++;
      console.log(`[${i + 1}/${PLAYER_DATABASE.length}] ✅ ${p.name} -> ${photo.substring(0, 55)}...`);
    } else {
      console.log(`[${i + 1}/${PLAYER_DATABASE.length}] ❌ ${p.name} -> NOT FOUND`);
    }
    // Respect rate limits slightly
    await new Promise((r) => setTimeout(r, 80));
  }

  console.log(`\nFinished! Found ${foundCount} / ${PLAYER_DATABASE.length} authentic photos.`);
  fs.writeFileSync(path.join(__dirname, 'real-photos-map.json'), JSON.stringify(photoMap, null, 2), 'utf8');
  console.log('Saved photo map to scripts/real-photos-map.json');
}

main();
