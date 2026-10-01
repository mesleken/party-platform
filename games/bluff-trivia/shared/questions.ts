import type { BluffQuestion, BluffCategory } from './types.js';

export const BLUFF_QUESTIONS: BluffQuestion[] = [
  // ─── 1. TARİH & MEDENİYETLER ───
  {
    id: 'tarih_01',
    category: 'Tarih',
    question: "Eski Roma'da gladyatörlerin teri kadınlar tarafından ne olarak satın alınıp kullanılıyordu?",
    correctAnswer: 'Cilt Kremi Ve Parfüm',
    defaultFakes: ['Zırh Cilası', 'Aşk İksiri', 'Göz Kalemi', 'Savaş Boyası']
  },
  {
    id: 'tarih_02',
    category: 'Tarih',
    question: "1932 yılında Avustralya ordusunun resmi olarak makineli tüfeklerle savaş ilan edip kaybettiği kuş türü hangisidir?",
    correctAnswer: 'Emu Kuşu',
    defaultFakes: ['Devekuşu', 'Pelikan', 'Dodo Kuşu', 'Kivi Kuşu']
  },
  {
    id: 'tarih_03',
    category: 'Tarih',
    question: "Eski Mısır'da evdeki kedileri ölen aile üyeleri derin bir yas göstergesi olarak vücutlarında neyi tıraş ederdi?",
    correctAnswer: 'Kaşlarını',
    defaultFakes: ['Bıyıklarını', 'Saçlarının Sol Tarafını', 'Kirpiklerini', 'Sakalını']
  },
  {
    id: 'tarih_04',
    category: 'Tarih',
    question: "1923 yılında Frank Hayes isimli jokey, hangi inanılmaz durumda at yarışı kazanmıştır?",
    correctAnswer: 'Kalp Krizi Geçirip Ölmüşken',
    defaultFakes: ['Gözleri Bağlıyken', 'Atın Eyeri Kopmuşken', 'Atı Geri Geri Koşturarak', 'Baygın Haldeyken']
  },
  {
    id: 'tarih_05',
    category: 'Tarih',
    question: "Napolyon Bonapart kutlama için düzenlediği tavşan avında beklenmedik şekilde neye maruz kalıp kaçmak zorunda kalmıştır?",
    correctAnswer: 'Yüzlerce Evcil Tavşanın Hücumuna',
    defaultFakes: ['Kurt Sürüsü Baskınına', 'Kendi Tüfeğinin Patlamasına', 'Bataklığa Saplanmaya', 'Arı Sürüsünün Saldırısına']
  },
  {
    id: 'tarih_06',
    category: 'Tarih',
    question: "18. yüzyılda İngiltere'de zengin elit kesim arasında zenginlik göstergesi olarak partilere kiralanarak götürülen egzotik meyve neydi?",
    correctAnswer: 'Ananas',
    defaultFakes: ['Avokado', 'Mango', 'Hindistan Cevizi', 'Muz']
  },

  // ─── 2. COĞRAFYA & DÜNYA ───
  {
    id: 'cog_01',
    category: 'Coğrafya',
    question: "Antarktika'daki McMurdo İstasyonu'nda bulunan tek ATM hangi bankaya aittir?",
    correctAnswer: 'Wells Fargo',
    defaultFakes: ['Citibank', 'HSBC', 'Deutsche Bank', 'Barclays']
  },
  {
    id: 'cog_02',
    category: 'Coğrafya',
    question: "Dünyada resmi bir başkenti bulunmayan tek ada ülkesi hangisidir?",
    correctAnswer: 'Nauru',
    defaultFakes: ['Tuvalu', 'Monako', 'Maldivler', 'Vanuatu']
  },
  {
    id: 'cog_03',
    category: 'Coğrafya',
    question: "Dünyanın en kurak çölü olan Şili'deki Atacama Çölü'nün bazı bölgelerine kaç yıldır hiç yağmur yağmamıştır?",
    correctAnswer: '400 Yıldır',
    defaultFakes: ['50 Yıldır', '120 Yıldır', '1000 Yıldır', '20 Yıldır']
  },
  {
    id: 'cog_04',
    category: 'Coğrafya',
    question: "Bering Boğazı'nda Rusya ile ABD arasında kalan iki Diomede Adası arasında kışın buz üstünde yürüyerek geçildiğinde saat farkı kaç saattir?",
    correctAnswer: '21 Saat',
    defaultFakes: ['4 Saat', '12 Saat', '2 Saat', '24 Saat']
  },
  {
    id: 'cog_05',
    category: 'Coğrafya',
    question: "Kanada'nın sahip olduğu göl sayısı, dünyanın geri kalanındaki tüm ülkelerin toplam göl sayısından nasıldır?",
    correctAnswer: 'Daha Fazladır',
    defaultFakes: ['Yarısı Kadardır', 'Tamamen Eşittir', 'Daha Azdır', 'Sadece Rusya Kadar']
  },
  {
    id: 'cog_06',
    category: 'Coğrafya',
    question: "Avustralya kıtası gerçekte aydan hangi fiziksel ölçüsüyle daha geniştir?",
    correctAnswer: 'Çap Genişliği',
    defaultFakes: ['Yüzölçümü', 'Kıyı Şeridi', 'Atmosfer Tabakası', 'Kütlesi']
  },

  // ─── 3. SPOR & REKORLAR ───
  {
    id: 'spor_01',
    category: 'Spor',
    question: "1904 St. Louis Olimpiyatları maratonunu birinci bitiren Fred Lorz, yarışın yaklaşık 17 kilometresini nasıl tamamlamıştı?",
    correctAnswer: 'Arabaya Binerek',
    defaultFakes: ['Bisiklet Sürerek', 'Kestirmeden Koşarak', 'Trene Kaçak Binerek', 'At Sırtında']
  },
  {
    id: 'spor_02',
    category: 'Spor',
    question: "Masa tenisi (ping-pong) 19. yüzyılda İngiltere'de ilk icat edildiğinde top olarak ne kullanılıyordu?",
    correctAnswer: 'Şampanya Mantarı',
    defaultFakes: ['Ceviz Kabuğu', 'İplik Yumağı', 'Kurutulmuş Portakal', 'Tüy Yumağı']
  },
  {
    id: 'spor_03',
    category: 'Spor',
    question: "Futbol Dünya Kupası tarihinde ilk sarı ve kırmızı kart uygulaması hangi turnuvada resmen başlatılmıştır?",
    correctAnswer: '1970 Meksika',
    defaultFakes: ['1950 Brezilya', '1966 İngiltere', '1974 Batı Almanya', '1982 İspanya']
  },
  {
    id: 'spor_04',
    category: 'Spor',
    question: "Tarihin en iyi basketbolcusu kabul edilen Michael Jordan, lise ikinci sınıftayken okul takımından hangi gerekçeyle kesilmişti?",
    correctAnswer: 'Boyu Kısa Olduğu İçin',
    defaultFakes: ['Notları Düşük Olduğu İçin', 'Yeterince Hızlı Olmadığı İçin', 'Disiplinsiz Davrandığı İçin', 'Top Süremediği İçin']
  },
  {
    id: 'spor_05',
    category: 'Spor',
    question: "Eski Yunan Olimpiyat Oyunlarında sporcular müsabakalara nasıl çıkıyorlardı?",
    correctAnswer: 'Tamamen Çıplak Ve Yağlanmış',
    defaultFakes: ['Demir Zırhla', 'Sadece Keten Şortla', 'Gözleri Yarı Kapalı', 'Maskeyle']
  },
  {
    id: 'spor_06',
    category: 'Spor',
    question: "Curling sporunda kullanılan taşlar sadece dünyada tek bir adadan çıkarılan hangi özel taştan yapılır?",
    correctAnswer: 'İskoçya Graniti',
    defaultFakes: ['İzlanda Bazaltı', 'Norveç Kuvarsı', 'İrlanda Mermeri', 'Grönland Yeşimi']
  },

  // ─── 4. SİNEMA, SANAT & POP KÜLTÜR ───
  {
    id: 'sinema_01',
    category: 'Sinema & Sanat',
    question: "Star Wars filminde efsanevi Chewbacca'nın kükreme sesi hangi hayvanların seslerinin birleşiminden mikslenmiştir?",
    correctAnswer: 'Ayı, Aslan Ve Mors',
    defaultFakes: ['Fil Ve Goril', 'Kaplan Ve Kurt', 'Deve Ve Hipopotam', 'Panda Ve Çita']
  },
  {
    id: 'sinema_02',
    category: 'Sinema & Sanat',
    question: "Titanic filminde Leonardo DiCaprio'nun ikonik 'I'm the king of the world!' repliği senaryoda nasıldı?",
    correctAnswer: 'Senaryoda Yoktu, Doğaçlama Söylendi',
    defaultFakes: ['Yönetmenin Annesinin Sözüydü', 'Shakespeare Şiirinden Alıntıydı', 'Dublörün Fikriydi', 'Geminin Gerçek Kaptanının Sözüydü']
  },
  {
    id: 'sinema_03',
    category: 'Sinema & Sanat',
    question: "Terminatör 2 filminde eriyen T-1000'in metal parmaklarının yere akma ses efekti için ne kullanılmıştır?",
    correctAnswer: 'Kutudan Çıkarılan Köpek Maması',
    defaultFakes: ['Eriyen Sıvı Sabun', 'Jöle Karışımı', 'Islak Sünger', 'Cıva Damlaları']
  },
  {
    id: 'sinema_04',
    category: 'Sinema & Sanat',
    question: "Alfred Hitchcock'un ünlü 'Psycho' (Sapık) filmindeki efsanevi duş sahnesinde kan olarak ne kullanılmıştır?",
    correctAnswer: 'Çikolata Şurubu',
    defaultFakes: ['Vişne Reçeli', 'Kırmızı Mürekkep', 'Domates Salçası', 'Pancar Suyu']
  },
  {
    id: 'sinema_05',
    category: 'Sinema & Sanat',
    question: "Mona Lisa tablosunun 1911 yılında Louvre Müzesi'nden çalındığında ilk şüpheli olarak tutuklanan ünlü ressam kimdi?",
    correctAnswer: 'Pablo Picasso',
    defaultFakes: ['Salvador Dali', 'Claude Monet', 'Henri Matisse', 'Vincent Van Gogh']
  },

  // ─── 5. BİLİM & DOĞA ───
  {
    id: 'bilim_01',
    category: 'Bilim & Doğa',
    question: "Kutup ayılarının beyaz görünen kürklerinin altındaki gerçek deri rengi nedir?",
    correctAnswer: 'Siyah',
    defaultFakes: ['Pembe', 'Mavi', 'Beyaz', 'Kahverengi']
  },
  {
    id: 'bilim_02',
    category: 'Bilim & Doğa',
    question: "Ahtapotların vücudunda kaç tane kalp bulunmaktadır?",
    correctAnswer: '3 Tane',
    defaultFakes: ['1 Tane', '2 Tane', '4 Tane', 'Kalpleri Yoktur']
  },
  {
    id: 'bilim_03',
    category: 'Bilim & Doğa',
    question: "Kelebekler tat alma duyularını vücutlarının neresiyle kullanırlar?",
    correctAnswer: 'Ayaklarıyla',
    defaultFakes: ['Antenleriyle', 'Kanat Uçlarıyla', 'Hortumlarıyla', 'Gözleriyle']
  },
  {
    id: 'bilim_04',
    category: 'Bilim & Doğa',
    question: "Güneş sistemindeki Venüs gezegeninde bir gün neden bir yıldan daha uzundur?",
    correctAnswer: 'Kendi Ekseni Etrafında Aşırı Yavaş Döndüğü İçin',
    defaultFakes: ['Güneşe Çok Yakın Olduğu İçin', 'İki Tane Uydusu Olduğu İçin', 'Atmosferi Çok Yoğun Olduğu İçin', 'Ters Yöne Yattığı İçin']
  },
  {
    id: 'bilim_05',
    category: 'Bilim & Doğa',
    question: "Doğal olarak her gün tükettiğimiz muzlar, yapısında hangi radyoaktif elementi barındırır?",
    correctAnswer: 'Potasyum-40',
    defaultFakes: ['Uranyum', 'Radyum', 'Plütonyum', 'Karbon-14']
  },
  {
    id: 'bilim_06',
    category: 'Bilim & Doğa',
    question: "İsviçre yasalarına göre yalnızlık hissetmemesi için evde tek başına beslenmesi yasa dışı olan hayvan hangisidir?",
    correctAnswer: 'Ginedomuzu (Kobay Faresi)',
    defaultFakes: ['Japon Balığı', 'Muhabbet Kuşu', 'Bukalemun', 'Tavşan']
  },
  {
    id: 'bilim_07',
    category: 'Bilim & Doğa',
    question: "Ketçap 1830'lu yıllarda Amerika'da eczanelerde ne olarak reçeteyle satılıyordu?",
    correctAnswer: 'İshal Ve Mide İlacı',
    defaultFakes: ['Gargara', 'Yara Merhemi', 'Öksürük Şurubu', 'Saç Losyonu']
  }
];

