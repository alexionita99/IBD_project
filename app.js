var map = L.map("map").setView([60.1746, 25.0097], 12);

L.tileLayer('https://cdn.digitransit.fi/map/v1/{id}/{z}/{x}/{y}.png', {
  attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ' +
    '<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>',
  maxZoom: 18,
  id: 'hsl-map'}).addTo(map);

var realtime, client;

var tracked_vehicle;
var polyline;

var geohashes;
var geohash_polylines = L.layerGroup().addTo(map);

const updateTopic = function() {
  if (client) {
    client.end(true);
  }
  if (realtime) {
    realtime.removeFrom(map);
  }

  validateFields();

  var topicBase = "/hfp/v2/journey";
  var topics = [];

  document.getElementById("topics").innerHTML = "";

  document.getElementById("geohash_level").style.display = "none";
  document.getElementById("show_topics").style.display = "none";
  document.getElementById("geohash_on").style.display = "none";
  document.getElementById("geohash_off").style.display = "none";
  document.getElementById("start_time").style.display = "none";
  document.getElementById("next_stop").style.display = "none";
  document.getElementById("temporal_type").style.display = "none";
  document.getElementById("headsign").style.display = "none";

  if (geohashes) {
    geohashes.forEach(function(geohash) {
      var topic = topicBase;

      topic += "/";
      topic += document.getElementById("temporal_type").value;
      topic += "/";
      topic += document.getElementById("transport_mode").value;
      topic += "/";
      topic += document.getElementById("operator_id").value;
      topic += "/";
      topic += document.getElementById("vehicle_number").value;
      topic += "/";
      topic += document.getElementById("route_id").value;
      topic += "/";
      topic += document.getElementById("direction_id").value;
      topic += "/";
      topic += document.getElementById("headsign").value;
      topic += "/";
      topic += document.getElementById("start_time").value;
      topic += "/";
      topic += document.getElementById("next_stop").value;
      topic += "/";
      topic += document.getElementById("geohash_level").value;
      topic += "/"
      topic += geohash;
      topic += "/#";

      topics.push(topic);
      document.getElementById("topics").innerHTML += topic;
      document.getElementById("topics").innerHTML += "\n";
    });
  } else {
    var topic = topicBase;

    topic += "/+/";
    topic += document.getElementById("temporal_type").value;
    topic += "/";
    topic += document.getElementById("transport_mode").value;
    topic += "/";
    topic += document.getElementById("operator_id").value;
    topic += "/";
    topic += document.getElementById("vehicle_number").value;
    topic += "/";
    topic += document.getElementById("route_id").value;
    topic += "/";
    topic += document.getElementById("direction_id").value;
    topic += "/";
    topic += document.getElementById("headsign").value;
    topic += "/";
    topic += document.getElementById("start_time").value;
    topic += "/";
    topic += document.getElementById("next_stop").value;
    topic += "/";
    topic += document.getElementById("geohash_level").value;
    topic += "/#";

    topics.push(topic);
    document.getElementById("topics").innerHTML += topic;
    document.getElementById("topics").innerHTML += "\n";
  }

  var count = 0;
  client = mqtt.connect("wss://mqtt.hsl.fi:443/");
  client.on("connect", function() {
    console.log("connected")
    realtime = L.realtime(null, {
      start: false
    }).addTo(map);
    realtime.on("update", function(e) {
      var popupContent = function(fId) {
          var feature = e.features[fId];
          return '<b>' + 'Route, Direction & Vehicle Number: ' + feature.properties.name + '</b><br/>Speed: ' +
              feature.properties.speed + 'km/h<br>In station: ' + feature.properties.in_station;
      },
      bindFeaturePopup = function(fId) {
          realtime.getLayer(fId).on("popupopen", function() {
            tracked_vehicle = e.features[fId].properties.id;
            polyline = L.polyline([L.GeoJSON.coordsToLatLng(e.features[fId].geometry.coordinates)]).addTo(map);
          });
          realtime.getLayer(fId).on("popupclose", function() {
            tracked_vehicle = null;
            polyline.removeFrom(map);
          });
          realtime.getLayer(fId).bindPopup(popupContent(fId));
      },
      updateFeaturePopup = function(fId) {
          if (e.features[fId].properties.id === tracked_vehicle) {
            polyline.addLatLng(L.GeoJSON.coordsToLatLng(e.features[fId].geometry.coordinates));
          }

          realtime.getLayer(fId).getPopup().setContent(popupContent(fId));
      };

      Object.keys(e.enter).forEach(bindFeaturePopup);
      Object.keys(e.update).forEach(updateFeaturePopup);
    });

    topics.forEach(function(topic) {
      client.subscribe(topic);
      console.log("Subscribed "+topic);
    });
  });
  client.on("message", function(topic, payload, packet) {
    var VP = JSON.parse(payload.toString()).VP;
    var topic = packet.topic.split("/");

    if (typeof(VP) == 'undefined') {
      return;
    }
    
    if (!VP.lat || !VP.long) {
      return;
    }

    if (Math.round(3.6*VP.spd) < 15 &&  VP.drst == 0 && VP.desi != "M1" && VP.desi != "M2" && VP.desi != "A" && VP.desi != "U" && VP.desi != "K" && VP.desi != "P" && VP.desi != "E" && VP.desi != "R" && VP.desi != "19"){
      var circle = L.circle([VP.lat, VP.long], {
        color: 'red',
        fillColor: '#f03',
        fillOpacity: 0.1,
        radius: 10
    }).addTo(map);
    setTimeout(function(){circle.removeFrom(map)}, 1000)
    }

    realtime.update({
			type: "Feature",
			geometry: {
				type: "Point",
				coordinates: [VP.long, VP.lat]
			},
			properties: {
				id: VP.oper+"-"+VP.veh,
        name: VP.desi+" - "+topic[10]+" ("+VP.veh+")",
        in_station: VP.drst,
        speed: Math.round(3.6*VP.spd)
			}
      
    });
  });
};

