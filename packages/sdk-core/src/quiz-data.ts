export interface QuizQuestion {
  id: number;
  question: string;
  options: [string, string, string, string]; // [A, B, C, D]
  correctIndex: number; // 0, 1, 2, 3
  category: string; // 'bilim' | 'tarih' | 'cografya' | 'sinema' | 'oyun' | 'spor' | 'genel'
  categoryLabel: string;
  timeLimit: number; // saniye
}

export interface QuizCategoryInfo {
  id: string;
  name: string;
  icon: string;
  description: string;
}

export const QUIZ_CATEGORIES: QuizCategoryInfo[] = [
  { id: 'bilim', name: 'Bilim & Teknoloji', icon: '🔬', description: 'Uzay, fizik, kimya, tıp ve yazılım dünyası' },
  { id: 'tarih', name: 'Tarih & Kültür', icon: '📜', description: 'İmparatorluklar, tarihi dönüm noktaları ve arkeoloji' },
  { id: 'cografya', name: 'Coğrafya & Dünya', icon: '🌍', description: 'Başkentler, dağlar, okyanuslar ve doğa harikaları' },
  { id: 'sinema', name: 'Sinema & Dizi', icon: '🎬', description: 'Kült filmler, efsane diziler ve popüler kültür' },
  { id: 'oyun', name: 'Oyun Dünyası', icon: '🎮', description: 'Retro konsollar, espor ve popüler video oyunları' },
  { id: 'spor', name: 'Spor & Rekorlar', icon: '⚽', description: 'Futbol, basketbol, olimpiyatlar ve dünya rekorları' },
  { id: 'genel', name: 'Genel Kültür', icon: '💡', description: 'İlginç gerçekler, sanat, edebiyat ve zeka soruları' }
];

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  // ─── 1. BİLİM & TEKNOLOJİ (11 Soru) ───
  {
    id: 1,
    question: "Güneş sistemindeki en büyük gezegen hangisidir?",
    options: ["Mars", "Jüpiter", "Satürn", "Venüs"],
    correctIndex: 1,
    category: "bilim",
    categoryLabel: "Bilim & Teknoloji",
    timeLimit: 15
  },
  {
    id: 2,
    question: "Periyodik tabloda 'Au' simgesi hangi elementi temsil eder?",
    options: ["Gümüş", "Demir", "Bakır", "Altın"],
    correctIndex: 3,
    category: "bilim",
    categoryLabel: "Bilim & Teknoloji",
    timeLimit: 15
  },
  {
    id: 3,
    question: "HTML kısaltmasının açılımı nedir?",
    options: [
      "HyperText Markup Language",
      "High Tech Multi Language",
      "Home Tool Management Layer",
      "Hyper Transfer Mode Link"
    ],
    correctIndex: 0,
    category: "bilim",
    categoryLabel: "Bilim & Teknoloji",
    timeLimit: 15
  },
  {
    id: 4,
    question: "Işığın boşluktaki hızı yaklaşık olarak saniyede kaç kilometredir?",
    options: ["150.000 km/s", "300.000 km/s", "500.000 km/s", "1.000.000 km/s"],
    correctIndex: 1,
    category: "bilim",
    categoryLabel: "Bilim & Teknoloji",
    timeLimit: 15
  },
  {
    id: 5,
    question: "İnsan vücudundaki en büyük iç organ hangisidir?",
    options: ["Akciğer", "Mide", "Karaciğer", "Böbrek"],
    correctIndex: 2,
    category: "bilim",
    categoryLabel: "Bilim & Teknoloji",
    timeLimit: 15
  },
  {
    id: 6,
    question: "İlk yapay uydu olan Sputnik 1 hangi yıl uzaya fırlatılmıştır?",
    options: ["1949", "1957", "1961", "1969"],
    correctIndex: 1,
    category: "bilim",
    categoryLabel: "Bilim & Teknoloji",
    timeLimit: 15
  },
  {
    id: 7,
    question: "Elektrik akımını ölçen temel SI birimi hangisidir?",
    options: ["Volt", "Watt", "Ohm", "Amper"],
    correctIndex: 3,
    category: "bilim",
    categoryLabel: "Bilim & Teknoloji",
    timeLimit: 15
  },
  {
    id: 8,
    question: "DNA molekülünün çift sarmal (double helix) yapısını kimler keşfetmiştir?",
    options: ["Watson ve Crick", "Newton ve Galileo", "Curie ve Pasteur", "Darwin ve Mendel"],
    correctIndex: 0,
    category: "bilim",
    categoryLabel: "Bilim & Teknoloji",
    timeLimit: 15
  },
  {
    id: 9,
    question: "Hangisi açık kaynaklı ve ücretsiz bir işletim sistemi çekirdeğidir?",
    options: ["Windows NT", "macOS Darwin", "Linux", "Solaris Enterprise"],
    correctIndex: 2,
    category: "bilim",
    categoryLabel: "Bilim & Teknoloji",
    timeLimit: 15
  },
  {
    id: 10,
    question: "Evrende kütlece en bol bulunan kimyasal element hangisidir?",
    options: ["Oksijen", "Helyum", "Karbon", "Hidrojen"],
    correctIndex: 3,
    category: "bilim",
    categoryLabel: "Bilim & Teknoloji",
    timeLimit: 15
  },
  {
    id: 11,
    question: "Hangisi bir programlama dili DEĞİLDİR?",
    options: ["Python", "Rust", "CSS", "Kotlin"],
    correctIndex: 2,
    category: "bilim",
    categoryLabel: "Bilim & Teknoloji",
    timeLimit: 15
  },

  // ─── 2. TARİH & KÜLTÜR (11 Soru) ───
  {
    id: 12,
    question: "İstanbul hangi yıl Fatih Sultan Mehmet tarafından fethedilmiştir?",
    options: ["1451", "1453", "1461", "1492"],
    correctIndex: 1,
    category: "tarih",
    categoryLabel: "Tarih & Kültür",
    timeLimit: 15
  },
  {
    id: 13,
    question: "Antik Dünyanın Yedi Harikasından günümüze ulaşabilen tek eser hangisidir?",
    options: ["Babil'in Asma Bahçeleri", "İskenderiye Feneri", "Keops Piramidi", "Rodos Heykeli"],
    correctIndex: 2,
    category: "tarih",
    categoryLabel: "Tarih & Kültür",
    timeLimit: 15
  },
  {
    id: 14,
    question: "Türkiye Cumhuriyeti hangi tarihte ilan edilmiştir?",
    options: ["23 Nisan 1920", "19 Mayıs 1919", "29 Ekim 1923", "30 Ağustos 1922"],
    correctIndex: 2,
    category: "tarih",
    categoryLabel: "Tarih & Kültür",
    timeLimit: 15
  },
  {
    id: 15,
    question: "Fransız İhtilali hangi yılda başlamıştır?",
    options: ["1776", "1789", "1804", "1815"],
    correctIndex: 1,
    category: "tarih",
    categoryLabel: "Tarih & Kültür",
    timeLimit: 15
  },
  {
    id: 16,
    question: "Tarihte ilk yazıyı (çivi yazısı) M.Ö. 3500 civarında hangi medeniyet icat etmiştir?",
    options: ["Mısırlılar", "Hititler", "Sümerler", "Fenikeliler"],
    correctIndex: 2,
    category: "tarih",
    categoryLabel: "Tarih & Kültür",
    timeLimit: 15
  },
  {
    id: 17,
    question: "Roma İmparatorluğu'nun ilk imparatoru kimdir?",
    options: ["Julius Caesar", "Augustus", "Neron", "Marcus Aurelius"],
    correctIndex: 1,
    category: "tarih",
    categoryLabel: "Tarih & Kültür",
    timeLimit: 15
  },
  {
    id: 18,
    question: "Tarihin sıfır noktası olarak adlandırılan Göbeklitepe hangi ilimizdedir?",
    options: ["Gaziantep", "Mardin", "Diyarbakır", "Şanlıurfa"],
    correctIndex: 3,
    category: "tarih",
    categoryLabel: "Tarih & Kültür",
    timeLimit: 15
  },
  {
    id: 19,
    question: "Rönesans hareketi 14. yüzyılda ilk olarak hangi ülkede başlamıştır?",
    options: ["Fransa", "İngiltere", "İtalya", "Almanya"],
    correctIndex: 2,
    category: "tarih",
    categoryLabel: "Tarih & Kültür",
    timeLimit: 15
  },
  {
    id: 20,
    question: "Çanakkale Kara Savaşları hangi yıl gerçekleşmiştir?",
    options: ["1914", "1915", "1918", "1921"],
    correctIndex: 1,
    category: "tarih",
    categoryLabel: "Tarih & Kültür",
    timeLimit: 15
  },
  {
    id: 21,
    question: "Tarihi İpek Yolu'nun doğu ucu hangi ülkeden başlamaktadır?",
    options: ["Hindistan", "Japonya", "Çin", "İran"],
    correctIndex: 2,
    category: "tarih",
    categoryLabel: "Tarih & Kültür",
    timeLimit: 15
  },
  {
    id: 22,
    question: "Magna Carta (Büyük Sözleşme) hangi ülkede ve yılda imzalanmıştır?",
    options: ["Fransa 1789", "İngiltere 1215", "Almanya 1517", "İspanya 1492"],
    correctIndex: 1,
    category: "tarih",
    categoryLabel: "Tarih & Kültür",
    timeLimit: 15
  },

  // ─── 3. COĞRAFYA & DÜNYA (11 Soru) ───
  {
    id: 23,
    question: "Türkiye'nin en yüksek dağı hangisidir?",
    options: ["Erciyes Dağı", "Süphan Dağı", "Ağrı Dağı", "Kaçkar Dağı"],
    correctIndex: 2,
    category: "cografya",
    categoryLabel: "Coğrafya & Dünya",
    timeLimit: 15
  },
  {
    id: 24,
    question: "Dünyanın en derin noktası olan Mariana Çukuru hangi okyanustadır?",
    options: ["Atlantik Okyanusu", "Büyük (Pasifik) Okyanus", "Hint Okyanusu", "Arktik Okyanusu"],
    correctIndex: 1,
    category: "cografya",
    categoryLabel: "Coğrafya & Dünya",
    timeLimit: 15
  },
  {
    id: 25,
    question: "Dünyanın yüzölçümü bakımından en büyük gölü hangisidir?",
    options: ["Hazar Denizi/Gölü", "Baykal Gölü", "Superior Gölü", "Viktorya Gölü"],
    correctIndex: 0,
    category: "cografya",
    categoryLabel: "Coğrafya & Dünya",
    timeLimit: 15
  },
  {
    id: 26,
    question: "Japonya'nın başkenti neresidir?",
    options: ["Kyoto", "Osaka", "Hiroşima", "Tokyo"],
    correctIndex: 3,
    category: "cografya",
    categoryLabel: "Coğrafya & Dünya",
    timeLimit: 15
  },
  {
    id: 27,
    question: "Dünyanın en uzun nehri kabul edilen nehir hangisidir?",
    options: ["Amazon Nehri", "Nil Nehri", "Mississippi", "Yangtze"],
    correctIndex: 1,
    category: "cografya",
    categoryLabel: "Coğrafya & Dünya",
    timeLimit: 15
  },
  {
    id: 28,
    question: "Afrika kıtasının en yüksek zirvesi olan dağ hangisidir?",
    options: ["Atlas Dağı", "Kenya Dağı", "Kilimanjaro Dağı", "Table Dağı"],
    correctIndex: 2,
    category: "cografya",
    categoryLabel: "Coğrafya & Dünya",
    timeLimit: 15
  },
  {
    id: 29,
    question: "Avustralya'nın başkenti hangi şehirdir?",
    options: ["Sidney", "Melbourne", "Canberra", "Brisbane"],
    correctIndex: 2,
    category: "cografya",
    categoryLabel: "Coğrafya & Dünya",
    timeLimit: 15
  },
  {
    id: 30,
    question: "Dünyanın en kurak sıcak çölü olan Atacama Çölü hangi kıtadadır?",
    options: ["Afrika", "Güney Amerika", "Asya", "Avustralya"],
    correctIndex: 1,
    category: "cografya",
    categoryLabel: "Coğrafya & Dünya",
    timeLimit: 15
  },
  {
    id: 31,
    question: "İtalya'nın başkenti Roma sınırları içinde yer alan dünyanın en küçük bağımsız ülkesi hangisidir?",
    options: ["Monako", "San Marino", "Liechtenstein", "Vatikan"],
    correctIndex: 3,
    category: "cografya",
    categoryLabel: "Coğrafya & Dünya",
    timeLimit: 15
  },
  {
    id: 32,
    question: "Dünyanın en yüksek kesintisiz şelalesi olan Angel Şelalesi hangi ülkededir?",
    options: ["Brezilya", "Venezuela", "Kanada", "Güney Afrika"],
    correctIndex: 1,
    category: "cografya",
    categoryLabel: "Coğrafya & Dünya",
    timeLimit: 15
  },
  {
    id: 33,
    question: "Türkiye'nin en uzun kıyı şeridine sahip olan coğrafi bölgesi hangisidir?",
    options: ["Karadeniz Bölgesi", "Akdeniz Bölgesi", "Ege Bölgesi", "Marmara Bölgesi"],
    correctIndex: 2,
    category: "cografya",
    categoryLabel: "Coğrafya & Dünya",
    timeLimit: 15
  },

  // ─── 4. SİNEMA & DİZİ (11 Soru) ───
  {
    id: 34,
    question: "Yüzüklerin Efendisi serisinde 'Tek Yüzük' hangi dağın lavlarına atılarak yok edilmiştir?",
    options: ["Yalnız Dağ", "Kıyamet Dağı", "Moria Dağı", "Dumanlı Dağlar"],
    correctIndex: 1,
    category: "sinema",
    categoryLabel: "Sinema & Dizi",
    timeLimit: 15
  },
  {
    id: 35,
    question: "Matrix filminde 'Neo' karakterini hangi aktör canlandırmıştır?",
    options: ["Brad Pitt", "Tom Cruise", "Keanu Reeves", "Christian Bale"],
    correctIndex: 2,
    category: "sinema",
    categoryLabel: "Sinema & Dizi",
    timeLimit: 15
  },
  {
    id: 36,
    question: "11 dalda Oscar kazanarak tarihe geçen James Cameron filmi hangisidir?",
    options: ["Avatar", "Terminator 2", "Aliens", "Titanic"],
    correctIndex: 3,
    category: "sinema",
    categoryLabel: "Sinema & Dizi",
    timeLimit: 15
  },
  {
    id: 37,
    question: "Star Wars evreninde 'Darth Vader' karakterinin gerçek adı nedir?",
    options: ["Luke Skywalker", "Anakin Skywalker", "Obi-Wan Kenobi", "Qui-Gon Jinn"],
    correctIndex: 1,
    category: "sinema",
    categoryLabel: "Sinema & Dizi",
    timeLimit: 15
  },
  {
    id: 38,
    question: "Harry Potter serisinde Harry'nin seçildiği Hogwarts binası hangisidir?",
    options: ["Slytherin", "Ravenclaw", "Hufflepuff", "Gryffindor"],
    correctIndex: 3,
    category: "sinema",
    categoryLabel: "Sinema & Dizi",
    timeLimit: 15
  },
  {
    id: 39,
    question: "Breaking Bad dizisinde Walter White'ın kimya imparatorluğunda kullandığı takma ad nedir?",
    options: ["Ozymandias", "Heisenberg", "Cap'n Cook", "Saul"],
    correctIndex: 1,
    category: "sinema",
    categoryLabel: "Sinema & Dizi",
    timeLimit: 15
  },
  {
    id: 40,
    question: "Christopher Nolan'ın rüya katmanları ve bilinçaltını konu alan kült filmi hangisidir?",
    options: ["Interstellar", "Tenet", "Inception", "Memento"],
    correctIndex: 2,
    category: "sinema",
    categoryLabel: "Sinema & Dizi",
    timeLimit: 15
  },
  {
    id: 41,
    question: "Marvel evreninde Thanos, evrendeki tüm canlıların yarısını yok etmek için ne takar?",
    options: ["Sonsuzluk Eldiveni", "Mjolnir Çekici", "Vibranium Kalkanı", "Ağ Fırlatıcı"],
    correctIndex: 0,
    category: "sinema",
    categoryLabel: "Sinema & Dizi",
    timeLimit: 15
  },
  {
    id: 42,
    question: "Hayao Miyazaki'nin En İyi Animasyon Oscar'ı kazanan efsanevi eseri hangisidir?",
    options: ["Prenses Mononoke", "Komşum Totoro", "Ruhların Kaçışı (Spirited Away)", "Yürüyen Şato"],
    correctIndex: 2,
    category: "sinema",
    categoryLabel: "Sinema & Dizi",
    timeLimit: 15
  },
  {
    id: 43,
    question: "Game of Thrones dizisinde 'Kış Geliyor' (Winter is Coming) hangi hanedanın mottosudur?",
    options: ["Lannister", "Targaryen", "Baratheon", "Stark"],
    correctIndex: 3,
    category: "sinema",
    categoryLabel: "Sinema & Dizi",
    timeLimit: 15
  },
  {
    id: 44,
    question: "Pulp Fiction ve Kill Bill filmlerinin ünlü yönetmeni kimdir?",
    options: ["Quentin Tarantino", "Martin Scorsese", "Steven Spielberg", "David Fincher"],
    correctIndex: 0,
    category: "sinema",
    categoryLabel: "Sinema & Dizi",
    timeLimit: 15
  },

  // ─── 5. OYUN DÜNYASI (11 Soru) ───
  {
    id: 45,
    question: "Minecraft oyununda Nether dünyasına portal açmak için hangi blok dizilir?",
    options: ["Bedrock", "Obsidiyen", "Elmas Blok", "Lav Taşı"],
    correctIndex: 1,
    category: "oyun",
    categoryLabel: "Oyun Dünyası",
    timeLimit: 15
  },
  {
    id: 46,
    question: "İlk ev video oyunu konsolu olan 'Magnavox Odyssey' hangi yılda piyasaya sürüldü?",
    options: ["1965", "1972", "1980", "1985"],
    correctIndex: 1,
    category: "oyun",
    categoryLabel: "Oyun Dünyası",
    timeLimit: 15
  },
  {
    id: 47,
    question: "The Witcher serisinin ana karakteri olan efsanevi canavar avcısı kimdir?",
    options: ["Vesemir", "Dandelion", "Geralt of Rivia", "Eskel"],
    correctIndex: 2,
    category: "oyun",
    categoryLabel: "Oyun Dünyası",
    timeLimit: 15
  },
  {
    id: 48,
    question: "GTA San Andreas oyunundaki ana karakterin adı nedir?",
    options: ["Tommy Vercetti", "Carl Johnson (CJ)", "Niko Bellic", "Michael De Santa"],
    correctIndex: 1,
    category: "oyun",
    categoryLabel: "Oyun Dünyası",
    timeLimit: 15
  },
  {
    id: 49,
    question: "Super Mario'nun yeşil şapkalı ve tulumlu kardeşi kimdir?",
    options: ["Wario", "Toad", "Bowser", "Luigi"],
    correctIndex: 3,
    category: "oyun",
    categoryLabel: "Oyun Dünyası",
    timeLimit: 15
  },
  {
    id: 50,
    question: "CS:GO / Counter-Strike'ta bomba imha kiti (Defuse Kit) varken bomba kaç saniyede çözülür?",
    options: ["3 saniye", "5 saniye", "7 saniye", "10 saniye"],
    correctIndex: 1,
    category: "oyun",
    categoryLabel: "Oyun Dünyası",
    timeLimit: 15
  },
  {
    id: 51,
    question: "Dark Souls, Bloodborne ve Elden Ring oyunlarının efsanevi oyun yönetmeni kimdir?",
    options: ["Hideo Kojima", "Hidetaka Miyazaki", "Shigeru Miyamoto", "Todd Howard"],
    correctIndex: 1,
    category: "oyun",
    categoryLabel: "Oyun Dünyası",
    timeLimit: 15
  },
  {
    id: 52,
    question: "League of Legends (LoL) oyununda 5v5 klasik haritanın adı nedir?",
    options: ["Sonsuz Uçurum", "Uğursuz Koruluk", "Sihirdar Vadisi", "Kristal Yara"],
    correctIndex: 2,
    category: "oyun",
    categoryLabel: "Oyun Dünyası",
    timeLimit: 15
  },
  {
    id: 53,
    question: "Half-Life serisinde levye kullanan dilsiz teorik fizikçi ana karakter kimdir?",
    options: ["Barney Calhoun", "Eli Vance", "G-Man", "Gordon Freeman"],
    correctIndex: 3,
    category: "oyun",
    categoryLabel: "Oyun Dünyası",
    timeLimit: 15
  },
  {
    id: 54,
    question: "Portal oyununda test odalarını yöneten ve 'Pasta bir yalan' diyen yapay zeka kimdir?",
    options: ["Cortana", "GLaDOS", "HAL 9000", "Wheatley"],
    correctIndex: 1,
    category: "oyun",
    categoryLabel: "Oyun Dünyası",
    timeLimit: 15
  },
  {
    id: 55,
    question: "Pokémon dünyasında 25 numaralı, Ash Ketchum'ın sadık dostu elektrik tipi Pokémon hangisidir?",
    options: ["Charmander", "Squirtle", "Pikachu", "Bulbasaur"],
    correctIndex: 2,
    category: "oyun",
    categoryLabel: "Oyun Dünyası",
    timeLimit: 15
  },

  // ─── 6. SPOR & REKORLAR (11 Soru) ───
  {
    id: 56,
    question: "100 metre erkekler dünya rekorunu 9.58 saniye ile elinde tutan Jamaikalı atlet kimdir?",
    options: ["Tyson Gay", "Yohan Blake", "Usain Bolt", "Carl Lewis"],
    correctIndex: 2,
    category: "spor",
    categoryLabel: "Spor & Rekorlar",
    timeLimit: 15
  },
  {
    id: 57,
    question: "1986 Dünya Kupası'nda 'Tanrı'nın Eli' golünü atan efsanevi futbolcu kimdir?",
    options: ["Pele", "Diego Maradona", "Johan Cruyff", "Zinedine Zidane"],
    correctIndex: 1,
    category: "spor",
    categoryLabel: "Spor & Rekorlar",
    timeLimit: 15
  },
  {
    id: 58,
    question: "NBA tarihinde tüm zamanların en çok sayı atan oyuncusu unvanı kime aittir?",
    options: ["Michael Jordan", "Kobe Bryant", "Kareem Abdul-Jabbar", "LeBron James"],
    correctIndex: 3,
    category: "spor",
    categoryLabel: "Spor & Rekorlar",
    timeLimit: 15
  },
  {
    id: 59,
    question: "Fransa Açık (Roland Garros) turnuvasını 14 kez kazanarak 'Toprak Ağası' lakabını alan tenisçi kimdir?",
    options: ["Roger Federer", "Novak Djokovic", "Rafael Nadal", "Andy Murray"],
    correctIndex: 2,
    category: "spor",
    categoryLabel: "Spor & Rekorlar",
    timeLimit: 15
  },
  {
    id: 60,
    question: "Bir standart maraton koşusunun resmi parkur mesafesi kaç kilometredir?",
    options: ["40.000 km", "42.195 km", "45.500 km", "50.000 km"],
    correctIndex: 1,
    category: "spor",
    categoryLabel: "Spor & Rekorlar",
    timeLimit: 15
  },
  {
    id: 61,
    question: "UEFA Şampiyonlar Ligi kupasını müzesine en çok götüren futbol kulübü hangisidir?",
    options: ["AC Milan", "Bayern Münih", "Liverpool", "Real Madrid"],
    correctIndex: 3,
    category: "spor",
    categoryLabel: "Spor & Rekorlar",
    timeLimit: 15
  },
  {
    id: 62,
    question: "Olimpiyat Oyunları kaç yılda bir düzenlenmektedir?",
    options: ["2", "3", "4", "5"],
    correctIndex: 2,
    category: "spor",
    categoryLabel: "Spor & Rekorlar",
    timeLimit: 15
  },
  {
    id: 63,
    question: "Olimpiyatlarda 23'ü altın toplam 28 madalya kazanarak tüm zamanların rekorunu kıran yüzücü kimdir?",
    options: ["Ian Thorpe", "Michael Phelps", "Ryan Lochte", "Caeleb Dressel"],
    correctIndex: 1,
    category: "spor",
    categoryLabel: "Spor & Rekorlar",
    timeLimit: 15
  },
  {
    id: 64,
    question: "Formula 1 tarihinde en çok Grand Prix birinciliği kazanan pilot kimdir?",
    options: ["Michael Schumacher", "Ayrton Senna", "Lewis Hamilton", "Max Verstappen"],
    correctIndex: 2,
    category: "spor",
    categoryLabel: "Spor & Rekorlar",
    timeLimit: 15
  },
  {
    id: 65,
    question: "Türkiye A Milli Futbol Takımı, FIFA Dünya Kupası'nda en iyi derecesini (Dünya 3.'sü) hangi yıl almıştır?",
    options: ["1996", "2000", "2002", "2008"],
    correctIndex: 2,
    category: "spor",
    categoryLabel: "Spor & Rekorlar",
    timeLimit: 15
  },
  {
    id: 66,
    question: "Basketbolda üçlük çizgisinin gerisinden atılan başarılı bir basket kaç sayı değerindedir?",
    options: ["2", "3", "4", "1"],
    correctIndex: 1,
    category: "spor",
    categoryLabel: "Spor & Rekorlar",
    timeLimit: 15
  },

  // ─── 7. GENEL KÜLTÜR (11 Soru) ───
  {
    id: 67,
    question: "Mona Lisa tablosunu kim yapmıştır?",
    options: ["Leonardo da Vinci", "Pablo Picasso", "Vincent van Gogh", "Michelangelo"],
    correctIndex: 0,
    category: "genel",
    categoryLabel: "Genel Kültür",
    timeLimit: 15
  },
  {
    id: 68,
    question: "Dünyanın en hızlı koşan kara hayvanı hangisidir?",
    options: ["Aslan", "Çita", "Tazı", "Antilop"],
    correctIndex: 1,
    category: "genel",
    categoryLabel: "Genel Kültür",
    timeLimit: 15
  },
  {
    id: 69,
    question: "Standart bir satranç tahtasında toplam kaç kare bulunur?",
    options: ["48", "64", "72", "81"],
    correctIndex: 1,
    category: "genel",
    categoryLabel: "Genel Kültür",
    timeLimit: 15
  },
  {
    id: 70,
    question: "Nobel Barış Ödülü diğer kategorilerden farklı olarak hangi şehirde takdim edilir?",
    options: ["Stockholm (İsveç)", "Oslo (Norveç)", "Cenevre (İsviçre)", "Kopenhag (Danimarka)"],
    correctIndex: 1,
    category: "genel",
    categoryLabel: "Genel Kültür",
    timeLimit: 15
  },
  {
    id: 71,
    question: "Ünlü 'Düşünen Adam' (The Thinker) heykelinin yaratıcısı olan heykeltıraş kimdir?",
    options: ["Auguste Rodin", "Donatello", "Bernini", "Canova"],
    correctIndex: 0,
    category: "genel",
    categoryLabel: "Genel Kültür",
    timeLimit: 15
  },
  {
    id: 72,
    question: "Güneş sisteminde kendi ekseni etrafında saat yönünde (ters yönde) dönen tek gezegen hangisidir?",
    options: ["Mars", "Venüs", "Merkür", "Uranüs"],
    correctIndex: 1,
    category: "genel",
    categoryLabel: "Genel Kültür",
    timeLimit: 15
  },
  {
    id: 73,
    question: "Bir bal arısı kovanında yumurtlama yeteneğine sahip tek dişi arı hangisidir?",
    options: ["İşçi Arı", "Asker Arı", "Kraliçe (Ana) Arı", "Erkek Arı"],
    correctIndex: 2,
    category: "genel",
    categoryLabel: "Genel Kültür",
    timeLimit: 15
  },
  {
    id: 74,
    question: "İstiklal Marşı'mızın şairi kimdir?",
    options: ["Yahya Kemal Beyatlı", "Namık Kemal", "Mehmet Akif Ersoy", "Tevfik Fikret"],
    correctIndex: 2,
    category: "genel",
    categoryLabel: "Genel Kültür",
    timeLimit: 15
  },
  {
    id: 75,
    question: "Saf su standart atmosfer basıncında hangi sıcaklıkta en yüksek yoğunluğa (+1 g/cm³) ulaşır?",
    options: ["0 °C", "+4 °C", "+20 °C", "+100 °C"],
    correctIndex: 1,
    category: "genel",
    categoryLabel: "Genel Kültür",
    timeLimit: 15
  },
  {
    id: 76,
    question: "Dünyanın bilinen en eski destanı hangisidir?",
    options: ["Gılgamış Destanı", "İlyada Destanı", "Oğuz Kağan Destanı", "Mahabharata"],
    correctIndex: 0,
    category: "genel",
    categoryLabel: "Genel Kültür",
    timeLimit: 15
  },
  {
    id: 77,
    question: "Ağırlığına oranla insan vücudundaki en güçlü kas hangisidir?",
    options: ["Dil kası", "Pazı (Biceps)", "Çene kası (Masseter)", "Baldır kası"],
    correctIndex: 2,
    category: "genel",
    categoryLabel: "Genel Kültür",
    timeLimit: 15
  }
];

/**
 * Verilen kategorilere ve soru sayısına göre soruları filtreleyip rastgele karıştırır.
 */
export function filterAndShuffleQuestions(
  selectedCategories: string[] = [],
  count: number = 5
): QuizQuestion[] {
  let pool = QUIZ_QUESTIONS;

  if (selectedCategories && selectedCategories.length > 0 && !selectedCategories.includes('all')) {
    pool = pool.filter((q) => selectedCategories.includes(q.category));
  }

  // Eğer filtre sonucu soru kalmadıysa tüm havuza dön
  if (pool.length === 0) {
    pool = QUIZ_QUESTIONS;
  }

  // Fisher-Yates Karıştırma
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, Math.min(count, shuffled.length));
}
