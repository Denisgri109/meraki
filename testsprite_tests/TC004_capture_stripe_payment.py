import requests

BASE_URL = "https://bkxdsxnxrtcqnkdcdist.supabase.co/functions/v1"
API_KEY = "sbp_e308c28c5d835eefc5d714a299fd44de1e49c705"
HEADERS = {
    "apikey": API_KEY,
    "Content-Type": "application/json"
}
TIMEOUT = 30

def test_capture_stripe_payment():
    payment_intent_id = None
    # First create a PaymentIntent with capture_method manual to have a payment_intent_id to capture
    create_intent_payload = {
        "amount": 1000,
        "currency": "eur",
        "appointment_id": "test-appointment-001",
        "capture_method": "manual"
    }

    try:
        # Create PaymentIntent
        create_resp = requests.post(
            f"{BASE_URL}/create-payment-intent",
            headers=HEADERS,
            json=create_intent_payload,
            timeout=TIMEOUT
        )
        assert create_resp.status_code == 200, f"Create PaymentIntent failed: {create_resp.text}"
        create_data = create_resp.json()
        assert "paymentIntentId" in create_data and create_data["paymentIntentId"], "paymentIntentId missing in response"
        payment_intent_id = create_data["paymentIntentId"]

        # Capture the previously authorized PaymentIntent
        capture_payload = {
            "payment_intent_id": payment_intent_id
        }
        capture_resp = requests.post(
            f"{BASE_URL}/capture-payment",
            headers=HEADERS,
            json=capture_payload,
            timeout=TIMEOUT
        )
        assert capture_resp.status_code == 200, f"Capture payment failed: {capture_resp.text}"
        capture_data = capture_resp.json()
        assert capture_data.get("success") is True, f"Payment capture not successful: {capture_data}"
        assert "status" in capture_data and isinstance(capture_data["status"], str) and capture_data["status"], "Missing or invalid status in capture response"

    finally:
        # Cleanup: cancel payment intent if it exists and is not captured to avoid leaving test data
        if payment_intent_id:
            try:
                cancel_payload = {"payment_intent_id": payment_intent_id}
                requests.post(
                    f"{BASE_URL}/cancel-payment",
                    headers=HEADERS,
                    json=cancel_payload,
                    timeout=TIMEOUT
                )
            except Exception:
                pass

test_capture_stripe_payment()
