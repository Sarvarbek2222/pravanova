/// <summary>
/// Yangi test sahifasi (Views/Shared/_NovaTest.cshtml + wwwroot/js/nova-test.js) sozlamalari.
/// Barcha test turlari bitta dvigatelda ishlaydi; farqi faqat shu sozlamalarda.
/// </summary>
public class NovaTest
{
    /// <summary>Savollar manzili (JSON).</summary>
    public string Source { get; set; } = "";

    /// <summary>"array" — savollar ro'yxati; "bilet" — { biletNumber, questions }.</summary>
    public string Format { get; set; } = "array";

    /// <summary>Savollar soni cheklovi (real imtihon — 20). null — hammasi.</summary>
    public int? Limit { get; set; }

    /// <summary>Real imtihon qoidalari: javobni tasdiqlash, 25 daqiqa, 3-xatoda to'xtash, o'tish — 18 ta to'g'ri.</summary>
    public bool Exam { get; set; }

    public string ExitUrl { get; set; } = "/";

    /// <summary>Chiqish tugmasi matni kaliti (qidiruvdan kelganda — "test.backToSearch").</summary>
    public string ExitKey { get; set; } = "test.exit";

    /// <summary>Bilet raqami (bilet testi uchun).</summary>
    public int? Bilet { get; set; }

    /// <summary>Mavzu kaliti (mavzu testi uchun) — bo'sh savollar xabari uchun.</summary>
    public string? Topic { get; set; }

    /// <summary>Natija yoziladigan test turi va havola (TestTypes); null — so'rov manzilidan aniqlanadi.</summary>
    public string? Type { get; set; }
    public string? Ref { get; set; }
}
