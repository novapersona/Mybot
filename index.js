// 1. Oldin mavjud bo'lgan importlar
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import TelegramBot from 'node-telegram-bot-api';

// 2. MANA SHU YERGA QO'SHASIZ (fileURLToPath ni ham import qilamiz):
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 3. Pastda esa sizning eski kodingiz davom etadi:

// Botning qolgan kodlari...
// ==================== DUMMY WEB SERVER FOR RENDER.COM ====================
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Kinochi Bot is active and running 24/7!\n');
}).listen(PORT, () => {
  console.log(`Render.com port binding active on port ${PORT}`);
});
// =========================================================================

// ==================== SOZLAMALAR (CONFIG) ====================
// Bot tokenini shu yerga kiriting
const BOT_TOKEN = '8704179698:AAEORuQoAgCbxKe8ciDrc3x5FVSlJC1NN3s';

// Super Admin Telegram ID sini shu yerga kiriting (raqam shaklida, masalan: 123456789)
const SUPER_ADMIN_ID = '6390314381';

// Bot a'zo bo'lishi shart bo'lgan kanallar ro'yxati
// DIQQAT: Bot ushbu kanallarda administrator (admin) bo'lishi shart!
const CHANNELS = [
  { id: 'https://t.me/online_pulkopaytir', name: '1-kanalga obuna bo\'lish' },
  { id: 'https://t.me/xojiakbar_05', name: '2-kanalga obuna bo\'lish' }
];

// Donat (xayriya) uchun karta ma'lumotlari
const CARD_DETAILS = `💳 Karta: 8600 0000 0000 0000\n👤 Ega: ISMI SHARIFI\n🏦 Bank: Humo / Uzcard`;

// Zaxira kanali/guruhi ID-si (Masalan: -1001234567890 yoki '@zaxira_kanali')
// Bot ushbu chatda xabar yuborish va uni PIN qilish huquqiga ega bo'lishi kerak!
// Bo'sh qoldirilsa zaxiralash ishlamaydi va faqat local fayl ishlatiladi.
const BACKUP_CHAT_ID = '';
// =============================================================

// Kanal ID/Usernamelarini to'g'rilash (masalan, link yuborilgan bo'lsa uni @username formatiga o'tkazish)
function formatChannelId(id) {
  if (typeof id !== 'string') return id;
  let clean = id.trim();

  // URL va ortiqcha protokollarni olib tashlash (masalan, https://t.me/kanal -> @kanal)
  clean = clean.replace(/^(https?:\/\/)?(www\.)?(t\.me|telegram\.me)\//i, '');

  // So'rov parametrlari (?boost=...) yoki qo'shimcha / belgilarni olib tashlash
  clean = clean.split('/')[0].split('?')[0];

  // Agar raqamli ID bo'lmasa yoki @ bilan boshlanmasa, @ belgisini qo'shish
  if (!clean.startsWith('@') && !clean.startsWith('-') && isNaN(clean)) {
    clean = '@' + clean;
  }
  return clean;
}

// Agar foydalanuvchi tokenlarni sozlamagan bo'lsa ogohlantirish va dasturni to'xtatish
if (BOT_TOKEN === 'YOUR_BOT_TOKEN_HERE' || BOT_TOKEN === '') {
  console.log('------------------------------------------------------------');
  console.log('XATOLIK: Bot tokeni sozlanmagan!');
  console.log('Iltimos, src/index.js faylini ochib, 7-qatordagi');
  console.log('BOT_TOKEN o\'rniga @BotFather dan olgan tokeningizni yozing.');
  console.log('------------------------------------------------------------');
  process.exit(1);
}

// Ma'lumotlar bazasi fayli manzili
let DB_PATH = path.join(__dirname, 'database.json');

// Bazani o'qish funksiyasi
function readDb() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      const initialDb = {
        users: {},
        movies: {},
        admins: []
      };
      fs.writeFileSync(DB_PATH, JSON.stringify(initialDb, null, 2), 'utf8');
      return initialDb;
    }
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Bazani o\'qishda xatolik:', err);
    return { users: {}, movies: {}, admins: [] };
  }
}

