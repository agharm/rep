const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const sqlite3 = require('sqlite3').verbose();
const config = require('./config');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const gmailUser = process.env.GMAIL_USER;
const gmailPass = process.env.GMAIL_PASS;

const app = express();
const PORT = process.env.PORT || 3000

// Set EJS as the view engine
app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

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
  const docxFilePath = __dirname + '/docs/Work instructions.docx'; // Replace with the actual file path

  // Set the content type to Word document
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

  // Provide options for downloading the file with a specific name
  res.setHeader('Content-Disposition', 'attachment; filename=WorkInstructions.docx');

  // Send the Word document file
  res.sendFile(docxFilePath);
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
  const db = new sqlite3.Database('./database/questions.db');
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS questions (
        questionId TEXT PRIMARY KEY,
        dbemail TEXT,
        content TEXT,
        dbanswer TEXT
      )
    `);

    const stmt = db.prepare('INSERT INTO questions (questionId, dbemail, content) VALUES (?, ?, ?)');
    stmt.run(questionId, email, qtext);
    stmt.finalize();
  });
  db.close();

  // Send email to admin with a link to the answer page
  const adminEmail = 'aghar_4@hotmail.com';
  //const answerLink = `http://localhost:3000/answer?id=${questionId}`;
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
app.get('/answer', (req, res) => {
  const questionId = req.query.id;

  // Open the database
  const db = new sqlite3.Database('./database/questions.db');

  // Retrieve the question text from the database using questionId
  db.get('SELECT content FROM questions WHERE questionId = ?', [questionId], (err, row) => {
    if (err) {
      console.error('Error retrieving question text:', err);
      res.status(500).send('Error retrieving question text');
    } else {
      const qtext = row ? row.content : 'Question not found';
      res.render('answerform', { qText: qtext, questionId: questionId });
    }
  });

  // Close the database
  db.close();
});

// Handle the form submission for answers
app.post('/submitAnswer', async (req, res) => {
  const { answer, questionId } = req.body;

  // Update the database with the answer
  const db = new sqlite3.Database('./database/questions.db');
  db.run('UPDATE questions SET dbanswer = ? WHERE questionId = ?', [answer, questionId], (updateErr) => {
    if (updateErr) {
      console.error('Error inserting answer:', updateErr);
      res.status(500).send('Error inserting answer');
    } else {
      // Retrieve the user's email from the database
      db.get('SELECT dbemail FROM questions WHERE questionId = ?', [questionId], async (emailErr, row) => {
        if (emailErr) {
          console.error('Error retrieving user email:', emailErr);
          res.status(500).send('Error retrieving user email');
        } else {
          const userEmail = row ? row.dbemail : '';
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

          try {
            await transporter.sendMail(userMailOptions);
            console.log('Email to user sent successfully');
          } catch (userEmailErr) {
            console.error('Error sending email to user:', userEmailErr);
          }
          res.send('Email sent successfully');
        }
      });
    }
  });

  // Close the database
  db.close();
});

//app.listen(process.env.PORT || 3000)

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});

