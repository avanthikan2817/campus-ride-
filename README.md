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
