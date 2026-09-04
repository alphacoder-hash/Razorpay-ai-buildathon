import os
from dotenv import load_dotenv
import razorpay

load_dotenv()
client = razorpay.Client(auth=(os.getenv('RAZORPAY_KEY_ID', ''), os.getenv('RAZORPAY_KEY_SECRET', '')))

print("=== Fetching all payment links ===")
try:
    links = client.payment_link.all({"count": 100})
    items = links.get("items", [])
    print(f"Total found: {len(items)}")
    cancelled = 0
    for link in items:
        lid = link.get("id")
        status = link.get("status")
        amt = link.get("amount", 0) / 100
        print(f"  {lid} | status={status} | amount=Rs.{amt}")
        if status in ("created", "partially_paid"):
            try:
                client.payment_link.cancel(lid)
                print(f"    -> CANCELLED")
                cancelled += 1
            except Exception as ce:
                print(f"    -> Cancel failed: {ce}")
    print(f"\nCancelled {cancelled} active links.")
except Exception as e:
    print(f"ERROR: {e}")

print("\n=== Testing new payment link creation ===")
try:
    payload = {
        "amount": 50000,
        "currency": "INR",
        "description": "PayBack AI test recovery link",
        "customer": {
            "email": "test@example.com",
            "contact": "+919999999999",
        },
        "notify": {"email": False, "sms": False},
        "reminder_enable": True,
    }
    link = client.payment_link.create(payload)
    print(f"SUCCESS! Link created:")
    print(f"  ID:  {link.get('id')}")
    print(f"  URL: {link.get('short_url')}")
    # Clean up the test link
    client.payment_link.cancel(link.get("id"))
    print(f"  (test link cancelled)")
except Exception as e:
    print(f"STILL FAILING: {e}")
