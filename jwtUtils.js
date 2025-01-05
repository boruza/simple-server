const jwt = require("jsonwebtoken");

const JWT_SECRET = "wariodub2020boruza123456"; // Use a strong, environment-specific secret key

// Generate JWT token
const generateToken = (payload, expiresIn = "1h") => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
};

// Verify JWT token
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
};

// Authentication middleware directly in jwtUtils
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
 console.log("Authorization header:", authHeader); // Debug: Log the authorization header

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized: Token is required" });
  }

  const token = authHeader.split(" ")[1];
console.log("Extracted token:", token); // Debug: Log the extracted token
  const userData = verifyToken(token);

  if (!userData) {
console.log("Invalid token or token expired"); // Debug: Log if token is invalid
    return res.status(401).json({ message: "Unauthorized: Invalid token" });
  }

  req.user = userData; // Attach user data to the request object
console.log("Authenticated user:", req.user); // Debug: Log authenticated user data
  next();
};

module.exports = { generateToken, verifyToken, authenticate };
