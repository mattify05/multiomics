## Production image for the OmicsAI FastAPI ML worker.
## Build context MUST be the repo root so the `ml/` package is included:
##   docker build -f ml/deploy/Dockerfile -t omics-ml-api .
##
## Override SPATIAL=1 at build time to install heavy spatial deps (scanpy, anndata, etc.):
##   docker build -f ml/deploy/Dockerfile --build-arg SPATIAL=1 -t omics-ml-api .

FROM python:3.11-slim

ARG SPATIAL=0
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PORT=8787

WORKDIR /app

# System deps for scientific Python wheels (numpy, scipy, scikit-learn).
RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential curl \
 && rm -rf /var/lib/apt/lists/*

# Install Python deps first so this layer is cached when only source changes.
COPY ml/requirements.txt        ml/requirements.txt
COPY ml/requirements-tabular.txt ml/requirements-tabular.txt
COPY ml/requirements-spatial.txt ml/requirements-spatial.txt

RUN pip install --upgrade pip \
 && pip install -r ml/requirements.txt \
 && pip install -r ml/requirements-tabular.txt \
 && pip install fastapi "uvicorn[standard]" pydantic httpx \
 && if [ "$SPATIAL" = "1" ]; then pip install -r ml/requirements-spatial.txt; fi

# Copy the ml/ package (worker source).
COPY ml/ ml/

EXPOSE 8787

# Health endpoint used by orchestrators / load balancers.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/health" || exit 1

# uvicorn binds to $PORT so the same image works on Fly, Render, Railway, Cloud Run.
CMD ["sh", "-c", "uvicorn ml.api.main:app --host 0.0.0.0 --port ${PORT}"]
