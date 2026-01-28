import requests

BASE_URL = "https://bkxdsxnxrtcqnkdcdist.supabase.co/functions/v1"
API_KEY_NAME = "Authorization"
API_KEY_VALUE = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJreGRzeG54cnRjcW5rZGNkaXN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4NDM5MjksImV4cCI6MjA4NDQxOTkyOX0.zL0pnHHeqUSZxSwSSlI1oR747RD747KThVm64_JDziA"
TIMEOUT = 30

def test_send_aftercare_reminder_notifications():
    url = f"{BASE_URL}/aftercare-reminder"
    headers = {
        API_KEY_NAME: API_KEY_VALUE,
        "Content-Type": "application/json"
    }
    try:
        response = requests.post(url, headers=headers, timeout=TIMEOUT)
        # Ensure HTTP status code 200 OK
        assert response.status_code == 200, f"Expected status code 200, got {response.status_code}"

        # Ensure response content is not empty and valid JSON
        content = response.content
        assert content, "Response content is empty"
        try:
            json_resp = response.json()
        except Exception as e:
            assert False, f"Response is not valid JSON: {str(e)}"

        # Validate response contains 'message' and 'appointmentIds'
        assert "message" in json_resp and isinstance(json_resp["message"], str), "'message' missing or not a string"
        assert "appointmentIds" in json_resp and isinstance(json_resp["appointmentIds"], list), "'appointmentIds' missing or not a list"
        # Validate all appointmentIds are strings
        assert all(isinstance(aid, str) for aid in json_resp["appointmentIds"]), "Not all appointment IDs are strings"

    except requests.exceptions.RequestException as e:
        assert False, f"Request failed: {str(e)}"

test_send_aftercare_reminder_notifications()
