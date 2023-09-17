const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const gmailUser = process.env.GMAIL_USER;
const gmailPass = process.env.GMAIL_PASS;
const { Client } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// Set EJS as the view engine
app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Get the database URL from the environment variable
const databaseUrl = process.env.DATABASE_URL;

// Create a new PostgreSQL client
const client = new Client({
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false, // For development, you might need to disable SSL checks
  },
});

// Connect to the database
client.connect()
  .then(() => {
    console.log('Connected to the database');
  })
  .catch((error) => {
    console.error('Error connecting to the database:', error);
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
  const cvFilePath = __dirname + '/docs/CV.pdf';
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=CV-Aghar Masri-Engineer & Software Developer.pdf');
  res.sendFile(cvFilePath);
});

app.get('/word', (req, res) => {
  const workFilePath = __dirname + '/docs/Work instructions.pdf';

  console.log('Accessing /word route');
  console.log('File path:', workFilePath);

  // Set the content type to PDF
  res.setHeader('Content-Type', 'application/pdf');

  // Provide options for downloading the file with a specific name
  res.setHeader('Content-Disposition', 'attachment; filename="Work instructions.pdf"');

  // Send the PDF file
  res.sendFile(workFilePath, (err) => {
    if (err) {
      console.error('Error sending file:', err);
      res.status(500).send('Error sending file');
    } else {
      console.log('File sent successfully');
    }
  });
});


// Serve the Certificates page
app.get('/certificates', (req, res) => {
  const certificatesPagePath = path.join(__dirname, 'views', 'cert.html');
  res.sendFile(certificatesPagePath);
});

// Create routes to serve individual certificates
app.get('/certificates/:certificateName', (req, res) => {
  const certificateName = req.params.certificateName;
  const certificateFilePath = path.join(__dirname, 'docs', certificateName);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=${certificateName}`);
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
    await client.query(insertQuery, values);
    console.log('Question inserted into the database');
  } catch (error) {
    console.error('Error inserting question into the database:', error);
  }

  // Send email to admin with a link to the answer page
  const adminEmail = 'aghar_4@hotmail.com';
  const answerLink = `${req.protocol}://${req.get('host')}/answer?id=${questionId}`;
  const adminMailOptions = {
    from: config.gmail.user,
    to: adminEmail,
    subject: email,
    text: `A new question has been submitted: ${qtext}\nAnswer it here: ${answerLink}`,
  };

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: config.gmail.user,
      pass: config.gmail.password,
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
    const queryResult = await client.query('SELECT content FROM questions WHERE questionId = $1', [questionId]);
    const qtext = queryResult.rows[0] ? queryResult.rows[0].content : 'Question not found';
    res.render('answerform', { qText: qtext, questionId: questionId });
  } catch (error) {
    console.error('Error retrieving question text:', error);
    res.status(500).send('Error retrieving question text');
  }
});

// Handle the form submission for answers
app.post('/submitAnswer', async (req, res) => {
  const { answer, questionId } = req.body;

  const updateQuery = 'UPDATE questions SET dbanswer = $1 WHERE questionId = $2';
  const values = [answer, questionId];

  try {
    await client.query(updateQuery, values);

    // Retrieve the user's email from the database
    const emailResult = await client.query('SELECT dbemail FROM questions WHERE questionId = $1', [questionId]);
    const userEmail = emailResult.rows[0] ? emailResult.rows[0].dbemail : '';

    // Send email with the admin's answer to the user
    const userMailOptions = {
      from: config.gmail.user,
      to: userEmail,
      subject: 'Your Question Answered',
      text: 'Answer from Aghar:\n\n' + answer,
    };

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: config.gmail.user,
        pass: config.gmail.password,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    await transporter.sendMail(userMailOptions);
    console.log('Email to user sent successfully');
    res.send('Email sent successfully');
  } catch (error) {
    console.error('Error updating answer or sending email to user:', error);
    res.status(500).send('Error updating answer or sending email to user');
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
