import requests

BASE_URL = "https://bkxdsxnxrtcqnkdcdist.supabase.co/functions/v1"
API_KEY = "sbp_e308c28c5d835eefc5d714a299fd44de1e49c705"
HEADERS = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {API_KEY}"
}
TIMEOUT = 30


def test_cancel_stripe_payment_hold():
    payment_intent_id = None

    # First create a PaymentIntent to have a valid payment_intent_id to cancel
    create_intent_url = f"{BASE_URL}/create-payment-intent"
    create_payload = {
        "amount": 1000,
        "currency": "eur",
        "appointment_id": "test-appointment-123",
        "capture_method": "manual"
    }

    try:
        response = requests.post(create_intent_url, json=create_payload, headers=HEADERS, timeout=TIMEOUT)
        assert response.status_code == 200, f"Failed to create PaymentIntent, status code: {response.status_code}"
        assert response.headers.get('Content-Type', '').lower().startswith('application/json'), "Response content type is not application/json"
        try:
            resp_json = response.json()
        except Exception as e:
            assert False, f"Response is not valid JSON: {str(e)}"
        payment_intent_id = resp_json.get("paymentIntentId")
        assert payment_intent_id, "paymentIntentId not returned in create-payment-intent response"

        # Now call /cancel-payment endpoint to cancel this PaymentIntent
        cancel_payment_url = f"{BASE_URL}/cancel-payment"
        cancel_payload = {
            "payment_intent_id": payment_intent_id
        }
        cancel_resp = requests.post(cancel_payment_url, json=cancel_payload, headers=HEADERS, timeout=TIMEOUT)
        assert cancel_resp.status_code == 200, f"Cancel payment failed, status code: {cancel_resp.status_code}"
        assert cancel_resp.headers.get('Content-Type', '').lower().startswith('application/json'), "Cancel payment response content type is not application/json"
        try:
            cancel_resp_json = cancel_resp.json()
        except Exception as e:
            assert False, f"Cancel payment response is not valid JSON: {str(e)}"
        assert "success" in cancel_resp_json, "'success' key missing in cancel-payment response"
        assert cancel_resp_json["success"] is True, f"Cancel payment not successful: {cancel_resp_json}"
        assert "status" in cancel_resp_json, "'status' key missing in cancel-payment response"
    finally:
        # Cleanup: If PaymentIntent still exists and can be cancelled, try canceling again to release resources
        if payment_intent_id:
            try:
                requests.post(
                    f"{BASE_URL}/cancel-payment",
                    json={"payment_intent_id": payment_intent_id},
                    headers=HEADERS,
                    timeout=TIMEOUT
                )
            except Exception:
                pass


test_cancel_stripe_payment_hold()
