FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY FraudApi/FraudApi.csproj FraudApi/
RUN dotnet restore FraudApi/FraudApi.csproj
COPY FraudApi FraudApi
RUN dotnet publish FraudApi/FraudApi.csproj -c Release -o /out --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /out .
ENV ASPNETCORE_URLS=http://+:5055 AlertsDbPath=/data/alertas.db
EXPOSE 5055
ENTRYPOINT ["dotnet", "FraudApi.dll"]
