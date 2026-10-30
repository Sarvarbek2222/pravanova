# AvtoPrava Nova

`AvtoPravaSam_ptest` loyihasining yangi dizayndagi alohida nusxasi. Imkoniyatlari bir xil
(real imtihon, 20/40/80/100/200 savol, marafon, 66 bilet, 42 mavzu, xatolar ustida ishlash, savol qidirish,
kabinet, admin panel, 3 til, mobil API, obuna), ustiga kengaytirilgan tahlil qo'shilgan.

## Ishga tushirish

1. OSPanel'dagi MySQL 8 ishlab turgan bo'lishi kerak (`localhost:3306`, `root`, parolsiz).
2. `start.cmd` faylini ikki marta bosing yoki terminalda:

```
cd C:\Users\Sarvar_PC\OneDrive\Desktop\AvtoPravaNova
dotnet run --launch-profile http
```

3. Brauzerda oching: http://localhost:5390

Eski loyiha 5258-portda ishlaydi, yangisi 5390-portda — ikkalasi bir vaqtda ishlashi mumkin
(cookie nomlari ham har xil: `nova.auth`, `nova.did`).

## Baza

- Alohida baza: `avtoprava_nova` (eski `baza_ptest` ga bog'liq emas).
- Ko'chirilgan: `Questions` (1320), `Options` (4333), `QuestionTopics` (1263), `SubscriptionPlans`, `AppSettings`.
  Ikkala bazada savollar, variantlar va mavzular MD5 checksum bo'yicha bir xil ekani tekshirilgan.
- Savol rasmlari: `wwwroot/uploads` (774 fayl, eski loyihadan nusxa).
- Foydalanuvchilar va natijalar yangi bazada noldan boshlanadi. Birinchi ishga tushishda jadvallar
  va super admin (`appsettings.json` → `DefaultAdmin`) avtomatik yaratiladi.

## Kirish

- Super admin: `appsettings.json` → `DefaultAdmin`.
- O'quvchilarni admin panel → Foydalanuvchilar bo'limida qo'shing.

## Nima o'zgardi

- **Dizayn:** yangi dizayn tizimi (`wwwroot/css/app.css`): yorug' va qorong'i rejim, chap menyu,
  telefonda pastki menyu, hover effektlari, Plus Jakarta Sans / Sora shriftlari.
- **Testlar:** barcha 10 ta test sahifasi bitta dvigatelda (`wwwroot/js/nova-test.js`, `Views/Shared/_NovaTest.cshtml`).
  Qoidalar o'zgarmagan: F1–F5, ←/→, avtomatik o'tish, 90% o'tish balli, real imtihonda tasdiqlash,
  25 daqiqa va 3-xatoda to'xtash, "Ko'rib chiqish", "Xatolarni ishlash", "Qayta ishlash".
  Savol raqamlari navigatsiyasi pastda; rasmsiz savollarda logotip ko'rsatiladi.
- **Tahlil (qo'shimcha):** o'rtacha javob vaqti (har bir javob vaqti `TestAnswers.TimeMs` ga yoziladi),
  imtihondan o'tish ehtimoli, haftalik solishtirish, natijalar dinamikasi grafigi, joriy va eng uzun seriya,
  18 haftalik faollik xaritasi, hafta kunlari va soatlar bo'yicha faollik, biletlar xaritasi,
  eng ko'p xato qilingan top-10 savol ("Shularni ishlash"). Biletlar va mavzular ro'yxatida — har biri bo'yicha eng yaxshi natija.
