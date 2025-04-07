const express = require("express");
const bcrypt = require("bcrypt");
const mongodb = require("mongodb");
const jwt = require('jsonwebtoken');
const cron = require('node-cron');
require('dotenv').config();

const { MongoClient, ObjectId } = require('mongodb');

let nanoid;

import("nanoid").then(module => {
    nanoid = module.nanoid;
});

const app = express();
app.use(express.static('.'));
app.use(express.json());

const dbURI = "mongodb://localhost:27017/CS5003"; 
const dbName = "CS5003"; 
const JWT_SECRET = 'secret_key';

let db, usersCollection, runsCollection, commentsCollection, challengesCollection;

let apiKey = 'dd64dd7a5d85f7b416e3923f2165828e';

/**
 * Connects to the Mongo Database and sets up the collections
 * @returns the client name
 */

async function connectDB() {
    if (db) return db;

    const client = new MongoClient(dbURI);
    await client.connect();
    console.log("Connected to MongoDB");
    db = client.db(dbName);

    // Initialize collections specific to your application
    usersCollection = db.collection("users");
    runsCollection = db.collection("runs"); 
    commentsCollection = db.collection("comments");
    challengesCollection = db.collection("challenges");

    return db;
}

module.exports = { connectDB, checkChallengeProgress };


connectDB().then(() => {
    app.listen(3002, () => console.log("Server running on port 3002"));
}).catch(console.error);


/**
 * Provides the user with an authentication token to track their user id
 * @returns auth token
 */
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
  
    if (token == null) return res.sendStatus(401);
  
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}



/**
 * End point for a used to be registered
 * @returns a success or error message dependant on the response
 */

app.post("/register", async function (req, res) {
  try {
    const userRegistered = await registerUser(req.body); 
    res.status(200).send(userRegistered);
  } catch (error) {
    res.status(400).send(error.message);
  }
});

/**
 * End point for a used to log in
 * @returns a success or error message dependant on the response
 */
app.post("/login", async function (req, res) {
  try {
    const userLogin = await loginUser(req.body);
    res.status(200).send(userLogin);
  } catch (error) {
    res.status(401).send(error.message);
  }
});

/**
 * Registers a new user with the given userData. We connect to the database and
 * check if the inputs are valid. For example, we call an error if the username laready exists, we then
 * hash the provided password, ans add user's details to the database.
 * 
 * @param {Object} userData - Contains the username and password. 
 * @returns {Promise<string>} a success message
 * @throws {Error} Throws an error if the user is already registered.
 */
async function registerUser(userData) {
  const db = await connectDB(); 
  const usersCollection = db.collection("users");

  const existingUser = await usersCollection.findOne({ username: userData.username });
  if (existingUser) {
    throw new Error('Username already exists');
  }

  const hashedPassword = await bcrypt.hash(userData.password, 10); 
  const newUser = {
    userId: nanoid(), // Generate a unique userID
    username: userData.username,
    password: hashedPassword
  };

  await usersCollection.insertOne(newUser);
  return "User registered successfully";
}

/**
 * Logs in the user by comparing their username and password to those already in the database. If the
 * user is found and the password matches then a token is returned with the user's Id.
 * 
 * @param {Object} userData - The username and password
 * @returns {Promise<Object>} returns the token and user Id.
 * @throws {Error} occurs when username or password does not match. 
 */
async function loginUser(userData) {
  const db = await connectDB();
  const usersCollection = db.collection("users");

  const user = await usersCollection.findOne({ username: userData.username });
  if (!user) {
    throw new Error('User not found');
  }

  const isPasswordValid = await bcrypt.compare(userData.password, user.password);
  if (!isPasswordValid) {
    throw new Error('Invalid username or password');
  }

  // Generate a token
  const token = jwt.sign({ userId: user.userId, username: user.username }, JWT_SECRET, { expiresIn: '1h' });

  return { message: "Login successful", token: token, userId: user.userId };
}

