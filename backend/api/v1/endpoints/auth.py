"""
Auth endpoints: register, login, me.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from sqlalchemy.orm.attributes import flag_modified

from core.database import get_db
from core.deps import get_current_user
from core.limiter import limiter
from core.security import create_access_token, hash_password, verify_password
from models.database import User

router = APIRouter()


# ── Schemas ──────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Name is required")
        return v.strip()

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: str
    email: str
    name: str | None

    model_config = {"from_attributes": True}


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def register(request: Request, body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Create a new user account and return an access token."""
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    if body.name and body.name.strip():
        name_check = await db.execute(
            select(User).where(User.name.ilike(body.name.strip()))
        )
        if name_check.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Name already taken",
            )

    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        name=body.name,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """Authenticate with email + password and return an access token."""
    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalar_one_or_none()

    # Always run bcrypt verify to prevent timing-based user enumeration.
    # If no user found, verify against a dummy hash (constant time).
    _DUMMY_HASH = "$2b$12$eImiTXuWVxfM37uY4JANjQ..."
    candidate_hash = user.hashed_password if user else _DUMMY_HASH
    password_ok = verify_password(form_data.password, candidate_hash)

    if not user or not password_ok:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    """Return the currently authenticated user's profile."""
    return UserResponse(
        id=str(current_user.id),
        email=current_user.email,
        name=current_user.name,
    )


# ── Categories ────────────────────────────────────────────────────────────────

class CategoryItem(BaseModel):
    id: str
    label: str
    value: str


class CategoriesPayload(BaseModel):
    categories: List[CategoryItem]


@router.get("/categories", response_model=CategoriesPayload)
async def get_categories(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the current user's custom categories."""
    user_id = current_user.id
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one()
    prefs = user.preferences or {}
    cats = prefs.get("categories", [])
    return CategoriesPayload(categories=cats)


@router.put("/categories", response_model=CategoriesPayload)
async def save_categories(
    payload: CategoriesPayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Replace the current user's categories list."""
    user_id = current_user.id
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one()
    prefs = dict(user.preferences or {})
    prefs["categories"] = [c.model_dump() for c in payload.categories]
    user.preferences = prefs
    flag_modified(user, "preferences")
    await db.commit()
    return CategoriesPayload(categories=payload.categories)
