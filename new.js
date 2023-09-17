const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// Set EJS as the view engine
app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Create a new PostgreSQL pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // For development, you might need to disable SSL checks
  },
});

// Serve the homepage
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/hom.html');
});

// ... (Other routes)

// Handle form submission
app.post('/submit', async (req, res) => {
  const { qtext, email } = req.body;
  const questionId = uuidv4();

  // Store the question in the database
  const insertQuery = 'INSERT INTO questions (questionId, dbemail, content) VALUES ($1, $2, $3)';
  const values = [questionId, email, qtext];

  try {
    await pool.query(insertQuery, values);
    console.log('Question inserted into the database');
  } catch (error) {
    console.error('Error inserting question into the database:', error);
  }

  // Send email to admin with a link to the answer page
  const adminEmail = 'aghar_4@hotmail.com';
  const answerLink = `${req.protocol}://${req.get('host')}/answer?id=${questionId}`;
  const adminMailOptions = {
    from: process.env.GMAIL_USER, // Use the appropriate environment variable
    to: adminEmail,
    subject: email,
    text: `A new question has been submitted: ${qtext}\nAnswer it here: ${answerLink}`,
  };

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER, // Use the appropriate environment variable
      pass: process.env.GMAIL_PASS, // Use the appropriate environment variable
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  try {
    await transporter.sendMail(adminMailOptions);
    console.log('Email to admin sent successfully');
  } catch (error) {
    console.error('Error sending email to admin:', error);
  }

  res.redirect('/response');
});

// ... (Other routes)

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
