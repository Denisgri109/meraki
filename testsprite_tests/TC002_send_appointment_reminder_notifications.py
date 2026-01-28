import requests

BASE_URL = "https://bkxdsxnxrtcqnkdcdist.supabase.co/functions/v1"
API_KEY_NAME = "Authorization"
API_KEY_VALUE = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJreGRzeG54cnRjcW5rZGNkaXN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4NDM5MjksImV4cCI6MjA4NDQxOTkyOX0.zL0pnHHeqUSZxSwSSlI1oR747RD747KThVm64_JDziA"
HEADERS = {
    API_KEY_NAME: API_KEY_VALUE,
    "Content-Type": "application/json"
}
TIMEOUT = 30


def test_send_appointment_reminder_notifications():
    url = f"{BASE_URL}/appointment-reminders"
    try:
        response = requests.post(url, headers=HEADERS, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    assert response.status_code == 200, f"Expected status code 200 but got {response.status_code}"
    try:
        json_resp = response.json()
    except ValueError:
        assert False, "Response is not a valid JSON"

    assert isinstance(json_resp.get("success"), bool), "'success' field is missing or not a boolean"
    assert json_resp.get("success") is True, "'success' field is False"

    assert isinstance(json_resp.get("message"), str), "'message' field is missing or not a string"
    assert json_resp["message"], "'message' field is empty"

    reminders = json_resp.get("reminders")
    assert isinstance(reminders, list), "'reminders' field is missing or not a list"
    # reminder items should be strings
    for r in reminders:
        assert isinstance(r, str), "Reminder items should be strings"

    # Optional debug_tickets check if present
    debug_tickets = json_resp.get("debug_tickets")
    if debug_tickets is not None:
        assert isinstance(debug_tickets, dict), "'debug_tickets' is present but not an object"


test_send_appointment_reminder_notifications()
