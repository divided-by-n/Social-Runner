document.getElementById("registerButton").addEventListener("click", performRegistration);
document.getElementById("loginButton").addEventListener("click", performLogin);
let YOUR_MAPBOX_TOKEN =
  "pk.eyJ1IjoiamFtaWVtYWMiLCJhIjoiY2x1aWJxZmRnMDNhbjJrbG1xbG5sa2VlaCJ9.dwk-lbxwVaPAPyWmmKe6sw";

mapboxgl.accessToken = YOUR_MAPBOX_TOKEN;
let startingMarker = null;
let meetingMarker = null;
let endingMarker = null;
let globalStartingCoordinates = null;
let globalMeetingCoordinates = null;
let globalEndingCoordinates = null;

/**
 * Handles user registration. Sends the username and password to the server for registration.
 * If the registration is successful, it alerts the user to press login. If there's an error,
 * it displays the error message.
 */
async function performRegistration() {
  const username = document.getElementById('authUsername').value;
  const password = document.getElementById('authPassword').value;

  if (!username || !password) {
      alert('Please fill out all fields for registration');
      return;
  }

  try {
      const response = await fetch('/register', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json'
          },
          body: JSON.stringify({ username, password })
      });

      if (response.ok) {
          alert('Registration successful! Please press login');
          // Clear fields or show login section as needed
      } else {
          // Parse the error response as text
          const errorMessage = await response.text();
          alert(errorMessage); // Show error from server
      }
  } catch (error) {
      console.error('Error during registration:', error);
  }
}

/**
 * Handles user login. It sends the username and password to the server.
 * If login is successful, it stores the received token and userId in localStorage and toggles
 * the app visibility to show the main application section. In case of error, it displays the
 * error message to the user.
 */
async function performLogin() {
  const username = document.getElementById('authUsername').value;
  const password = document.getElementById('authPassword').value;

  if (!username || !password) {
    alert('Please enter both username and password for login');
    return;
  }

  try {
    const response = await fetch('/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();
    console.log(data);

    if (response.ok) {
      localStorage.setItem('token', data.token); // Store received token
      localStorage.setItem('userId', data.userId); // Store received userId
      toggleAppVisibility(); // Instead of redirecting, toggle visibility
    } else {
      alert(data.message); // Show error from server
    }
  } catch (error) {
    console.error('Error during login:', error);
  }
}

/**
 * Toggles the visibility of the login/registration UI and the main application section.
 * Hides the login/registration UI and shows the main app section.
 * It also initiates the fetching and display of runs and run data for charts.
 */
function toggleAppVisibility() {
  const loginRegistrationUI = document.getElementById('loginRegistrationUI');
  const appSection = document.getElementById('appSection');

  if (loginRegistrationUI && appSection) {
      loginRegistrationUI.style.display = 'none';
      appSection.style.display = 'block';
      fetchAndDisplayRuns(); // Fetch and display runs upon showing app section
      fetchRunDataAndRenderChart();
      performPlaceList();
  } else {
      console.error('Error toggling sections: Sections not found.');
  }
}



document
  .getElementById("createRunButton")
  .addEventListener("click", function () {
    performCreateRun();
  });


  /**
 * Captures data from the create run form, validates it, and sends it to the server to create a new run.
 * Alerts the user upon successful creation or failure. Fetches and displays updated runs list upon success.
 */
  function performCreateRun() {
   
    
    const date = document.getElementById("runDate").value;
    const time = document.getElementById("runTime").value;
    const level = document.getElementById("run-level").value;
    const location = document.getElementById("runLocation").value;
    const pace = document.getElementById("pace").value;

    // Retrieve latitude and longitude for starting, meeting, and ending points
    const startingPlace = globalStartingCoordinates ? `${globalStartingCoordinates[1]}, ${globalStartingCoordinates[0]}` : "";
    const meetingPlace = globalMeetingCoordinates ? `${globalMeetingCoordinates[1]}, ${globalMeetingCoordinates[0]}` : "";
    const endingPlace = globalEndingCoordinates ? `${globalEndingCoordinates[1]}, ${globalEndingCoordinates[0]}` : "";

    // Calculate distance
    let distance = 0;
    if (globalStartingCoordinates && globalEndingCoordinates) {
        if (globalMeetingCoordinates) {
            // Calculate distance from start to meeting point and then meeting point to end
            const startToMeetDistance = calculateDistance(globalStartingCoordinates, globalMeetingCoordinates);
            const meetToEndDistance = calculateDistance(globalMeetingCoordinates, globalEndingCoordinates);
            distance = startToMeetDistance + meetToEndDistance;
        } else {
            // Calculate distance from start to end directly
            distance = calculateDistance(globalStartingCoordinates, globalEndingCoordinates);
        }
    }

    console.log(distance + " kilometers");

 

    const token = localStorage.getItem("token"); 

    console.log(date)
    console.log(time)
    console.log(startingPlace)
    console.log(endingPlace)
    console.log(pace)
    console.log(location)

    // Validate inputs
    if (!date || !time || !startingPlace || !endingPlace || !pace || !location || !level) {
      alert("Please fill in all required fields.");
      return;
    }

    // Prepare data for submission
    const data = {
      runDetails: { date, time, distance, startingPlace, meetingPlace, endingPlace, pace, location, level },
    };


    // Make a POST request to the server with the run details
    fetch("/create-run", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token, 
      },
      body: JSON.stringify(data),
    })
      .then(response => {
        if (!response.ok) {
          throw new Error("Creating run failed.");
        }
        return response.json();
      })
      .then(data => {
        console.log(data);
        alert("Run created successfully!");
        fetchAndDisplayRuns();
      })
      .catch(error => {
        console.error("Create run failed:", error);
        alert("Create run failed: " + error.message);
      });
}

