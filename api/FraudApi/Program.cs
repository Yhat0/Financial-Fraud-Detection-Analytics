using System.ComponentModel.DataAnnotations;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using FraudApi;

var builder = WebApplication.CreateBuilder(args);

var dbPath = Path.GetFullPath(builder.Configuration["AlertsDbPath"] ?? "../../resultados/alertas.db",
                              builder.Environment.ContentRootPath);
builder.Services.AddSingleton(new AlertRepository(dbPath));
// Claves DEV por defecto (identicas en Python y web). En produccion: cambiarlas por variables de entorno.
var apiKey = builder.Configuration["ApiKey"] ?? "dev-key-change-me";
var scoringKey = builder.Configuration["ScoringApiKey"] ?? "dev-key-change-me";
builder.Services.AddHttpClient("scoring", c =>
{
    c.BaseAddress = new Uri(builder.Configuration["PythonServiceUrl"] ?? "http://localhost:8000");
    c.Timeout = TimeSpan.FromSeconds(10);
    c.DefaultRequestHeaders.Add("X-API-Key", scoringKey);
});
builder.Services.AddOpenApi();
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p
    .WithOrigins(builder.Configuration.GetSection("CorsOrigins").Get<string[]>() ?? ["http://localhost:5173"])
    .AllowAnyHeader().AllowAnyMethod()));
builder.Services.ConfigureHttpJsonOptions(o => o.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase);

var app = builder.Build();
app.UseCors();

// Autenticacion por API key (X-API-Key) para /api/v1/*. /health, /swagger y OpenAPI quedan abiertos.
app.Use(async (ctx, next) =>
{
    if (ctx.Request.Path.StartsWithSegments("/api") && !HttpMethods.IsOptions(ctx.Request.Method))
    {
        var given = ctx.Request.Headers["X-API-Key"].ToString();
        var ok = given.Length > 0 && System.Security.Cryptography.CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(given), Encoding.UTF8.GetBytes(apiKey));
        if (!ok)
        {
            ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
            await ctx.Response.WriteAsJsonAsync(new { message = "API key invalida o ausente (cabecera X-API-Key)" });
            return;
        }
    }
    await next();
});
app.MapOpenApi();                      // /openapi/v1.json
app.MapGet("/swagger", () => Results.Content("""
<!doctype html><html><head><meta charset="utf-8"><title>FraudApi - Swagger</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui.css"></head>
<body><div id="ui"></div>
<script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui-bundle.js"></script>
<script>SwaggerUIBundle({url:'/openapi/v1.json',dom_id:'#ui'});</script></body></html>
""", "text/html")).ExcludeFromDescription();

var repo = app.Services.GetRequiredService<AlertRepository>();
app.Logger.LogInformation("alertas.db: {Path} (existe: {Exists})", repo.DbPath, repo.Exists);

// Si la DB no existe, las rutas de datos responden 503 claro en vez de 500.
IResult NoDb() => Results.Problem(
    $"No se encuentra alertas.db en {repo.DbPath}. Genera la DB con 'python generate_alerts.py' en Model/.",
    statusCode: 503);

// Health checks (sin auth)
app.MapGet("/health", () => Results.Ok(new { status = "ok", service = "fraud-api", db = repo.Exists }));
app.MapGet("/health/ready", async (IHttpClientFactory f, CancellationToken ct) =>
{
    bool scoring;
    try
    {
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        cts.CancelAfter(TimeSpan.FromSeconds(3));
        scoring = (await f.CreateClient("scoring").GetAsync("/v1/health", cts.Token)).IsSuccessStatusCode;
    }
    catch (Exception e) when (e is HttpRequestException or TaskCanceledException) { scoring = false; }
    var ready = repo.Exists && scoring;
    return Results.Json(new { status = ready ? "ready" : "degraded", db = repo.Exists, scoring },
                        statusCode: ready ? 200 : 503);
});

