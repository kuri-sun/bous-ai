from fastapi import APIRouter

from app.api.endpoints import extract, generate

api_router = APIRouter()
api_router.include_router(extract.router)
api_router.include_router(generate.router)
