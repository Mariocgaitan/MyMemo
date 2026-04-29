"""
Google Places integration for TravelMemo discovery feed.

Provides nearby place search backed by the Google Places API,
enriched with MyMemo public-memory data when available.
"""

from typing import Optional
import httpx

NEARBY_URL = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"

# Map TravelMemo Spanish chip labels → Google Places type
CHIP_TO_GOOGLE_TYPE: dict[str, str] = {
    "comida":   "restaurant",
    "cafe":     "cafe",
    "salidas":  "bar",
    "deporte":  "gym",
    "arte":     "museum",
    "pareja":   "spa",
    "familia":  "park",
    "fiesta":   "night_club",
}

# Reverse: Google type → Spanish chip
GOOGLE_TO_CHIP: dict[str, str] = {
    "restaurant":       "comida",
    "food":             "comida",
    "meal_takeaway":    "comida",
    "meal_delivery":    "comida",
    "bakery":           "comida",
    "cafe":             "cafe",
    "coffee_shop":      "cafe",
    "bar":              "salidas",
    "night_club":       "fiesta",
    "liquor_store":     "salidas",
    "casino":           "fiesta",
    "gym":              "deporte",
    "stadium":          "deporte",
    "sports_complex":   "deporte",
    "bowling_alley":    "deporte",
    "museum":           "arte",
    "art_gallery":      "arte",
    "tourist_attraction": "arte",
    "church":           "arte",
    "place_of_worship": "arte",
    "spa":              "pareja",
    "beauty_salon":     "pareja",
    "park":             "familia",
    "amusement_park":   "familia",
    "zoo":              "familia",
    "aquarium":         "familia",
    "movie_theater":    "salidas",
}

# Default types when no chip filter is active
DEFAULT_GOOGLE_TYPES = ["restaurant", "cafe", "bar", "tourist_attraction", "park"]


class GooglePlacesService:
    def __init__(self, api_key: str):
        self._key = api_key

    def google_types_to_chips(self, google_types: list[str]) -> list[str]:
        """Convert a list of Google type strings to Spanish TravelMemo chip labels."""
        chips: list[str] = []
        for gtype in google_types:
            chip = GOOGLE_TO_CHIP.get(gtype)
            if chip and chip not in chips:
                chips.append(chip)
        return chips

    async def nearby(
        self,
        lat: float,
        lng: float,
        radius_m: int = 2000,
        type_filter: Optional[str] = None,
        language: str = "es",
    ) -> list[dict]:
        """
        Call Google Places Nearby Search.
        Returns a list of raw place dicts with normalized fields (no photo URLs).
        """
        google_type = CHIP_TO_GOOGLE_TYPE.get(type_filter or "") if type_filter else None
        results: list[dict] = []

        async with httpx.AsyncClient(timeout=8.0) as client:
            if google_type:
                data = await self._fetch_nearby(client, lat, lng, radius_m, google_type, language)
                results = data.get("results", [])
            else:
                seen: set[str] = set()
                for gtype in DEFAULT_GOOGLE_TYPES:
                    data = await self._fetch_nearby(client, lat, lng, radius_m, gtype, language)
                    for place in data.get("results", []):
                        pid = place.get("place_id")
                        if pid and pid not in seen:
                            seen.add(pid)
                            results.append(place)

        return [self._normalize(p) for p in results]

    async def _fetch_nearby(
        self,
        client: httpx.AsyncClient,
        lat: float,
        lng: float,
        radius_m: int,
        gtype: str,
        language: str,
    ) -> dict:
        try:
            resp = await client.get(
                NEARBY_URL,
                params={
                    "location": f"{lat},{lng}",
                    "radius": radius_m,
                    "type": gtype,
                    "language": language,
                    "key": self._key,
                },
            )
            resp.raise_for_status()
            return resp.json()
        except Exception:
            return {"results": []}

    def _normalize(self, place: dict) -> dict:
        geometry = place.get("geometry", {}).get("location", {})
        return {
            "google_place_id": place.get("place_id"),
            "name": place.get("name"),
            "address": place.get("vicinity") or place.get("formatted_address"),
            "lat": geometry.get("lat"),
            "lng": geometry.get("lng"),
            "types": place.get("types") or [],
            "rating": place.get("rating"),
            "user_ratings_total": place.get("user_ratings_total"),
            "open_now": (place.get("opening_hours") or {}).get("open_now"),
        }
