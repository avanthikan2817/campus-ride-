# campus-ride-
routes (collection)
 └─ route1 (document)
     └─ buses (subcollection)
         ├─ bus1 (document id = "bus1")
         │    bus_number: "Bus 1"
         │    total_seats: 40
         │    seats_filled: 40
         │    stops: ["Kavaraipettai", "StopB", ...]
         │    priority: 1         # lower = earlier/first to check
         │    estimated_arrival: "2025-09-15T10:25:00"  (optional)
         ├─ bus2
         └─ bus3
# main.py
import os
from flask import jsonify, Request
import firebase_admin
from firebase_admin import credentials, firestore

# Initialize Firebase Admin only once
if os.getenv("GOOGLE_APPLICATION_CREDENTIALS"):
    cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    try:
        firebase_admin.initialize_app(credentials.Certificate(cred_path))
    except ValueError:
        # already initialized
        pass
else:
    # On Cloud Functions use default credentials (no args)
    try:
        firebase_admin.initialize_app()
    except ValueError:
        pass

db = firestore.client()

def check_availability(request: Request):
    """
    GET params:
      - route_id (e.g. "route1")
      - stop (e.g. "Kavaraipettai")
    Returns first upcoming bus (by priority) that has available seats.
    If none have available seats, returns message and suggests the first bus.
    """
    try:
        route_id = request.args.get("route_id")
        stop = request.args.get("stop")
        if not route_id or not stop:
            return jsonify({"error": "Missing route_id or stop parameter"}), 400

        buses_ref = db.collection("routes").document(route_id).collection("buses")
        docs = list(buses_ref.stream())

        buses = []
        for doc in docs:
            d = doc.to_dict()
            d["bus_id"] = doc.id
            # ensure numeric defaults
            d["total_seats"] = int(d.get("total_seats", 0))
            d["seats_filled"] = int(d.get("seats_filled", 0))
            buses.append(d)

        # filter buses that stop at stop
        buses = [b for b in buses if isinstance(b.get("stops"), list) and stop in b["stops"]]

        if not buses:
            return jsonify({"error": f"No buses found for stop '{stop}' on route '{route_id}'"}), 404

        # sort by priority (lowest first)
        buses.sort(key=lambda x: x.get("priority", 999))

        for b in buses:
            available = b["total_seats"] - b["seats_filled"]
            if available > 0:
                return jsonify({
                    "status": "found",
                    "bus_id": b["bus_id"],
                    "bus_number": b.get("bus_number"),
                    "available_seats": available,
                    "total_seats": b["total_seats"],
                    "seats_filled": b["seats_filled"]
                }), 200

        # If we reach here, none have seats available
        first_bus = buses[0]
        return jsonify({
            "status": "none_available",
            "message": "No seats available in upcoming buses (by priority).",
            "suggest": {
                "bus_id": first_bus["bus_id"],
                "bus_number": first_bus.get("bus_number"),
                "total_seats": first_bus["total_seats"],
                "seats_filled": first_bus["seats_filled"]
            }
        }), 200

    except Exception as e:
        return jsonify({"error": "Server error", "detail": str(e)}), 500


def update_seats(request: Request):
    """
    POST JSON body:
      {
        "route_id": "route1",
        "bus_id": "bus2",
        "action": "board" | "alight",
        "count": 1
      }
    This updates seats_filled using a transaction to avoid race conditions.
    """
    try:
        data = request.get_json(silent=True)
        if not data:
            return jsonify({"error": "Invalid or missing JSON body"}), 400

        route_id = data.get("route_id")
        bus_id = data.get("bus_id")
        action = data.get("action")
        count = int(data.get("count", 1))

        if not (route_id and bus_id and action in ("board", "alight")):
            return jsonify({"error": "Missing/invalid parameters"}), 400

        bus_ref = db.collection("routes").document(route_id).collection("buses").document(bus_id)

        def txn_update(tx):
            snap = bus_ref.get(transaction=tx)
            if not snap.exists:
                raise ValueError("Bus document not found")
            current = int(snap.get("seats_filled") or 0)
            total = int(snap.get("total_seats") or 0)

            if action == "board":
                new_filled = current + count
                if new_filled > total:
                    # Cap at total (can't exceed capacity)
                    new_filled = total
            else:  # alight
                new_filled = current - count
                if new_filled < 0:
                    new_filled = 0

            tx.update(bus_ref, {"seats_filled": new_filled})
            return {"bus_id": bus_id, "seats_filled": new_filled, "available_seats": total - new_filled}

        result = db.run_transaction(lambda tx: txn_update(tx))
        return jsonify({"status": "success", "result": result}), 200

    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        return jsonify({"error": "Server error", "detail": str(e)}), 500 
    firebase-admin>=6.0.0
Flask>=2.0.0
{
  "bus_number": "Bus 1",
  "total_seats": 40,
  "seats_filled": 40,
  "stops": ["Kavaraipettai","StopB","StopC"],
  "priority": 1
}
