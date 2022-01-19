var map = L.map('map').setView([60.192059,24.945831], 13);

var normalTiles = L.tileLayer('https://cdn.digitransit.fi/map/v1/{id}/{z}/{x}/{y}.png', {
  attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ' +
    '<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>',
  maxZoom: 19,
  id: 'hsl-map'}).addTo(map);

var clicked_location;
var origin_location, destination_location;
var itinerary_features = L.layerGroup().addTo(map);

function setOrigin() {
  if (origin_location) {
    origin_location.removeFrom(map);
  }

  origin_location = L.marker(clicked_location, {draggable: true}).on('dragend', () => planItinerary()).bindPopup("Origin").addTo(map);

  planItinerary();
}

function setDestination() {
  if (destination_location) {
    destination_location.removeFrom(map);
  }

  destination_location = L.marker(clicked_location, {draggable: true}).on('dragend', () => planItinerary()).bindPopup("Destination").addTo(map);

  planItinerary();
}

map.on('contextmenu', function(e) {
  clicked_location = e.latlng;

  L.popup()
    .setLatLng(e.latlng)
    .setContent('<button type="button" onclick="setOrigin()" value="">Origin</button><button type="button" onclick="setDestination()">Destination</button>')
    .on('popupclose', function() {
      clicked_location = null;
    })
    .openOn(map);
});

function planItinerary() {
  if (origin_location && destination_location) {
    fetch(new Request("https://api.digitransit.fi/routing/v1/routers/hsl/index/graphql",   {
        method: 'POST',
        headers: {
          "Content-Type": "application/graphql" 
        },
        body: `{ 
              plan(
                from: {lat: `+origin_location.getLatLng().lat+`, lon: `+origin_location.getLatLng().lng+`}
                to: {lat: `+destination_location.getLatLng().lat+`, lon: `+destination_location.getLatLng().lng+`}
                numItineraries: 1
              ) {
                itineraries {
                  legs {
                    startTime
                    endTime
                    from {
                      name
                    }
                    to {
                      name
                    }
                    trip {
                      route {
                        shortName
                      }
                    }
                    legGeometry {
                      length
                      points
                    }
                  }
                }
              }
            }`
      })
    ).then(function(response) {
      return response.json();
    }).then(function(body) {
      try {
        itinerary_features.clearLayers();
        body.data.plan.itineraries[0].legs.forEach(function(leg) {
          var popup_content = new Date(leg.startTime).toLocaleTimeString() +" - "+new Date(leg.endTime).toLocaleTimeString()+":<br/>";
          popup_content += leg.trip ? "<b>"+leg.trip.route.shortName+"</b>: " : "";
          popup_content += leg.from.name;
          popup_content += " -> ";
          popup_content += leg.to.name;

          var leg_polyline = L.polyline([], 
                {
                  color: '#'+Math.random().toString(16).substr(-6),
                  weight: 7
                }).bindPopup(popup_content)
                .addTo(itinerary_features);

          var points = polyline.decode(leg.legGeometry.points);
          for (var i=0; i < points.length; i++) {
            leg_polyline.addLatLng(L.latLng(points[i][0], points[i][1]));
          }
        });
      } catch (e) {
        console.log(e);
        throw e;
      }
    });
  }
}

