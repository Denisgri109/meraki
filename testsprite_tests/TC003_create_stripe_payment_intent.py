import requests

BASE_URL = "https://bkxdsxnxrtcqnkdcdist.supabase.co/functions/v1"
API_KEY = "sbp_e308c28c5d835eefc5d714a299fd44de1e49c705"
HEADERS = {
    "Content-Type": "application/json",
    "supabase": API_KEY
}


def test_create_stripe_payment_intent():
    url = f"{BASE_URL}/create-payment-intent"
    timeout = 30

    # 1. Test successful creation with required fields
    valid_payload = {
        "amount": 1500,
        "appointment_id": "test-appointment-123",
        "currency": "eur",
        "description": "Test payment intent creation",
        "capture_method": "manual"
    }

    try:
        resp = requests.post(url, json=valid_payload, headers=HEADERS, timeout=timeout)
        assert resp.status_code == 200, f"Expected 200 but got {resp.status_code}: {resp.text}"
        json_resp = resp.json()
        assert "clientSecret" in json_resp and isinstance(json_resp["clientSecret"], str) and json_resp["clientSecret"], "Missing or invalid clientSecret in response"
        assert "paymentIntentId" in json_resp and isinstance(json_resp["paymentIntentId"], str) and json_resp["paymentIntentId"], "Missing or invalid paymentIntentId in response"
    except requests.RequestException as e:
        assert False, f"Request failed during valid payload test: {e}"

    # 2. Test missing amount field
    invalid_payload_no_amount = {
        "appointment_id": "test-appointment-123"
    }
    try:
        resp = requests.post(url, json=invalid_payload_no_amount, headers=HEADERS, timeout=timeout)
        assert resp.status_code == 400, f"Expected 400 for missing amount but got {resp.status_code}: {resp.text}"
    except requests.RequestException as e:
        assert False, f"Request failed during missing amount test: {e}"

    # 3. Test missing appointment_id field
    invalid_payload_no_appointment = {
        "amount": 1500
    }
    try:
        resp = requests.post(url, json=invalid_payload_no_appointment, headers=HEADERS, timeout=timeout)
        assert resp.status_code == 400, f"Expected 400 for missing appointment_id but got {resp.status_code}: {resp.text}"
    except requests.RequestException as e:
        assert False, f"Request failed during missing appointment_id test: {e}"


test_create_stripe_payment_intent()