/**
 * Initializes the Mapbox map and sets up place search functionalities for the starting and ending
 * places of a run. It configures the input fields to use Mapbox's geocoding service to offer place
 * suggestions and allows users to select a place from these suggestions.
 */
function performPlaceList(){
  // Create map
  map = new mapboxgl.Map({
    container: "map",
    style: "mapbox://styles/mapbox/streets-v9",
    center: [-3.2, 55.95],
    zoom: 11,
  });
 
  setupPlaceSearch("startingPlace", "startingPlaceSuggestions");
  setupPlaceSearch("meetingPlace", "meetingPlaceSuggestions");
  setupPlaceSearch("endingPlace", "endingPlaceSuggestions");
}

/**
 * Sets up the event listener for place search input fields. It fetches place suggestions based on
 * the user's input and displays them. Allows the user to select a suggestion and updates the input
 * field and global coordinates accordingly.
 *
 * @param {string} inputId - The ID of the input element for entering place queries.
 * @param {string} suggestionsListId - The ID of the list element where suggestions should be displayed.
 */
function setupPlaceSearch(inputId, suggestionsListId) {
  const input = document.getElementById(inputId);
  const suggestionsList = document.getElementById(suggestionsListId);

  input.addEventListener("input", async () => {
    const query = input.value.trim();
    if (!query) {
      suggestionsList.innerHTML = "";
      suggestionsList.style.display = "none";
      return;
    }
    suggestionsList.style.display = "block";

    const suggestions = await fetchPlaceSuggestions(query);
    displaySuggestions(suggestions, suggestionsList, suggestionsListId);
  });
}


/**
 * Displays place suggestions in a list element. Each suggestion is clickable and selects the place
 * for the corresponding input field.
 *
 * @param {Array} suggestions - An array of place suggestions, each containing name, longitude, and latitude.
 * @param {HTMLElement} suggestionsList - The list element where suggestions should be displayed.
 * @param {string} suggestionsListId - The ID of the list to determine whether the selection is for starting or ending place.
 */
function displaySuggestions(suggestions, suggestionsList, suggestionsListId) {
  console.log("id", suggestionsList.id);
  suggestionsList.innerHTML = ""; 
  suggestions.forEach((suggestion) => {
    const li = document.createElement("li");
    li.className = "suggestion-option";
    li.textContent = suggestion.name; 
    li.addEventListener("click", () => {
      selectPlace(suggestion, suggestionsListId);
      suggestionsList.style.display = "none";
    });
    suggestionsList.appendChild(li);
  });
}

/**
 * Fetches place suggestions from Mapbox based on the provided query.
 *
 * @param {string} query - The search query 
 * @returns {Promise<Array>} An array of place suggestion objects, each containing
 * name, longitude, and latitude.
 */
async function fetchPlaceSuggestions(query) {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
    query
  )}.json?access_token=${mapboxgl.accessToken}&limit=5`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
    const data = await response.json();
    return data.features.map((feature) => ({
      name: feature.place_name, 
      longitude: feature.center[0], 
      latitude: feature.center[1], 
    }));
  } catch (error) {
    console.error("Error fetching place suggestions:", error);
    return []; 
  }
}

/**
 * Updates the input field with the selected place's name, sets the global coordinates for the starting or 
 * ending place based on the suggestions list ID, and updates
 * the map view and markers
 *
 * @param {Object} place - The selected place name, longitude, and latitude.
 * @param {string} suggestionsListId - The ID of the suggestions list to identify if the place is for starting or ending location.
 */
function selectPlace(place, suggestionsListId) {
  console.log("ada", place);
  // startingPlaceSuggestions
  // endingPlaceSuggestions

  const lngLat = [place.longitude, place.latitude];  
  if (suggestionsListId == "startingPlaceSuggestions") {
    document.getElementById("startingPlace").value = place.name;
    globalStartingCoordinates = [place.longitude, place.latitude];
    if (startingMarker) {
      startingMarker.setLngLat(lngLat);
    } else {
      startingMarker = new mapboxgl.Marker({ color: "red" })
        .setLngLat(lngLat)
        .addTo(map);
    }
  } else if (suggestionsListId == "meetingPlaceSuggestions") {
    document.getElementById("meetingPlace").value = place.name;
    globalMeetingCoordinates = [place.longitude, place.latitude];
    if (meetingMarker) {
      meetingMarker.setLngLat(lngLat);
    } else {
      meetingMarker = new mapboxgl.Marker({ color: "grey" })
        .setLngLat(lngLat)
        .addTo(map);
    }
  } else {
    document.getElementById("endingPlace").value = place.name;
    globalEndingCoordinates = [place.longitude, place.latitude];
    if (endingMarker) {
      endingMarker.setLngLat(lngLat);
    } else {
      endingMarker = new mapboxgl.Marker({ color: "green" })
        .setLngLat(lngLat)
        .addTo(map);
    }
  }
  map.flyTo({ center: lngLat, zoom: 12 }); // Adjust map view centered on selected points
  createRoute();
}

/**
 * Creates a route on the map between the starting and ending markers if both are set. It fetches the route from
 * Mapbox's Directions API and displays it on the map.
 */
function createRoute() {
  if (startingMarker && endingMarker) {
    const startLngLat = startingMarker.getLngLat();
    const endLngLat = endingMarker.getLngLat();
    console.log(startLngLat,endLngLat)
    let meetLngLat; 

    if (meetingMarker) {
      meetLngLat = meetingMarker.getLngLat();
    }

    createRouteinMap(startLngLat, meetLngLat, endLngLat).then((data) => {
      if (data) {
        console.log(data);
        const route = data.routes[0].geometry.coordinates;

        const geojson = {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: route,
          },
        };

        // Update or add the route layer on the map
        if (map.getSource("route")) {
          map.getSource("route").setData(geojson);
        } else {
          map.addLayer({
            id: "route",
            type: "line",
            source: {
              type: "geojson",
              data: geojson,
            },
            layout: {
              "line-join": "round",
              "line-cap": "round",
            },
            paint: {
              "line-color": "#888",
              "line-width": 6,
            },
          });
        }
      }
    }).catch((error) => console.error("Error creating route:", error));
  }
}

/**
 * Converts a pace value from minutes per mile to meters per second. Useful for calculating walking speed in a format
 * compatible with Mapbox Directions API.
 *
 * @param {number} minutesPerMile - The pace in minutes per mile.
 * @returns {number} The pace converted to meters per second.
 */
function convertPace(minutesPerMile) {
  const milesToMeters = 1609.34;
  const secondsPerHour = 3600;
  const mph = 60 / minutesPerMile;
  const metersPerSecond = mph * milesToMeters / secondsPerHour;
  return metersPerSecond;
}

/**
 * Fetches a route from Mapbox's Directions API based on the provided start and end coordinates.
 *
 * @param {Object} start - The starting point of the route with `lng` and `lat` properties.
 * @param {Object} end - The ending point of the route with `lng` and `lat` properties.
 * @returns {Promise<Object|null>} Route data from the Directions API, or null if an error occurs.
 */
async function createRouteinMap(start, meet, end) {
  const speed = convertPace(document.getElementById("pace").value);

  const startLngLat = `${start.lng},${start.lat}`;
  const endLngLat = `${end.lng},${end.lat}`;
  const waypoints = meet ? `${startLngLat};${meet.lng},${meet.lat};${endLngLat}` : `${startLngLat};${endLngLat}`;


  const directionsRequest = `https://api.mapbox.com/directions/v5/mapbox/walking/${waypoints}?&walking_speed=${2}&geometries=geojson&access_token=${mapboxgl.accessToken}`;

  try {
    const response = await fetch(directionsRequest);
    if (!response.ok) {
      throw new Error("Failed to fetch route");
    }
    const json = await response.json();
    return json; 
  } catch (error) {
    console.error("Error fetching directions:", error);
    return null; }
}