var api = app.MapGroup("/api/v1");

api.MapGet("/alerts", (string? level, string? type, string? split, bool? onlyFraud, string? from, string? to,
                       string? sort, int? page, int? pageSize) =>
{
    if (!repo.Exists) return NoDb();
    var errors = new Dictionary<string, string[]>();
    level = level?.ToUpperInvariant(); type = type?.ToUpperInvariant(); split = split?.ToLowerInvariant();
    if (level is not null and not ("ALTA" or "MEDIA")) errors["level"] = ["debe ser ALTA o MEDIA"];
    if (type is not null and not ("TRANSFER" or "CASH_OUT")) errors["type"] = ["debe ser TRANSFER o CASH_OUT"];
    if (split is not null and not ("train" or "test")) errors["split"] = ["debe ser train o test"];
    if (sort is not null and not ("prob" or "prob_desc" or "timestamp" or "timestamp_desc"))
        errors["sort"] = ["use prob_desc (defecto), prob, timestamp o timestamp_desc"];
    if (errors.Count > 0) return Results.ValidationProblem(errors);
    var p = Math.Max(page ?? 1, 1);
    var ps = Math.Clamp(pageSize ?? 50, 1, 200);
    return Results.Ok(repo.GetAlerts(level, type, split, onlyFraud ?? false, from, to, sort ?? "prob_desc", p, ps));
});

api.MapGet("/alerts/{id:long}", (long id) =>
{
    if (!repo.Exists) return NoDb();
    var a = repo.GetAlert(id);
    return a is null ? Results.NotFound(new { message = $"alerta {id} no encontrada" }) : Results.Ok(a);
});

api.MapGet("/timeline", (string? granularity) =>
{
    if (!repo.Exists) return NoDb();
    if (granularity is not null and not ("daily" or "hourly"))
        return Results.ValidationProblem(new Dictionary<string, string[]> { ["granularity"] = ["use daily u hourly"] });
    return Results.Ok(repo.GetTimeline(granularity == "hourly"));
});

api.MapGet("/summary", () => repo.Exists ? Results.Ok(repo.GetSummary()) : NoDb());
api.MapGet("/stats", () => repo.Exists ? Results.Ok(repo.GetStats()) : NoDb());

// Proxy al servicio Python de scoring en vivo
api.MapPost("/score", async (ScoreRequest req, IHttpClientFactory f, CancellationToken ct) =>
{
    var errs = new List<ValidationResult>();
    if (!Validator.TryValidateObject(req, new ValidationContext(req), errs, true))
        return Results.ValidationProblem(errs.ToDictionary(
            e => e.MemberNames.FirstOrDefault() ?? "request", e => new[] { e.ErrorMessage ?? "invalido" }));
    // El servicio Python espera nombres de campo tal cual PaySim (oldbalanceOrg, ...)
    var body = JsonSerializer.Serialize(new
    {
        type = req.Type, amount = req.Amount, oldbalanceOrg = req.OldbalanceOrg,
        newbalanceOrig = req.NewbalanceOrig, oldbalanceDest = req.OldbalanceDest,
        newbalanceDest = req.NewbalanceDest, nameDest = req.NameDest, step = req.Step
    });
    try
    {
        var resp = await f.CreateClient("scoring").PostAsync("/v1/score",
            new StringContent(body, Encoding.UTF8, new MediaTypeHeaderValue("application/json")), ct);
        var txt = await resp.Content.ReadAsStringAsync(ct);
        return Results.Content(txt, "application/json", Encoding.UTF8, (int)resp.StatusCode);
    }
    catch (Exception e) when (e is HttpRequestException or TaskCanceledException)
    {
        return Results.Json(new
        {
            message = "servicio de scoring no disponible; arráncalo con uvicorn service:app (desde Model/); si ya esta arriba, revisa ScoringApiKey",
            detail = e.Message
        }, statusCode: 503);
    }
});

app.Run();
