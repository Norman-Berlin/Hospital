/**********************************************************************
 *  MEDICARE PROFESSIONAL BACKEND (UPGRADED TO MATCH ADVANCED DATABASE)
 **********************************************************************/
require("dotenv").config();


const express = require("express");
const mysql = require("mysql2");
const bcrypt = require("bcrypt");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const session = require('express-session');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3050';

const app = express();
const PORT = 3050;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Database Connection
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "Mandedongo01",
  database: "medicare_db"
});

db.connect(err => {
  if (err) {
    console.error("❌ DB connection failed:", err);
    return;
  }
  console.log("✅ Connected to MySQL database");
});

// Send message route in the website
app.post("/send-message", async (req, res) => {
  const { name, email, phone, subject, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ success: false, message: "Name, email, and message are required." });
  }

  // Configure transporter
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "medicarehospitalsystem@gmail.com",
      pass: "jxpvtcezdotcwdcb" 
    }
  });

  const mailOptions = {
    from: email,
    to: "medicarehospitalsystem@gmail.com",
    subject: subject || "New Message from Website",
    html: `
      <h3>New Contact Form Submission</h3>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${phone || "—"}</p>
      <p><strong>Subject:</strong> ${subject || "—"}</p>
      <p><strong>Message:</strong><br>${message}</p>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: "Message sent successfully!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to send message." });
  }
});


//Admin Password //
const newPassword = 'Admin123';

bcrypt.hash(newPassword, 10).then(hash => {
  db.query(
    "UPDATE admins SET password = ? WHERE email = 'admin@hospital.com'",
    [hash],
    (err, result) => {
      if (err) console.error(err);
      else console.log('✅ Password updated');
    }
  );
});

// Configure the transporter (example using Gmail)

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});


transporter.verify((err, success) => {
  if (err) {
    console.log("❌ SMTP Error:", err);
  } else {
    console.log("✅ SMTP Ready");
  }
});


// Test connection
transporter.verify(function (error, success) {
  if (error) {
    console.error("❌ Email transporter error:", error);
  } else {
    console.log("✅ Email transporter is ready");
  }
});

// Session middleware
app.use(session({
  secret: 'super_secure_admin_secret', // change this to a strong secret
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 60 * 60 * 1000 } // 1 hour
}));


/**********************************************************************
 *  UTILITIES
 **********************************************************************/

function generateLicenseNumber() {
  return "DOC-" + Math.floor(100000 + Math.random() * 900000);
}

function logAction(user_id, user_type, action, details = "") {
  db.query(
    "INSERT INTO audit_logs (user_id, user_type, action, details) VALUES (?, ?, ?, ?)",
    [user_id, user_type, action, details]
  );
}

function sendNotification(user_id, user_type, message) {
  db.query(
    "INSERT INTO notifications (user_id, user_type, message) VALUES (?, ?, ?)",
    [user_id, user_type, message]
  );
}

//************ADMIN LOGIN******* */
app.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.json({ status: 'error', message: 'Email and password required' });
    }

    const sql = "SELECT * FROM admins WHERE email = ?";
    db.query(sql, [email], async (err, results) => {
      if (err) {
        console.error("DB error:", err);
        return res.json({ status: 'error', message: 'Server database error' });
      }

      if (results.length === 0) {
        return res.json({ status: 'error', message: 'Admin not found' });
      }

      const admin = results[0];

      // Compare password
      const match = await bcrypt.compare(password, admin.password);

      if (!match) {
        return res.json({ status: 'error', message: 'Invalid password' });
      }

      // Optional: session storage
      req.session.admin = { id: admin.id, full_name: admin.full_name, email: admin.email };

      return res.json({ status: 'success', message: 'Admin logged in' });
    });
  } catch (err) {
    console.error("Login error:", err);
    res.json({ status: 'error', message: 'Server error' });
  }
});



// Generate hash for default admin password (run once to get the hash)
const passwordPlain = 'Admin123';  // what you type in login
const hashFromDB = '$2b$10$X3j/1gM9PqZPx8vCkX8veO0g0bJ6f3YxV0N6C4k1yqf2w3G6JQkSe'; // your DB hash

bcrypt.compare(passwordPlain, hashFromDB).then(match => {
  console.log('Password match?', match);
});

//*************PROTECT ADMIN DASHBOARD */
function isAdminLoggedIn(req, res, next) {
  if (req.session.admin && req.session.admin.role === 'superadmin') {
    next();
  } else {
    res.status(401).send("Access denied. Please log in as admin.");
  }
}

app.get("/admin-dashboard.html", isAdminLoggedIn, (req, res) => {
  res.sendFile(__dirname + "/admin-dashboard.html");
});

//**********ADMIN LOGOUT */
app.post('/admin/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).json({ status: 'error', message: 'Error logging out' });
        }
        res.json({ status: 'success', message: 'Logged out successfully' });
    });
});

//*********ADMIN LOGIN */
app.post("/login/admin", (req, res) => {
  const { email, password } = req.body;

  db.query("SELECT * FROM admins WHERE email = ?", [email], (err, rows) => {
    if (rows.length === 0)
      return res.status(400).json({ message: "Invalid credentials" });

    const admin = rows[0];

    bcrypt.compare(password, admin.password, (err, isMatch) => {
      if (!isMatch)
        return res.status(400).json({ message: "Invalid credentials" });

      res.json({
        message: "Admin login successful",
        admin: {
          id: admin.id,
          full_name: admin.full_name,
          email: admin.email,
          role: admin.role
        }
      });
    });
  });
});

app.delete("/admin/delete-appointment/:id", (req, res) => {
    const appointmentId = req.params.id;

    const sql = "DELETE FROM appointments WHERE id = ?";
    db.query(sql, [appointmentId], (err, result) => {
        if (err) {
            console.error("SQL Delete Error:", err);
            return res.status(500).json({
                success: false,
                message: "Database delete error"
            });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Appointment not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Appointment deleted successfully"
        });
    });
});
// Delete doctor (fixed response consistency)
app.delete("/admin/delete-doctor/:id", async (req, res) => {
    const doctorId = req.params.id;
    console.log(`🔄 Attempting to delete doctor with ID: ${doctorId}`);

    try {
        // First check if doctor exists
        const [checkResult] = await db.promise().query('SELECT id, email FROM doctors WHERE id = ?', [doctorId]);
        
        if (checkResult.length === 0) {
            console.log(`❌ Doctor not found with ID: ${doctorId}`);
            return res.status(404).json({
                status: 'error',
                message: "Doctor not found"
            });
        }

        const doctor = checkResult[0];

        // Check if doctor has appointments
        const [appointments] = await db.promise().query(
            'SELECT id FROM appointments WHERE doctor_id = ?', 
            [doctorId]
        );

        if (appointments.length > 0) {
            console.log(`⚠️ Doctor has ${appointments.length} appointments. Deleting them first.`);
            
            // Delete doctor's appointments first
            await db.promise().query('DELETE FROM appointments WHERE doctor_id = ?', [doctorId]);
            console.log(`✅ Deleted ${appointments.length} appointments for doctor ${doctorId}`);
        }

        // Delete the doctor
        const [result] = await db.promise().query('DELETE FROM doctors WHERE id = ?', [doctorId]);

        if (result.affectedRows > 0) {
            console.log(`✅ Doctor ${doctorId} deleted successfully`);
            
            // Try to delete from doctor table (optional - skip if table doesn't exist)
            try {
                const [userResult] = await db.promise().query('DELETE FROM doctor WHERE email = ?', [doctor.email]);
                if (userResult.affectedRows > 0) {
                    console.log(`✅ Also deleted doctor from doctor table: ${doctor.email}`);
                }
            } catch (userErr) {
                console.log('ℹ️ doctor table not found or deletion skipped:', userErr.message);
                // Don't fail the request if doctor table doesn't exist
            }

            return res.json({
                status: 'success',
                message: "Doctor deleted successfully"
            });
        } else {
            console.log(`❌ No doctor deleted with ID: ${doctorId}`);
            return res.status(404).json({
                status: 'error',
                message: "Doctor not found"
            });
        }

    } catch (err) {
        console.error("❌ Error deleting doctor:", err);
        return res.status(500).json({
            status: 'error',
            message: "Database error while deleting doctor: " + err.message
        });
    }
});

//*****************GET ALL DOCTORS */
app.get("/admin/doctors", (req, res) => {
  db.query("SELECT * FROM doctors", (err, results) => {
    if (err) return res.status(500).json({ message: "DB error" });
    res.json(results);
  });
});

//*****************GET ALL PATIENTS */
app.get("/admin/patients", (req, res) => {
  db.query("SELECT * FROM patients", (err, results) => {
    if (err) return res.status(500).json({ message: "DB error" });
    res.json(results);
  });
});

// Delete patient (fixed)
app.delete('/admin/patients/:id/delete', async (req, res) => {
  const id = req.params.id;
  console.log(`🔄 Attempting to delete patient with ID: ${id}`);

  try {
    // First check if patient exists
    const [checkResult] = await db.promise().query('SELECT id FROM patients WHERE id = ?', [id]);
    
    if (checkResult.length === 0) {
      console.log(`❌ Patient not found with ID: ${id}`);
      return res.status(404).json({ 
        status: 'error', 
        message: 'Patient not found' 
      });
    }

    // Check if patient has appointments
    const [appointments] = await db.promise().query(
      'SELECT id FROM appointments WHERE patient_id = ?', 
      [id]
    );

    if (appointments.length > 0) {
      console.log(`⚠️ Patient has ${appointments.length} appointments. Deleting them first.`);
      
      // Delete patient's appointments first
      await db.promise().query('DELETE FROM appointments WHERE patient_id = ?', [id]);
      console.log(`✅ Deleted ${appointments.length} appointments for patient ${id}`);
    }

    // Now delete the patient
    const [result] = await db.promise().query('DELETE FROM patients WHERE id = ?', [id]);

    if (result.affectedRows > 0) {
      console.log(`✅ Patient ${id} deleted successfully`);
      
      // Also delete from doctor table if exists
      try {
        await db.promise().query('DELETE FROM doctor WHERE email IN (SELECT email FROM patients WHERE id = ?)', [id]);
      } catch (userErr) {
        console.log('ℹ️ doctor table deletion skipped or failed:', userErr.message);
      }

      return res.json({ 
        status: 'success', 
        message: 'Patient deleted successfully' 
      });
    } else {
      console.log(`❌ No patient deleted with ID: ${id}`);
      return res.status(404).json({ 
        status: 'error', 
        message: 'Patient not found' 
      });
    }

  } catch (err) {
    console.error("❌ Error deleting patient:", err);
    return res.status(500).json({ 
      status: 'error', 
      message: 'Database error: ' + err.message 
    });
  }
});


app.post("/admin/doctors/reject/:id", (req, res) => {

  db.query("UPDATE doctors SET status='rejected' WHERE id=?", [req.params.id], (err) => {
    if (err) return res.status(500).json({ message: "DB error" });

    // send rejection email
    const mailOptions = {
      from: '"Medicare HMS" <your-email@gmail.com>',
      to: req.body.email,
      subject: "Account Rejected",
      html: `<p>Dear Doctor, your account has been rejected by the admin.</p>`
    };

    transporter.sendMail(mailOptions, () => {});
    res.json({ message: "Doctor rejected" });
  });
});


// Admin: Get all appointments for a specific doctor
app.get('/admin/doctor/:id/appointments', (req,res) => {
  const doctorId = req.params.id;
  const sql = `
    SELECT 
      a.id AS appointment_id,
      a.patient_id,
      a.doctor_id,
      DATE_FORMAT(a.appointment_time, '%Y-%m-%d %H:%i') AS appointment_time,
      a.reason,
      a.status,
      a.prescription,
      a.billing,
      a.report,
      p.full_name AS patient_name,
      d.full_name AS doctor_name,
      d.specialization
    FROM appointments a
    JOIN patients p ON a.patient_id = p.id
    JOIN doctors d ON a.doctor_id = d.id
    WHERE a.doctor_id = ?
    ORDER BY a.appointment_time DESC
  `;
  db.query(sql, [doctorId], (err, results) => {
    if(err) return res.status(500).json({message:"DB error"});
    res.json(results);
  });
});


app.post("/admin/approve-doctor", (req, res) => {
  const { doctorId } = req.body;

  const sql = "UPDATE doctors SET status = 'approved' WHERE id = ?";

  db.query(sql, [doctorId], (err, result) => {
    if (err) {
      console.error("Approval error:", err);
      return res.json({ success: false, message: "Error approving doctor" });
    }

    res.json({ success: true, message: "Doctor approved successfully" });
  });
});


//*****************GET ALL APPOINTMENTS */
app.get("/admin/appointments", (req, res) => {
  const sql = `
    SELECT a.*, d.full_name AS doctor_name, p.full_name AS patient_name
    FROM appointments a
    JOIN doctors d ON a.doctor_id = d.id
    JOIN patients p ON a.patient_id = p.id
    ORDER BY a.appointment_time DESC
  `;

  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: "DB error" });
    res.json(results);
  });
});

// Doctors delete
app.delete('/admin/doctors/:id/delete', async (req, res) => {
  const id = req.params.id;

  try {
const [result] = await db.promise().query('DELETE FROM doctors WHERE id = ?', [id]);

    if (result.affectedRows > 0) {
      res.json({ status: 'success' });
    } else {
      res.json({ status: 'error', message: 'Doctor not found' });
    }

  } catch (err) {
    console.error(err);
    res.json({ status: 'error', message: 'Could not delete doctor' });
  }
});


// Delete accountant
app.delete('/admin/accountants/:id/delete', isAdminLoggedIn, async (req, res) => {
  const id = req.params.id;
  try {
    await db.query('DELETE FROM accountants WHERE id = ?', [id]);
    res.json({ status: 'success' });
  } catch (err) {
    res.json({ status: 'error', message: err.message });
  }
});

// Delete appointment (fixed)
app.delete('/admin/appointments/:id/delete', async (req, res) => {
  const id = req.params.id;
  console.log(`🔄 Attempting to delete appointment with ID: ${id}`);

  try {
    // First check if appointment exists
    const [checkResult] = await db.promise().query('SELECT id FROM appointments WHERE id = ?', [id]);
    
    if (checkResult.length === 0) {
      console.log(`❌ Appointment not found with ID: ${id}`);
      return res.status(404).json({ 
        status: 'error', 
        message: 'Appointment not found' 
      });
    }

    // Delete the appointment
    const [result] = await db.promise().query('DELETE FROM appointments WHERE id = ?', [id]);

    if (result.affectedRows > 0) {
      console.log(`✅ Appointment ${id} deleted successfully`);
      return res.json({ 
        status: 'success', 
        message: 'Appointment deleted successfully' 
      });
    } else {
      console.log(`❌ No appointment deleted with ID: ${id}`);
      return res.status(404).json({ 
        status: 'error', 
        message: 'Appointment not found' 
      });
    }

  } catch (err) {
    console.error("❌ Error deleting appointment:", err);
    return res.status(500).json({ 
      status: 'error', 
      message: 'Database error: ' + err.message 
    });
  }
});

// Also update the other appointment deletion endpoint for consistency
app.delete("/api/appointments/:id", async (req, res) => {
  const { id } = req.params;
  console.log(`🔄 API: Deleting appointment ${id}`);

  try {
    const [result] = await db.promise().query('DELETE FROM appointments WHERE id = ?', [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Appointment not found" 
      });
    }

    console.log(`✅ API: Appointment ${id} deleted successfully`);
    return res.json({ 
      success: true, 
      message: "Appointment deleted successfully" 
    });

  } catch (err) {
    console.error("❌ API Error deleting appointment:", err);
    return res.status(500).json({ 
      success: false, 
      message: "Database error: " + err.message 
    });
  }
});



app.get("/admin/doctors/pending", (req, res) => {
  db.query("SELECT * FROM doctors WHERE status='pending'", (err, rows) => {
    if (err) return res.status(500).json({ message: "DB error" });
    res.json(rows);
  });
});


app.post("/admin/doctors/approve", (req, res) => {
    const { id } = req.body;

    db.query("UPDATE doctors SET status = 'approved' WHERE id = ?", [id], (err, result) => {
        if (err) return res.json({ success: false, message: "Error approving doctor" });

        res.json({ success: true, message: "Doctor approved" });
    });
});


app.post("/admin/doctors/approve/:id", (req, res) => {
  db.query("UPDATE doctors SET status='approved' WHERE id=?", [req.params.id], (err) => {
    if (err) return res.status(500).json({ message: "DB error" });

    res.json({ message: "Doctor approved" });
  });
});


app.post("/login", (req, res) => {
    const { email, password, role } = req.body;

    db.query(
        "SELECT * FROM doctors WHERE email = ? AND role = ?",
        [email, role],
        (err, results) => {
            if (err) return res.json({ success: false, message: "DB error" });
            if (results.length === 0)
                return res.json({ success: false, message: "Invalid credentials" });

            const user = results[0];

            if (user.password !== password)
                return res.json({ success: false, message: "Invalid credentials" });

            // ⛔ Doctor must be approved first
            if (role === "doctor" && user.approved === 0) {
                return res.json({
                    success: false,
                    message: "Your account is pending admin approval"
                });
            }

            // Save session
            req.session.user = user;

            // Redirects
            if (role === "admin") return res.json({ success: true, redirect: "/admin.html" });
            if (role === "doctor") return res.json({ success: true, redirect: "/doctor.html" });
            if (role === "patient") return res.json({ success: true, redirect: "/patient.html" });
        }
    );
});


/**********************************************************************
 *  DOCTOR SIGNUP (UPDATED FOR ADVANCED DB)
 **********************************************************************/
app.post("/signup/doctor", async (req, res) => {
  const { full_name, email, password, specialization, experience_years, hospital_name } = req.body;

  if (!full_name || !email || !password || !specialization || !experience_years || !hospital_name)
    return res.status(400).json({ message: "All fields are required" });

  db.query("SELECT id FROM doctors WHERE email = ?", [email], async (err, rows) => {
    if (rows.length > 0) return res.status(400).json({ message: "Doctor already exists" });

    const hashed = await bcrypt.hash(password, 10);
    const license_number = generateLicenseNumber();

    db.query(
      `INSERT INTO doctors 
(full_name, email, password, license_number, specialization, experience_years, hospital_name, status)
VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
`,
      [full_name, email, hashed, license_number, specialization, experience_years, hospital_name],
      (err, result) => {
        if (err) return res.status(500).json({ message: "Error saving doctor" });

        // Log action
        logAction(result.insertId, "doctor", "Doctor Signup — Awaiting Admin Approval");

        // Send email
        const mailOptions = {
          from: '"Medicare Hospital Management System" <your-email@gmail.com>',
          to: email,
          subject: "Your Doctor License Number (Pending Approval)",
          html: `
            <h3>Welcome Dr. ${full_name}!</h3>
            <p>Your account has been received and is currently <strong>pending admin approval</strong>.</p>
            <p><strong>License Number:</strong> ${license_number}</p>
            <p>You will be notified once your account is approved.</p>
            <br>
            <p>Thank you for joining Medicare Hospital Management System!</p>
          `,
        };

        transporter.sendMail(mailOptions, (err, info) => {
          if (err) {
            console.error("❌ Failed to send email to doctor:", err);
          } else {
            console.log("✅ License email sent to doctor:", email);
          }
        });

        res.status(201).json({
          message: "Doctor created successfully. Waiting for admin approval.",
          license_number
        });
      }
    );
  });
});

// ==================== PATIENT SIGNUP ====================
app.post("/signup/patient", async (req, res) => {
  try {
    const {
      full_name,
      email,
      password,
      dob,
      gender,
      contact_number,
      address,
      blood_group,
      allergies,
      emergency_contact
    } = req.body;

    if (!full_name || !email || !password || !dob || !gender) {
      return res.status(400).json({
        success: false,
        message: "Full name, email, password, date of birth, and gender are required"
      });
    }

    // Check if patient already exists
    const [existing] = await db.promise().query(
      "SELECT id FROM patients WHERE email = ?",
      [email]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Email already registered"
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert patient
    const insertQuery = `
      INSERT INTO patients
      (full_name, email, password, dob, gender, contact_number, address, blood_group, allergies, emergency_contact)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await db.promise().query(insertQuery, [
      full_name,
      email,
      hashedPassword,
      dob,
      gender,
      contact_number || null,
      address || null,
      blood_group || null,
      allergies || null,
      emergency_contact || null
    ]);

    return res.status(201).json({
      success: true,
      message: "Signup successful. Please login.",
      patientId: result.insertId
    });

  } catch (err) {
    console.error("Patient signup error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error, please try again later"
    });
  }
});

