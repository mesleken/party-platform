export interface QuizQuestion {
  id: number;
  question: string;
  options: [string, string, string, string]; // [A, B, C, D]
  correctIndex: number; // 0, 1, 2, 3
  category: string;
  timeLimit: number; // saniye
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    question: "Güneş sistemindeki en büyük gezegen hangisidir?",
    options: ["Mars", "Jüpiter", "Satürn", "Venüs"],
    correctIndex: 1,
    category: "Bilim & Uzay",
    timeLimit: 15
  },
  {
    id: 2,
    question: "Mona Lisa tablosunu kim yapmıştır?",
    options: ["Leonardo da Vinci", "Pablo Picasso", "Vincent van Gogh", "Michelangelo"],
    correctIndex: 0,
    category: "Sanat & Tarih",
    timeLimit: 15
  },
  {
    id: 3,
    question: "İlk video oyunu konsolu olan 'Magnavox Odyssey' hangi yılda piyasaya sürüldü?",
    options: ["1965", "1972", "1980", "1985"],
    correctIndex: 1,
    category: "Oyun Dünyası",
    timeLimit: 15
  },
  {
    id: 4,
    question: "Türkiye'nin en yüksek dağı hangisidir?",
    options: ["Erciyes Dağı", "Süphan Dağı", "Ağrı Dağı", "Kaçkar Dağı"],
    correctIndex: 2,
    category: "Coğrafya",
    timeLimit: 15
  },
  {
    id: 5,
    question: "HTML kısaltmasının açılımı nedir?",
    options: [
      "HyperText Markup Language",
      "High Tech Multi Language",
      "Home Tool Management Layer",
      "Hyper Transfer Mode Link"
    ],
    correctIndex: 0,
    category: "Teknoloji",
    timeLimit: 15
  },
  {
    id: 6,
    question: "Dünyanın en hızlı kara hayvanı hangisidir?",
    options: ["Aslan", "Çita", "Tazı", "Antilop"],
    correctIndex: 1,
    category: "Doğa",
    timeLimit: 15
  },
  {
    id: 7,
    question: "Minecraft oyununda Nether dünyasına gitmek için hangi blok kullanılır?",
    options: ["Bedrock", "Obsidiyen", "Elmas Blok", "Lav Taşı"],
    correctIndex: 1,
    category: "Oyun Dünyası",
    timeLimit: 15
  },
  {
    id: 8,
    question: "Periyodik tabloda 'Au' simgesi hangi elementi temsil eder?",
    options: ["Gümüş", "Demir", "Bakır", "Altın"],
    correctIndex: 3,
    category: "Bilim",
    timeLimit: 15
  },
  {
    id: 9,
    question: "Yüzüklerin Efendisi serisinde 'Tek Yüzük' hangi dağın lavlarına atılarak yok edilmiştir?",
    options: ["Yalnız Dağ", "Kıyamet Dağı", "Moria Dağı", "Dumanlı Dağlar"],
    correctIndex: 1,
    category: "Sinema & Edebiyat",
    timeLimit: 15
  },
  {
    id: 10,
    question: "Hangisi bir programlama dili DEĞİLDİR?",
    options: ["Python", "Rust", "CSS", "Kotlin"],
    correctIndex: 2,
    category: "Yazılım",
    timeLimit: 15
  }
];