/**
 * Validates if the provided coordinates array contains valid longitude and latitude values.
 *
 * @param {Array<number>} coords - An array containing two elements: longitude and latitude.
 * @returns {boolean} Returns true if the coordinates are valid, otherwise false.
 */
function isValidCoordinates(coords) {
    // Validate longitude and latitude; longitude (-180 to 180), latitude (-90 to 90)
    if (coords.length !== 2) return false;
    const [longitude, latitude] = coords;
    return longitude >= -180 && longitude <= 180 && latitude >= -90 && latitude <= 90;
}
/**
 * Adds an event listener to the "userpreferences" button to display the user preferences section when clicked.
 */
document.getElementById("userpreferences").addEventListener("click", function () {
  const userPreferencesSection = document.getElementById('userPreferencesSection');
  userPreferencesSection.style.display = 'block';
});

/**
 * Handles the submission of the user preferences form. Prevents the default form submission,
 * extracts values from the form fields, validates and prepares the data, then sends it to the server.
 * Alerts the user upon successful save or if an error occurs.
 */
document.getElementById("userPreferencesForm").addEventListener("submit", async function(event) {
  event.preventDefault(); // Prevent the form from submitting traditionally

  // Extract values from the form
  const maxDistance = document.getElementById("maxDistance").value;
  const preferredLength = document.getElementById("preferredLevel").value;
  const averagePace = document.getElementById("averageTravel").value;

  const userLat = document.getElementById("userLat").value;
  const userLon = document.getElementById("userLon").value;

  const userLatFloat = parseFloat(userLat);
  const userLonFloat = parseFloat(userLon);
    

  const userLocation = [userLatFloat, userLonFloat];

  const userId = localStorage.getItem('userId'); // Retrieve userId from localStorage
  console.log("Submitting preferences for userId:", userId);

  // Prepare the data to send to the server
  const preferencesData = {
    userId,
    maxDistance: parseInt(maxDistance, 10) || 0,
    preferredLength: parseInt(preferredLength, 10) || 0,
    averagePace: parseFloat(averagePace) || 0,
    userLocation
  };

  console.log("Preferences data being sent:", preferencesData);

  try {
    const response = await fetch('/user-stats', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(preferencesData)
    });

    console.log("Response status:", response.status);
    if (response.ok) {
      console.log("Preferences saved successfully");
      alert('Preferences saved successfully!');
    } else {
      const errorResponse = await response.json();
      console.error("Error saving preferences:", errorResponse);
      alert(`Error saving preferences: ${errorResponse.message}`);
    }
  } catch (error) {
    console.error('Error during preferences submission:', error);
    alert('An error occurred while saving your preferences.');
  }
});





/**
 * Globally stores fetched run information for easy access.
 * @type {Array<Object>}
 */
let availableRuns = []; // Store fetched runs globally for easy access

/**
 * Fetches available runs from the server and displays them.
 * Requires the user to be logged in (token must be present in localStorage).
 * Alerts the user if not logged in or if fetching runs fails.
 */
async function fetchAndDisplayRuns() {
    const token = localStorage.getItem("token");
    if (!token) {
        alert("You are not logged in.");
        return;
    }

    try {
        const response = await fetch("/available-runs", {
            method: "GET",
            headers: {"Authorization": `Bearer ${token}`},
        });

        if (!response.ok) {
            throw new Error("Failed to fetch runs");
        }

        availableRuns = await response.json(); // Store fetched runs
        displayRuns(availableRuns); // Initial display
    } catch (error) {
        console.error("Failed to load runs:", error);
        alert("Failed to load runs.");
    }
}

/**
 * Fetches available runs from the server and returns them as an array.
 * Requires the user to be logged in (token must be present in localStorage).
 * Returns an empty array and alerts the user if not logged in or if fetching runs fails.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of run objects.
 */
