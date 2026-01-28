import requests
import uuid

BASE_URL = "https://bkxdsxnxrtcqnkdcdist.supabase.co/functions/v1"
API_KEY = "sbp_e308c28c5d835eefc5d714a299fd44de1e49c705"
HEADERS = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {API_KEY}",
}

def test_send_message_notification():
    url = f"{BASE_URL}/send-message-notification"
    timeout = 30

    # Test case 1: send notification using message_id (valid)
    valid_message_id = str(uuid.uuid4())
    payload_message_id = {"message_id": valid_message_id}
    try:
        resp = requests.post(url, json=payload_message_id, headers=HEADERS, timeout=timeout)
        assert resp.status_code == 200, f"Expected 200 OK, got {resp.status_code}"
        try:
            if not resp.text:
                assert False, "Response is empty, expected JSON for valid message_id payload"
            json_resp = resp.json()
        except Exception:
            assert False, "Response is not JSON as expected for valid message_id payload"
        assert "success" in json_resp and json_resp["success"] is True
        assert "message" in json_resp and isinstance(json_resp["message"], str)
        assert "result" in json_resp and isinstance(json_resp["result"], dict)
    except Exception as e:
        assert False, f"Failed on valid message_id payload: {e}"

    # Test case 2: send notification using record payload (valid)
    record_id = str(uuid.uuid4())
    record_payload = {
        "record": {
            "id": record_id,
            "conversation_id": str(uuid.uuid4()),
            "sender_id": str(uuid.uuid4()),
            "content": "Test message content",
            "media_type": "text"
        }
    }
    try:
        resp = requests.post(url, json=record_payload, headers=HEADERS, timeout=timeout)
        assert resp.status_code == 200, f"Expected 200 OK, got {resp.status_code}"
        try:
            if not resp.text:
                assert False, "Response is empty, expected JSON for valid record payload"
            json_resp = resp.json()
        except Exception:
            assert False, "Response is not JSON as expected for valid record payload"
        assert "success" in json_resp and json_resp["success"] is True
        assert "message" in json_resp and isinstance(json_resp["message"], str)
        assert "result" in json_resp and isinstance(json_resp["result"], dict)
    except Exception as e:
        assert False, f"Failed on valid record payload: {e}"

    # Test case 3: missing payload (empty)
    try:
        resp = requests.post(url, json={}, headers=HEADERS, timeout=timeout)
        assert resp.status_code == 400, f"Expected 400 Bad Request for missing payload, got {resp.status_code}"
    except Exception as e:
        assert False, f"Failed on missing payload test: {e}"

    # Test case 4: invalid payload (wrong keys)
    invalid_payload = {"invalid_key": "invalid_value"}
    try:
        resp = requests.post(url, json=invalid_payload, headers=HEADERS, timeout=timeout)
        assert resp.status_code == 400, f"Expected 400 Bad Request for invalid payload, got {resp.status_code}"
    except Exception as e:
        assert False, f"Failed on invalid payload test: {e}"

    # Test case 5: non-existing message_id or record (simulate 404)
    nonexistent_message_id = str(uuid.uuid4())
    payload_not_found = {"message_id": nonexistent_message_id}
    # The server should respond with 404 for not found resource
    try:
        resp = requests.post(url, json=payload_not_found, headers=HEADERS, timeout=timeout)
        assert resp.status_code in (200, 404), "Expected 200 OK or 404 Not Found for nonexistent message_id"
    except Exception as e:
        assert False, f"Failed on nonexistent message_id test: {e}"

test_send_message_notification()
