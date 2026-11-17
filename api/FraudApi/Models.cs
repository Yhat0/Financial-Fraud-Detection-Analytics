using System.ComponentModel.DataAnnotations;

namespace FraudApi;

public record AlertDto(
    long Id, string Timestamp, int Step, string Type, double Amount, string NameOrig, string NameDest,
    double Prob, string AlertLevel, bool MahaFlag, bool RedFlag, double ScoreMaha, double ScoreRed,
    int FanIn, string Split, bool IsFraud, double OldbalanceOrg, double NewbalanceOrig,
    double OldbalanceDest, double NewbalanceDest);

public record PagedResult<T>(IReadOnlyList<T> Items, long Total, int Page, int PageSize);

public record TimelineRow(string Label, long NTx, long NAlta, long NMedia, long NFraudes,
                          double MontoEnAlerta, long FraudesEnAlerta);

public record LevelCount(string Level, long Count, long Fraudes);
public record TypeCount(string Type, long Count, long Fraudes);

public record StatsDto(
    long TotalAlertas, IReadOnlyList<LevelCount> PorNivel, IReadOnlyList<TypeCount> PorTipo,
    long FraudesCapturados, double MontoTotalEnAlerta,
    double? PrecisionAltaTest, double? RecallAltaTest, double? TasaBaseTest, double? AuprcTest);

public class ScoreRequest
{
    [Required, RegularExpression("^(TRANSFER|CASH_OUT)$", ErrorMessage = "type debe ser TRANSFER o CASH_OUT")]
    public string Type { get; set; } = "";
    [Range(0, double.MaxValue)] public double Amount { get; set; }
    public double OldbalanceOrg { get; set; }
    public double NewbalanceOrig { get; set; }
    public double OldbalanceDest { get; set; }
    public double NewbalanceDest { get; set; }
    [Required, MinLength(1)] public string NameDest { get; set; } = "";
    public int? Step { get; set; }
}