async function fetchRuns() {
  const token = localStorage.getItem("token");
  if (!token) {
      alert("You are not logged in.");
      return [];
  }

  try {
      const response = await fetch("/available-runs", {
          method: "GET",
          headers: {"Authorization": `Bearer ${token}`},
      });

      if (!response.ok) {
          throw new Error("Failed to fetch runs");
      }

      const fetchedRuns = await response.json(); // Fetch and return runs
      return fetchedRuns;
  } catch (error) {
      console.error("Failed to load runs:", error);
      alert("Failed to load runs.");
      return [];
  }
}

/**
 * Displays a list of runs in the HTML document. Each run is displayed with its details.
 * Assumes the presence of an element with id "runsList" where the runs will be appended.
 * @param {Array<Object>} runs - An array of run objects to display.
 */
function displayRuns(runs) {
  const runsList = document.getElementById("runsList");
  runsList.innerHTML = ''; // Clear existing runs

  runs.forEach(run => {
    const runDiv = document.createElement("div");
    runDiv.className = "run";
    runDiv.dataset.runId = run.id;

    runDiv.dataset.startingPlace = run.startingPlace;
    runDiv.dataset.endingPlace = run.endingPlace;
    
    // Display run's unique ID along with other details, including weather condition
    runDiv.innerHTML = `
        <div><strong>ID:</strong> ${run.id}</div>
        <div><strong>Date:</strong> ${new Date(run.date).toLocaleDateString()}</div>
        <div><strong>Location:</strong> ${run.location}</div>
        <div><strong>Level:</strong> ${run.level}</div>
        <div><strong>Starting Place:</strong> ${run.startingPlace}</div>
        <div><strong>Meeting Place:</strong> ${run.meetingPlace}</div>
        <div><strong>Ending Place:</strong> ${run.endingPlace}</div>
        <div><strong>Distance:</strong> ${run.distance}</div>
        <div><strong>Weather:</strong> ${run.weatherCondition || 'Not available'}</div>
    `; 

    runsList.appendChild(runDiv);
  });
}


document.getElementById("recomendRuns").addEventListener("click", async function () {
  await recommendRuns(); 
});

/**
 * Recommends runs based on user preferences fetched from the server.
 * Filters and sorts runs based on proximity to user's location and desired run level.
 * Displays the sorted runs using `displayRuns`.
 */
async function recommendRuns() {
  // Fetch user preferences
  const userPreferences = await fetchUserPreferences();

  if (!userPreferences) {
    console.error('User preferences could not be fetched');
    return;
  }

  const fetchedRuns = await fetchRuns();

  if (!fetchedRuns || fetchedRuns.length === 0) {
    console.error('No runs available to recommend');
    return;
  }

  console.log(userPreferences)

  const userLocationParts = userPreferences.userLocation
  if (userLocationParts.length !== 2 || isNaN(userLocationParts[0]) || isNaN(userLocationParts[1])) {
    console.error('Invalid user location format');
    return;
  }
  const userLocation = userLocationParts;

  const enhancedRuns = fetchedRuns.map(run => {
      const [runLat, runLon] = run.startingPlace
      run.distanceFromUser = calculateDistance(userLocation, [runLat, runLon]);
      run.levelDifference = Math.abs(run.level - userPreferences.preferredLength);
      return run;
  });

  console.log("Runs before sorting:", JSON.stringify(enhancedRuns, null, 2));

  const recommendedRuns = enhancedRuns.sort((a, b) => {
      if (a.levelDifference === b.levelDifference) {
          return a.distanceFromUser - b.distanceFromUser;
      }
      return a.levelDifference - b.levelDifference;
  });

  console.log("Runs after sorting:", JSON.stringify(recommendedRuns, null, 2));

  displayRuns(recommendedRuns);
}

/**
 * Fetches the current user's preferences from the server using a GET request.
 * Requires the user to be logged in, as it sends the request with an Authorization header.
 * 
 * @returns {Promise<Object>} The user preferences data from the server.
 * @throws Will throw an error if fetching user preferences fails.
 */
async function fetchUserPreferences() {
  console.log('Starting to fetch user preferences');
  try {
      const token = localStorage.getItem('token');
      console.log('Token retrieved from localStorage:', token);

      console.log('Sending request to /user-stats');
      const response = await fetch(`/user-stats`, {
          method: 'GET',
          headers: {
              'Authorization': `Bearer ${token}`
          }
      });

      console.log('Response received from /user-stats', response.status);

      if (!response.ok) {
          console.error('Response not OK. Status:', response.status);
          throw new Error('Failed to fetch user preferences');
      }

      const data = await response.json();
      console.log('Data received from /user-stats:', data);
      return data;
  } catch (error) {
      console.error('Error fetching user preferences:', error);
      throw error;
  }
}

/**
 * Calculates the great-circle distance between two points using the Haversine formula.
 * 
 * @param {Array<number>} loc1 - The first location [latitude, longitude].
 * @param {Array<number>} loc2 - The second location [latitude, longitude].
 * @returns {number} The distance between the two points in kilometers.
 */
function calculateDistance(loc1, loc2) {
  // Implementing the Haversine formula to calculate the great-circle distance
  const [lat1, lon1] = loc1;
  const [lat2, lon2] = loc2;
  console.log([lat1, lon1])
  console.log([lat2, lon2])
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return distance;
}
document.getElementById("displayCalendarButton").addEventListener("click", function() {
    loadAndDisplayUserEvents();
});

/**
 * Loads and displays user-specific events and available runs in a calendar view.
 * Requires the user to be logged in (checks for a token in localStorage).
 * Utilizes FullCalendar for displaying events in a monthly grid view.
 */
