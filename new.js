const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { validationResult, check } = require('express-validator');

const app = express();
const PORT = process.env.PORT || 3000;

// Set EJS as the view engine
app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Store submitted questions and answers in memory
const questions = [];

// Custom error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack); // Log the error to the console

  // Send an error response to the client
  res.status(500).send('Something went wrong!');
});

// Separate concerns into different modules or functions
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/home.html');
});

app.get('/question-form', (req, res) => {
  res.sendFile(__dirname + '/views/question-form.html');
});

app.get('/response', (req, res) => {
  res.sendFile(__dirname + '/views/submitted.html');
});

app.get('/ted-talks', (req, res) => {
  res.sendFile(__dirname + '/views/ted.html');
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

app.get('/projects', (req, res) => {
  res.sendFile(__dirname + '/views/proj.html');
});

app.get('/cv', (req, res) => {
  const cvFilePath = __dirname + '/docs/CV.pdf';

  // Set the content type to PDF
  res.setHeader('Content-Type', 'application/pdf');

  // Provide options for downloading the file with a specific name
  res.setHeader('Content-Disposition', 'attachment; filename=CV-Aghar Masri-Engineer & Software Developer.pdf');

  // Send the CV file
  res.sendFile(cvFilePath);
});

app.get('/word', (req, res) => {
  const workFilePath = __dirname + '/docs/Inst.pdf';

  // Set the content type to PDF
  res.setHeader('Content-Type', 'application/pdf');

  // Provide options for downloading the file with a specific name
  res.setHeader('Content-Disposition', 'attachment; filename=Work instructions.pdf');

  // Send the CV file
  res.sendFile(workFilePath);
});

// Handle form submission
app.post(
  '/submit',
  [
    check('email').isEmail().withMessage('Invalid email'),
    check('qtext').isLength({ max: 300 }).withMessage('Question too long'),
    check('name').isLength({ max: 15 }).withMessage('Name too long'),
  ],
  (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { qtext, email, name } = req.body;
    const questionId = uuidv4();

    // Store the question in memory
    questions.push({ questionId, email, qtext, name });

    // Send email to admin with a link to the answer page
    sendEmailToAdmin(email, name, qtext, questionId);

    res.redirect('/response');
  }
);

// Handle rendering the answer page for admin and processing answer submission
app.get('/answer', (req, res) => {
  const questionId = req.query.id;
  const question = questions.find((q) => q.questionId === questionId);

  if (!question) {
    res.status(404).send('Question not found');
  } else {
    res.render('answerform', { qText: question.qtext, questionId: questionId });
  }
});

// Define your email sending function
function sendEmailToAdmin(email, name, qtext, questionId) {
  const adminEmail = 'aghar_4@hotmail.com';
  const answerLink = `${req.protocol}://${req.get('host')}/answer?id=${questionId}`;
  const adminMailOptions = {
    from: process.env.GMAIL_USER,
    to: adminEmail,
    subject: email,
    text: `A new question has been submitted from ${name}: ${qtext}\nAnswer it here: ${answerLink}`,
  };

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  transporter.sendMail(adminMailOptions, (error, info) => {
    if (error) {
      console.error('Error sending email to admin:', error);
      // You can handle the error here
    } else {
      console.log('Email to admin sent successfully', info.response);
      // You can handle success here
    }
  });
}

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
