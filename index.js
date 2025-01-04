const express = require("express");
const bodyParser = require("body-parser");
const mysql = require("mysql2");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const multer = require("multer");
const path = require("path");
const cors = require("cors");

// Initialize the app
const app = express();

// Enable CORS for all origins
app.use(cors());

// Middleware setup
app.use(bodyParser.json());
app.use(express.static(__dirname));
app.use(express.static("public"));

// Configure Multer to handle file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // Specify the directory for uploaded files
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`); // Use a timestamp to avoid name conflicts
  },
});

const upload = multer({ storage });

const fs = require("fs");

// Directory where files will be stored
const uploadDirectory = path.join(__dirname, "uploads");

// Check if the uploads directory exists
if (!fs.existsSync(uploadDirectory)) {
  // If not, create it
  fs.mkdirSync(uploadDirectory);
}

// Session middleware
app.use(
  session({
    secret: "gfjhdblkgfgcct76598hgdytrgvnjgf509862mvvhjhgf",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // Set to true if using HTTPS
  })
);

// Middleware to check if the user is an admin
function isAdmin(req, res, next) {
  if (req.session.user && req.session.user.isAdmin) {
    next();
  } else {
    res.status(403).send("Access denied. Admins only.");
  }
}

// Admin dashboard route
app.get("/admin-dashboard", isAdmin, (req, res) => {
  res.sendFile(__dirname + "/admin-dashboard.html");
});

// Middleware to check if the user is logged in
function isAuthenticated(req, res, next) {
  console.log("Checking if user is authenticated...");

  // Log session data for debugging
  console.log("Session Data:", req.session);

  if (req.session.user) {
    console.log("User is authenticated:", req.session.user); // User data exists in session
    next(); // Proceed to the next middleware or route handler
  } else {
    console.log("User is not authenticated. Redirecting to login page.");
    res.redirect("/login"); // Redirect to login page if not logged in
  }
}

const db = mysql.createConnection({
  host: "junction.proxy.rlwy.net", // Railway public host
  user: "root",                    // Railway username
  password: "ekhGtuJdFbLwOugQOosKVQUpmxglecrx", // Railway password
  database: "railway",             // Railway database name
  port: 41241,                     // Public URL port
  connectTimeout: 20000,
});



db.connect((err) => {
  if (err) {
    console.error("Database connection error:", err);
    process.exit(1);
  }
  console.log("Connected to MySQL Database.");
});

// Serve login.html
app.get("/login", (req, res) => {
  res.sendFile(__dirname + "/login.html");
});

// Protected route: Homepage
app.get("/homepage", isAuthenticated, (req, res) => {
  res.sendFile(__dirname + "/index.html");
});
app.get("/booking-history", isAuthenticated, (req, res) => {
  res.sendFile(__dirname + "/booking-history.html");
});

app.get("/api/booking-history", isAuthenticated, (req, res) => {
  console.log("Accessing /booking-history route");

  const userId = req.session.user.id;
  console.log("User ID:", userId);

  const sql = `
        SELECT u.full_name, r.room_number, r.room_type, res.check_in_date, res.check_out_date, res.total_price, res.status
        FROM reservations res
        JOIN rooms r ON res.room_id = r.id
        JOIN users u ON res.user_id = u.id
        WHERE res.user_id = ?
    `;
  console.log("SQL Query:", sql);

  db.query(sql, [userId], (err, results) => {
    if (err) {
      console.error("Database error:", err);
      return res
        .status(500)
        .json({ message: "Error fetching booking history" });
    }

    console.log("Results:", results);

    if (results.length === 0) {
      console.log("No bookings found for user.");
      return res.status(200).json([]); // Return empty array
    }

    // Include the full name in the response
    const response = {
      fullName: results[0].full_name, // Since all rows will have the same full_name
      bookings: results.map(({ full_name, ...booking }) => booking), // Exclude full_name from individual bookings
    };

    console.log("Booking history successfully retrieved.");
    res.status(200).json(response); // Send the booking history with full name
  });
});

// Registration endpoint
app.post("/register", async (req, res) => {
  const { fullName, email, password } = req.body;
  if (!fullName || !email || !password) {
    return res.json({ success: false, message: "All fields are required." });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const query =
      "INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)";
    db.query(query, [fullName, email, passwordHash], (err) => {
      if (err) {
        if (err.code === "ER_DUP_ENTRY") {
          return res.json({
            success: false,
            message: "Email is already registered.",
          });
        }
        throw err;
      }
      res.json({ success: true, message: "Registration successful!" });
    });
  } catch (error) {
    res.json({ success: false, message: "Server error." });
  }
});

// Login endpoint
app.post("/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.json({ success: false, message: "All fields are required." });
  }

  const query = "SELECT * FROM users WHERE email = ?";
  db.query(query, [email], async (err, results) => {
    if (err) {
      console.error(err);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error." });
    }

    if (results.length === 0) {
      return res.json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const user = results[0];
    try {
      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (isMatch) {
        req.session.user = {
          id: results[0].id,
          username: results[0].full_name,
        };
        return res.status(200).json({
          success: true,
          message: "Login successful",
          user: req.session.user,
        });
      } else {
        return res.json({
          success: false,
          message: "Invalid email or password.",
        });
      }
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error." });
    }
  });
});

// Route to add a new room with an image
app.post("/api/add-room", upload.single("roomImage"), (req, res) => {
  const { roomNumber, roomType, pricePerNight } = req.body;
  const roomImage = req.file ? `/uploads/${req.file.filename}` : null;

  if (!roomNumber || !roomType || !pricePerNight || !roomImage) {
    return res
      .status(400)
      .json({
        success: false,
        message: "All fields, including an image, are required.",
      });
  }

  const sql = `
        INSERT INTO rooms (room_number, room_type, price_per_night, availability, image_url)
        VALUES (?, ?, ?, 'Yes', ?)
    `;
  db.query(
    sql,
    [roomNumber, roomType, pricePerNight, roomImage],
    (err, result) => {
      if (err) {
        console.error("Error inserting room:", err);
        return res
          .status(500)
          .json({ success: false, message: "Error adding room to database." });
      }

      res
        .status(200)
        .json({ success: true, message: "Room added successfully." });
    }
  );
});

// Route to get all rooms
app.get("/api/rooms", (req, res) => {
  const { page = 1, limit = 6 } = req.query; // Support pagination
  const offset = (page - 1) * limit;

  const sql = `
        SELECT id, room_number, room_type, price_per_night, availability, image_url
        FROM rooms
        WHERE availability = 'Yes'
        LIMIT ? OFFSET ?
    `;
  db.query(sql, [parseInt(limit), parseInt(offset)], (err, rooms) => {
    if (err) {
      console.error("Error fetching rooms:", err);
      res.status(500).json({ message: "Error fetching rooms" });
    } else {
      const countSql =
        'SELECT COUNT(*) AS total FROM rooms WHERE availability = "Yes"';
      db.query(countSql, (err, result) => {
        if (err) {
          console.error("Error fetching room count:", err);
          return res.status(500).json({ message: "Error fetching room count" });
        }

        const totalRooms = result[0].total;
        const hasMore = offset + rooms.length < totalRooms;

        // Respond with the rooms data, including image URLs
        res.json({ rooms, hasMore });
      });
    }
  });
});

app.post("/api/reserve", (req, res) => {
  const { roomId, checkInDate, checkOutDate } = req.body;

  const userId = req.session.user.id; // Retrieve user ID from the session

  // Check room availability
  const checkAvailabilitySql = `
        SELECT * FROM reservations
        WHERE room_id = ? 
        AND (
            (check_in_date BETWEEN ? AND ?) 
            OR (check_out_date BETWEEN ? AND ?)
        )
    `;
  db.query(
    checkAvailabilitySql,
    [roomId, checkInDate, checkOutDate, checkInDate, checkOutDate],
    (err, results) => {
      if (err) {
        console.error("Error checking availability:", err);
        return res
          .status(500)
          .json({ message: "Error checking room availability" });
      }

      // If the room is already reserved for the selected dates
      if (results.length > 0) {
        return res
          .status(400)
          .json({ message: "Room is already reserved for these dates." });
      }

      // Calculate total price
      const sql = "SELECT price_per_night FROM rooms WHERE id = ?";
      db.query(sql, [roomId], (err, room) => {
        if (err || !room.length) {
          return res.status(500).json({ message: "Room not found" });
        }

        const pricePerNight = room[0].price_per_night;
        const diffTime = new Date(checkOutDate) - new Date(checkInDate);
        const diffDays = diffTime / (1000 * 3600 * 24); // Convert time difference to days
        const totalPrice = pricePerNight * diffDays;

        // Insert reservation
        const insertSql =
          "INSERT INTO reservations (user_id, room_id, check_in_date, check_out_date, total_price) VALUES (?, ?, ?, ?, ?)";
        db.query(
          insertSql,
          [userId, roomId, checkInDate, checkOutDate, totalPrice],
          (err, result) => {
            if (err) {
              return res.status(500).json({ message: "Error reserving room" });
            }

            // Optionally, update room availability
            const updateRoomAvailabilitySql =
              "UPDATE rooms SET availability = ? WHERE id = ?";
            db.query(
              updateRoomAvailabilitySql,
              ["No", roomId],
              (err, updateResult) => {
                if (err) {
                  console.error("Error updating room availability:", err);
                }

                res.status(200).json({
                  message: "Reservation successful!",
                  reservationId: result.insertId,
                  roomId,
                  totalPrice,
                });
              }
            );
          }
        );
      });
    }
  );
});

// Logout route
app.post("/api/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res
        .status(500)
        .json({ success: false, message: "Failed to log out" });
    }
    res.status(200).json({ success: true, message: "Logout successful" });
  });
});

// Admin Login endpoint
app.post("/admin/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.json({ success: false, message: "All fields are required." });
  }

  // Query to check if the admin exists
  const query = "SELECT * FROM admin WHERE email = ?";
  db.query(query, [email], async (err, results) => {
    if (err) {
      console.error(err);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error." });
    }

    if (results.length === 0) {
      return res.json({ success: false, message: "You are not an admin." });
    }

    const admin = results[0];
    try {
      // Compare the hashed password
      const isMatch = await bcrypt.compare(password, admin.password_hash);
      if (isMatch) {
        req.session.user = {
          id: admin.id,
          username: admin.full_name,
          isAdmin: true, // Mark the session as admin
        };
        return res.status(200).json({
          success: true,
          message: "Admin login successful",
          user: req.session.user,
        });
      } else {
        return res.json({
          success: false,
          message: "Invalid email or password.",
        });
      }
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error." });
    }
  });
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
