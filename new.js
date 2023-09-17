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

// Serve the question form
app.get('/question-form', (req, res) => {
  res.sendFile(__dirname + '/views/question-form.html');
});

app.get('/response', (req, res) => {
  res.sendFile(__dirname + '/views/submitted.html');
});

app.get('/ted-talks', (req, res) => {
  res.sendFile(__dirname + '/views/ted.html');
});

app.get('/projects', (req, res) => {
  res.sendFile(__dirname + '/views/proj.html');
});

app.get('/cv', (req, res) => {
  const cvFilePath = __dirname + '/docs/CV.pdf'; // Replace 'your_cv.pdf' with the actual file name

  // Set the content type to PDF
  res.setHeader('Content-Type', 'application/pdf');

  // Provide options for downloading the file with a specific name
  res.setHeader('Content-Disposition', 'attachment; filename=CV-Aghar Masri-Engineer & Software Developer.pdf');

  // Send the CV file
  res.sendFile(cvFilePath);
});

app.get('/word', (req, res) => {
  const workFilePath = __dirname + '/docs/Inst.pdf'; // Replace 'your_cv.pdf' with the actual file name

  // Set the content type to PDF
  res.setHeader('Content-Type', 'application/pdf');

  // Provide options for downloading the file with a specific name
  res.setHeader('Content-Disposition', 'attachment; filename=Work instructions.pdf');

  // Send the CV file
  res.sendFile(workFilePath);
});

// Serve the Certificates page
app.get('/certificates', (req, res) => {
  // Set the path to your certificate.html file
  const certificatesPagePath = path.join(__dirname, 'views', 'cert.html');

  // Send the certificate.html file as a response
  res.sendFile(certificatesPagePath);
});

// Create routes to serve individual certificates
app.get('/certificates/:certificateName', (req, res) => {
  // Get the certificate name from the URL parameters
  const certificateName = req.params.certificateName;

  // Set the path to the certificate file
  const certificateFilePath = path.join(__dirname, 'docs', certificateName);

  // Set the content type to PDF (or adjust to the appropriate content type)
  res.setHeader('Content-Type', 'application/pdf');

  // Provide options for downloading the file with a specific name
  res.setHeader('Content-Disposition', `attachment; filename=${certificateName}`);

  // Send the certificate file
  res.sendFile(certificateFilePath);
});

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

// Handle rendering the answer page for admin and processing answer submission
app.get('/answer', async (req, res) => {
  const questionId = req.query.id;

  try {
    const client = await pool.connect();
    
    // Retrieve the question text from the database using questionId
    const query = 'SELECT content FROM questions WHERE questionId = $1';
    const result = await client.query(query, [questionId]);

    if (result.rows.length === 0) {
      res.status(404).send('Question not found');
    } else {
      const qtext = result.rows[0].content;
      res.render('answerform', { qText: qtext, questionId: questionId });
    }

    client.release();
  } catch (error) {
    console.error('Error retrieving question text:', error);
    res.status(500).send('Error retrieving question text: ' + error.message); // Send the error message to the client
  }
});

app.post('/submitAnswer', async (req, res) => {
  const { answer, questionId } = req.body;

  try {
    const client = await pool.connect();

    // Update the database with the answer
    const updateQuery = 'UPDATE questions SET dbanswer = $1 WHERE questionId = $2';
    await client.query(updateQuery, [answer, questionId]);

    // Retrieve the user's email from the database
    const emailQuery = 'SELECT dbemail FROM questions WHERE questionId = $1';
    const emailResult = await client.query(emailQuery, [questionId]);
    const userEmail = emailResult.rows.length > 0 ? emailResult.rows[0].dbemail : '';

    // Send email with the admin's answer to the user
    const userMailOptions = {
      from: process.env.GMAIL_USER, // Use the appropriate environment variable
      to: userEmail,
      subject: 'Your Question Answered',
      text: 'Answer from Aghar:\n\n' + answer,
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

    await transporter.sendMail(userMailOptions);
    console.log('Email to user sent successfully');

    res.send('Email sent successfully');
    client.release();
  } catch (error) {
    console.error('Error processing answer submission:', error);
    res.status(500).send('Error processing answer submission');
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});