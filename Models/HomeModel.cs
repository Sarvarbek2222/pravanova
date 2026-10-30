/// <summary>Bosh sahifa ma'lumotlari: test bo'limlari uchun sonlar.</summary>
public class HomeModel
{
    public int BankSize { get; set; }
    public int BiletCount { get; set; }
    public int TopicCount { get; set; }

    /// <summary>Eng ko'p savolli mavzular (bosh sahifadagi tezkor havolalar uchun).</summary>
    public List<(string Topic, int Count)> TopTopics { get; set; } = new();

    /// <summary>Joriy o'quvchi statistikasi (tayyorlik, seriya, xatolar); topilmasa — null.</summary>
    public UserStats? Me { get; set; }
}
