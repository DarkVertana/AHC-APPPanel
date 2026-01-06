#!/usr/bin/env python3
"""
WooCommerce REST API Direct Test Script

This script tests WooCommerce REST API endpoints directly using Basic Auth.
It bypasses the proxy server and calls WooCommerce API directly.

Usage:
1. Set WOOCOMMERCE_STORE_URL to your WooCommerce store URL (e.g., 'https://yourstore.com')
2. Set WOOCOMMERCE_CONSUMER_KEY to your WooCommerce consumer key
3. Set WOOCOMMERCE_CONSUMER_SECRET to your WooCommerce consumer secret
4. Set USER_EMAIL to the email address to test
5. Run: python test_endpoints.py
"""

import requests
import json
import time
from datetime import datetime
from typing import Dict, Any, Tuple, List, Optional

# ============================================================================
# CONFIGURATION - EDIT THESE VALUES
# ============================================================================

# WooCommerce store URL (without trailing slash, e.g., 'https://yourstore.com')
WOOCOMMERCE_STORE_URL = "https://alternatehealthclub.com"  # Change to your WooCommerce store URL

# WooCommerce REST API credentials
# Get these from: WooCommerce > Settings > Advanced > REST API
WOOCOMMERCE_CONSUMER_KEY = "ck_600915344ad25ea9e9f62c477cda3c5abe2dfdf3"  # Change to your consumer key
WOOCOMMERCE_CONSUMER_SECRET = "cs_26b4ccf364932cb4308cc3f70c02bb5008e236f0"  # Change to your consumer secret

# Email address to test
USER_EMAIL = "akshay@devgraphix.com"  # Change to the email you want to test

# WooCommerce API version (usually 'v3')
API_VERSION = "v3"

# ============================================================================
# END CONFIGURATION
# ============================================================================

# Construct WooCommerce REST API base URL
WOOCOMMERCE_API_BASE = f"{WOOCOMMERCE_STORE_URL.rstrip('/')}/wp-json/wc/{API_VERSION}"


def make_request(url: str, auth: tuple) -> Tuple[Dict[str, Any], float, int]:
    """
    Make a WooCommerce API request with Basic Auth and measure the time taken.
    
    Args:
        url: Full URL to request
        auth: Tuple of (consumer_key, consumer_secret) for Basic Auth
    
    Returns:
        (response_data, time_taken_seconds, status_code)
    """
    start_time = time.time()
    
    try:
        response = requests.get(url, auth=auth, timeout=60)
        elapsed_time = time.time() - start_time
        
        # Try to parse JSON response
        try:
            response_data = response.json()
        except json.JSONDecodeError:
            response_data = {"error": "Invalid JSON response", "raw": response.text[:500]}
        
        return response_data, elapsed_time, response.status_code
    
    except requests.exceptions.Timeout:
        elapsed_time = time.time() - start_time
        return {"error": "Request timeout"}, elapsed_time, 0
    
    except requests.exceptions.RequestException as e:
        elapsed_time = time.time() - start_time
        return {"error": str(e)}, elapsed_time, 0


def fetch_all_paginated(url: str, auth: tuple, per_page: int = 100) -> Tuple[List[Dict], float, int]:
    """
    Fetch all items from a paginated WooCommerce endpoint.
    
    Returns:
        (items_list, total_time_seconds, status_code)
    """
    all_items = []
    current_page = 1
    total_time = 0
    status_code = 200
    
    while True:
        # Build URL with proper query parameter separator
        separator = "&" if "?" in url else "?"
        page_url = f"{url}{separator}per_page={per_page}&page={current_page}"
        data, elapsed, status = make_request(page_url, auth)
        total_time += elapsed
        status_code = status
        
        if status != 200:
            if current_page == 1:
                return [], total_time, status_code
            break
        
        # Handle both array and single object responses
        if isinstance(data, list):
            page_items = data
        elif isinstance(data, dict):
            if 'code' in data or 'message' in data:
                # Error response
                return [], total_time, status_code
            page_items = [data]
        else:
            break
        
        if not page_items:
            break
        
        all_items.extend(page_items)
        
        # Check if we've reached the last page
        if len(page_items) < per_page:
            break
        
        # Safety limit: don't fetch more than 10 pages (1000 items)
        if current_page >= 10:
            print(f"  ⚠️  Reached maximum page limit (10 pages). Some items may be missing.")
            break
        
        current_page += 1
    
    return all_items, total_time, status_code