// Faylni url orqali yuklab olish yordamchi funksiyasi
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Yuklab olishda xatolik: ${res.statusCode}`));
        return;
      }
      const file = fs.createWriteStream(destPath);
      res.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// Telegram zaxiradan bazani tiklash
async function restoreDbFromTelegram() {
  if (!BACKUP_CHAT_ID) {
    console.log('BACKUP_CHAT_ID sozlanmagan. Tiklash o\'tkazib yuborildi.');
    return;
  }
  try {
    console.log('Telegram zaxiradan ma\'lumotlarni tiklash tekshirilmoqda...');
    const chat = await bot.getChat(BACKUP_CHAT_ID);
    if (chat.pinned_message && chat.pinned_message.document) {
      const fileId = chat.pinned_message.document.file_id;
      const fileLink = await bot.getFileLink(fileId);

      console.log('Zaxira fayli yuklab olinmoqda...');
      await downloadFile(fileLink, DB_PATH);
      console.log('Ma\'lumotlar bazasi zaxiradan muvaffaqiyatli tiklandi!');
    } else {
      console.log('Zaxira fayli topilmadi (pinned message yo\'q).');
    }
  } catch (err) {
    console.error('Zaxirani tiklashda xatolik:', err.message);
  }
}

// Telegramga bazani zaxiralash
let backupTimeout = null;
function backupDbToTelegram() {
  if (!BACKUP_CHAT_ID) return;

  if (backupTimeout) clearTimeout(backupTimeout);

  backupTimeout = setTimeout(async () => {
    try {
      console.log('Ma\'lumotlar bazasi Telegramga yuklanmoqda...');
      const dbFile = fs.createReadStream(DB_PATH);
      const msg = await bot.sendDocument(BACKUP_CHAT_ID, dbFile, {
        caption: `Kinochi Bot zaxira bazasi. Sana: ${new Date().toLocaleString('uz-UZ')}`
      });
      await bot.pinChatMessage(BACKUP_CHAT_ID, msg.message_id);
      console.log('Baza muvaffaqiyatli zaxiralandi va pin qilindi!');
    } catch (err) {
      console.error('Zaxiralashda xatolik:', err.message);
    }
  }, 5000);
}

// Bazaga yozish funksiyasi
function writeDb(db) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
    backupDbToTelegram();
  } catch (err) {
    console.error('Bazaga yozishda xatolik:', err);
  }
}

// Botni ishga tushirish (polling false qilib boshlaymiz)
const bot = new TelegramBot(BOT_TOKEN, { polling: false });

(async () => {
  // Avval zaxiradan bazani tiklaymiz
  await restoreDbFromTelegram();

  // Keyin botni ishga tushiramiz
  bot.startPolling();
  console.log('Kino bot ishga tushdi...');
})();

// Foydalanuvchini ro'yxatga olish
function registerUser(msg) {
  const db = readDb();
  const userId = msg.from.id.toString();
  if (!db.users[userId]) {
    db.users[userId] = {
      id: msg.from.id,
      username: msg.from.username || null,
      firstName: msg.from.first_name || null,
      lastName: msg.from.last_name || null,
      registeredAt: new Date().toISOString()
    };
    writeDb(db);
  }
}

// Foydalanuvchi admin yoki super admin ekanligini tekshirish
function isAdminUser(userId) {
  const db = readDb();
  const userIdStr = userId.toString();
  const superAdminStr = SUPER_ADMIN_ID.toString();

  if (userIdStr === superAdminStr) {
    return true;
  }

  return db.admins && db.admins.includes(userIdStr);
}

// Kanallarga obunani tekshirish funksiyasi
async function checkSubscription(userId) {
  const userIdStr = userId.toString();
  const superAdminStr = SUPER_ADMIN_ID.toString();

  // Super admin uchun obunani tekshirish shart emas
  if (userIdStr === superAdminStr) {
    return true;
  }

  // Kanallarning to'g'riligini tekshirish
  let hasValidChannels = false;
  for (const ch of CHANNELS) {
    const formattedId = formatChannelId(ch.id);
    if (formattedId && !formattedId.includes('kanal_username')) {
      hasValidChannels = true;
    }
  }
  if (!hasValidChannels) {
    return true;
  }

  for (const channel of CHANNELS) {
    const channelId = formatChannelId(channel.id);
    if (channelId.includes('kanal_username')) {
      continue; // Standart placeholder kanallarni tekshirmaymiz
    }
    try {
      const member = await bot.getChatMember(channelId, userId);
      const activeStatuses = ['member', 'administrator', 'creator'];
      if (!activeStatuses.includes(member.status)) {
        return false;
      }
    } catch (err) {
      console.error(`\n[OBUNA XATOLIGI] Kanal: ${channelId} | Xato:`, err.message);
      console.log(`------------------------------------------------------------------`);
      console.log(`DIQQAT: Bot ${channelId} kanalida administrator (admin) bo'lishi shart!`);
      console.log(`Shuningdek, ${channelId} shaxsiy profil emas, aynan KANAL yoki GURUH bo'lishi kerak.`);
      console.log(`Ushbu kanal tekshiruvi xatolik tufayli o'tkazib yuborildi.`);
      console.log(`------------------------------------------------------------------\n`);
      // Agar bot admin bo'lmasa yoki kanal shaxsiy profil bo'lsa, bu kanalni o'tkazib yuboramiz va boshqa kanallarni tekshirishni davom ettiramiz
      continue;
    }
  }
  return true;
}

