const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Set EJS as the view engine
app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Store submitted questions and answers in memory
const questions = [];

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
app.post('/submit', (req, res) => {
  const { qtext, email } = req.body;
  const questionId = uuidv4();

  // Store the question in memory
  questions.push({ questionId, email, qtext });

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

  transporter.sendMail(adminMailOptions, (error, info) => {
    if (error) {
      console.error('Error sending email to admin:', error);
    } else {
      console.log('Email to admin sent successfully', info.response);
    }
  });

  res.redirect('/response');
});

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

app.post('/submitAnswer', (req, res) => {
  const { answer, questionId } = req.body;
  const question = questions.find((q) => q.questionId === questionId);

  if (!question) {
    res.status(404).send('Question not found');
    return;
  }

  // Send email with the admin's answer to the user
  const userMailOptions = {
    from: process.env.GMAIL_USER, // Use the appropriate environment variable
    to: question.email,
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

  transporter.sendMail(userMailOptions, (error, info) => {
    if (error) {
      console.error('Error sending email to user:', error);
      res.status(500).send('Error sending email to user');
    } else {
      console.log('Email to user sent successfully', info.response);
      res.send('Email sent successfully');
    }
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
