using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace propro.Controllers
{
    public class TopicController : Controller
    {
        private readonly AppDbContext _context;

        private readonly QuestionBank _bank;
        private readonly StatsService _stats;

        public TopicController(AppDbContext context, QuestionBank bank, StatsService stats)
        {
            _context = context;
            _bank = bank;
            _stats = stats;
        }

        // =========================
        // 1. MAVZULAR RO'YXATI
        // =========================
        public async Task<IActionResult> Index()
        {
            // Mavzu -> savollar soni (xotiradagi keshdan; ptest mavzulari QuestionTopics jadvalidan)
            ViewBag.Counts = (await _bank.ByTopicAsync())
                .ToDictionary(kv => kv.Key, kv => kv.Value.Count);

            // O'quvchining har bir mavzu bo'yicha eng yaxshi natijasi
            ViewBag.Progress = int.TryParse(User.FindFirstValue(System.Security.Claims.ClaimTypes.NameIdentifier), out var uid)
                ? await _stats.GetRefProgressAsync(uid, TestTypes.Topic)
                : new Dictionary<string, RefProgress>();

            return View(Topics.All);
        }

        // =========================
        // 2. TEST PAGE
        // =========================
        public IActionResult Test(string topic)
        {
            if (string.IsNullOrWhiteSpace(topic))
                return RedirectToAction(nameof(Index));

            topic = topic.Trim();

            if (!Topics.All.Contains(topic))
                return RedirectToAction(nameof(Index));

            ViewData["Topic"] = topic;

            return View();
        }

        // =========================
        // 3. QUESTION API
        // =========================
        [HttpGet]
        public async Task<IActionResult> GetQuestions(string topic)
        {
            try
            {
                // Topic bo'sh bo'lsa
                if (string.IsNullOrWhiteSpace(topic))
                {
                    return Json(new List<object>());
                }

                topic = topic.Trim();

                // Mavzu savollari xotiradagi keshdan (bir savol bir nechta mavzuda bo'lishi mumkin)
                var randomQuestions = QuestionBank.Shuffled(await _bank.TopicQuestionsAsync(topic))
                    .Select(QuestionJson.From)
                    .ToList();

                return Json(randomQuestions);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    error = true,
                    message = ex.Message,
                    inner = ex.InnerException?.Message
                });
            }
        }
    }
}