from fastapi import APIRouter

from app.api.endpoints import extract, generate, places, sessions

api_router = APIRouter()
api_router.include_router(extract.router)
api_router.include_router(generate.router)
api_router.include_router(sessions.router)
api_router.include_router(places.router)