/**********************************************************************
 *  DOCTOR LOGIN (UNCHANGED)
 **********************************************************************/
// Doctor Login Route
app.post("/doctor-login", (req, res) => {
  const { license_number, password } = req.body;

  db.query("SELECT * FROM doctors WHERE license_number = ?", [license_number], async (err, rows) => {
    if (err) return res.status(500).json({ message: "Database error" });
    if (rows.length === 0) return res.status(400).json({ message: "Doctor not found" });

    const doctor = rows[0];

    // 🔥 Admin approval check
    if (doctor.status === "pending") {
      return res.status(403).json({ message: "Your account is awaiting admin approval." });
    }

    if (doctor.status === "rejected") {
      return res.status(403).json({ message: "Your account was rejected by admin." });
    }

    // Check password
    const match = await bcrypt.compare(password, doctor.password);
    if (!match) return res.status(400).json({ message: "Invalid password" });

    res.json({
      message: "Login successful",
      doctor
    });
  });
});


/**********************************************************************
 *  PATIENT LOGIN (UNCHANGED)
 **********************************************************************/

app.post("/login/patient", (req, res) => {
  const { email, password } = req.body;

  db.query("SELECT * FROM patients WHERE email = ?", [email], (err, rows) => {
    if (rows.length === 0) return res.status(400).json({ message: "Invalid credentials" });

    const patient = rows[0];
    bcrypt.compare(password, patient.password, (err, isMatch) => {
      if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

      logAction(patient.id, "patient", "Patient Login");

      res.json({
        message: "Patient login successful",
        patient: {
          id: patient.id,
          full_name: patient.full_name,
          email: patient.email,
          gender: patient.gender,
          dob: patient.dob
        }
      });
    });
  });
});


