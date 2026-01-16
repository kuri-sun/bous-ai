from fastapi import APIRouter

from app.api.endpoints import agentic, generate, places, sessions

api_router = APIRouter()
api_router.include_router(generate.router)
api_router.include_router(sessions.router)
api_router.include_router(places.router)
api_router.include_router(agentic.router)