// Obuna bo'lish so'rovini yuborish
function sendSubscriptionPrompt(chatId) {
  const keyboard = [];

  CHANNELS.forEach((channel) => {
    let url = channel.id;
    // Agar id link bo'lmasa, uni link formatiga o'tkazamiz
    if (!url.startsWith('http')) {
      const cleanUsername = url.startsWith('@') ? url.substring(1) : url;
      url = `https://t.me/${cleanUsername}`;
    }
    keyboard.push([{ text: channel.name, url: url }]);
  });

  keyboard.push([{ text: "Tasdiqlash ✅", callback_data: "check_sub" }]);

  bot.sendMessage(chatId, "Botdan foydalanish uchun quyidagi kanallarga obuna bo'ling va 'Tasdiqlash' tugmasini bosing:", {
    reply_markup: {
      inline_keyboard: keyboard
    }
  });
}

// Asosiy menyu klaviaturasi
function getMainMenuKeyboard(userId) {
  const keyboard = [
    [{ text: "🔍 Kino izlash" }, { text: "🏆 Top Donaters" }]
  ];

  if (isAdminUser(userId)) {
    keyboard.push([{ text: "⚙️ Admin Panel" }]);
  }

  return {
    reply_markup: {
      keyboard: keyboard,
      resize_keyboard: true
    }
  };
}

// Boshqaruv paneli (Inline)
function sendAdminPanel(chatId, userId) {
  const userIdStr = userId.toString();
  const superAdminStr = SUPER_ADMIN_ID.toString();
  const isSuper = userIdStr === superAdminStr;

  const inlineKeyboard = [
    [
      { text: "➕ Kino qo'shish", callback_data: "admin_add_movie" },
      { text: "🗑️ Kino o'chirish", callback_data: "admin_del_movie" }
    ],
    [
      { text: "📋 Kinolar ro'yxati", callback_data: "admin_list_movies" }
    ]
  ];

  if (isSuper) {
    inlineKeyboard.push([
      { text: "➕ Admin qo'shish", callback_data: "super_add_admin" },
      { text: "🗑️ Admin o'chirish", callback_data: "super_del_admin" }
    ]);
    inlineKeyboard.push([
      { text: "👥 Adminlar ro'yxati", callback_data: "super_list_admins" },
      { text: "📊 Statistika", callback_data: "super_stats" }
    ]);
  }

  bot.sendMessage(chatId, "⚙️ Admin boshqaruv paneli:", {
    reply_markup: {
      inline_keyboard: inlineKeyboard
    }
  });
}

