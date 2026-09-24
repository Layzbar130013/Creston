# ==============================================================================
# CRESTON PREMIUM COLLECTIONS - Production Dockerfile
# Motto: Quality, Style, Trust
# Zero-dependency, multi-threaded Kenyan fashion e-commerce store
# ==============================================================================

FROM python:3.12-slim AS runner

LABEL org.opencontainers.image.title="CRESTON PREMIUM COLLECTIONS" \
      org.opencontainers.image.description="Luxury Kenyan apparel e-commerce store with M-Pesa integration" \
      org.opencontainers.image.vendor="CRESTON PREMIUM COLLECTIONS"

# Install curl for health check probing
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Create application directories and unprivileged service account
RUN groupadd -r creston && useradd -r -g creston -d /app -s /sbin/nologin creston && \
    mkdir -p /app/server /app/public/uploads /app/data && \
    chown -R creston:creston /app

WORKDIR /app

# Application environment configuration
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000 \
    HOST=0.0.0.0 \
    CRESTON_DB_PATH=/app/data/creston.db \
    CRESTON_UPLOAD_DIR=/app/public/uploads

# Copy application source code
COPY --chown=creston:creston server/ /app/server/
COPY --chown=creston:creston public/ /app/public/
COPY --chown=creston:creston run.sh /app/run.sh
COPY --chown=creston:creston README.md /app/README.md

# Pre-seed initial database template
COPY --chown=creston:creston creston.db /app/data/creston.db

# Ensure entrypoint and directories are executable
RUN chmod +x /app/run.sh && \
    chmod -R 775 /app/data /app/public/uploads

# Switch to unprivileged user
USER creston

# Declare mountable storage volumes
VOLUME ["/app/data", "/app/public/uploads"]

# Expose HTTP port
EXPOSE 8000

# Automated container healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://127.0.0.1:${PORT:-8000}/api/store/settings || exit 1

# Production command
CMD ["python3", "server/app.py"]
