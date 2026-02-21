import requests
import sys

try:
    response = requests.get("http://localhost:8000", timeout=5)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.json()}")
    sys.exit(0)
except requests.exceptions.ConnectionError:
    print("ERROR: Cannot connect to backend (connection refused)")
    sys.exit(1)
except requests.exceptions.Timeout:
    print("ERROR: Backend timeout (no response)")
    sys.exit(2)
except Exception as e:
    print(f"ERROR: {str(e)}")
    sys.exit(3)