/**
 * Endpoint for creating a run. Takes the user ID from the token, and then makes sure that the 
 * required elements are all provided and correct. 
  * Returns a success message and the run ID
 * 
 * 
 * @param {Object} req - The request containing a user object with 'userId' and the run details. 
 * @param {Object} res - Sends back the response containing the success message and the run ID. 
 * @returns {Promise<void>} JSON response with success or error information.
 */
app.post("/create-run", authenticateToken, async (req, res) => {
  try {
   
    const userId = req.user.userId;  
    
    if (!userId) {
      return res.status(403).json({ error: "User not authenticated." });
    }

    const db = await connectDB();
    const runsCollection = db.collection("runs");
    const runDetails = req.body.runDetails;

    if (!runDetails) {
      return res.status(400).json({ error: "Invalid run details. All fields are required." });
    }

    const newRun = {
      userId,
      ...runDetails,
      participants: [userId], 
    };

    console.log(newRun)

    const result = await runsCollection.insertOne(newRun);
    res.status(200).json({
      success: true,
      message: "Run created successfully",
      runId: result.insertedId,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


/**
 * Receives the users preferences from the client side and stores them in the correct location
 * If the userId is not provided or the specified user cannot be found in the database
 * this triggers an error response. 
 * 
 * @param {Object} req - The request object, containing 'maxDistance', 'preferredLength',
 * 'averagePace', 'userLocation', and 'userId'
 * @param {Object} res - The response object, used for sending back the HTTP response.
 * @returns {Promise<void>} success or error messages.
 */
app.post('/user-stats', authenticateToken, async (req, res) => {
  const { maxDistance, preferredLength, averagePace, userLocation, userId } = req.body;
  console.log("Received preferences to update for userId:", userId);
  console.log("Received preferences data:", req.body);

  if (!userId) {
    console.error("UserId is required but not provided");
    return res.status(400).json({ message: "UserId is required" });
  }

  try {
    const db = await connectDB();
    const usersCollection = db.collection("users");

    // Update the user document with the provided preferences
    const updateResult = await usersCollection.updateOne(
      { userId },
      { 
        $set: {
          preferences: {
            maxDistance,
            preferredLength,
            averagePace,
            userLocation
          }
        }
      }
    );

    console.log("Update result:", updateResult);
    if (updateResult.matchedCount === 0) {
      console.error("User not found in the database:", userId);
      return res.status(404).json({ message: "User not found" });
    }

    console.log("User preferences updated successfully for userId:", userId);
    res.status(200).json({ message: "User preferences saved successfully" });
  } catch (error) {
    console.error('Error updating user preferences:', error);
    res.status(500).json({ error: "An error occurred while saving your preferences." });
  }
});

/**
 * Retrieves user preferences for a specified userID and returns the preferences set
 * by the user. Handles error with an error message. 
 * @param {Object} req - Contains the userID
 * @param {Object} res - Sends back the preferences
 * @returns {Promise<void>}  user preferences or error messages in JSON.
 */
app.get('/user-stats', authenticateToken, async (req, res) => {
  // Log to confirm entry into the route
  console.log('Fetching user stats', new Date().toISOString());

  const userId = req.user.userId;
  console.log('Authenticated userId:', userId);

  if (!userId) {
    console.log('No userId found in request');
    return res.status(403).json({ error: "User not authenticated." });
  }

  try {
    const db = await connectDB();
    const usersCollection = db.collection("users");

    console.log('Looking for user preferences with userId:', userId);
    const user = await usersCollection.findOne({ userId }, { projection: { preferences: 1, _id: 0 } });

    if (!user) {
      console.log('User not found in database:', userId);
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.preferences) {
      console.log('User preferences not found for userId:', userId);
      return res.status(404).json({ message: "User preferences not found" });
    }

    console.log('User preferences found:', user.preferences);
    res.status(200).json(user.preferences);
  } catch (error) {
    console.error('Error fetching user preferences:', error);
    res.status(500).json({ error: "An error occurred while retrieving user preferences." });
  }
});

/**
 * Fetches available runs from the database whilst adding the weather condition to each run
 * based on the run's date and starting location.
 * 
 * @param {Object} req - User authentication
 * @param {Object} res - Send back the list of runs with weather
 * @returns {Promise<void>} A list of runs including weather conditions
 * .
 */

app.get("/available-runs", authenticateToken, async (req, res) => {
  try {
    const db = await connectDB();
    const runsCollection = db.collection("runs");

    const allRuns = await runsCollection.find({}).toArray();
    if (!allRuns.length) {
      return res.status(404).json({ message: "No runs available." });
    }

    // Fetch weather condition for each run dynamically
    const runsWithWeather = await Promise.all(allRuns.map(async (run) => {
      const weatherCondition = await fetchWeatherCondition(run.date, run.startingPlace[0], run.startingPlace[1])
        .catch(error => {
          console.error("Failed to fetch weather conditions for run", run._id, ":", error);
          return "Weather data unavailable"; // Provide a default message in case of an error
        });

      // Return a new object for each run with the weatherCondition included
      return {
        id: run._id.toString(),
        ...run,
        weatherCondition, // Include the fetched weather condition
      };
    }));

    res.status(200).json(runsWithWeather);
  } catch (error) {
    console.error("Failed to fetch available runs:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const fetch = require('node-fetch');

/**
 * Fetches the weather condition date and location using the OpenWeatherMap Forecast API.
 * returns the main weather condition(e.g., Rain, Clear, Clouds). 
 * If the date is invalid, if the API request fails, or if the weather
 * condition cannot be determined, a default message is returned.
 * 
 * @param {string} dateInput - The date of the weather forecast
 * @param {number} longitude - location of forecast
 * @param {number} latitude - latitude of forecast
 * @returns {Promise<string>} returns weather condition.
 * @throws {Error} returns an error
 */
async function fetchWeatherCondition(dateInput, longitude, latitude) {
  const apiKey = "dd64dd7a5d85f7b416e3923f2165828e";  
  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${latitude}&lon=${longitude}&appid=${apiKey}&units=metric`;

  try {
    // Parse the dateInput into a Date object to ensure .getTime() can be called on it
    const date = new Date(dateInput);
    if (isNaN(date)) {
      throw new Error(`Invalid date provided: ${dateInput}`);
    }
    const targetTimestamp = date.getTime();

    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Weather API responded with ${response.status}: ${response.statusText}`);
      return "Data unavailable";
    }

    const data = await response.json();

    // Find the forecast closest to the desired date
    const closestForecast = data.list.reduce((prev, curr) => {
      const prevDiff = Math.abs(new Date(prev.dt * 1000).getTime() - targetTimestamp);
      const currDiff = Math.abs(new Date(curr.dt * 1000).getTime() - targetTimestamp);
      return (prevDiff < currDiff) ? prev : curr;
    });

    const weatherCondition = closestForecast.weather && closestForecast.weather.length > 0 ? closestForecast.weather[0].main : "Condition unknown";

    console.log(`Weather condition for ${dateInput} at [${latitude}, ${longitude}]:`, weatherCondition);
    return weatherCondition;
  } catch (error) {
    console.error("Failed to fetch weather conditions:", error);
    return "Weather data unavailable"; // Return a default message on error
  }
}

/**
 * Aloows user's to join a run by recieving a specfic run Id
 * It first Validates the presence of a user ID and run ID in the request. Adds the user to the run's participant list 
 * through the joinRun function. 
 * 
 * @param {Object} req - The request object, containing the user's userId
 * and the runId.
 * @param {Object} res - The response sending sucess or error message
 * @returns {Promise<void>} JSON response indicating the outcome.
 */

app.post("/join-run", authenticateToken, async function (req, res) {
  try {
    const userId = req.user.userId; 
    
    const { runId } = req.body; 


    if (!userId) {
      return res.status(403).json({ message: "User not authenticated" });
    }
    if (!runId) {
      return res.status(400).json({ message: "Run ID is required" });
    }

    const result = await joinRun(userId, runId); // Call the joinRun function with user ID and run ID

    if (result) {
      // If the joinRun operation is successful
      return res.status(200).json({ message: "Successfully joined the run" });
    }
  } catch (error) {

    let statusCode = 500;

    if (error.message === "Run does not exist" || error.message === "User does not exist") {
      statusCode = 404; // Not Found
    } else if (error.message === "User already joined") {
      statusCode = 409; 
    }

    res.status(statusCode).json({ error: error.message });
  }
});

/**
 * Retrieves a list of runs that the user has joined. Fetches the runs from the database
 * where the user's ID appears in the participants list.
 * 
 * @param {Object} req - The request object, containing the user's userId.
 * @param {Object} res - The response object, which sends the list of joined runs
 * or an empty array.
 * @returns {Promise<void>} JSON response with the runs or an empty array.
 */
app.get("/joined-runs", authenticateToken, async (req, res) => {
  try {
      const userId = req.user.userId; 
      const db = await connectDB();
      const runsCollection = db.collection("runs");

      const runs = await runsCollection.find({
          participants: { $in: [userId] }
      }).toArray();

      const formattedRuns = runs.map(run => ({
        id: run._id.toString(), // Convert ObjectId to string for client-side handling
        userId: run.userId, 
        ...run,
        date: run.date
    }));
    
      if (!runs.length) {
          return res.status(204).json([]); // No Content
      }
      res.status(200).json(formattedRuns);
  } catch (error) {
      console.error("Failed to fetch joined runs:", error);
      res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * Adds a user to a run's participant list. First checks the validity of the user and the run
 * Checks if the user has already joined the run. 
 * 
 * @param {string} userId - The ID of the user attempting to join the run.
 * @param {string} runId - The ID of the run.
 * @returns {Promise<boolean>} A promise that is true when a user is successfully added to the
 * run's participants.
 * @throws {Error} Returns an error if the run does not exist.
 */
async function joinRun(userId, runId) {
  // Verify that both the user ID and run ID are valid
  const runExists = await runsCollection.findOne({ _id: new mongodb.ObjectId(runId) });
  if (!runExists) throw new Error("Run does not exist");

  // Check if the user has already joined the run
  if (runExists.participants.includes(userId))
    throw new Error("User already joined");

  // Add the user to the run's participants list
  const updateResult = await runsCollection.updateOne(
    { _id: new mongodb.ObjectId(runId) },
    { $addToSet: { participants: userId } }
  );

  if (updateResult.matchedCount === 0) throw new Error("Run does not exist");

  return true; 
}

/**
 * Submits a comment for a specific run. The comment, the user's ID and the run's ID, are stored in the database. 
 * Cahcks the inputs are valid
 *  Adds the comment to the database and returns a success message.
 * 
 * @param {Object} req - The request object, containing 'runId', 'commentText', and the
 * user's 'userId' in the body.
 * @param {Object} res - The response object, sends back success or error message
 * @returns {Promise<void>} No explicit return value but responds with success or error messages.
 */
app.post("/submit-comment", authenticateToken, async function (req, res) {
  try {
    const { runId, commentText } = req.body;
    const userId = req.user.userId;

    console.log("Received comment for runId:", runId, "from userId:", userId);

    if (!runId || !commentText) {
      console.log("Missing required fields");
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Ensure runId is a valid ObjectId
    if (!mongodb.ObjectId.isValid(runId)) {
      console.log("Invalid runId format", "runId:", runId);
      return res.status(400).json({ message: "Invalid runId format" });
    }

    const runExists = await runsCollection.findOne({ _id: new mongodb.ObjectId(runId) });
    if (!runExists) {
      console.log("Run does not exist:", runId);
      return res.status(404).json({ message: "Run does not exist" });
    }

    console.log("Posting comment:", commentText, "for runId:", runId, "by userId:", userId);

    const comment = {
      runId: new mongodb.ObjectId(runId), 
      userId, 
      commentText,
      timestamp: new Date(),
    };

    // Insert the comment into the commentsCollection
    await commentsCollection.insertOne(comment);
    console.log("Comment posted successfully:", commentText, "for runId:", runId, "by userId:", userId);

    // Respond to the client that the comment has been posted successfully
    res.status(201).json({ message: "Comment posted successfully" });
  } catch (error) {
    console.error("Submit comment failed:", error);
    res.status(500).json({ message: "Failed to post comment" });
  }
});

/**
 * Fetches comments for a run, identified by the run ID.  Comments are returned in descending order by their timestamp. 
 * If no comments are found for the run, the user is informed.
 * 
 * @param {Object} req - The request object, with 'runId'
 * @param {Object} res - The response object, sends back the comments or an error message.
 * @returns {Promise<void>} JSON response with the comments or an error message.
 */
app.get("/fetch-comments/:runId", authenticateToken, async function (req, res) {
  try {
    const { runId } = req.params;
    console.log("Fetching comments for runId:", runId); // Log the runId being queried

    if (!runId) {
      console.log("Run ID not provided");
      return res.status(400).json({ message: "Run ID is required" });
    }

    const comments = await commentsCollection.find({
      runId: new mongodb.ObjectId(runId),
    }).sort({ timestamp: -1 }).toArray();
    
    console.log(`Found ${comments.length} comments for runId: ${runId}`); // Log the number of comments found

    if (comments.length > 0) {
      res.status(200).json(comments);
    } else {
      console.log("No comments found for this run");
      res.status(404).json({ message: "No comments found for this run" });
    }
  } catch (error) {
    console.error("Fetch comments failed:", error);
    res.status(500).json({ message: "Failed to fetch comments" });
  }
});

/**
 * Retrieves data about run participants, including run IDs, participant counts, and run levels from
 * all available runs. The data is fetched using the fetchRunData function and structured into a response object.
 * 
 * @param {Object} req - the request
 * @param {Object} res - The response object, sends back the run participant data.
 * @returns {Promise<void>} JSON object containing arrays
 * of dates, participant counts, and run levels.
 */
app.get("/run-participants", async (req, res) => {
  try {
    const runData = await fetchRunData();

    // Correctly map over runData to extract run IDs, participant counts, and run levels
    const dates = runData.map(run => run.runId);
    const participantCounts = runData.map(run => run.participantCount);
    const runLevels = runData.map(run => run.runLevel); // Use runLevel to match fetchRunData

    console.log(runLevels);

    // Construct the response object with the extracted data
    const responseData = {
      dates,
      participantCounts,
      runLevels // Use runLevels to provide an array of levels
    };

    // Send the response
    res.status(200).json(responseData);
  } catch (error) {
    console.error('Failed to fetch run data:', error);
    res.status(500).json({ error: 'Failed to fetch run data' });
  }
});

/**
 * Fetches data for all runs from the database, including each run's ID, participant count, and level.
 * Gathers data that is used to build the graph. 
 * 
 * @returns {Promise<Array>} A promise that is an array of objects, each representing a run
 * with its ID, participant count, and level.
 * @throws {Error} Throws an error if the database operation fails.
 */
async function fetchRunData() {
  try {
    const db = await connectDB();
    const runsCollection = db.collection("runs");

    const runData = await runsCollection.find({}).toArray();

    const runParticipants = runData.map(run => ({
      runId: run._id.toString(), // Convert ObjectId to string
      participantCount: run.participants.length, 
      runLevel: run.level
    }));

    return runParticipants;
  } catch (error) {
    console.error('Failed to fetch run data:', error);
    throw new Error('Failed to fetch run data');
  }
}

app.post("/create-challenge", authenticateToken, async (req, res) => {
  try {
    // Extract user ID from the authenticated request
    const userId = req.user.userId;
    
    if (!userId) {
      return res.status(403).json({ error: "User not authenticated." });
    }
    
    // Connect to the database and select the challenges collection
    const db = await connectDB();
    const challengesCollection = db.collection("challengesCollection");
    
    // Extract challenge details from the request body
    const { title, description, dates, type, goal } = req.body;
    
    // Validate the received challenge details
    if (!title || !description || !dates || !dates.start || !dates.end || !type || !goal) {
      return res.status(400).json({ error: "Invalid challenge details. All fields are required." });
    }
    
    // Generate a new ObjectId for the challenge
    const challengeId = new mongodb.ObjectId();
    console.log(challengeId)
    
    // Prepare the new challenge object for insertion
    const newChallenge = {
      _id: challengeId, 
      userId, 
      title,
      description,
      dates,
      type,
      goal,
      participants: [], 
      createdAt: new Date() 
    };
    
    // Insert the new challenge into the database
    await challengesCollection.insertOne(newChallenge);
    

    res.status(200).json({
      success: true,
      message: "Challenge created successfully",
      challengeId: challengeId.toHexString() 
    });
  } catch (error) {

    console.error("Error creating challenge:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/available-challenges", authenticateToken, async (req, res) => {
  try {
    const db = await connectDB();
    const challengesCollection = db.collection("challengesCollection");

    const allChallenges = await challengesCollection.find({}).toArray();
    if (!allChallenges.length) {
      return res.status(404).json({ message: "No challenges available." });
    }

    // Simplify the challenge objects for the client-side
    const simplifiedChallenges = allChallenges.map(challenge => ({
        id: challenge._id.toString(),
        title: challenge.title,
        description: challenge.description,
        dates: challenge.dates,
        type: challenge.type,
        goal: challenge.goal
    }));

    res.status(200).json(simplifiedChallenges);
  } catch (error) {
    console.error("Failed to fetch available challenges:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


app.post("/join-challenge", authenticateToken, async function (req, res) {
  try {
    const userId = req.user.userId; 
    const { challengeId } = req.body;
    
    console.log("User ID:", userId);
    console.log("Challenge ID:", challengeId);

    if (!userId) {
      return res.status(403).json({ message: "User not authenticated" });
    }
    if (!challengeId) {
      return res.status(400).json({ message: "Challenge ID is required" });
    }

    const result = await joinChallenge(userId, challengeId); 
    console.log("Join result:", result);

    if (result) {
      return res.status(200).json({ message: "Successfully joined the challenge" });
    }
  } catch (error) {
    let statusCode = 500;

    if (error.message === "Challenge does not exist" || error.message === "User does not exist") {
      statusCode = 404;
    } else if (error.message === "User already joined") {
      statusCode = 409; 
    }

    console.error("Error joining challenge:", error);
    res.status(statusCode).json({ error: error.message });
  }
});

/**
 * Adds a user to a challenge's participant list if they haven't already joined.
 * 
 * @param {string} userId - User Id who is attempting to join the challenge.
 * @param {string} challengeId - The unique identifier of the challenge to join.
 * @returns {Promise<boolean>} A promise that is true if the user successfully joins the challenge, otherwise throws an error.
 * @throws {Error} error if the challenge does not exist or the user has already joined the challenge.
 */
async function joinChallenge(userId, challengeId) {

  const db = await connectDB();
  const challengesCollection = db.collection("challengesCollection");


  const challengeExists = await challengesCollection.findOne({ _id: new mongodb.ObjectId(challengeId) });
  if (!challengeExists) throw new Error("Challenge does not exist");

  // Check if the user has already joined the challenge
  if (challengeExists.participants.includes(userId))
    throw new Error("User already joined");

  // Add the user to the challenge's participants list
  const updateResult = await challengesCollection.updateOne(
    { _id: new mongodb.ObjectId(challengeId) },
    { $addToSet: { participants: userId } }
  );

  if (updateResult.matchedCount === 0) throw new Error("Challenge does not exist");

  return true; 
}


/**
 * Updates the run completion statistics for all users. This function finds all runs that have ended,
 * updates each participant's total distance and total runs, and marks the run as completed.
 * 
 * Intended to be run periodically to keep user statistics up to date.
 * 
 * @returns {Promise<void>} A promise that resolves when the operation is complete.
 */
async function updateRunCompletionStats() {
  const db = await connectDB(); 
  const runsCollection = db.collection("runs");
  const usersCollection = db.collection("users");

  const now = new Date();
  const completedRuns = await runsCollection.find({ 
    endTime: { $lt: now }, 
  }).toArray();

  for (const run of completedRuns) {
    const { participants, distance } = run; 
    for (const userId of participants) {
      await usersCollection.updateOne(
        { userId }, 
        { 
          $inc: { 
            'stats.totalDistance': distance, 
            'stats.totalRuns': 1 
          },
          $push: { 
            'stats.runsDetails': { distance, date: now } 
          }
        }
      );
    }
    // Mark the run as completed
    await runsCollection.updateOne(
      { _id: run._id },
      { $set: { completed: true } }
    );
  }
  

  console.log(`Updated stats for ${completedRuns.length} completed runs.`);
}

/**
 * Checks the progress of all participants in active challenges. For each participant in each challenge,
 * it calculates their progress based on the challenge type (e.g., distance), and updates their progress
 * and completion status in the challenge.
 * 
 * Intended to be run periodically to update challenge progress.
 * 
 * @returns {Promise<void>} A promise that resolves when all active challenges have been updated.
 */
async function checkChallengeProgress() {
  const db = await connectDB();
  const challengesCollection = db.collection("challenges");
  const usersCollection = db.collection("users");

  const now = new Date();
  // Find challenges that are currently active
  const activeChallenges = await challengesCollection.find({
    'dates.start': { $lte: now }, 
    'dates.end': { $gte: now } 
  }).toArray();

  for (const challenge of activeChallenges) {
    const { _id: challengeId, participants, goal, type, dates } = challenge;
    
    for (const userId of participants) {
      const user = await usersCollection.findOne({ userId });
      if (!user || !user.stats || !user.stats.runsDetails) continue; 
      let progress = 0;
      if (type === 'distance') {
        // Filter runs completed within the challenge dates and sum their distances
        const relevantRuns = user.stats.runsDetails.filter(run => 
          run.date >= dates.start && run.date <= dates.end
        );
        progress = relevantRuns.reduce((total, run) => total + run.distance, 0);
      }
  
      const isCompleted = progress >= goal;
      
      await challengesCollection.updateOne(
        { _id: challengeId, 'participants.userId': userId },
        {
          $set: { 
            'participants.$.progress': progress,
            'participants.$.completed': isCompleted
          }
        }
      );
    }
  }
  console.log(`Checked progress for ${activeChallenges.length} active challenges.`);
}


cron.schedule('0 * * * *', async () => {
  console.log('Running scheduled tasks to update run completions and other tasks.');
  try {
      await updateRunCompletionStats();
      await checkChallengeProgress(); 
      console.log('Scheduled tasks completed successfully.');
  } catch (error) {
      console.error('Error during scheduled tasks:', error);
  }
});


app.post('/challenge-progress', authenticateToken, async (req, res) => {
  const { challengeId } = req.body;
  console.log(challengeId)
  if (!challengeId) {
    return res.status(400).json({ message: "Challenge ID is required." });
  }
  try {
    const progressDetails = await getChallengeProgressDetails(challengeId);
    res.json(progressDetails);
  } catch (error) {
    console.error('Error fetching challenge progress:', error);
    res.status(500).json({ error: 'An error occurred while fetching challenge progress.' });
  }
});

/**
 * Progress details of all participants in a specific challenge.
 * 
 * @param {string} challengeId - The unique challenge identifier to get progress details.
 * @returns {Promise<Array>} The progress details of each participant
 * @throws {Error} Throws an error if the specified challenge does not exist.
 */
async function getChallengeProgressDetails(challengeId) {
  const db = await connectDB();
  const challengesCollection = db.collection("challengesCollection");
  const usersCollection = db.collection("users");

  console.log(challengeId)

  const challengeExists = await challengesCollection.findOne({ _id: new mongodb.ObjectId(challengeId) });
  if (!challengeExists) throw new Error("Challenge does not exist");

  const { participants, goal, type, dates } = challengeExists;
  let progressDetails = [];
  for (const userId of participants) {
    const user = await usersCollection.findOne({ userId });
    if (!user || !user.stats || !user.stats.runsDetails) continue;

    let progress = 0;
    if (type === 'distance') {
      const relevantRuns = user.stats.runsDetails.filter(run => 
        run.date >= dates.start && run.date <= dates.end
      );
      progress = relevantRuns.reduce((total, run) => total + run.distance, 0);
    }

    const progressPercentage = ((progress / goal) * 100).toFixed(2);
    progressDetails.push({
      userId,
      progressPercentage: Math.min(100, Number(progressPercentage))
    });
  }
  return progressDetails;
}