def find_customer_by_email(email: str, auth: tuple) -> Optional[int]:
    """
    Find customer ID by email address.
    
    Returns:
        Customer ID if found, None otherwise
    """
    url = f"{WOOCOMMERCE_API_BASE}/customers?email={email}&per_page=1"
    data, _, status = make_request(url, auth)
    
    if status == 200:
        if isinstance(data, list) and len(data) > 0:
            return data[0].get('id')
        elif isinstance(data, dict) and 'id' in data:
            return data.get('id')
    
    return None


def format_time(seconds: float) -> str:
    """Format time in seconds and milliseconds."""
    ms = seconds * 1000
    return f"{seconds:.3f}s ({ms:.2f}ms)"


def save_json_file(data: Dict[str, Any], filename: str):
    """Save JSON data to a file."""
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"  ✓ Saved to: {filename}")


def main():
    print("=" * 80)
    print("WooCommerce REST API Direct Test")
    print("=" * 80)
    print(f"Store URL: {WOOCOMMERCE_STORE_URL}")
    print(f"API Base: {WOOCOMMERCE_API_BASE}")
    print(f"Email: {USER_EMAIL}")
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    print()
    
    # Validate credentials
    if not WOOCOMMERCE_CONSUMER_KEY or not WOOCOMMERCE_CONSUMER_SECRET:
        print("❌ ERROR: WooCommerce consumer key and secret must be set")
        return
    
    if WOOCOMMERCE_CONSUMER_KEY.startswith('ck_') and len(WOOCOMMERCE_CONSUMER_KEY) < 10:
        print("⚠️  WARNING: Consumer key looks like a placeholder. Please set your actual key.")
    
    # Set up Basic Auth
    auth = (WOOCOMMERCE_CONSUMER_KEY, WOOCOMMERCE_CONSUMER_SECRET)
    
    results = {}
    total_start_time = time.time()
    
    # Find customer ID first (more efficient)
    print("🔍 Looking up customer by email...")
    customer_id = find_customer_by_email(USER_EMAIL, auth)
    if customer_id:
        print(f"✓ Found customer ID: {customer_id}")
    else:
        print(f"⚠️  Customer not found by email. Will filter subscriptions/orders by email.")
    print()
    
    # ========================================================================
    # Test 1: Subscriptions Endpoint
    # ========================================================================
    print("📋 Test 1: Fetching Subscriptions")
    print("-" * 80)
    
    # Build subscriptions URL
    subscriptions_url = f"{WOOCOMMERCE_API_BASE}/subscriptions"
    if customer_id:
        subscriptions_url += f"?customer={customer_id}"
    else:
        subscriptions_url += "?per_page=100"  # Will filter by email after fetching
    
    print(f"URL: {subscriptions_url}")
    
    # Fetch all subscriptions (with pagination)
    all_subscriptions, subscriptions_time, subscriptions_status = fetch_all_paginated(
        subscriptions_url, auth
    )
    
    print(f"Status Code: {subscriptions_status}")
    print(f"Time Taken: {format_time(subscriptions_time)}")
    
    if subscriptions_status == 200:
        # Filter by email if we didn't use customer ID
        if not customer_id:
            email_lower = USER_EMAIL.lower().strip()
            all_subscriptions = [
                sub for sub in all_subscriptions
                if (
                    sub.get('billing', {}).get('email', '').lower().strip() == email_lower or
                    sub.get('customer_email', '').lower().strip() == email_lower or
                    sub.get('email', '').lower().strip() == email_lower
                )
            ]
        
        count = len(all_subscriptions)
        print(f"Subscriptions Found: {count}")
        
        # Format response similar to proxy API
        subscriptions_data = {
            "success": True,
            "email": USER_EMAIL,
            "customerId": customer_id,
            "count": count,
            "subscriptions": all_subscriptions
        }
        
        results['subscriptions'] = {
            'time_seconds': subscriptions_time,
            'time_ms': subscriptions_time * 1000,
            'status_code': subscriptions_status,
            'count': count
        }
        save_json_file(subscriptions_data, 'subscriptions_response.json')
    else:
        error_msg = all_subscriptions[0] if isinstance(all_subscriptions, list) and all_subscriptions else {"error": "Unknown error"}
        print(f"❌ Error: {error_msg.get('message', error_msg.get('error', 'Unknown error'))}")
        results['subscriptions'] = {
            'time_seconds': subscriptions_time,
            'time_ms': subscriptions_time * 1000,
            'status_code': subscriptions_status,
            'error': str(error_msg)
        }
        save_json_file(error_msg, 'subscriptions_response.json')
    
    print()
    
    # ========================================================================
    # Test 2: Orders Endpoint
    # ========================================================================
    print("📦 Test 2: Fetching All Orders")
    print("-" * 80)
    
    # Build orders URL
    orders_url = f"{WOOCOMMERCE_API_BASE}/orders"
    if customer_id:
        orders_url += f"?customer={customer_id}"
    else:
        orders_url += "?per_page=100"  # Will filter by email after fetching
    
    print(f"URL: {orders_url}")
    
    # Fetch all orders (with pagination)
    all_orders, orders_time, orders_status = fetch_all_paginated(orders_url, auth)
    
    print(f"Status Code: {orders_status}")
    print(f"Time Taken: {format_time(orders_time)}")
    
    if orders_status == 200:
        # Filter by email if we didn't use customer ID
        if not customer_id:
            email_lower = USER_EMAIL.lower().strip()
            all_orders = [
                order for order in all_orders
                if (
                    order.get('billing', {}).get('email', '').lower().strip() == email_lower or
                    order.get('customer_email', '').lower().strip() == email_lower
                )
            ]
        
        count = len(all_orders)
        print(f"Orders Found: {count}")
        
        # Format response similar to proxy API
        orders_data = {
            "success": True,
            "email": USER_EMAIL,
            "customerId": customer_id,
            "count": count,
            "orders": all_orders
        }
        
        results['orders'] = {
            'time_seconds': orders_time,
            'time_ms': orders_time * 1000,
            'status_code': orders_status,
            'count': count
        }
        save_json_file(orders_data, 'orders_response.json')
    else:
        error_msg = all_orders[0] if isinstance(all_orders, list) and all_orders else {"error": "Unknown error"}
        print(f"❌ Error: {error_msg.get('message', error_msg.get('error', 'Unknown error'))}")
        results['orders'] = {
            'time_seconds': orders_time,
            'time_ms': orders_time * 1000,
            'status_code': orders_status,
            'error': str(error_msg)
        }
        save_json_file(error_msg, 'orders_response.json')
    
    print()
    
    # ========================================================================
    # Test 3: Subscription Orders Endpoint (for each subscription)
    # ========================================================================
    print("🔗 Test 3: Fetching Orders for Each Subscription")
    print("-" * 80)
    
    subscription_orders_results = []
    
    if subscriptions_status == 200 and all_subscriptions:
        subscriptions_list = all_subscriptions
        
        if len(subscriptions_list) == 0:
            print("No subscriptions found, skipping subscription orders test.")
        else:
            for idx, subscription in enumerate(subscriptions_list, 1):
                subscription_id = subscription.get('id')
                if not subscription_id:
                    continue
                
                print(f"\n  Subscription {idx}: ID {subscription_id}")
                
                # WooCommerce Subscriptions plugin endpoint for subscription orders
                # Note: This endpoint may vary depending on WooCommerce Subscriptions plugin version
                subscription_orders_url = f"{WOOCOMMERCE_API_BASE}/subscriptions/{subscription_id}/orders"
                print(f"  URL: {subscription_orders_url}")
                
                # Fetch orders for this subscription
                sub_orders_list, sub_orders_time, sub_orders_status = fetch_all_paginated(
                    subscription_orders_url, auth
                )
                
                print(f"  Status Code: {sub_orders_status}")
                print(f"  Time Taken: {format_time(sub_orders_time)}")
                
                if sub_orders_status == 200:
                    count = len(sub_orders_list)
                    print(f"  Orders Found: {count}")
                    
                    # Format response
                    sub_orders_data = {
                        "success": True,
                        "subscriptionId": subscription_id,
                        "count": count,
                        "orders": sub_orders_list
                    }
                    
                    subscription_orders_results.append({
                        'subscription_id': subscription_id,
                        'time_seconds': sub_orders_time,
                        'time_ms': sub_orders_time * 1000,
                        'status_code': sub_orders_status,
                        'count': count
                    })
                    filename = f'subscription_{subscription_id}_orders_response.json'
                    save_json_file(sub_orders_data, filename)
                else:
                    error_msg = sub_orders_list[0] if isinstance(sub_orders_list, list) and sub_orders_list else {"error": "Unknown error"}
                    error_text = error_msg.get('message', error_msg.get('error', 'Unknown error'))
                    print(f"  ❌ Error: {error_text}")
                    subscription_orders_results.append({
                        'subscription_id': subscription_id,
                        'time_seconds': sub_orders_time,
                        'time_ms': sub_orders_time * 1000,
                        'status_code': sub_orders_status,
                        'error': str(error_text)
                    })
                    filename = f'subscription_{subscription_id}_orders_response.json'
                    save_json_file(error_msg, filename)
    else:
        print("Cannot fetch subscription orders - subscriptions endpoint failed.")
    
    results['subscription_orders'] = subscription_orders_results
    print()
    
    # ========================================================================
    # Summary
    # ========================================================================
    total_time = time.time() - total_start_time
    
    print("=" * 80)
    print("📊 PERFORMANCE SUMMARY")
    print("=" * 80)
    print()
    
    # Subscriptions
    if 'subscriptions' in results:
        sub = results['subscriptions']
        print(f"1. Subscriptions Endpoint:")
        print(f"   Time: {format_time(sub['time_seconds'])}")
        print(f"   Status: {sub['status_code']}")
        if 'count' in sub:
            print(f"   Count: {sub['count']} subscriptions")
        print()
    
    # Orders
    if 'orders' in results:
        ord = results['orders']
        print(f"2. Orders Endpoint:")
        print(f"   Time: {format_time(ord['time_seconds'])}")
        print(f"   Status: {ord['status_code']}")
        if 'count' in ord:
            print(f"   Count: {ord['count']} orders")
        print()
    
    # Subscription Orders
    if subscription_orders_results:
        print(f"3. Subscription Orders Endpoint:")
        total_sub_orders_time = sum(r['time_seconds'] for r in subscription_orders_results)
        avg_sub_orders_time = total_sub_orders_time / len(subscription_orders_results)
        print(f"   Total Time: {format_time(total_sub_orders_time)}")
        print(f"   Average Time: {format_time(avg_sub_orders_time)}")
        print(f"   Requests: {len(subscription_orders_results)}")
        for r in subscription_orders_results:
            print(f"   - Subscription {r['subscription_id']}: {format_time(r['time_seconds'])}")
        print()
    
    print(f"Total Test Time: {format_time(total_time)}")
    print()
    
    # Save summary
    summary = {
        'test_timestamp': datetime.now().isoformat(),
        'woocommerce_store_url': WOOCOMMERCE_STORE_URL,
        'woocommerce_api_base': WOOCOMMERCE_API_BASE,
        'email': USER_EMAIL,
        'customer_id': customer_id,
        'results': results,
        'total_time_seconds': total_time,
        'total_time_ms': total_time * 1000
    }
    save_json_file(summary, 'test_summary.json')
    
    print("=" * 80)
    print("✅ Test Complete!")
    print("=" * 80)
    print("\nGenerated Files:")
    print("  - subscriptions_response.json")
    print("  - orders_response.json")
    print("  - subscription_*_orders_response.json (one per subscription)")
    print("  - test_summary.json")


if __name__ == "__main__":
    main()