// Admin va foydalanuvchilar holati (State management)
const userStates = {};

// Xabarlarni boshqarish
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;

  if (!text && !msg.video && !msg.document && !msg.photo) return;

  // Foydalanuvchini ro'yxatga olish
  registerUser(msg);

  // Obunani tekshirish
  const isSubscribed = await checkSubscription(userId);
  if (!isSubscribed) {
    sendSubscriptionPrompt(chatId);
    return;
  }

  // Bekor qilish komandasi
  if (text === '/cancel' || text === '❌ Jarayonni bekor qilish') {
    if (userStates[chatId]) {
      delete userStates[chatId];
      bot.sendMessage(chatId, "Jarayon bekor qilindi.", getMainMenuKeyboard(userId));
    } else {
      bot.sendMessage(chatId, "Bekor qilinadigan faol jarayon yo'q.", getMainMenuKeyboard(userId));
    }
    return;
  }

  // Agar foydalanuvchi biror state da bo'lsa
  if (userStates[chatId]) {
    const currentState = userStates[chatId];

    // ADMIN: Kino qo'shish jarayoni
    if (currentState.state === 'AWAITING_MOVIE_NAME') {
      if (!text) {
        bot.sendMessage(chatId, "Iltimos, kino nomini matn shaklida kiriting:");
        return;
      }
      currentState.name = text;
      currentState.state = 'AWAITING_MOVIE_KEY';
      bot.sendMessage(chatId, `Kino nomi: *${text}*\n\nEndi kino uchun kalit raqamini (kodini) kiriting (masalan: 1234):`, {
        parse_mode: 'Markdown',
        reply_markup: {
          keyboard: [[{ text: '❌ Jarayonni bekor qilish' }]],
          resize_keyboard: true
        }
      });
      return;
    }

    if (currentState.state === 'AWAITING_MOVIE_KEY') {
      if (!text) {
        bot.sendMessage(chatId, "Iltimos, kalit raqamini matn/son shaklida kiriting:");
        return;
      }
      const db = readDb();
      if (db.movies[text.trim()]) {
        bot.sendMessage(chatId, `❌ Ushbu kod (${text.trim()}) band. Boshqa kod kiriting:`);
        return;
      }
      currentState.key = text.trim();
      currentState.state = 'AWAITING_MOVIE_DESCRIPTION';
      bot.sendMessage(chatId, `Kino kodi: *${currentState.key}*\n\nEndi kino tavsifini (ta'rifini) kiriting:`, {
        parse_mode: 'Markdown'
      });
      return;
    }

    if (currentState.state === 'AWAITING_MOVIE_DESCRIPTION') {
      if (!text) {
        bot.sendMessage(chatId, "Iltimos, tavsifni matn shaklida kiriting:");
        return;
      }
      currentState.description = text;
      currentState.state = 'AWAITING_MOVIE_FILE';
      bot.sendMessage(chatId, `Tavsif saqlandi.\n\nEndi kino faylini yuboring (video, hujjat yoki rasm ko'rinishida) yoki video havolasini yozing:`);
      return;
    }

    if (currentState.state === 'AWAITING_MOVIE_FILE') {
      let fileId = null;
      let fileType = null;

      if (msg.video) {
        fileId = msg.video.file_id;
        fileType = 'video';
      } else if (msg.document) {
        fileId = msg.document.file_id;
        fileType = 'document';
      } else if (msg.photo) {
        fileId = msg.photo[msg.photo.length - 1].file_id;
        fileType = 'photo';
      } else if (text) {
        fileId = text;
        fileType = 'text';
      }

      if (!fileId) {
        bot.sendMessage(chatId, "Iltimos, video fayl yuboring yoki matnli havola kiriting:");
        return;
      }

      // Kinoni bazaga saqlash
      const db = readDb();
      db.movies[currentState.key] = {
        key: currentState.key,
        name: currentState.name,
        description: currentState.description,
        fileId: fileId,
        fileType: fileType
      };
      writeDb(db);

      bot.sendMessage(
        chatId,
        `✅ Kino muvaffaqiyatli saqlandi!\n🔑 Kalit raqam: *${currentState.key}*\n🎥 Nomi: *${currentState.name}*`,
        {
          parse_mode: 'Markdown',
          reply_markup: getMainMenuKeyboard(userId).reply_markup
        }
      );
      delete userStates[chatId];
      return;
    }

    // ADMIN: Kino o'chirish
    if (currentState.state === 'AWAITING_MOVIE_DELETE_KEY') {
      if (!text) return;
      const db = readDb();
      const key = text.trim();
      if (db.movies[key]) {
        const movieName = db.movies[key].name;
        delete db.movies[key];
        writeDb(db);
        bot.sendMessage(chatId, `🗑️ *${movieName}* (kod: ${key}) muvaffaqiyatli o'chirildi!`, {
          parse_mode: 'Markdown',
          reply_markup: getMainMenuKeyboard(userId).reply_markup
        });
      } else {
        bot.sendMessage(chatId, `❌ Bunday kodli (${key}) kino topilmadi.`, getMainMenuKeyboard(userId));
      }
      delete userStates[chatId];
      return;
    }

    // SUPER ADMIN: Yangi admin qo'shish
    if (currentState.state === 'AWAITING_ADD_ADMIN_ID') {
      if (!text) return;
      const adminId = text.trim();
      if (isNaN(adminId)) {
        bot.sendMessage(chatId, "❌ Admin ID faqat raqamlardan iborat bo'lishi kerak. Qayta kiriting:");
        return;
      }

      const db = readDb();
      if (!db.admins) {
        db.admins = [];
      }

      if (db.admins.includes(adminId) || adminId === SUPER_ADMIN_ID.toString()) {
        bot.sendMessage(chatId, "❌ Ushbu foydalanuvchi allaqachon admin.", getMainMenuKeyboard(userId));
      } else {
        db.admins.push(adminId);
        writeDb(db);
        bot.sendMessage(chatId, `✅ Foydalanuvchi (ID: \`${adminId}\`) adminlar ro'yxatiga qo'shildi!`, {
          parse_mode: 'Markdown',
          reply_markup: getMainMenuKeyboard(userId).reply_markup
        });
      }
      delete userStates[chatId];
      return;
    }

    // SUPER ADMIN: Adminni o'chirish
    if (currentState.state === 'AWAITING_DEL_ADMIN_ID') {
      if (!text) return;
      const adminId = text.trim();
      const db = readDb();

      if (db.admins && db.admins.includes(adminId)) {
        db.admins = db.admins.filter(id => id !== adminId);
        writeDb(db);
        bot.sendMessage(chatId, `🗑️ Admin (ID: \`${adminId}\`) muvaffaqiyatli o'chirildi!`, {
          parse_mode: 'Markdown',
          reply_markup: getMainMenuKeyboard(userId).reply_markup
        });
      } else {
        bot.sendMessage(chatId, `❌ Adminlar ro'yxatida bunday ID (${adminId}) topilmadi.`, getMainMenuKeyboard(userId));
      }
      delete userStates[chatId];
      return;
    }
  }

  // Buyruqlar va oddiy xabarlarni qayta ishlash
  if (text === '/start') {
    bot.sendMessage(
      chatId,
      `Assalomu alaykum! Kino botimizga xush kelibsiz.\n\nKino topish uchun kalit raqamini yuboring.`,
      getMainMenuKeyboard(userId)
    );
    return;
  }

  if (text === '🔍 Kino izlash') {
    bot.sendMessage(chatId, "Kino kalit raqamini yuboring (masalan: 1234):");
    return;
  }

  if (text === '🏆 Top Donaters') {
    const textStats = `🏆 *Top Donatorlarimiz:*\n\n` +
      `1. Admin — 150 000 UZS\n` +
      `2. Sardor — 70 000 UZS\n` +
      `3. Shahzod — 50 000 UZS\n\n` +
      `Loyiha rivoji va faoliyatini qo'llab-quvvatlash istagida bo'lsangiz, quyidagi tugma orqali donat qilishingiz mumkin!`;

    bot.sendMessage(chatId, textStats, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: "💸 Donat qilish", callback_data: "donate" }]
        ]
      }
    });
    return;
  }

  if (text === '⚙️ Admin Panel' && isAdminUser(userId)) {
    sendAdminPanel(chatId, userId);
    return;
  }

  // Agar boshqa hech narsa mos kelmasa va matn bo'lsa - kino qidirish
  if (text) {
    const db = readDb();
    const movie = db.movies[text.trim()];

    if (movie) {
      const caption = `🎥 *Kino nomi:* ${movie.name}\n\n📝 *Tavsif:* ${movie.description}\n\n🔑 *Kodi:* ${movie.key}`;

      if (movie.fileType === 'video') {
        bot.sendVideo(chatId, movie.fileId, { caption: caption, parse_mode: 'Markdown' });
      } else if (movie.fileType === 'document') {
        bot.sendDocument(chatId, movie.fileId, { caption: caption, parse_mode: 'Markdown' });
      } else if (movie.fileType === 'photo') {
        bot.sendPhoto(chatId, movie.fileId, { caption: caption, parse_mode: 'Markdown' });
      } else {
        bot.sendMessage(chatId, `${caption}\n\n🔗 *Havola:* ${movie.fileId}`, { parse_mode: 'Markdown' });
      }
    } else {
      bot.sendMessage(chatId, "❌ Bu kod bilan kino topilmadi. Iltimos, kodni to'g'ri kiriting yoki menyudan foydalaning.");
    }
  }
});

