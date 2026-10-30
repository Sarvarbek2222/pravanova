// Loyiha fayli AvtoPravaNova deb nomlangan, tarjimalar esa "propro.Resources.SharedResource" nomi ostida — localizer shu nomni izlasin
[assembly: Microsoft.Extensions.Localization.RootNamespace("propro")]

namespace propro
{
    /// <summary>
    /// Umumiy tarjima fayllari uchun belgi-klass (ASP.NET Core standarti: IStringLocalizer&lt;SharedResource&gt;).
    /// Tarjimalar: Resources/SharedResource.resx (o'zbek lotin, standart),
    ///             Resources/SharedResource.ru.resx (rus),
    ///             Resources/SharedResource.uz-Cyrl.resx (o'zbek kirill).
    /// </summary>
    public class SharedResource
    {
    }
}
