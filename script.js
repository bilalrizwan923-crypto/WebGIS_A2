
/* Set the starting location of the map to Lahore */
var map = L.map("map").setView([31.5204, 74.3587], 11);

/* Add the OpenStreetMap background */
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);


/* These are the four types of facilities we need */
var facilityTypes = ["hospital", "clinic", "pharmacy", "dentist"];

/* Store the facilities received from the API */
var allFacilities = [];

/* Store the map markers */
var facilityMarkers = [];


/* Colours used for different facility types */
var facilityColors = {
    hospital: "#2468c4",
    clinic: "#16845b",
    pharmacy: "#d58b16",
    dentist: "#8055b5"
};


/* Get the facility type from its tags */
function getFacilityType(tags) {
    var type = tags.amenity || tags.healthcare;

    if (facilityTypes.includes(type)) {
        return type;
    }

    return null;
}


/* Create the API query for Lahore */
function makeQuery() {
    return `
        [out:json][timeout:25];
        (
            nwr["amenity"~"^(hospital|clinic|pharmacy|dentist)$"]
            (31.15,74.00,31.75,74.55);

            nwr["healthcare"~"^(hospital|clinic|pharmacy|dentist)$"]
            (31.15,74.00,31.75,74.55);
        );
        out center tags;
    `;
}


/* Get the coordinates of a facility */
function getCoordinates(item) {
    var latitude;
    var longitude;

    if (item.type === "node") {
        latitude = item.lat;
        longitude = item.lon;
    } else if (item.center) {
        latitude = item.center.lat;
        longitude = item.center.lon;
    }

    if (latitude === undefined || longitude === undefined) {
        return null;
    }

    return [latitude, longitude];
}


/* Turn API data into a simple facility record */
function prepareFacility(item) {
    var tags = item.tags || {};
    var type = getFacilityType(tags);
    var coordinates = getCoordinates(item);

    if (!type || !coordinates) {
        return null;
    }

    var name = tags.name || "Unnamed " + type;

    var address = [
        tags["addr:street"],
        tags["addr:suburb"],
        tags["addr:city"]
    ].filter(Boolean).join(", ");

    return {
        id: item.type + "-" + item.id,
        name: name,
        type: type,
        latitude: coordinates[0],
        longitude: coordinates[1],
        address: address || "Address not available",
        phone: tags.phone || tags["contact:phone"] || "Not available",
        hours: tags.opening_hours || "Not available"
    };
}


/* Try the API addresses until one works */
async function getFacilities() {
    var status = document.getElementById("status");
    var totalCount = document.getElementById("totalCount");

    status.textContent = "Loading healthcare data...";

    var query = makeQuery();

    var apiAddresses = [
        "https://overpass-api.de/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter"
    ];

    for (var address of apiAddresses) {
        try {
            var response = await fetch(address, {
                method: "POST",
                body: new URLSearchParams({ data: query })
            });

            if (!response.ok) {
                throw new Error("API request failed");
            }

            var data = await response.json();

            /* Prepare the facilities received from the API */
            var facilities = data.elements
                .map(prepareFacility)
                .filter(function (facility) {
                    return facility !== null;
                });

            /* Remove duplicate facilities */
            var uniqueFacilities = [];
            var usedIDs = new Set();

            facilities.forEach(function (facility) {
                if (!usedIDs.has(facility.id)) {
                    usedIDs.add(facility.id);
                    uniqueFacilities.push(facility);
                }
            });

            allFacilities = uniqueFacilities;

            totalCount.textContent = allFacilities.length;
            status.textContent = "Healthcare data loaded successfully.";

            showFacilities();
            return;

        } catch (error) {
            /* Try the next API address if this one fails */
            console.log("Could not load data from " + address);
        }
    }

    status.textContent =
        "Could not load data. Please check your internet and try again.";

    allFacilities = [];
    totalCount.textContent = "0";
    showFacilities();
}


/* Create the information shown when a marker is clicked */
function makePopup(facility) {
    var popup = document.createElement("div");

    var heading = document.createElement("strong");
    heading.textContent = facility.name;

    var type = document.createElement("p");
    type.textContent = "Type: " + facility.type;

    var address = document.createElement("p");
    address.textContent = "Address: " + facility.address;

    var phone = document.createElement("p");
    phone.textContent = "Phone: " + facility.phone;

    var hours = document.createElement("p");
    hours.textContent = "Opening hours: " + facility.hours;

    popup.append(heading, type, address, phone, hours);

    return popup;
}


/* Display the facilities that match the search and filter */
function showFacilities() {
    var searchText = document.getElementById("searchInput")
        .value.toLowerCase().trim();

    var selectedType = document.getElementById("categoryFilter").value;

    /* Remove old markers from the map */
    facilityMarkers.forEach(function (marker) {
        map.removeLayer(marker);
    });

    facilityMarkers = [];

    /* Find facilities that match the selected options */
    var visibleFacilities = allFacilities.filter(function (facility) {
        var matchesName = facility.name.toLowerCase().includes(searchText);

        var matchesType =
            selectedType === "all" || facility.type === selectedType;

        return matchesName && matchesType;
    });

    /* Add a marker for each matching facility */
    visibleFacilities.forEach(function (facility) {
        var marker = L.circleMarker(
            [facility.latitude, facility.longitude],
            {
                radius: 7,
                color: facilityColors[facility.type],
                fillColor: facilityColors[facility.type],
                fillOpacity: 0.8
            }
        );

        marker.bindPopup(makePopup(facility));
        marker.addTo(map);

        facilityMarkers.push(marker);
    });

    document.getElementById("visibleCount").textContent =
        visibleFacilities.length;
}


/* Update the map when the user types a name */
document.getElementById("searchInput").addEventListener("input", function () {
    showFacilities();
});


/* Update the map when the user selects a facility type */
document.getElementById("categoryFilter").addEventListener("change", function () {
    showFacilities();
});


/* Load the data again when the button is clicked */
document.getElementById("reloadButton").addEventListener("click", function () {
    getFacilities();
});


/* Load the data when the website first opens */
getFacilities();
