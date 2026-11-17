# Servicio de scoring (FastAPI). Los modelos NO van en la imagen: se montan en /app/Model/models.
FROM python:3.14-slim
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
WORKDIR /app/Model
COPY requirements-service.txt .
RUN pip install --no-cache-dir -r requirements-service.txt
COPY src ./src
COPY service.py .
EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=3s --start-period=30s --retries=5 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/health').status==200 else 1)"
CMD ["uvicorn", "service:app", "--host", "0.0.0.0", "--port", "8000"]
