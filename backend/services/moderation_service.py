"""
TravelMemo moderation service.
"""

import re
from typing import Optional, Tuple

from openai import OpenAI

from core.config import settings


class TravelModerationService:
    """Encapsulates moderation checks for public travel memories."""

    def __init__(self):
        self._client: Optional[OpenAI] = None
        self._political_pattern = re.compile(
            r"\\b(partido|eleccion|vota|voto|gobierno|presidente|senador|diputado|campaign|politics?)\\b",
            re.IGNORECASE,
        )
        self._religious_pattern = re.compile(
            r"\\b(conversion|predica|evangeliza|religion verdadera|salvacion|dios te manda)\\b",
            re.IGNORECASE,
        )

    @property
    def client(self) -> OpenAI:
        if self._client is None:
            self._client = OpenAI(api_key=settings.OPENAI_API_KEY)
        return self._client

    def moderate_text(self, text: str) -> Tuple[bool, str]:
        """Returns (is_safe, reason)."""
        content = (text or "").strip()
        if not content:
            return True, ""

        if self._political_pattern.search(content):
            return False, "blocked: political content is out of TravelMemo scope"

        if self._religious_pattern.search(content):
            return False, "blocked: religious proselytism is out of TravelMemo scope"

        if not settings.OPENAI_API_KEY:
            # In local/dev without key, avoid blocking publication by configuration gap.
            return True, ""

        try:
            response = self.client.moderations.create(input=content)
            result = response.results[0]
            if result.flagged:
                categories = result.categories.model_dump()
                triggered = [name for name, active in categories.items() if active]
                reason = ", ".join(triggered) if triggered else "policy flagged"
                return False, f"flagged: {reason}"
            return True, ""
        except Exception:
            # Best-effort moderation in MVP: fail open to avoid false outages.
            return True, ""

    def moderate_image(self, image_url: str) -> Tuple[bool, str]:
        """Returns (is_safe, reason) for public image content."""
        if not image_url or not settings.OPENAI_API_KEY:
            return True, ""

        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "image_url", "image_url": {"url": image_url}},
                            {
                                "type": "text",
                                "text": (
                                    "Classify this image for a public travel app. "
                                    "Reply exactly SAFE or UNSAFE. "
                                    "UNSAFE only for sexual explicit content, graphic violence, "
                                    "hate symbols, or illegal/abusive content."
                                ),
                            },
                        ],
                    }
                ],
                max_tokens=20,
                temperature=0,
            )
            answer = (response.choices[0].message.content or "").strip().upper()
            if answer.startswith("UNSAFE"):
                return False, "flagged: unsafe image content"
            return True, ""
        except Exception:
            # Best-effort moderation in MVP.
            return True, ""


travel_moderation_service = TravelModerationService()
