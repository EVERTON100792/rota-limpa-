const fetch = require('node-fetch');
async function test() {
  const coords = "-46.6333,-23.5505;-46.64,-23.56;-46.65,-23.57";
  const res = await fetch(`https://router.project-osrm.org/trip/v1/driving/${coords}?source=first&roundtrip=false&destination=any`);
  const data = await res.json();
  console.log(JSON.stringify(data.waypoints, null, 2));
}
test();