async function loadAndDisplayUserEvents() {
  const token = localStorage.getItem('token');
  if (!token) {
    console.error('No token found, user might not be logged in.');
    return;
  }
  const availableEvents = await fetchAvailableRuns();
  const joinedEvents = await fetchJoinedRuns(); // Fetch user-specific events
  // console.log(availableEvents,joinedEvents)
  const mergedEvents = mergeRuns(availableEvents, joinedEvents); 
  let calendarEl = document.getElementById('calendar');
  const calendar = new FullCalendar.Calendar(calendarEl, {

    initialView: 'dayGridMonth',
    height: 650,
    contentHeight: 600,
    
    events: mergedEvents,
  })
  calendar.render();
}

/**
 * Merges available and joined runs into a single array, ensuring that joined runs are marked appropriately.
 * If a run is present in both available and joined runs, the joined run's details are used, and it's marked as joined.
 * 
 * @param {Array<Object>} availableRuns - An array of run objects available for joining.
 * @param {Array<Object>} joinedRuns - An array of run objects the user has joined.
 * @returns {Array<Object>} An array of merged run objects.
 */
function mergeRuns(availableRuns, joinedRuns) {
  // Add all available runs to the map
  const runMap = new Map();

  availableRuns.forEach(run => runMap.set(run.extendedProps.runId, run));
  joinedRuns.forEach(run => {
    const existingRun = runMap.get(run.extendedProps.runId) || {};
    runMap.set(run.extendedProps.runId, { ...existingRun, ...run, isJoined: true });
  });

  return Array.from(runMap.values()); // Convert to array


}

/**
 * Fetches available runs from the server. Each run is transformed to include display properties
 * such as title, start date, color, and textColor for calendar display.
 *
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of runs with display properties.
 */