// Get all appointments for a patient
app.get("/api/patient/:id/appointments", (req, res) => {
  const patientId = req.params.id;

  const query = `
    SELECT a.id, d.full_name AS doctor_name, d.specialization, 
           a.appointment_time, a.reason, a.status, a.prescription, a.billing, a.report
    FROM appointments a
    JOIN doctors d ON a.doctor_id = d.id
    WHERE a.patient_id = ?
    ORDER BY a.appointment_time DESC
  `;

  db.query(query, [patientId], (err, results) => {
    if (err) {
      console.error("DB error fetching appointments:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }

    res.json(results);
  });
});
/**********************************************************************
 *  BOOK APPOINTMENT (UPDATED TO CREATE BILLING + NOTIFICATION)
 **********************************************************************/
// Book a new appointment
app.post("/api/appointments", (req, res) => {
  const { patient_id, doctor_id, appointment_time, reason } = req.body;

  if (!patient_id || !doctor_id || !appointment_time || !reason) {
    return res.status(400).json({ success: false, message: "All fields are required." });
  }

  const apptTime = new Date(appointment_time);
  const now = new Date();

  if (apptTime < now) {
    return res.status(400).json({ success: false, message: "You cannot book an appointment in the past." });
  }

  const insertQuery = `
    INSERT INTO appointments (patient_id, doctor_id, appointment_time, reason, status)
    VALUES (?, ?, ?, ?, 'Pending')
  `;

  db.query(insertQuery, [patient_id, doctor_id, appointment_time, reason], (err, result) => {
    if (err) {
      console.error("DB error booking appointment:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }

    res.json({ success: true, message: "Appointment booked successfully.", appointmentId: result.insertId });
  });
});


// ================= GET ALL DOCTORS =================
app.get("/api/doctors", (req, res) => {
  const sql = `SELECT id, full_name, specialization, hospital_name, license_number FROM doctors ORDER BY full_name ASC`;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("❌ Error fetching doctors:", err);
      return res.status(500).json({ message: "Failed to fetch doctors" });
    }

    res.json(results);
  });
});


// ================= GET DOCTOR'S APPOINTMENTS =================
app.get("/api/doctor/:id/appointments", (req, res) => {
  const doctorId = req.params.id;

  const sql = `
    SELECT 
      a.id AS appointment_id,
      a.patient_id,
      a.doctor_id,
      DATE_FORMAT(a.appointment_time, '%Y-%m-%d %H:%i') AS appointment_time,
      a.reason,
      a.status,
      a.prescription,
      a.billing,
      a.report,
      p.full_name AS patient_name
    FROM appointments a
    JOIN patients p ON a.patient_id = p.id
    WHERE a.doctor_id = ?
    ORDER BY a.appointment_time DESC
  `;

  db.query(sql, [doctorId], (err, results) => {
    if (err) {
      console.error("❌ Error fetching doctor appointments:", err);
      return res.status(500).json({ success: false });
    }

    res.json({
      appointments: results  // <-- THIS is what the frontend expects
    });
  });
});
// ================= APPROVE / REJECT DOCTOR REGISTRATION =================
app.post('/admin/doctors/:id/approve', async (req, res) => {
    const { id } = req.params;

    try {
        const [rows] = await db.promise().query('SELECT * FROM doctors WHERE id = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ message: "Doctor not found" });

        await db.promise().query('UPDATE doctors SET status = ? WHERE id = ?', ['approved', id]);

        const doctor = rows[0];

        await transporter.sendMail({
            from: '"MediCare Admin" <your-email@gmail.com>',
            to: doctor.email,
            subject: 'Account Approved',
            text: `Hello Dr. ${doctor.full_name}, your account has been approved. You can now log in.`
        });

        res.json({ status: 'success', message: 'Doctor approved and email sent' });
    } catch (err) {
        console.error("Approve doctor error:", err);
        res.status(500).json({ message: "Server error" });
    }
});


app.post('/admin/doctors/:id/reject', async (req, res) => {
    const { id } = req.params;

    try {
        // Use .promise() so await works
        const [rows] = await db.promise().query('SELECT * FROM doctors WHERE id = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ message: "Doctor not found" });

        const doctor = rows[0];

        // Update status to rejected
        await db.promise().query('UPDATE doctors SET status = ? WHERE id = ?', ['rejected', id]);

        // Send rejection email
        await transporter.sendMail({
            from: '"MediCare Admin" <your-email@gmail.com>',
            to: doctor.email,
            subject: 'Account Rejected',
            text: `Hello Dr. ${doctor.full_name}, your account registration was rejected. You cannot log in.`
        });

        res.json({ status: 'success', message: 'Doctor rejected and email sent' });
    } catch (err) {
        console.error("Reject doctor error:", err);
        res.status(500).json({ message: "Server error" });
    }
});


/**********************************************************************
 *  DOCTOR UPDATES APPOINTMENT (ALSO CREATES MEDICAL RECORDS)
 **********************************************************************/
// DOCTOR UPDATES APPOINTMENT (SAFE, looks up patient_id/doctor_id server-side)
app.post("/api/appointments/:id/update", (req, res) => {
  const { id } = req.params;
  const { status, prescription, billing, report } = req.body;

  // 1) Update the appointment
  db.query(
    `UPDATE appointments SET status=?, prescription=?, billing=?, report=? WHERE id=?`,
    [status, prescription || null, billing || null, report || null, id],
    (updateErr) => {
      if (updateErr) {
        console.error("❌ Error updating appointment:", updateErr);
        return res.status(500).json({ success: false, message: "Database error updating appointment" });
      }

      // 2) Fetch appointment for patient_id and doctor_id
      db.query(
        `SELECT patient_id, doctor_id FROM appointments WHERE id = ?`,
        [id],
        (selectErr, rows) => {
          if (selectErr) {
            console.error("❌ Error fetching appointment after update:", selectErr);
            return res.status(500).json({ success: false, message: "Database error reading appointment" });
          }

          if (!rows || rows.length === 0) {
            return res.status(404).json({ success: false, message: "Appointment not found" });
          }

          const appointment = rows[0];
          const patient_id = appointment.patient_id;
          const doctor_id = appointment.doctor_id;

          // --- FUNCTION that sends email (so we avoid repeating)
          const sendPatientEmail = () => {
            db.query(
              "SELECT full_name, specialization FROM doctors WHERE id = ?",
              [doctor_id],
              (docErr, docRows) => {
                if (docErr || docRows.length === 0) {
                  console.error("❌ Error fetching doctor info:", docErr);
                  return;
                }

                const doctor = docRows[0];

                db.query(
                  "SELECT email, full_name FROM patients WHERE id = ?",
                  [patient_id],
                  (patErr, patRows) => {
                    if (!patErr && patRows.length > 0) {
                      const patient = patRows[0];

                      const mailOptions = {
                        from: '"Medicare Health Center" <your-email@gmail.com>',
                        to: patient.email,
                        subject: "Your Appointment has been Updated",
                        html: `
                          <h3>Hello ${patient.full_name},</h3>
                          <p>Your appointment with Dr. ${doctor.full_name} (${doctor.specialization}) has been updated.</p>
                          <p><strong>Prescription:</strong> ${prescription || "—"}</p>
                          <p><strong>Billing:</strong> ${billing || "—"}</p>
                          <p><strong>Report / Notes:</strong> ${report || "—"}</p>
                        `,
                      };

                      transporter.sendMail(mailOptions, (err) => {
                        if (err) {
                          console.error("❌ Failed to send email:", err);
                        } else {
                          console.log("✅ Email sent to patient:", patient.email);
                        }
                      });
                    }
                  }
                );
              }
            );
          };

          // --- FUNCTION to log and notify
          const performNotifications = () => {
            try {
              if (typeof sendNotification === "function") {
                sendNotification(patient_id, "patient", "Your appointment has been updated.");
              }
            } catch (err) {
              console.error("⚠️ sendNotification failed:", err);
            }

            try {
              if (typeof logAction === "function") {
                logAction(doctor_id, "doctor", "Update Appointment", `ID: ${id}`);
              }
            } catch (err) {
              console.error("⚠️ logAction failed:", err);
            }
          };

          // 3) If appointment is completed, add medical record
          if (status === "Completed") {
            db.query(
              `INSERT INTO medical_records (appointment_id, doctor_id, patient_id, diagnosis, notes)
               VALUES (?, ?, ?, ?, ?)`,
              [id, doctor_id, patient_id, report || "", prescription || ""],
              (mrErr) => {
                if (mrErr) {
                  console.error("❌ Error creating medical record:", mrErr);
                  return res.status(500).json({ success: false, message: "Error creating medical record" });
                }

                sendPatientEmail();
                performNotifications();
                return res.json({ success: true });
              }
            );
          } else {
            // Not completed -> still notify
            sendPatientEmail();
            performNotifications();
            return res.json({ success: true });
          }
        }
      );
    }
  );
});



// Password recovery endpoint

const JWT_SECRET = 'your_jwt_secret_key'; // Use a strong secret key in production
// Password recovery endpoint
app.post('/api/auth/recover-password', async (req, res) => {
  try {
    const { email, userType } = req.body;

    if (!email || !userType) {
      return res.status(400).json({
        success: false,
        error: 'Email and user type are required'
      });
    }

    // STEP 1 — Check if email exists in correct table
    let user;

    if (userType === 'doctor') {
      const [rows] = await db.promise().query(
        'SELECT id, full_name, email FROM doctors WHERE email = ?',
        [email]
      );
      user = rows[0];
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'No doctor account found with this email'
        });
      }
    }

    else if (userType === 'patient') {
      const [rows] = await db.promise().query(
        'SELECT id, full_name, email FROM patients WHERE email = ?',
        [email]
      );
      user = rows[0];
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'No patient account found with this email'
        });
      }
    }

    else {
      return res.status(400).json({
        success: false,
        error: 'Invalid user type'
      });
    }

    // STEP 2 — Create reset token (valid for 1 hour)
    const resetToken = jwt.sign(
      {
        userId: user.id,
        userType,
        purpose: 'password_reset'
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // STEP 3 — Generate reset password link
    const resetLink =
      `${FRONTEND_URL}/reset-password.html?token=${encodeURIComponent(resetToken)}&type=${encodeURIComponent(userType)}`;

    // STEP 4 — Create email
    const mailOptions = {
      from: `"Medicare Health Center" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: "Password Reset Request",
      html: `
        <div style="font-family: Arial, sans-serif; color:#333;">
            <h2>Hi ${user.full_name},</h2>
            <p>You requested to reset your password for your Medicare account.</p>
            <p>Click the button below to create a new password:</p>

            <p style="margin:20px 0;">
                <a href="${resetLink}" 
                   style="background:#1e2a78;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;">
                   Reset Password
                </a>
            </p>

            <p>This link will expire in <strong>1 hour</strong>.</p>

            <p>If you did not request this, you can safely ignore this email.</p>
            <br>
            <p>— Medicare Support Team</p>
        </div>
      `
    };

    // STEP 5 — Send email
    transporter.sendMail(mailOptions, (err, info) => {
      if (err) {
        console.error("❌ Failed to send recovery email:", err);
        return res.status(500).json({
          success: false,
          error: "Failed to send recovery email"
        });
      }

      console.log("✅ Recovery email sent to:", user.email);
      return res.json({
        success: true,
        message: "Recovery link sent successfully"
      });
    });

  } catch (err) {
    console.error("Password recovery error:", err);
    res.status(500).json({
      success: false,
      error: "Internal server error"
    });
  }
});



// -----------------------------------------------------------
// RESET PASSWORD ENDPOINT
// -----------------------------------------------------------

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, userType, newPassword } = req.body;

    if (!token || !userType || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Token, user type and new password required'
      });
    }

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (e) {
      console.error("Invalid/expired token:", e);
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired reset token'
      });
    }

    if (payload.purpose !== 'password_reset') {
      return res.status(400).json({
        success: false,
        error: 'Invalid token purpose'
      });
    }

    const userId = payload.userId;
    const hashed = await bcrypt.hash(newPassword, 10);

    if (userType === 'doctor') {
      await db.promise().query(
        'UPDATE doctors SET password = ? WHERE id = ?',
        [hashed, userId]
      );
    }

    else if (userType === 'patient') {
      await db.promise().query(
        'UPDATE patients SET password = ? WHERE id = ?',
        [hashed, userId]
      );
    }

    else {
      return res.status(400).json({
        success: false,
        error: 'Invalid user type'
      });
    }

    res.json({
      success: true,
      message: 'Password reset successfully'
    });

  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({
      success: false,
      error: "Internal server error"
    });
  }
});

/**********************************************************************
 *  REAL-TIME UPDATES
 **********************************************************************/

let clients = [];

app.get("/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");

  clients.push(res);

  req.on("close", () => {
    clients = clients.filter(c => c !== res);
  });
});


// Keep a list of connected clients

// SSE endpoint
app.get("/events", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders();

  // Send a comment to keep connection alive
  res.write(": connected\n\n");

  // Store client
  const clientId = Date.now();
  const newClient = { id: clientId, res };
  clients.push(newClient);

  req.on("close", () => {
    const index = clients.findIndex(c => c.id === clientId);
    if (index !== -1) clients.splice(index, 1);
    console.log(`Client ${clientId} disconnected`);
  });
});
// ================= ACCOUNTANT & FINANCE ROUTES =================
// ================= ACCOUNTANT & FINANCE ROUTES =================

// Total Revenue (Completed appointments only)
app.get('/api/finance/total-revenue', async (req, res) => {
  try {
    const [rows] = await db.promise().query(`
      SELECT IFNULL(SUM(billing), 0) AS totalRevenue
      FROM appointments 
      WHERE billing > 0 AND status = 'Completed'
    `);
    res.json({ totalRevenue: rows[0].totalRevenue || 0 });
  } catch (err) {
    console.error('Total revenue error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Pending Payments (Not completed appointments)
app.get('/api/finance/pending-payments', async (req, res) => {
  try {
    const [rows] = await db.promise().query(`
      SELECT IFNULL(SUM(billing), 0) AS pendingPayments
      FROM appointments 
      WHERE billing > 0 AND status != 'Completed'
    `);
    res.json({ pendingPayments: rows[0].pendingPayments || 0 });
  } catch (err) {
    console.error('Pending payments error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Overdue Invoices (Bills older than 30 days)
app.get('/api/finance/overdue-invoices', async (req, res) => {
  try {
    const [rows] = await db.promise().query(`
      SELECT IFNULL(SUM(billing), 0) AS overdueInvoices
      FROM appointments 
      WHERE billing > 0 
        AND appointment_time < DATE_SUB(NOW(), INTERVAL 30 DAY)
    `);
    res.json({ overdueInvoices: rows[0].overdueInvoices || 0 });
  } catch (err) {
    console.error('Overdue invoices error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Patients This Month
app.get('/api/finance/patients-this-month', async (req, res) => {
  try {
    const [rows] = await db.promise().query(`
      SELECT COUNT(DISTINCT patient_id) AS patientsThisMonth
      FROM appointments 
      WHERE MONTH(appointment_time) = MONTH(CURRENT_DATE())
        AND YEAR(appointment_time) = YEAR(CURRENT_DATE())
    `);
    res.json({ patientsThisMonth: rows[0].patientsThisMonth || 0 });
  } catch (err) {
    console.error('Patients this month error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get recent payments - FIXED
app.get("/api/finance/recent-payments", async (req, res) => {
    try {
        const [rows] = await db.promise().query(`
            SELECT 
                p.full_name as patient_name,
                a.reason as service,
                py.amount,
                DATE_FORMAT(py.payment_date, '%Y-%m-%d') as date,
                py.status,
                py.appointment_id
            FROM payments py
            JOIN patients p ON py.patient_id = p.id
            JOIN appointments a ON py.appointment_id = a.id
            WHERE py.status = 'paid'
            ORDER BY py.payment_date DESC 
            LIMIT 10
        `);
        
        console.log(`📊 Recent payments fetched: ${rows.length} paid records`);
        res.json(rows);
    } catch (error) {
        console.error("❌ Error fetching recent payments:", error);
        res.status(500).json({ error: "Database error" });
    }
});

// Monthly Revenue (All bills this month)
app.get('/api/finance/monthly-revenue', async (req, res) => {
  try {
    const [rows] = await db.promise().query(`
      SELECT IFNULL(SUM(billing), 0) AS revenue
      FROM appointments
      WHERE billing > 0 
        AND MONTH(appointment_time) = MONTH(CURRENT_DATE())
        AND YEAR(appointment_time) = YEAR(CURRENT_DATE())
    `);
    res.json({ revenue: rows[0].revenue || 0 });
  } catch (err) {
    console.error('Monthly revenue error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Yearly Revenue (All bills this year)
app.get('/api/finance/yearly-revenue', async (req, res) => {
  try {
    const [rows] = await db.promise().query(`
      SELECT IFNULL(SUM(billing), 0) AS revenue
      FROM appointments
      WHERE billing > 0 
        AND YEAR(appointment_time) = YEAR(CURRENT_DATE())
    `);
    res.json({ revenue: rows[0].revenue || 0 });
  } catch (err) {
    console.error('Yearly revenue error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Revenue By Service (All bills grouped by service)
app.get('/api/finance/revenue-by-service', async (req, res) => {
  try {
    const [rows] = await db.promise().query(`
      SELECT 
        COALESCE(reason, 'General Consultation') AS service,
        COUNT(*) AS bill_count,
        IFNULL(SUM(billing), 0) AS revenue,
        IFNULL(AVG(billing), 0) AS average_amount
      FROM appointments
      WHERE billing > 0
      GROUP BY reason
      ORDER BY revenue DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error('Revenue by service error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Top Doctor (Doctor with most billing amount)
app.get('/api/finance/top-doctor', async (req, res) => {
  try {
    const [rows] = await db.promise().query(`
      SELECT 
        d.full_name AS doctor,
        COUNT(a.id) AS appointment_count,
        IFNULL(SUM(a.billing), 0) AS revenue
      FROM appointments a
      JOIN doctors d ON a.doctor_id = d.id
      WHERE a.billing > 0
      GROUP BY a.doctor_id
      ORDER BY revenue DESC, appointment_count DESC
      LIMIT 1
    `);
    
    res.json({
      topDoctor: rows.length ? rows[0].doctor : 'No data',
      appointmentCount: rows.length ? rows[0].appointment_count : 0,
      revenue: rows.length ? rows[0].revenue : 0
    });
  } catch (err) {
    console.error('Top doctor error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Average Bill
app.get('/api/finance/average-bill', async (req, res) => {
  try {
    const [rows] = await db.promise().query(`
      SELECT IFNULL(AVG(billing), 0) AS avgBill
      FROM appointments
      WHERE billing > 0
    `);
    res.json({ avgBill: rows[0].avgBill || 0 });
  } catch (err) {
    console.error('Average bill error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get billing data for accountant - FIXED
app.get("/api/accountant/billing", async (req, res) => {
    try {
        const sql = `
            SELECT 
                a.id as appointment_id,
                p.full_name as patient_name,
                d.full_name as doctor_name,
                a.reason as service_type,
                COALESCE(a.billing, 0) as amount,
                DATE_FORMAT(a.appointment_time, '%Y-%m-%d') as appointment_date,
                -- Check if payment exists for THIS specific appointment
                CASE 
                    WHEN EXISTS (
                        SELECT 1 FROM payments 
                        WHERE appointment_id = a.id AND status = 'paid'
                    ) THEN 'paid'
                    WHEN EXISTS (
                        SELECT 1 FROM payments 
                        WHERE appointment_id = a.id AND status = 'pending' 
                    ) THEN 'pending'
                    WHEN a.appointment_time < NOW() AND a.billing > 0 THEN 'overdue'
                    WHEN a.billing > 0 THEN 'pending'
                    ELSE 'pending'
                END as payment_status,
                -- Get the actual payment status if exists
                (SELECT status FROM payments WHERE appointment_id = a.id ORDER BY id DESC LIMIT 1) as payment_status_raw
            FROM appointments a
            JOIN patients p ON a.patient_id = p.id
            JOIN doctors d ON a.doctor_id = d.id
            WHERE a.billing IS NOT NULL AND a.billing > 0
            ORDER BY a.appointment_time DESC
        `;

        const [results] = await db.promise().query(sql);
        
        // Log for debugging
        console.log(`📊 Billing data fetched: ${results.length} records`);
        
        res.json(results);
    } catch (error) {
        console.error("❌ Error fetching billing data:", error);
        res.status(500).json({ error: "Database error: " + error.message });
    }
});

// Get all payments (for payments section)
app.get("/api/accountant/payments", async (req, res) => {
    try {
        const sql = `
            SELECT 
                py.id,
                p.full_name as patient_name,
                py.appointment_id,
                py.amount,
                DATE_FORMAT(py.due_date, '%Y-%m-%d') as due_date,
                DATE_FORMAT(py.payment_date, '%Y-%m-%d') as payment_date,
                py.status,
                py.payment_method,
                py.notes
            FROM payments py
            JOIN patients p ON py.patient_id = p.id
            ORDER BY 
                CASE 
                    WHEN py.status = 'pending' THEN 1
                    WHEN py.status = 'overdue' THEN 2
                    WHEN py.status = 'paid' THEN 3
                END,
                py.due_date DESC
        `;

        const [results] = await db.promise().query(sql);
        res.json(results);
    } catch (error) {
        console.error("❌ Error fetching payments data:", error);
        res.status(500).json({ error: "Database error" });
    }
});


// Record payment - FIXED with better status handling
app.post("/api/accountant/record-payment", async (req, res) => {
    try {
        const { appointment_id, amount_paid, payment_method, payment_date, notes } = req.body;

        // Check if appointment exists
        const [appointment] = await db.promise().query(
            'SELECT id, patient_id, billing FROM appointments WHERE id = ?',
            [appointment_id]
        );

        if (appointment.length === 0) {
            return res.status(404).json({ success: false, message: "Appointment not found" });
        }

        const appointmentData = appointment[0];

        // Check if payment already exists for this appointment
        const [existingPayment] = await db.promise().query(
            'SELECT id FROM payments WHERE appointment_id = ?', 
            [appointment_id]
        );

        if (existingPayment.length > 0) {
            // Update existing payment to paid
            const updateSql = `
                UPDATE payments 
                SET amount = ?, 
                    payment_method = ?, 
                    payment_date = ?, 
                    status = 'paid',
                    notes = ?
                WHERE appointment_id = ?
            `;
            await db.promise().query(updateSql, [
                amount_paid, 
                payment_method, 
                payment_date, 
                notes || '', 
                appointment_id
            ]);
        } else {
            // Insert new payment
            const insertSql = `
                INSERT INTO payments (
                    appointment_id, 
                    patient_id, 
                    amount, 
                    payment_method, 
                    payment_date, 
                    due_date, 
                    status, 
                    notes
                ) VALUES (?, ?, ?, ?, ?, DATE_ADD(?, INTERVAL 30 DAY), 'paid', ?)
            `;
            await db.promise().query(insertSql, [
                appointment_id,
                appointmentData.patient_id,
                amount_paid,
                payment_method,
                payment_date,
                payment_date,
                notes || ''
            ]);
        }

        // Update appointment billing status
        await db.promise().query(
            'UPDATE appointments SET billing_status = ? WHERE id = ?',
            ['paid', appointment_id]
        );

        console.log(`✅ Payment recorded for appointment #${appointment_id}: KSh ${amount_paid}`);

        res.json({ 
            success: true, 
            message: "Payment recorded successfully"
        });

    } catch (error) {
        console.error("❌ Error recording payment:", error);
        res.status(500).json({ success: false, message: "Database error: " + error.message });
    }
});

// DIAGNOSTIC: Check payment vs appointment status
app.get("/api/debug/payment-status", async (req, res) => {
    try {
        const sql = `
            SELECT 
                a.id as appointment_id,
                p.full_name as patient_name,
                a.billing as amount,
                a.billing_status,
                (SELECT status FROM payments WHERE appointment_id = a.id ORDER BY id DESC LIMIT 1) as payment_status,
                (SELECT COUNT(*) FROM payments WHERE appointment_id = a.id) as payment_count
            FROM appointments a
            JOIN patients p ON a.patient_id = p.id
            WHERE a.billing IS NOT NULL AND a.billing > 0
            ORDER BY a.appointment_time DESC
            LIMIT 20
        `;
        
        const [results] = await db.promise().query(sql);
        console.log("🔍 Payment Status Diagnostic:", results);
        res.json(results);
    } catch (error) {
        console.error("Diagnostic error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Accountant Logout
app.post('/accountant/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).json({ 
                success: false, 
                message: 'Error logging out' 
            });
        }
        res.json({ 
            success: true, 
            message: 'Logged out successfully' 
        });
    });
});

// Accountant Login Route - WITH DEBUGGING
app.post("/login/accountant", (req, res) => {
  console.log("📧 Login attempt for:", req.body.email);
  
  const { email, password } = req.body;

  if (!email || !password) {
    console.log("❌ Missing email or password");
    return res.status(400).json({ 
      success: false,
      message: "Email and password required" 
    });
  }

  db.query("SELECT * FROM accountants WHERE email = ?", [email], (err, rows) => {
    if (err) {
      console.error("❌ Database error:", err);
      return res.status(500).json({ 
        success: false,
        message: "Server error" 
      });
    }
    
    console.log("🔍 Found records:", rows.length);
    
    if (rows.length === 0) {
      console.log("❌ No accountant found with email:", email);
      return res.status(400).json({ 
        success: false,
        message: "Invalid credentials" 
      });
    }

    const acc = rows[0];
    console.log("👤 Accountant found:", acc.full_name);
    console.log("🔑 Stored hash:", acc.password.substring(0, 20) + "...");

    bcrypt.compare(password, acc.password, (err, isMatch) => {
      if (err) {
        console.error("❌ Password compare error:", err);
        return res.status(500).json({ 
          success: false,
          message: "Server error" 
        });
      }
      
      console.log("✅ Password match?", isMatch);
      
      if (!isMatch) {
        console.log("❌ Password doesn't match");
        return res.status(400).json({ 
          success: false,
          message: "Invalid credentials" 
        });
      }

      // Set session
      req.session.accountant = {
        id: acc.id,
        full_name: acc.full_name,
        email: acc.email
      };

      console.log("🎉 Login successful for:", acc.full_name);
      
      res.json({
        success: true,
        message: "Login successful",
        accountant: {
          id: acc.id,
          full_name: acc.full_name,
          email: acc.email
        }
      });
    });
  });
});
/**********************************************************************
 *  START SERVER
 **********************************************************************/

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});