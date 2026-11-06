from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.data import get_store
from app.routers import advanced, intermediate, minimum


@asynccontextmanager
async def lifespan(_: FastAPI):
    get_store()  # warm the cache so the first request is fast
    yield


app = FastAPI(title="NYISO Congestion Dashboard API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    # The frontend normally runs on http://localhost:3000. Any local port is allowed too, so
    # `npm run demo -- --web-port 3001` or opening http://127.0.0.1:3000 still gets live data.
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "rows_loaded": get_store().row_counts()}


app.include_router(minimum.router, prefix="/api/minimum", tags=["minimum"])
app.include_router(intermediate.router, prefix="/api/intermediate", tags=["intermediate"])
app.include_router(advanced.router, prefix="/api/advanced", tags=["advanced"])