async function fetchAvailableRuns() {
  const token = localStorage.getItem('token');
  const response = await fetch("/available-runs", {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`,
    },
  });
  const runs = await response.json();
  return runs.map(run => ({
    title: run.location + run.id,
    start: run.date,
    color: displayColor(run), // Assume this function returns a string color value
    textColor: "#333",
    extendedProps: { runId: run.id }
  }));
}

/**
 * Determines the display color for a run based on its level. This is an example implementation
 * and can be customized based on specific run level criteria.
 *
 * @param {Object} run - The run object.
 * @returns {string} The color string for the run's display based on its level.
 */
function displayColor(run) {
  // Example implementation for coloring based on the run level
  if (run.level < 3) {
    return '#9BCA3E'; // Green for easier levels
  } else if (run.level < 6) {
    return '#FEEB51'; // Yellow for intermediate levels
  } else {
    return '#ED5314'; // Red for harder levels
  }
}

/**
 * Fetches runs the user has joined from the server. Each joined run is transformed to include display properties
 * such as title, start date, color, and textColor for calendar display. Joined runs are marked differently
 * for easy identification in the UI.
 *
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of joined runs with display properties.
 */
async function fetchJoinedRuns() {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch("/joined-runs", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch joined runs');
    const runs = await response.json();
    return runs.map(run => ({
      title: "Joined: " + run.location + run.id,
      color: '#16558F',
      textColor:"white",
      start: run.date,
      extendedProps: { runId: run.id },
    }));
  } catch (error) {
    return [];
  }
}


document.getElementById("searchRuns").addEventListener("keypress", function (event) {
  if (event.key === "Enter") {
    const searchQuery = this.value.trim();
    const runsList = document.getElementById("runsList").getElementsByClassName("run");

    let foundRun = null;
    Array.from(runsList).forEach(run => {
      if (run.dataset.runId === searchQuery) {
        foundRun = {
          id: run.dataset.runId,
          date: run.querySelector('div:nth-child(2)').innerText.replace('Date: ', ''),
          location: run.querySelector('div:nth-child(3)').innerText.replace('Location: ', ''),
          level: run.querySelector('div:nth-child(4)').innerText.replace('Level: ', ''),
          startingPlace: run.dataset.startingPlace, // Retrieve starting place
          endingPlace: run.dataset.endingPlace // Retrieve ending place
        };
      }
    });

    if (foundRun) {
      selectRun(foundRun); // Display the selected run's details
    } else {
      alert("Run ID not found. Please try again.");
    }
  }
});

/**
 * Stores the selected run's details in localStorage and toggles the visibility of the UI.
 * 
 * @param {Object} run - The run id, date, location, level, startingPlace, and endingPlace.
 */
function selectRun(run) {

  console.log(run); // Check the run object content
  localStorage.setItem("selectedRunId", run.id);
  localStorage.setItem("selectedRunStartingPlace", (run.startingPlace));  
  localStorage.setItem("selectedRunEndingPlace", (run.endingPlace));
    
  const individualRunSection = document.getElementById("individualRunSection");
  individualRunSection.style.display = 'block';
  appSection.style.display = 'none';
}

/**
 * Handles WHAT Happens when the "Display Map" button is clicked. Retrieves the selected run's ID from localStorage
 * and initiates the map display for the run if an ID is present.
 */
document.getElementById("displayMapButton").addEventListener("click", function () {
  const runId = localStorage.getItem("selectedRunId"); // Retrieve the selected run ID
  console.log(runId)
  const startingArea = localStorage.getItem("selectedRunStartingPlace");
  console.log(startingArea)
  if (runId) {
    displayMap(runId); // Use the joinRun function with the selected run ID
  } else {
    alert("Please select a run first.");
  }
});

/**
 * initiates the drawing of the route on the map using stored starting and
 * ending coordinates of the selected run.
 * 
 * @param {string} runId - The unique identifier of the run for which to display the map.
 */
function displayMap(runId) {
  const mapContainer = document.getElementById("mapContainer");
  mapContainer.innerHTML = ''; // Clear map container

  // Retrieve the coordinates as strings
  const startingAreaStr = localStorage.getItem("selectedRunStartingPlace");
  const endingPlaceStr = localStorage.getItem("selectedRunEndingPlace");

  // Check if startingAreaStr and endingPlaceStr are available
  if (!startingAreaStr || !endingPlaceStr) {
    alert("Run starting and ending coordinates not found.");
    return;
  }

  const startingArea = startingAreaStr.split(',').map(Number);
  const endingPlace = endingPlaceStr.split(',').map(Number);

  console.log(startingArea, endingPlace);
  createMapAndDrawRoute(mapContainer, startingArea, endingPlace);
}

/**
 * Initializes a Mapbox map within the given container element and draws a route between the specified
 * starting and ending coordinates.
 * 
 * @param {HTMLElement} mapContainer - The container element for the Mapbox map.
 * @param {Array<number>} startingArea - An array containing the latitude and longitude of the starting point.
 * @param {Array<number>} endingPlace - An array containing the latitude and longitude of the ending point.
 */
function createMapAndDrawRoute(mapContainer, startingArea, endingPlace) {
  const centerCoordinates = calculateCenter(startingArea, endingPlace);
  const map = new mapboxgl.Map({
    container: mapContainer,
    style: 'mapbox://styles/mapbox/streets-v11',
    center: centerCoordinates,
    zoom: 9
  });

  // Wait for the map to load before adding routes and markers
  map.on('load', function() {
    createRoute1(map, startingArea, endingPlace);

    // Add markers for starting and ending points
    addMarker(startingArea, map);
    addMarker(endingPlace, map);
  });
}

/**
 * Adds a marker to the map at the specified coordinates.
 * 
 * @param {Array<number>} coordinates - The coordinates [longitude, latitude].
 * @param {mapboxgl.Map} map - The Mapbox map
 */
function addMarker(coordinates, map) {
  new mapboxgl.Marker()
    .setLngLat([coordinates[0], coordinates[1]])
    .addTo(map);
}

/**
 * Calculates center point between two locations to set the initial view of the map.
 * 
 * @param {Array<number>} startingArea - Starting coordinates [longitude, latitude].
 * @param {Array<number>} endingPlace - Ending coordinates [longitude, latitude].
 * @returns {Array<number>} The center coordinates [latitude, longitude].
 */
function calculateCenter(startingArea, endingPlace) {
  const startLng = startingArea[0];
  const startLat = startingArea[1];
  const endLng = endingPlace[0];
  const endLat = endingPlace[1];

  const centerLng = (startLng + endLng) / 2;
  const centerLat = (startLat + endLat) / 2;

  return [centerLat, centerLng];
}

/**
 * Requests a route from the Mapbox Directions API and displays it on the map.
 * 
 * @param {mapboxgl.Map} map - The Mapbox map.
 * @param {Array<number>} startingArea - Starting coordinates [longitude, latitude].
 * @param {Array<number>} endingPlace - Ending coordinates [longitude, latitude].
 */
function createRoute1(map, startingArea, endingPlace) {
  const startLng = parseFloat(startingArea[0]);
  const startLat = parseFloat(startingArea[1]);
  const endLng = parseFloat(endingPlace[0]);
  const endLat = parseFloat(endingPlace[1]);

  // Construct strings for API request
  const startLngLat = `${startLng},${startLat}`;
  const endLngLat = `${endLng},${endLat}`;

  createRouteinMap1(startLngLat, endLngLat).then((data) => {
    if (!data || !data.routes.length) {
      console.error('No route data returned.');
      return;
    }

    const route = data.routes[0].geometry.coordinates;
    const geojson = {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: route,
      },
    };

    if (map.getSource("route")) {
      map.getSource("route").setData(geojson);
    } else {
      map.addLayer({
        id: "route",
        type: "line",
        source: {
          type: "geojson",
          data: geojson,
        },
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#888",
          "line-width": 6,
        },
      });
    }
  }).catch(error => console.error("Error creating route:", error));
}


async function createRouteinMap1(startLngLat, endLngLat) {
  console.log('API Request with:', startLngLat, endLngLat);
  const directionsRequest = `https://api.mapbox.com/directions/v5/mapbox/walking/${startLngLat};${endLngLat}?&walking_speed=5&geometries=geojson&access_token=${mapboxgl.accessToken}`;

  try {
    const response = await fetch(directionsRequest);
    if (!response.ok) {
      throw new Error("Failed to fetch route");
    }
    const json = await response.json();
    console.log(json);
    return json;
  } catch (error) {
    console.error("Error fetching directions:", error);
    throw error; 
  }
}

document.getElementById("joinRunButton").addEventListener("click", function () {
  const runId = localStorage.getItem("selectedRunId"); // Retrieve the selected run ID
  if (runId) {
    joinRun(runId); // Use the joinRun function with the selected run ID
  } else {
    alert("Please select a run first.");
  }
});

/**
 * Tries to join a run using the run's unique ID. 
 * 
 * @param {string} runId - The runId
 */
function joinRun(runId) {
  // Retrieve the token using the key 'token'
  const token = localStorage.getItem("token");

  fetch("/join-run", {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        // Correctly include the token for authentication
        "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ runId: runId }),
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`Failed to join run: ${response.status} ${response.statusText}`);
    }
    return response.json();
  })
  .then(data => {
    // Display a success message and clear the runId input field
    alert("Successfully joined the run!");
  })
  .catch(error => {
    // Log and alert the error message
    console.error("Error:", error);
    alert("Failed to join the run. Please try again later.");
  });
}

document.getElementById("submitCommentButton").addEventListener("click", handleSubmitClick);

/**
 * Submits a user's comment for a selected run. Updating the UI upon success or failure.
 */
async function handleSubmitClick() {
  const runId = localStorage.getItem("selectedRunId");
  console.log("Submitting comment for runId:", runId); // Log runId
  
  const commentText = document.getElementById("commentText").value.trim();
  console.log("Comment text:", commentText); // Log commentText

  const token = localStorage.getItem("token");
  console.log("User token:", token ? "Present" : "Absent"); 

  try {
    await submitComment(runId, commentText, token);
    document.getElementById("commentText").value = "";
    alert("Your comment was submitted successfully.");
    fetchAndDisplayComments(runId);
  } catch (error) {
    console.error("Error submitting comment:", error.message);
    alert(error.message);
  }
}

