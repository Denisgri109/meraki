import requests

base_url = "https://bkxdsxnxrtcqnkdcdist.supabase.co/functions/v1"
api_key = "sbp_e308c28c5d835eefc5d714a299fd44de1e49c705"
headers = {
    "Content-Type": "application/json",
    "apikey": api_key,
    "Authorization": f"Bearer {api_key}"
}
timeout = 30

def test_send_marketing_notification():
    url = f"{base_url}/send-marketing-notification"
    
    # Test unauthorized access (no auth header)
    resp_unauth = requests.post(url, json={"title": "Promo", "body": "Big Sale"}, timeout=timeout)
    assert resp_unauth.status_code == 401, f"Expected 401, got {resp_unauth.status_code}"

    # Test missing required fields title/body
    resp_missing_title = requests.post(url, headers=headers, json={"body": "Big Sale"}, timeout=timeout)
    assert resp_missing_title.status_code == 400, f"Expected 400 for missing title, got {resp_missing_title.status_code}"
    resp_missing_body = requests.post(url, headers=headers, json={"title": "Promo"}, timeout=timeout)
    assert resp_missing_body.status_code == 400, f"Expected 400 for missing body, got {resp_missing_body.status_code}"

    # Test forbidden access for non-owner/admin (simulate by using wrong api key)
    wrong_headers = {
        "Content-Type": "application/json",
        "apikey": "invalid_key",
        "Authorization": "Bearer invalid_key"
    }
    resp_forbidden = requests.post(url, headers=wrong_headers, json={"title": "Promo", "body": "Big Sale"}, timeout=timeout)
    # Endpoint doc says 403 is for "Only owners can send marketing notifications"
    if resp_forbidden.status_code not in (401, 403):
        raise AssertionError(f"Expected 401 or 403 for forbidden access, got {resp_forbidden.status_code}")

    # Test successful send without role_filter
    payload = {
        "title": "Spring Sale",
        "body": "Enjoy 20% off on all services!"
    }
    resp_success = requests.post(url, headers=headers, json=payload, timeout=timeout)
    assert resp_success.status_code == 200, f"Expected 200 on success, got {resp_success.status_code}"
    data = resp_success.json()
    assert isinstance(data.get("success"), bool), "Missing or invalid 'success' in response"
    assert "message" in data, "Missing 'message' in response"
    assert isinstance(data.get("total_users"), int), "Missing or invalid 'total_users' in response"
    assert isinstance(data.get("eligible_users"), int), "Missing or invalid 'eligible_users' in response"

    # Test successful send with role_filter set to "owner"
    payload_role = {
        "title": "Owner Exclusive",
        "body": "Special notification for owners only",
        "role_filter": "owner"
    }
    resp_success_role = requests.post(url, headers=headers, json=payload_role, timeout=timeout)
    assert resp_success_role.status_code == 200, f"Expected 200 on success with role_filter, got {resp_success_role.status_code}"
    data_role = resp_success_role.json()
    assert isinstance(data_role.get("success"), bool), "Missing or invalid 'success' in response with role_filter"
    assert "message" in data_role, "Missing 'message' in response with role_filter"
    assert isinstance(data_role.get("total_users"), int), "Missing or invalid 'total_users' in response with role_filter"
    assert isinstance(data_role.get("eligible_users"), int), "Missing or invalid 'eligible_users' in response with role_filter"

test_send_marketing_notification()