// Callback Query (Inline tugmalar uchun)
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const userId = query.from.id;
  const data = query.data;

  // Obunani tekshirish tugmasi bosilganda
  if (data === 'check_sub') {
    const isSubscribed = await checkSubscription(userId);
    if (isSubscribed) {
      bot.answerCallbackQuery(query.id, { text: "Rahmat! Obuna tasdiqlandi." });
      bot.sendMessage(chatId, "Xush kelibsiz! Kanallarga obuna bo'lingani tasdiqlandi.", getMainMenuKeyboard(userId));
    } else {
      bot.answerCallbackQuery(query.id, { text: "Iltimos, avval obuna bo'ling!", show_alert: true });
      bot.sendMessage(chatId, "❌ Siz hali kanallarga a'zo bo'lmadingiz. Iltimos, obuna bo'lib qaytadan 'Tasdiqlash' tugmasini bosing.");
    }
    return;
  }

  // Donat qilish
  if (data === 'donate') {
    bot.answerCallbackQuery(query.id);
    bot.sendMessage(chatId, `Loyiha rivoji uchun donat qilish ma'lumotlari:\n\n${CARD_DETAILS}\n\nDonat qilib bo'lgach, skrinshotni adminga yuborishingiz mumkin. E'tiboringiz uchun rahmat!`);
    return;
  }

  // Faqat admin yoki super admin ruxsatlari uchun
  if (!isAdminUser(userId)) {
    bot.answerCallbackQuery(query.id, { text: "Ruxsat etilmagan!", show_alert: true });
    return;
  }

  // ADMIN: Kino qo'shish bosqichi
  if (data === 'admin_add_movie') {
    bot.answerCallbackQuery(query.id);
    userStates[chatId] = { state: 'AWAITING_MOVIE_NAME' };
    bot.sendMessage(chatId, "Yangi kino qo'shish boshlandi.\n\nKino nomini kiriting:", {
      reply_markup: {
        keyboard: [[{ text: '❌ Jarayonni bekor qilish' }]],
        resize_keyboard: true
      }
    });
    return;
  }

  // ADMIN: Kino o'chirish bosqichi
  if (data === 'admin_del_movie') {
    bot.answerCallbackQuery(query.id);
    userStates[chatId] = { state: 'AWAITING_MOVIE_DELETE_KEY' };
    bot.sendMessage(chatId, "O'chirmoqchi bo'lgan kino kalit raqamini (kodini) yozib yuboring:", {
      reply_markup: {
        keyboard: [[{ text: '❌ Jarayonni bekor qilish' }]],
        resize_keyboard: true
      }
    });
    return;
  }

  // ADMIN: Kinolar ro'yxati
  if (data === 'admin_list_movies') {
    bot.answerCallbackQuery(query.id);
    const db = readDb();
    const keys = Object.keys(db.movies);
    if (keys.length === 0) {
      bot.sendMessage(chatId, "Hozircha bazada kinolar mavjud emas.");
    } else {
      let listText = "📋 *Bazada mavjud kinolar ro'yxati:*\n\n";
      keys.forEach((key) => {
        listText += `🔑 Kod: *${key}* | 🎥 Nomi: *${db.movies[key].name}*\n`;
      });
      bot.sendMessage(chatId, listText, { parse_mode: 'Markdown' });
    }
    return;
  }

  // SUPER ADMIN: Yangi admin qo'shish
  if (data === 'super_add_admin') {
    bot.answerCallbackQuery(query.id);
    userStates[chatId] = { state: 'AWAITING_ADD_ADMIN_ID' };
    bot.sendMessage(chatId, "Qo'shmoqchi bo'lgan adminingizning Telegram ID raqamini (masalan: 987654321) yuboring:", {
      reply_markup: {
        keyboard: [[{ text: '❌ Jarayonni bekor qilish' }]],
        resize_keyboard: true
      }
    });
    return;
  }

  // SUPER ADMIN: Adminni o'chirish
  if (data === 'super_del_admin') {
    bot.answerCallbackQuery(query.id);
    userStates[chatId] = { state: 'AWAITING_DEL_ADMIN_ID' };
    bot.sendMessage(chatId, "O'chirib yubormoqchi bo'lgan adminingizning Telegram ID raqamini yozib yuboring:", {
      reply_markup: {
        keyboard: [[{ text: '❌ Jarayonni bekor qilish' }]],
        resize_keyboard: true
      }
    });
    return;
  }

  // SUPER ADMIN: Adminlar ro'yxati
  if (data === 'super_list_admins') {
    bot.answerCallbackQuery(query.id);
    const db = readDb();
    const admins = db.admins || [];
    if (admins.length === 0) {
      bot.sendMessage(chatId, "Hozircha qo'shimcha adminlar tayinlanmagan.");
    } else {
      let listText = "👥 *Tayinlangan adminlar ro'yxati (Telegram IDlari):*\n\n";
      admins.forEach((adminId, idx) => {
        listText += `${idx + 1}. \`${adminId}\`\n`;
      });
      bot.sendMessage(chatId, listText, { parse_mode: 'Markdown' });
    }
    return;
  }

  // SUPER ADMIN: Statistika va kirgan foydalanuvchilar ro'yxati
  if (data === 'super_stats') {
    bot.answerCallbackQuery(query.id);
    const db = readDb();
    const users = db.users || {};
    const userIds = Object.keys(users);

    let statsText = `📊 *Bot statistikasi:*\n\n👥 Umumiy foydalanuvchilar soni: *${userIds.length}* ta\n`;

    if (userIds.length > 0) {
      statsText += `\n*Oxirgi qo'shilgan 10 ta foydalanuvchi:*\n`;
      // Oxirgi 10 ta foydalanuvchi
      const lastUsers = userIds.slice(-10).reverse();
      lastUsers.forEach((uid, idx) => {
        const u = users[uid];
        const fullName = [u.firstName, u.lastName].filter(Boolean).join(' ') || 'Noma\'lum';
        const usernameStr = u.username ? `@${u.username}` : 'Mavjud emas';
        statsText += `${idx + 1}. ID: \`${u.id}\` | Ism: ${fullName} | Username: ${usernameStr}\n`;
      });
    }
    bot.sendMessage(chatId, statsText, { parse_mode: 'Markdown' });
    return;
  }
});
