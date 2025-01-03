const express = require('express');
const app = express();
const port = process.env.PORT || 3000; // Use environment variable PORT or default to 3000

// Route to respond with a simple message
app.get('/', (req, res) => {
    res.send('Hello, World! Your server is running successfully!');
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
