"""
User connections endpoints — bidirectional friend connections for sharing memories.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_, update
from sqlalchemy.exc import IntegrityError
from typing import List
import uuid
import json
from datetime import datetime, timezone

from core.database import get_db
from core.deps import get_current_user
from models.database import User, UserConnection, Person
from models.schemas import (
    ConnectionCreate,
    ConnectionAccept,
    ConnectionLinkPerson,
    ConnectionResponse,
    ConnectionStyleUpdate,
    ConnectionUserInfo,
    MessageResponse,
)

router = APIRouter(prefix="/connections", tags=["connections"])


def _connection_to_response(conn: UserConnection) -> ConnectionResponse:
    return ConnectionResponse(
        id=conn.id,
        requester=ConnectionUserInfo(id=conn.requester.id, name=conn.requester.name),
        addressee=ConnectionUserInfo(id=conn.addressee.id, name=conn.addressee.name),
        person_id_in_requester=conn.person_id_in_requester,
        person_id_in_addressee=conn.person_id_in_addressee,
        status=conn.status,
        border_color_requester=conn.border_color_requester,
        border_style_requester=conn.border_style_requester,
        border_color_addressee=conn.border_color_addressee,
        border_style_addressee=conn.border_style_addressee,
        created_at=conn.created_at,
        accepted_at=conn.accepted_at,
    )


# ---------------------------------------------------------------------------
# POST /connections — Send connection request
# ---------------------------------------------------------------------------
@router.post(
    "",
    response_model=ConnectionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Send connection request",
    description="Invite another user by name to share memories where both appear.",
)
async def send_connection_request(
    body: ConnectionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Find target user by ID
    result = await db.execute(
        select(User).where(User.id == body.user_id)
    )
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if target.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot connect with yourself")

    # Validate person_id belongs to current_user
    if body.person_id:
        person_result = await db.execute(
            select(Person).where(
                and_(Person.id == body.person_id, Person.user_id == current_user.id)
            )
        )
        if not person_result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Person not found in your account")

    # Check for existing connection in either direction
    existing = await db.execute(
        select(UserConnection).where(
            or_(
                and_(
                    UserConnection.requester_id == current_user.id,
                    UserConnection.addressee_id == target.id,
                ),
                and_(
                    UserConnection.requester_id == target.id,
                    UserConnection.addressee_id == current_user.id,
                ),
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Connection already exists")

    conn = UserConnection(
        requester_id=current_user.id,
        addressee_id=target.id,
        person_id_in_requester=body.person_id,
    )
    db.add(conn)
    await db.flush()

    # Reload with relationships
    await db.refresh(conn, ["requester", "addressee"])
    await db.commit()
    return _connection_to_response(conn)


# ---------------------------------------------------------------------------
# GET /connections — List accepted connections
# ---------------------------------------------------------------------------
@router.get(
    "",
    response_model=List[ConnectionResponse],
    summary="List my connections",
    description="Return all accepted connections for the current user.",
)
async def list_connections(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(UserConnection).where(
            and_(
                UserConnection.status == "accepted",
                or_(
                    UserConnection.requester_id == current_user.id,
                    UserConnection.addressee_id == current_user.id,
                ),
            )
        )
    )
    conns = result.scalars().all()
    for c in conns:
        await db.refresh(c, ["requester", "addressee"])
    return [_connection_to_response(c) for c in conns]


# ---------------------------------------------------------------------------
# GET /connections/pending — Pending requests received by me
# ---------------------------------------------------------------------------
@router.get(
    "/pending",
    response_model=List[ConnectionResponse],
    summary="Pending connection requests",
    description="Return connection requests received by the current user that are still pending.",
)
async def list_pending_connections(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(UserConnection).where(
            and_(
                UserConnection.status == "pending",
                UserConnection.addressee_id == current_user.id,
            )
        )
    )
    conns = result.scalars().all()
    for c in conns:
        await db.refresh(c, ["requester", "addressee"])
    return [_connection_to_response(c) for c in conns]


# ---------------------------------------------------------------------------
# GET /connections/search — Search users by name (for send-request autocomplete)
# ---------------------------------------------------------------------------
@router.get(
    "/search",
    response_model=List[ConnectionUserInfo],
    summary="Search users by name",
    description="Find users by partial name match. Excludes self and users already connected.",
)
async def search_users(
    q: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if len(q.strip()) < 2:
        return []

    # Collect IDs that are already in a connection with the current user (any status)
    existing_result = await db.execute(
        select(UserConnection).where(
            or_(
                UserConnection.requester_id == current_user.id,
                UserConnection.addressee_id == current_user.id,
            )
        )
    )
    connected_ids: set = set()
    for c in existing_result.scalars().all():
        connected_ids.add(c.requester_id)
        connected_ids.add(c.addressee_id)
    connected_ids.discard(current_user.id)

    query = select(User).where(
        and_(
            User.name.ilike(f"%{q.strip()}%"),
            User.id != current_user.id,
        )
    ).limit(8)

    if connected_ids:
        query = query.where(~User.id.in_(connected_ids))

    users_result = await db.execute(query)
    users = users_result.scalars().all()
    return [ConnectionUserInfo(id=u.id, name=u.name) for u in users]


# ---------------------------------------------------------------------------
# PUT /connections/{id}/accept — Accept + link person + propagate embeddings
# ---------------------------------------------------------------------------
@router.put(
    "/{connection_id}/accept",
    response_model=ConnectionResponse,
    summary="Accept connection request",
    description="Accept a pending request and optionally link the requester to a Person in your DB.",
)
async def accept_connection(
    connection_id: uuid.UUID,
    body: ConnectionAccept,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(UserConnection).where(
            and_(
                UserConnection.id == connection_id,
                UserConnection.addressee_id == current_user.id,
                UserConnection.status == "pending",
            )
        )
    )
    conn = result.scalar_one_or_none()
    if not conn:
        raise HTTPException(status_code=404, detail="Pending connection not found")

    # Validate person_id belongs to current_user (addressee)
    if body.person_id:
        person_result = await db.execute(
            select(Person).where(
                and_(Person.id == body.person_id, Person.user_id == current_user.id)
            )
        )
        if not person_result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Person not found in your account")

    conn.status = "accepted"
    conn.accepted_at = datetime.now(timezone.utc)
    if body.person_id:
        conn.person_id_in_addressee = body.person_id

    # Embedding propagation: if both sides have a linked Person, merge embeddings
    # so each user's face recognizer gets the other's known encodings.
    if conn.person_id_in_requester and conn.person_id_in_addressee:
        await _propagate_embeddings(db, conn)

    await db.flush()
    await db.refresh(conn, ["requester", "addressee"])
    await db.commit()
    return _connection_to_response(conn)


async def _propagate_embeddings(db: AsyncSession, conn: UserConnection) -> None:
    """
    Merge face embeddings bidirectionally between the two linked Person records.
    - person_id_in_requester: requester's Person record FOR the addressee (how requester sees addressee)
    - person_id_in_addressee: addressee's Person record FOR the requester (how addressee sees requester)
    These are different people, so we don't cross-merge them directly.
    Instead we make each user's self-recognition better:
    Copy addressee's own embedding into a person record that requester's recognizer can use,
    and vice versa — only if self_person_id is set on each user.
    This is a best-effort improvement; failures are non-fatal.
    """
    try:
        requester_res = await db.execute(select(User).where(User.id == conn.requester_id))
        requester_user = requester_res.scalar_one_or_none()

        addressee_res = await db.execute(select(User).where(User.id == conn.addressee_id))
        addressee_user = addressee_res.scalar_one_or_none()

        if not (requester_user and addressee_user):
            return

        # Copy addressee's self embedding → person_id_in_requester (requester's record for addressee)
        if addressee_user.self_person_id and conn.person_id_in_requester:
            self_person_res = await db.execute(
                select(Person).where(Person.id == addressee_user.self_person_id)
            )
            self_person = self_person_res.scalar_one_or_none()

            target_res = await db.execute(
                select(Person).where(Person.id == conn.person_id_in_requester)
            )
            target_person = target_res.scalar_one_or_none()

            if self_person and target_person and self_person.face_embedding and target_person.face_embedding:
                target_person.face_embedding = _merge_embeddings(
                    self_person.face_embedding, target_person.face_embedding
                )

        # Copy requester's self embedding → person_id_in_addressee (addressee's record for requester)
        if requester_user.self_person_id and conn.person_id_in_addressee:
            self_person_res = await db.execute(
                select(Person).where(Person.id == requester_user.self_person_id)
            )
            self_person = self_person_res.scalar_one_or_none()

            target_res = await db.execute(
                select(Person).where(Person.id == conn.person_id_in_addressee)
            )
            target_person = target_res.scalar_one_or_none()

            if self_person and target_person and self_person.face_embedding and target_person.face_embedding:
                target_person.face_embedding = _merge_embeddings(
                    self_person.face_embedding, target_person.face_embedding
                )
    except Exception as e:
        # Embedding propagation is best-effort; don't fail the accept
        print(f"[connections] embedding propagation error (non-fatal): {e}")


def _merge_embeddings(source_embedding: str, target_embedding: str, max_count: int = 5) -> str:
    """Combine face embedding lists, keeping up to max_count (target first)."""
    def _parse(raw: str):
        try:
            parsed = json.loads(raw)
            if parsed and isinstance(parsed[0], list):
                return parsed
            return [parsed]
        except Exception:
            return [[float(x) for x in raw.split(",")]]

    combined = (_parse(target_embedding) + _parse(source_embedding))[:max_count]
    return json.dumps(combined)


# ---------------------------------------------------------------------------
# PUT /connections/{id}/reject — Reject a pending request
# ---------------------------------------------------------------------------
@router.put(
    "/{connection_id}/reject",
    response_model=MessageResponse,
    summary="Reject connection request",
)
async def reject_connection(
    connection_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(UserConnection).where(
            and_(
                UserConnection.id == connection_id,
                UserConnection.addressee_id == current_user.id,
                UserConnection.status == "pending",
            )
        )
    )
    conn = result.scalar_one_or_none()
    if not conn:
        raise HTTPException(status_code=404, detail="Pending connection not found")

    conn.status = "rejected"
    await db.commit()
    return MessageResponse(message="Connection rejected")


# ---------------------------------------------------------------------------
# DELETE /connections/{id} — Disconnect (either side can do this)
# ---------------------------------------------------------------------------
@router.delete(
    "/{connection_id}",
    response_model=MessageResponse,
    summary="Disconnect",
    description="Remove an accepted connection. Either side can do this.",
)
async def delete_connection(
    connection_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(UserConnection).where(
            and_(
                UserConnection.id == connection_id,
                or_(
                    UserConnection.requester_id == current_user.id,
                    UserConnection.addressee_id == current_user.id,
                ),
            )
        )
    )
    conn = result.scalar_one_or_none()
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")

    await db.delete(conn)
    await db.commit()
    return MessageResponse(message="Connection removed")


# ---------------------------------------------------------------------------
# PATCH /connections/{id}/link — Assign which Person record represents the partner
# ---------------------------------------------------------------------------
@router.patch(
    "/{connection_id}/link",
    response_model=ConnectionResponse,
    summary="Link partner to a Person record",
    description="Set (or clear) which Person in your photo DB represents your connection partner.",
)
async def link_person_to_connection(
    connection_id: uuid.UUID,
    body: ConnectionLinkPerson,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(UserConnection).where(
            and_(
                UserConnection.id == connection_id,
                UserConnection.status == "accepted",
                or_(
                    UserConnection.requester_id == current_user.id,
                    UserConnection.addressee_id == current_user.id,
                ),
            )
        )
    )
    conn = result.scalar_one_or_none()
    if not conn:
        raise HTTPException(status_code=404, detail="Accepted connection not found")

    # Validate person_id belongs to current user (if provided)
    if body.person_id:
        person_result = await db.execute(
            select(Person).where(
                and_(Person.id == body.person_id, Person.user_id == current_user.id)
            )
        )
        if not person_result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Person not found in your account")

    am_requester = conn.requester_id == current_user.id
    if am_requester:
        conn.person_id_in_requester = body.person_id
    else:
        conn.person_id_in_addressee = body.person_id

    # Propagate embeddings if both sides are now linked
    if conn.person_id_in_requester and conn.person_id_in_addressee:
        await _propagate_embeddings(db, conn)

    await db.flush()
    await db.refresh(conn, ["requester", "addressee"])
    await db.commit()
    return _connection_to_response(conn)


# ---------------------------------------------------------------------------
# PATCH /connections/{id}/style — Update border color/style
# ---------------------------------------------------------------------------
@router.patch(
    "/{connection_id}/style",
    response_model=ConnectionResponse,
    summary="Update border style",
    description="Update the border color and style used on your side of the shared memory cards.",
)
async def update_connection_style(
    connection_id: uuid.UUID,
    body: ConnectionStyleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(UserConnection).where(
            and_(
                UserConnection.id == connection_id,
                UserConnection.status == "accepted",
                or_(
                    UserConnection.requester_id == current_user.id,
                    UserConnection.addressee_id == current_user.id,
                ),
            )
        )
    )
    conn = result.scalar_one_or_none()
    if not conn:
        raise HTTPException(status_code=404, detail="Accepted connection not found")

    # Update only the current user's side
    if conn.requester_id == current_user.id:
        conn.border_color_requester = body.border_color
        conn.border_style_requester = body.border_style
    else:
        conn.border_color_addressee = body.border_color
        conn.border_style_addressee = body.border_style

    await db.flush()
    await db.refresh(conn, ["requester", "addressee"])
    await db.commit()
    return _connection_to_response(conn)
