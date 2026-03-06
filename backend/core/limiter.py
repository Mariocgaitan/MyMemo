from slowapi import Limiter
from slowapi.util import get_remote_address

# Shared rate limiter instance — uses client IP as key.
# Imported by main.py (to register middleware) and endpoint modules (to apply decorators).
limiter = Limiter(key_func=get_remote_address)
