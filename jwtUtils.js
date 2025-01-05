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

module.exports = { generateToken, verifyToken };