// ─── 6. ARKADAŞ MODU ŞABLONLARI ───
export const FRIEND_QUESTION_TEMPLATES: string[] = [
  "{NAME}'in en sevdiği renk nedir?",
  "{NAME}'in çocukluk lakabı neydi?",
  "{NAME}'in en nefret ettiği yemek nedir?",
  "{NAME}'in en büyük takıntısı veya fobisi nedir?",
  "{NAME}'in gizli yeteneği nedir?",
  "{NAME}'in en sevdiği müzik türü veya sanatçı kimdir?",
  "{NAME}'in dünyada en çok gitmek istediği yer neresidir?",
  "{NAME}'in lisedeki en sevdiği ders neydi?",
  "{NAME}'in kahvaltıda asla 'hayır' diyemediği şey nedir?",
  "{NAME}'in ilk aldığı veya kullandığı telefon modeli neydi?",
  "{NAME}'in en sevdiği film veya dizi hangisidir?",
  "{NAME}'in evinde veya hayatında kaç tane evcil hayvanı oldu?",
  "{NAME}'in en sevdiği tatlı nedir?"
];

export function getQuestionsForCategory(category: BluffCategory): BluffQuestion[] {
  if (category === 'cografya') {
    return BLUFF_QUESTIONS.filter((q) => q.category.includes('Coğrafya'));
  }
  if (category === 'tarih') {
    return BLUFF_QUESTIONS.filter((q) => q.category.includes('Tarih'));
  }
  if (category === 'spor') {
    return BLUFF_QUESTIONS.filter((q) => q.category.includes('Spor'));
  }
  if (category === 'sinema') {
    return BLUFF_QUESTIONS.filter((q) => q.category.includes('Sinema'));
  }
  if (category === 'bilim') {
    return BLUFF_QUESTIONS.filter((q) => q.category.includes('Bilim'));
  }
  // 'genel' or fallback: all questions
  return BLUFF_QUESTIONS;
}
