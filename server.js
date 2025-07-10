require('dotenv').config(); // .env dosyasındaki ortam değişkenlerini yükle

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors'); // Tarayıcıdan gelen istekleri kabul etmek için
const { GoogleGenerativeAI } = require('@google/generative-ai'); // Gemini API kütüphanesi

const app = express();
const port = 3005; // Sunucumuz bu portta çalışacak

// Middleware'ler: Gelen istekleri işlemek için kullanılır
app.use(bodyParser.json()); // JSON formatındaki istek gövdelerini (body) okumamızı sağlar
app.use(cors()); // CORS'u etkinleştirir. Bu, senin index.html dosyanın (farklı bir porttan veya sunucudan) bu backend'e istek atabilmesini sağlar.

// Gemini API anahtarını .env dosyasından al
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// API anahtarı yoksa hatayı göster ve uygulamayı sonlandır
if (!GEMINI_API_KEY) {
    console.error("Hata: GEMINI_API_KEY, .env dosyasında tanımlı değil veya boş. Lütfen API anahtarınızı .env dosyasına ekleyin.");
    process.exit(1); // Uygulamayı kapat
}

// Google Generative AI istemcisini oluştur
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Chatbot için POST endpoint'i oluşturma
// frontend'den /chat adresine POST isteği geldiğinde bu kod çalışacak
app.post('/chat', async (req, res) => {
    // Frontend'den gelen mesajı ve konuşma geçmişini al
    const userMessage = req.body.message;
    const history = req.body.history || []; // Konuşma geçmişi (boş gelebilir, bu yüzden || [])

    if (!userMessage) {
        return res.status(400).json({ error: "Mesaj boş olamaz." });
    }

    try {
        // Kullanılacak Gemini modelini belirt
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Modeli güncelledik!

        // Chat oturumunu başlat
        // Konuşma geçmişini Gemini'ın anlayacağı role/parts formatına dönüştürüyoruz
        const chat = model.startChat({
            history: history.map(item => ({
                role: item.sender === 'user' ? 'user' : 'model', // 'user' veya 'model' olmalı
                parts: [{ text: item.text }]
            })),
            // Botun kişiliğini burada tanımlayabiliriz (System Instruction)
            generationConfig: {
                temperature: 0.9, // Yaratıcılık seviyesi (0.0-1.0, 1.0 daha yaratıcı)
                topK: 1, // En yüksek k olasılıklı tokenlardan seçim
                topP: 1, // Toplam olasılık P'yi aşmayan tokenlardan seçim
                maxOutputTokens: 200, // Maksimum cevap uzunluğu
            },
        });

        // Benim sana bahsettiğim bot kişiliğini burada tanımlayabiliriz!
        // Bu kısım Gemini API'ın yeni özelliklerinden biri ve henüz kütüphaneye tam entegre olmamış olabilir.
        // Ama teorik olarak prompt engineering için şöyle düşünebilirsin:
        // Bir "sistem mesajı" ekleyebiliriz:
        // "Sen, ziyaretçilere web siteleri hakkında bilgi veren, genç, dinamik, Z kuşağına hitap eden, esprili ve cesaret verici bir asistansın.
        // Kullanıcılara yardımcı olurken sanki site sahibi [Senin Adın/Lakabın] konuşuyormuş gibi bir dil kullan.
        // Cümlelerinde pozitif ve ileri görüşlü bir ton benimse. Kod gösterme, e-ticaret, biyografi sitesi gibi konularda bilgi sahibisin."
        // Bu prompt'u 'startChat' fonksiyonuna history'nin başına özel bir giriş olarak ekleyebiliriz veya
        // direkt olarak ilk user mesajının içine Gemini'a "bu persona ile cevap ver" şeklinde yazabiliriz.
        // Şimdilik sadece history üzerinden ilerleyelim, persona kısmına daha sonra bakarız.

        // Kullanıcı mesajını modele gönder ve cevabı bekle
        const result = await chat.sendMessage(userMessage);
        const response = await result.response;
        const text = response.text(); // Botun metin cevabını al

        // Cevabı frontend'e geri gönder
        res.json({ reply: text });

    } catch (error) {
        console.error("Gemini API'dan yanıt alınırken bir hata oluştu:", error);
        // Hata durumunda frontend'e bir hata mesajı gönder
        res.status(500).json({ error: "Mesaj işlenirken bir hata oluştu. Lütfen daha sonra tekrar deneyin." });
    }
});

// Sunucuyu belirtilen portta başlat
app.listen(port, () => {
    console.log(`🚀 Chatbot backend sunucusu http://localhost:${port} adresinde çalışıyor!`);
    console.log(`Lütfen API anahtarınızın doğru olduğundan emin olun ve .env dosyasını herkese açık paylaşmayın.`);
});