/**
 * Submits a comment for a specified run to the server. 
 * 
 * @param {string} runId - Run Id for which the comment is being submitted.
 * @param {string} commentText - The text of the comment.
 * @param {string} token - The authentication token.
 * @throws {Error} - Error if the comment submission fails, as well as the reason for failure.
 */
async function submitComment(runId, commentText, token) {
  const response = await fetch("/submit-comment", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ runId, commentText }),
  });

  if (!response.ok) {
    const errorDetails = await response.text();
    throw new Error(`Failed to submit comment: ${errorDetails}`);
  }
}


document.getElementById("fetchCommentButton").addEventListener("click", function() {
  const runId = localStorage.getItem('selectedRunId');
  if (runId) {
    fetchAndDisplayComments(runId);
  } else {
    console.error("Error: Run Id is missing");
    alert("Error: Run Id is missing");
  }
});

/**
 * Fetches and displays comments for a specific run. 
 * 
 * @param {string} runId - RunID for which comments are being fetched.
 */
async function fetchAndDisplayComments(runId) {
  console.log("Attempting to fetch comments for runId:", runId); // Log the runId

  let token = localStorage.getItem("token");
  console.log("Token present:", !!token); // Log if the token is present

  try {
    const response = await fetch(`/fetch-comments/${runId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    });

    console.log("Response status:", response.status); // Log the response status
    if (!response.ok) {
      throw new Error(`Failed to fetch comments: ${response.statusText}`);
    }

    const comments = await response.json();
    console.log("Comments fetched:", comments.length); // Log the number of comments fetched
    
    displayComments(comments);
  } catch (error) {
    console.error("Error fetching comments:", error);
    alert("Failed to load comments: " + error.message);
  }
}
/**
 * Renders fetched comments into the  area on the webpage.
 * 
 * @param {Array<Object>} comments - An array of comment objects
 * containing a userId, commentText, and timestamp.
 */
function displayComments(comments) {
  const commentsDisplayArea = document.getElementById("commentsDisplayArea");
  commentsDisplayArea.innerHTML = ''; // Clear existing comments

  comments.forEach(comment => {
    let commentElement = document.createElement("div");
    // Format the timestamp from the comment
    const formattedTimestamp = new Date(comment.timestamp).toLocaleString();
    // Display the userId, commentText, and timestamp
    commentElement.innerHTML = `<strong>User ID: ${comment.userId}</strong>: ${comment.commentText} <em>${formattedTimestamp}</em>`;
    commentsDisplayArea.appendChild(commentElement);
  });
}

document.getElementById("backButton").addEventListener("click", function() {
  document.getElementById("individualRunSection").style.display = 'none'; 
  document.getElementById("appSection").style.display = 'block'; 
  document.getElementById("searchRuns").value = ''; 
  localStorage.removeItem('selectedRunId'); 
});

/**
 * Fetches run data from the server and a chart based on the number of participants
 * and their levels in each run.
 */
async function fetchRunDataAndRenderChart() {
  try {
    const response = await fetch('/run-participants');
    const { dates: runIds, participantCounts, runLevels } = await response.json();

    // Define colors based on run levels
    const colors = runLevels.map(level => {
      if (level >= 1 && level <= 2) {
        return 'rgba(75, 192, 192, 0.2)'; // Color for levels 1 and 2
      } else if (level >= 3 && level <= 4) {
        return 'rgba(255, 206, 86, 0.2)'; // Color for levels 3 and 4
      } else {
        return 'rgba(255, 99, 132, 0.2)'; // Color for level 5 and up
      }
    });

    const borderColor = runLevels.map(level => {
      if (level >= 1 && level <= 2) {
        return 'rgba(75, 192, 192, 1)'; // Border color for levels 1 and 2
      } else if (level >= 3 && level <= 4) {
        return 'rgba(255, 206, 86, 1)'; // Border color for levels 3 and 4
      } else {
        return 'rgba(255, 99, 132, 1)'; // Border color for level 5 and up
      }
    });

    const ctx = document.getElementById('participantsChart').getContext('2d');
    const participantsChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: runIds,
        datasets: [{
          label: 'Number of Participants',
          data: participantCounts,
          backgroundColor: colors,
          borderColor: borderColor,
          borderWidth: 1,
        }]
      },
      options: {
        scales: {
          y: {
            beginAtZero: true
          }
        },
        plugins: {
          legend: {
            display: true,
            labels: {
              generateLabels: chart => {
                return [
                  { text: 'Level 1-2', fillStyle: 'rgba(75, 192, 192, 0.2)' },
                  { text: 'Level 3-4', fillStyle: 'rgba(255, 206, 86, 0.2)' },
                  { text: 'Level 5+', fillStyle: 'rgba(255, 99, 132, 0.2)' },
                ];
              }
            }
          }
        }
      }
    });
  } catch (error) {
    console.error('Failed to fetch run data or render the chart:', error);
  }
}


document.getElementById("activeChallengesButton").addEventListener("click", function() {
  document.getElementById("appSection").style.display = 'none'; // Hide the main app section
  document.getElementById("challengesSection").style.display = 'block'; // Show the challenges section
  fetchAndDisplayChallenges()
});

document.addEventListener("DOMContentLoaded", function() {
  document.getElementById("createChallengeButton").addEventListener("click", function() {
      createChallenge();
  });
});


/**
 * Contains the information inthe challenge creation form, validates the input, and submits a new challenge
 * to the server. Alerts the user upon success or failure of challenge creation.
 */
function createChallenge() {
  // Retrieve user input from challenge creation form fields
  const title = document.getElementById("challengeTitle").value;
  const description = document.getElementById("challengeDescription").value;
  const startDate = document.getElementById("challengeStartDate").value;
  const endDate = document.getElementById("challengeEndDate").value;
  const challengeType = document.querySelector('input[name="challengeType"]:checked').value;
  const goalValue = document.getElementById("challengeGoalValue").value;
  let token = localStorage.getItem("token");

  // Validate inputs
  if (!title || !description || !startDate || !endDate || !challengeType || !goalValue) {
      alert("Please fill in all required fields.");
      return;
  }

  // Prepare data for submission
  const challengeData = {
      title,
      description,
      dates: { start: startDate, end: endDate },
      type: challengeType,
      goal: goalValue
  };

  fetch('/create-challenge', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify(challengeData)
  }).then(response => {
      if (!response.ok) {
          throw new Error("Creating challenge failed. Status: " + response.status);
      }
      return response.json();
  }).then(data => {
      console.log("Challenge created successfully!", data);
      alert("Challenge created successfully!");
  }).catch(error => {
      console.error("Create challenge failed:", error);
      alert("Create challenge failed: " + error.message);
  });
}

async function fetchAndDisplayChallenges() {
  const token = localStorage.getItem("token");
  if (!token) {
      alert("You are not logged in.");
      return;
  }

  try {
      const response = await fetch("/available-challenges", {
          method: "GET",
          headers: {"Authorization": `Bearer ${token}`},
      });

      if (!response.ok) {
          throw new Error("Failed to fetch challenges");
      }

      const availableChallenges = await response.json(); // Store fetched challenges
      displayChallenges(availableChallenges); // Initial display
  } catch (error) {
      console.error("Failed to load challenges:", error);
      alert("Failed to load challenges.");
  }
}

/**
 * Fetches available challenges from the server and displays them on the web page. Requires
 * user authentication for access.
 */
function displayChallenges(challenges) {
  const challengesList = document.getElementById("challengesList");
  challengesList.innerHTML = ''; // Clear existing challenges

  challenges.forEach(challenge => {
      const challengeDiv = document.createElement("div");
      challengeDiv.className = "challenge";
      challengeDiv.innerHTML = `
          <div><strong>Title:</strong> ${challenge.id}</div>
          <div><strong>Title:</strong> ${challenge.title}</div>
          <div><strong>Description:</strong> ${challenge.description}</div>
          <div><strong>Start Date:</strong> ${new Date(challenge.dates.start).toLocaleDateString()}</div>
          <div><strong>End Date:</strong> ${new Date(challenge.dates.end).toLocaleDateString()}</div>
          <div><strong>Type:</strong> ${challenge.type}</div>
          <div><strong>Goal:</strong> ${challenge.goal}</div>
          <button class="joinButton" data-challenge-id="${challenge.id}">Join</button>
          <button class="displayUserProgress" data-challenge-id="${challenge.id}">User Progress</button>
      `;
      challengesList.appendChild(challengeDiv);
  });

  // Add event listeners to each join button
  const joinButtons = document.querySelectorAll('.joinButton');
  joinButtons.forEach(button => {
      button.addEventListener('click', () => {
          const challengeId = button.dataset.challengeId;
          const userId = localStorage.getItem('userId'); 
          joinChallenge(challengeId, userId);
      });
  });
  const displayUserProgress = document.querySelectorAll('.displayUserProgress');
  displayUserProgress.forEach(button => {
    button.addEventListener('click', () => {
      const challengeId = button.dataset.challengeId;
      sendChallengeIdToServer(challengeId)
    }
  )
  })


}


async function joinChallenge(challengeId, userId) {
  console.log("Attempting to join challenge with ID:", challengeId);
  console.log("User ID:", userId);
  let token = localStorage.getItem("token");

  
  fetch(`/join-challenge`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify({ challengeId })
  }).then(response => {
      if (!response.ok) throw new Error('Failed to join challenge');
      console.log(`User ${userId} joined challenge ${challengeId}`);
      return response.json();
  }).then(data => {
      console.log("Join response:", data);
  }).catch(error => console.error('Error joining challenge:', error));
}




/**
 * Sends a selected challenge ID to the server to fetch progress data for all participants
 * of that challenge.=
 * 
 * @param {string} challengeId - Challenge id for the progress data 
 */
async function sendChallengeIdToServer(challengeId) {
  const token = localStorage.getItem('token');
  try {
    const response = await fetch('/challenge-progress', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ challengeId }),
    });


    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log(data)
    displayChallengeProgress(data);
  } catch (error) {
    console.error('Error sending challenge ID to server:', error);
  }
}

/**
 * Chart displaying the progress of each participant in a selected challenge.
 * 
 * @param {Array<Object>} progressData - An array containing progress data for each participant, 
 * including their userId and progress percentage.
 */
function displayChallengeProgress(progressData) {
  


  progressData.sort((a, b) => b.progressPercentage - a.progressPercentage);

  const ctx = document.getElementById('progressChart').getContext('2d');
  if (window.barChart !== undefined) {
    window.barChart.destroy();
  }
  window.barChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: progressData.map(data => `User ${data.userId}`),
      datasets: [{
        label: 'Progress (%)',
        data: progressData.map(data => data.progressPercentage),
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1
      }]
    },
    options: {
      scales: {
        y: {
          beginAtZero: true,
          max: 100
        }
      },
      plugins: {
        legend: {
          display: false
        }
      },
      maintainAspectRatio: false
    }
  });
}


document.getElementById("backToAppButton").addEventListener("click", function() {
  document.getElementById("challengesSection").style.display = 'none'; 
  document.getElementById("appSection").style.display = 'block'; 
  document.getElementById("searchRuns").value = ''; 
  localStorage.removeItem('selectedRunId'); 
});



