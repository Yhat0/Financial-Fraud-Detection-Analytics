using System.Globalization;
using Microsoft.Data.Sqlite;

namespace FraudApi;

/// <summary>Acceso de SOLO LECTURA a resultados/alertas.db (consultas parametrizadas).</summary>
public class AlertRepository
{
    private readonly string _cs;
    public string DbPath { get; }

    public AlertRepository(string dbPath)
    {
        DbPath = dbPath;
        _cs = new SqliteConnectionStringBuilder
        { DataSource = dbPath, Mode = SqliteOpenMode.ReadOnly, Pooling = false }.ToString();
    }

    public bool Exists => File.Exists(DbPath);
    private SqliteConnection Open() { var c = new SqliteConnection(_cs); c.Open(); return c; }

    private const string AlertCols =
        "id,timestamp,step,type,amount,nameOrig,nameDest,prob,alert_level,maha_flag,red_flag,score_maha," +
        "score_red,fan_in,split,isFraud,oldbalanceOrg,newbalanceOrig,oldbalanceDest,newbalanceDest";

    private static AlertDto Map(SqliteDataReader r) => new(
        r.GetInt64(0), r.GetString(1), r.GetInt32(2), r.GetString(3), r.GetDouble(4), r.GetString(5),
        r.GetString(6), r.GetDouble(7), r.GetString(8), r.GetInt32(9) != 0, r.GetInt32(10) != 0,
        r.GetDouble(11), r.GetDouble(12), r.GetInt32(13), r.GetString(14), r.GetInt32(15) != 0,
        r.GetDouble(16), r.GetDouble(17), r.GetDouble(18), r.GetDouble(19));

    private static string NormTs(string s) => s.Replace('T', ' ');

    public PagedResult<AlertDto> GetAlerts(string? level, string? type, string? split, bool onlyFraud,
        string? from, string? to, string sort, int page, int pageSize)
    {
        var where = new List<string>();
        using var c = Open();
        using var cmd = c.CreateCommand();
        if (level != null) { where.Add("alert_level=$level"); cmd.Parameters.AddWithValue("$level", level); }
        if (type != null) { where.Add("type=$type"); cmd.Parameters.AddWithValue("$type", type); }
        if (split != null) { where.Add("split=$split"); cmd.Parameters.AddWithValue("$split", split); }
        if (onlyFraud) where.Add("isFraud=1");
        if (from != null) { where.Add("timestamp>=$from"); cmd.Parameters.AddWithValue("$from", NormTs(from)); }
        if (to != null)
        {
            // 'to' solo con fecha (yyyy-MM-dd) se interpreta inclusivo hasta fin de dia
            var t = NormTs(to);
            where.Add(t.Length <= 10 ? "timestamp<$to" : "timestamp<=$to");
            cmd.Parameters.AddWithValue("$to", t.Length <= 10 ? t + " 99" : t);
        }
        var w = where.Count > 0 ? " WHERE " + string.Join(" AND ", where) : "";
        var order = sort switch
        {
            "timestamp" => "timestamp ASC, id ASC",
            "timestamp_desc" => "timestamp DESC, id DESC",
            "prob" => "prob ASC, id ASC",
            _ => "prob DESC, id ASC" // por defecto prob desc
        };

        cmd.CommandText = $"SELECT COUNT(*) FROM alerts{w}";
        var total = (long)cmd.ExecuteScalar()!;
        cmd.CommandText = $"SELECT {AlertCols} FROM alerts{w} ORDER BY {order} LIMIT $lim OFFSET $off";
        cmd.Parameters.AddWithValue("$lim", pageSize);
        cmd.Parameters.AddWithValue("$off", (long)(page - 1) * pageSize);
        var items = new List<AlertDto>();
        using var r = cmd.ExecuteReader();
        while (r.Read()) items.Add(Map(r));
        return new PagedResult<AlertDto>(items, total, page, pageSize);
    }

    public AlertDto? GetAlert(long id)
    {
        using var c = Open();
        using var cmd = c.CreateCommand();
        cmd.CommandText = $"SELECT {AlertCols} FROM alerts WHERE id=$id";
        cmd.Parameters.AddWithValue("$id", id);
        using var r = cmd.ExecuteReader();
        return r.Read() ? Map(r) : null;
    }

    public IReadOnlyList<TimelineRow> GetTimeline(bool hourly)
    {
        using var c = Open();
        using var cmd = c.CreateCommand();
        cmd.CommandText = hourly
            ? "SELECT timestamp,n_tx,n_alta,n_media,n_fraudes,monto_en_alerta,fraudes_en_alerta FROM timeline_hourly ORDER BY step"
            : "SELECT fecha,n_tx,n_alta,n_media,n_fraudes,monto_en_alerta,fraudes_en_alerta FROM timeline ORDER BY dia";
        var rows = new List<TimelineRow>();
        using var r = cmd.ExecuteReader();
        while (r.Read())
            rows.Add(new(r.GetString(0), r.GetInt64(1), r.GetInt64(2), r.GetInt64(3), r.GetInt64(4),
                         r.GetDouble(5), r.GetInt64(6)));
        return rows;
    }

    /// <summary>summary pivotado: scope -> metric -> valor (numero si parsea, si no texto).</summary>
    public Dictionary<string, Dictionary<string, object>> GetSummary()
    {
        var res = new Dictionary<string, Dictionary<string, object>>();
        using var c = Open();
        using var cmd = c.CreateCommand();
        cmd.CommandText = "SELECT scope,metric,value FROM summary";
        using var r = cmd.ExecuteReader();
        while (r.Read())
        {
            var scope = r.GetString(0);
            var raw = r.GetString(2);
            object v = double.TryParse(raw, NumberStyles.Float, CultureInfo.InvariantCulture, out var d) ? d : raw;
            if (!res.TryGetValue(scope, out var m)) res[scope] = m = new();
            m[r.GetString(1)] = v;
        }
        return res;
    }

    public StatsDto GetStats()
    {
        using var c = Open();
        List<LevelCount> lv = new(); List<TypeCount> tp = new();
        long total = 0, fraudes = 0; double monto = 0;
        using (var cmd = c.CreateCommand())
        {
            cmd.CommandText = "SELECT alert_level,COUNT(*),SUM(isFraud),SUM(amount) FROM alerts GROUP BY alert_level ORDER BY alert_level";
            using var r = cmd.ExecuteReader();
            while (r.Read())
            {
                lv.Add(new(r.GetString(0), r.GetInt64(1), r.GetInt64(2)));
                total += r.GetInt64(1); fraudes += r.GetInt64(2); monto += r.GetDouble(3);
            }
        }
        using (var cmd = c.CreateCommand())
        {
            cmd.CommandText = "SELECT type,COUNT(*),SUM(isFraud) FROM alerts GROUP BY type ORDER BY type";
            using var r = cmd.ExecuteReader();
            while (r.Read()) tp.Add(new(r.GetString(0), r.GetInt64(1), r.GetInt64(2)));
        }
        double? Metric(string name)
        {
            using var cmd = c.CreateCommand();
            cmd.CommandText = "SELECT value FROM summary WHERE scope='test' AND metric=$m";
            cmd.Parameters.AddWithValue("$m", name);
            var o = cmd.ExecuteScalar() as string;
            return o != null && double.TryParse(o, NumberStyles.Float, CultureInfo.InvariantCulture, out var d) ? d : null;
        }
        return new StatsDto(total, lv, tp, fraudes, monto, Metric("alta_precision"), Metric("alta_recall"),
                            Metric("tasa_base"), Metric("auprc_prob"));
    }
}
