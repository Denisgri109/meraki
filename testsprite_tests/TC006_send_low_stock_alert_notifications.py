import requests

BASE_URL = "https://bkxdsxnxrtcqnkdcdist.supabase.co/functions/v1"
API_KEY_NAME = "Authorization"
API_KEY_VALUE = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJreGRzeG54cnRjcW5rZGNkaXN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4NDM5MjksImV4cCI6MjA4NDQxOTkyOX0.zL0pnHHeqUSZxSwSSlI1oR747RD747KThVm64_JDziA"
TIMEOUT = 30

def test_send_low_stock_alert_notifications():
    url = f"{BASE_URL}/low-stock-alert"
    headers = {
        API_KEY_NAME: API_KEY_VALUE,
        "Content-Type": "application/json"
    }
    try:
        response = requests.post(url, headers=headers, timeout=TIMEOUT)
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        assert False, f"Request to {url} failed: {e}"

    try:
        json_resp = response.json()
    except ValueError:
        assert False, "Response is not a valid JSON"

    assert "message" in json_resp, "Response JSON missing 'message'"
    assert isinstance(json_resp["message"], str), "'message' should be a string"
    assert "products" in json_resp, "Response JSON missing 'products'"
    assert isinstance(json_resp["products"], list), "'products' should be a list"

    # Optional: further check that each item in products is string
    for product in json_resp["products"]:
        assert isinstance(product, str), "Each product in 'products' list should be a string"

    # The message should mention stock or alert concept (basic sanity)
    assert any(word in json_resp["message"].lower() for word in ["stock", "alert", "low"]), \
        "'message' does not seem related to low stock alert"

test_send_low_stock_alert_notifications()
