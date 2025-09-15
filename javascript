// check availability
async function check(routeId, stopName) {
  const url = https://REGION-PROJECT.cloudfunctions.net/check_availability?route_id=${routeId}&stop=${encodeURIComponent(stopName)};
  const res = await fetch(url);
  return await res.json();
}

// update seats (board or alight)
async function updateSeats(routeId, busId, action, count=1) {
  const url = "https://REGION-PROJECT.cloudfunctions.net/update_seats";
  const res = await fetch(url, {
    method: "POST",
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({route_id: routeId, bus_id: busId, action, count})
  });
  return await res.json();
}