var values = document.getElementsByClassName('value');
for (i = 0; i < values.length; i++) {
  var node = values.item(i);
  node.addEventListener("change", updateTopic);
}

document.getElementById("geohash_level").addEventListener("change", function(event) {
    if (event.target.value == "0") {
        document.getElementById("geohash_note").style.visibility = 'visible';
    } else {
        document.getElementById("geohash_note").style.visibility = 'hidden';
    }
});

document.getElementById('geohash_on').addEventListener('click', () => {
  var min = map.getBounds().getSouthWest();
  var max = map.getBounds().getNorthEast();

  var g = calculateGeohashesAndPolylines(min.lat, min.lng, max.lat, max.lng);

  geohashes = g[0];

  geohash_polylines.clearLayers();
  g[1].forEach(function(polyline) {
    polyline.addTo(geohash_polylines);
  });

  updateTopic();
});
document.getElementById('geohash_off').addEventListener('click', () => {
  geohashes = null;
  geohash_polylines.clearLayers();

  updateTopic();
});

updateTopic();

function validateFields() {
  setValidationNoteVisibility(document.getElementById("operator_id"), !/^(\+|[0-9]{4})$/.test(document.getElementById("operator_id").value));

  setValidationNoteVisibility(document.getElementById("vehicle_number"), !/^(\+|[0-9]{5})$/.test(document.getElementById("vehicle_number").value));

  setValidationNoteVisibility(document.getElementById("route_id"), !/^(\+|[1-9][0-9][0-9M][0-9][A-Z ]?[A-Z]?)$/.test(document.getElementById("route_id").value));

  setValidationNoteVisibility(document.getElementById("start_time"), !/^(\+|(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9])$/.test(document.getElementById("start_time").value));

  setValidationNoteVisibility(document.getElementById("next_stop"), !/^(\+|EOL|[0-9]{7})$/.test(document.getElementById("next_stop").value));
}

function setValidationNoteVisibility(element, visible) {
  element.parentNode.parentNode.childNodes.forEach(node => {
    if (node.className === 'validation_note') {
      if (visible) {
        node.style.visibility = 'visible';
      } else {
        node.style.visibility = 'hidden';
      }
    }
  })
}

function showTopics() {
  if(document.getElementById('topics').style.display == 'none') {
    document.getElementById('topics').style.display = 'block';
    document.getElementById('show_topics').innerHTML = 'Hide topics';
  } else {
    document.getElementById('topics').style.display = 'none';
    document.getElementById('show_topics').innerHTML = 'Show topics';
  }
}

/*function calculateGeohash(latlng) {
  var lat = latlng.lat;
  var lng = latlng.lng;

  var geohash ="/"+Math.floor(lat)+";"+Math.floor(lng);
  geohash += "/";
  geohash += lat.toString()[3]+lng.toString()[3];
  
  return geohash;
}*/

function calculateGeohashesAndPolylines(minLat, minLng, maxLat, maxLng) {
	var deltaLat = maxLat - minLat;
	var deltaLng = maxLng - minLng;

	var geohashLevel = Math.max(Math.ceil(Math.abs(Math.log10(deltaLat))), Math.ceil(Math.abs(Math.log10(deltaLng))));
	var delta = Math.pow(10, -geohashLevel);
  console.log(delta);

	var geohashes = [];
  var polylines = [];
	
	var lat = truncate(minLat, geohashLevel);

	while(lat <= maxLat) {
		var lng = truncate(minLng, geohashLevel);
		while(lng <= maxLng) {
			geohashes.push(calculateGeohash(lat, lng, geohashLevel));
      polylines.push(calculateGeohashPolyline(lat, lng, geohashLevel));

			lng += delta;
		}
		lat += delta;
	}

	return [geohashes, polylines];
}

function calculateGeohash(lat, lng, level) {
	var geohash = Math.floor(lat)+";"+Math.floor(lng);
	
	for(var i = 0; i < level; i++) {
		geohash += "/";
		geohash += lat.toFixed(level + 1).split(".")[1][i];
		geohash += lng.toFixed(level + 1).split(".")[1][i];
	}

	return geohash;
}

function calculateGeohashPolyline(lat, lng, level) {
  var fixed_lat = parseFloat(lat.toFixed(level + 1).substr(0, level === 0 ? 2 : 3+level));
  var fixed_lng = parseFloat(lng.toFixed(level + 1).substr(0, level === 0 ? 2 : 3+level));

  var latlngs = [[fixed_lat, fixed_lng], [fixed_lat+Math.pow(10, 0 - level), fixed_lng], [fixed_lat+Math.pow(10, 0 - level), fixed_lng+Math.pow(10, 0 - level)], [fixed_lat, fixed_lng+Math.pow(10, 0 - level)], [fixed_lat, fixed_lng]];

  return L.polyline(latlngs, {color: "red", opacity: 0.1}).addTo(map);
}

function truncate(x, n) {
    if (n == 0) {
      return x;
    }

    var split = x.toFixed(n+1).split(".");

    return parseFloat(split[0]+"."+split[1].substring(0, n));
}