const express = require("express");
const multer = require("multer");
const xlsx = require("xlsx");
const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");
const pdfParse = require("pdf-parse");

const Payment = require("../models/Payment");
const WorkerRequest = require("../models/workerRequest");
const PaymentRequest = require("../models/PaymentRequest");
const User = require("../models/User");
const FailedEmail = require("../models/FailedEmail");

const router = express.Router();

// ==== Email Configuration ====
// Single email transporter for both East and West Rayalaseema regions
// All emails are sent from the West Rayalaseema email account (spicon.apwr@gmail.com)
// You'll need to set these environment variables in your .env file:
// EMAIL_HOST, EMAIL_PORT (optional, defaults to Gmail)
// WEST_EMAIL_PASS - App password for spicon.apwr@gmail.com (used for both regions)

// Single email transporter for both regions (using West Rayalaseema credentials)
// All emails are sent from the West Rayalaseema email account
const emailTransporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: process.env.EMAIL_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: "spicon.apwr@gmail.com",
        pass: process.env.WEST_EMAIL_PASS, // App password for West email (used for both regions)
    },
});

// Verify email transporter on startup
if (process.env.WEST_EMAIL_PASS) {
    emailTransporter.verify(function (error, success) {
        if (error) {
            console.error("❌ Email transporter verification FAILED:", error.message);
            console.error("   Please check your WEST_EMAIL_PASS environment variable.");
            console.error("   Error code:", error.code);
        } else {
            console.log("✅ Email transporter verified successfully (used for both East and West regions)");
        }
    });
} else {
    console.warn("⚠️  WEST_EMAIL_PASS environment variable is not set. Email sending will fail.");
}

// Function to get transporter and sender email (always uses West email for both regions)
// Region is used only for email content customization, not for email account selection
function getEmailConfig(region) {
    // Always use West Rayalaseema email account for both regions
    // Region parameter is used only for email content customization
    return {
        transporter: emailTransporter,
        senderEmail: "spicon.apwr@gmail.com" // West email used for both East and West regions
    };
}

// Function to send registration confirmation email
async function sendRegistrationEmail(email, fullName, region) {
    try {
        // Format participant name - use fullName if available, otherwise use "Participant"
        const participantName = fullName || "Participant";
        
        // Get the appropriate transporter and sender email based on region
        const { transporter: emailTransporter, senderEmail } = getEmailConfig(region);
        
        const mailOptions = {
            from: senderEmail,
            to: email,
            subject: `Thank You for Registering for SPICON-2026 - ${region}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; line-height: 1.6; color: #333;">
                    <p>Dear ${participantName},</p>
                    
                    <p>Greetings in Christ's name!</p>
                    
                    <p>Thank you for your interest in SPICON-2026, the Spiritual Life Conference organized by UESI-AP ${region}. We have received your application and it is currently under review. Once the verification process is complete, you will receive a confirmation email with further details.</p>
                    
                    <p>We appreciate your prayerful anticipation and look forward to joining together in a time of consecration, imitation, and spiritual renewal rooted in 1 Peter 2:21–22. May the Lord prepare our hearts for a transformative experience.</p>
                    
                    <p>If you have any questions in the meantime, please reply to this email.</p>
                    
                    <p>With blessings,</p>
                    
                    <p><strong>SPICON-2026 Committee</strong><br/>
                    UESI-AP ${region}</p>
                </div>
            `,
        };
        
        await emailTransporter.sendMail(mailOptions);
        
        console.log(`Registration confirmation email sent to ${email} from ${senderEmail}`);
    } catch (error) {
        console.error(`❌ Error sending ${region} registration email to ${email}:`, error.message);
        if (error.code === 'EAUTH') {
            console.error(`   Authentication failed. Please verify the WEST_EMAIL_PASS environment variable.`);
            console.error("   All emails (East and West) are sent from spicon.apwr@gmail.com using WEST_EMAIL_PASS.");
        }
        // Don't throw error - registration should still succeed even if email fails
    }
}

// Map group type to ID prefix
function getPrefixForGroupType(groupType = "") {
    const normalized = (groupType || "").toLowerCase();
    if (normalized.includes("family")) return "F";               // Family
    if (normalized.includes("graduate")) return "G";             // Any graduate option
    if (normalized.includes("student")) return "S";              // Students
    if (normalized.includes("volunteer")) return "V";            // Volunteers
    // Fallback
    return "G";
}

// Function to generate unique registration ID with group-based prefixes
// Formats:
//  Family -> SPICON2026-F001
//  Graduates (employed/unemployed/children) -> SPICON2026-G001
//  Students -> SPICON2026-S001
//  Volunteers -> SPICON2026-V001
async function generateRegistrationId(region, groupType) {
    const prefix = getPrefixForGroupType(groupType);
    const regex = new RegExp(`^SPICON2026-${prefix}(\\d+)$`);

    const lastRegistration = await Payment.findOne({
        region,
        uniqueId: { $regex: regex },
        registrationStatus: "approved"
    }).sort({ uniqueId: -1 });

    let nextSequence = 1;
    if (lastRegistration?.uniqueId) {
        const match = lastRegistration.uniqueId.match(regex);
        if (match?.[1]) {
            const lastSequence = parseInt(match[1], 10);
            if (!isNaN(lastSequence)) {
                nextSequence = lastSequence + 1;
            }
        }
    }

    const paddedSequence = String(nextSequence).padStart(3, "0");
    return `SPICON2026-${prefix}${paddedSequence}`;
}

// Function to send approval confirmation email
async function sendApprovalEmail(email, fullName, region, uniqueId) {
    try {
        const participantName = fullName || "Participant";
        
        // Get the appropriate transporter and sender email based on region
        const { transporter: emailTransporter, senderEmail } = getEmailConfig(region);
        
        // Determine venue, dates, and speakers based on region
        let venue = "";
        let dates = "";
        let speakers = "";
        
        if (region === "West Rayalaseema") {
            venue = "Seventh-Day Adventist High School,\nDugganagaripalli, Vempalli, YSR Kadapa District";
            dates = "11th to 14th January 2026";
            speakers = "Bro. P. C. Joshua (Devotions), Bro. P. Prem Kumar (Expositions), and Bro. T. R. Ravi Rajendra (Keynote Address)";
        } else if (region === "East Rayalaseema") {
            venue = "Wisdom CBSE High school,\nkoduru,\nAnnamayya District";
            dates = "10th 5pm to 13th 1:00pm January 2026";
            speakers = "Bro. U.David Jaya Kumar (Devotions), Bro. J.Godwin Nickelson (Expositions), and Bro. T.R.Ravi Rajendra (Keynote Address)";
        }
        
        const mailOptions = {
            from: senderEmail,
            to: email,
            subject: `SPICON-2026 Registration Confirmation & Invitation - ${region}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; line-height: 1.6; color: #333;">
                    <p>Dear ${participantName},</p>
                    
                    <p>Greetings in the precious name of our Lord Jesus Christ!</p>
                    
                    <p>We are pleased to confirm your registration for SPICON-2026, the Spiritual Life Conference organized by UESI–AP ${region}. Your registration number is <strong>${uniqueId}</strong> — please keep it safe for future reference.</p>
                    
                    <p><strong>📅 Conference Dates:</strong></p>
                    <p>${dates}</p>
                    
                    <p><strong>📍 Venue:</strong></p>
                    <p>${venue}</p>
                    
                    <p><strong>🕊 Theme:</strong></p>
                    <p>"Consecrate… Imitate… Motivate…"</p>
                    <p>Based on 1 Peter 2:21–22</p>
                    
                    <p>We warmly invite you to join us for these blessed days of spiritual renewal, fellowship, and growth. The Lord has prepared His servants — ${speakers} — who will minister to us throughout the conference.</p>
                    
                    <p>We request you to arrive at the venue by the afternoon of January ${region === "West Rayalaseema" ? "11th" : "10th"} for registration and orientation. Additional details and instructions will be shared with you soon.</p>
                    
                    <p>Thank you for your prayerful participation. We look forward to welcoming you to SPICON-2026!</p>
                    
                    <p>In His service,</p>
                    
                    <p><strong>SPICON-2026 Committee</strong><br/>
                    UESI–AP ${region}</p>
                </div>
            `,
        };
        
        await emailTransporter.sendMail(mailOptions);
        
        console.log(`Approval confirmation email sent to ${email} with ID ${uniqueId}`);
    } catch (error) {
        console.error(`❌ Error sending ${region} approval email to ${email}:`, error.message);
        if (error.code === 'EAUTH') {
            console.error(`   Authentication failed. Please verify the WEST_EMAIL_PASS environment variable.`);
            console.error("   All emails (East and West) are sent from spicon.apwr@gmail.com using WEST_EMAIL_PASS.");
        }
        throw error; // Re-throw so we know if email failed
    }
}

// Function to send rejection email
async function sendRejectionEmail(email, fullName, region, reason) {
    if (!email) return; // nothing to send
    try {
        const participantName = fullName || "Participant";
        const { transporter: emailTransporter, senderEmail } = getEmailConfig(region);

        const mailOptions = {
            from: senderEmail,
            to: email,
            subject: "SPICON-2026 Registration Update",
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; line-height: 1.6; color: #333;">
                    <p>Dear ${participantName},</p>

                    <p>Greetings in Christ's name!</p>

                    <p>We regret to inform you that your registration for SPICON-2026 (${region}) could not be approved.</p>

                    ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}

                    <p>If you believe this is in error or need further clarification, please reply to this email.</p>

                    <p>With blessings,</p>
                    <p><strong>SPICON-2026 Committee</strong><br/>
                    UESI–AP ${region}</p>
                </div>
            `,
        };

        await emailTransporter.sendMail(mailOptions);
        console.log(`Rejection email sent to ${email}`);
    } catch (error) {
        console.error("Error sending rejection email:", error);
        // Do not throw; rejection action should still succeed
    }
}

// Function to send bulk WhatsApp group invitation email
async function sendBulkApprovalEmail(email, fullName, region) {
    if (!email) return; // nothing to send
    try {
        const participantName = fullName || "Participant";
        const { transporter: emailTransporter, senderEmail } = getEmailConfig(region);

        // Region-specific WhatsApp links and email content
        let whatsappLink = "";
        let subject = "";
        let emailBody = "";

        if (region === "East Rayalaseema") {
            whatsappLink = "https://chat.whatsapp.com/JW88QUiqz8HFbeX7ri7dZr";
            subject = "Join SPICON-2026 WhatsApp Group - East Rayalaseema";
            emailBody = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; line-height: 1.6; color: #333;">
                    <p>Dear ${participantName},</p>
                    
                    <p>Greetings in the precious name of our Lord Jesus Christ!</p>
                    
                    <p>Congratulations once again on the approval of your registration for SPICON-2026 (East Rayalaseema). We thank God for your commitment and are delighted to welcome you to this spiritually enriching conference.</p>
                    
                    <p><strong>👉 Important Notice:</strong><br/>
                    To ensure smooth communication and timely updates, <strong>joining the official SPICON-2026 East Rayalaseema WhatsApp group is mandatory for all registered participants</strong>.</p>
                    
                    <p>Please join the group using the link below at the earliest:</p>
                    
                    <p><strong>👉 Official WhatsApp Group Link:</strong><br/>
                    <a href="${whatsappLink}" style="color: #25D366; text-decoration: none; font-weight: bold;">${whatsappLink}</a></p>
                    
                    <p>This WhatsApp group will serve as the primary communication channel for:</p>
                    <ul>
                        <li>Conference schedules and real-time updates</li>
                        <li>Venue, accommodation, and travel-related information</li>
                        <li>Important instructions and announcements from the SPICON-2026 Committee</li>
                    </ul>
                    
                    <p>We kindly request your cooperation in maintaining the sanctity and purpose of the group, keeping all discussions aligned with the objectives of SPICON-2026.</p>
                    
                    <p>We prayerfully look forward to meeting you and fellow participants for a blessed time of fellowship, consecration, and spiritual renewal.</p>
                    
                    <p>With warm regards and prayers,</p>
                    
                    <p><strong>SPICON-2026 Committee</strong><br/>
                    UESI – AP East Rayalaseema</p>
                </div>
            `;
        } else if (region === "West Rayalaseema") {
            whatsappLink = "https://chat.whatsapp.com/FAJaJPnaHh07yoObN1Tfpw";
            subject = "Join SPICON-2026 WhatsApp Group - West Rayalaseema";
            emailBody = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; line-height: 1.6; color: #333;">
                    <p>Dear ${participantName},</p>
                    
                    <p>Greetings in the precious name of our Lord Jesus Christ!</p>
                    
                    <p>We are delighted to once again congratulate you on the successful approval of your registration for SPICON-2026 (West Rayalaseema). We praise God for your willingness to be part of this blessed Spiritual Life Conference.</p>
                    
                    <p>To ensure smooth communication, timely updates, and important announcements regarding the conference, we kindly request you to join the <strong>official SPICON-2026 West Rayalaseema WhatsApp group</strong>.</p>
                    
                    <p><strong>👉 Follow this link to join the WhatsApp group:</strong><br/>
                    <a href="${whatsappLink}" style="color: #25D366; text-decoration: none; font-weight: bold;">${whatsappLink}</a></p>
                    
                    <p>This WhatsApp group will be used exclusively for:</p>
                    <ul>
                        <li>Conference instructions and schedules</li>
                        <li>Travel and arrival coordination</li>
                        <li>Important announcements from the SPICON-2026 Committee</li>
                    </ul>
                    
                    <p>We humbly request all participants to maintain the sanctity and purpose of the group by refraining from unrelated discussions.</p>
                    
                    <p>We prayerfully look forward to meeting you in person and experiencing a spiritually enriching time together as we gather around God's Word.</p>
                    
                    <p>With prayers and blessings,</p>
                    
                    <p><strong>SPICON-2026 Committee</strong><br/>
                    UESI – AP West Rayalaseema</p>
                </div>
            `;
        } else {
            throw new Error(`Unknown region: ${region}`);
        }

        const mailOptions = {
            from: senderEmail,
            to: email,
            subject: subject,
            html: emailBody,
        };

        await emailTransporter.sendMail(mailOptions);
        console.log(`WhatsApp group invitation email sent to ${email} (${region})`);
        return { success: true, email };
    } catch (error) {
        console.error(`❌ Error sending bulk email to ${email} (${region}):`, error.message);
        if (error.code === 'EAUTH') {
            console.error(`   Authentication failed. Please verify the WEST_EMAIL_PASS environment variable.`);
        }
        return { success: false, email, error: error.message };
    }
}

// ==== Multer Storage ====
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, "../uploads");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log("📁 Created uploads directory:", dir);
    }
    console.log("💾 Saving file to:", dir);
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    // Sanitize filename: lowercase, replace spaces with underscores, remove special chars
    const cleanName = file.originalname
      .toLowerCase()              // jpg / png always lowercase
      .replace(/\s+/g, "_")       // spaces → _
      .replace(/[^a-z0-9._-]/g, ""); // remove special chars

    const filename = Date.now() + "-" + cleanName;
    console.log("📝 File will be saved as:", filename);
    cb(null, filename);
  }
});

const upload = multer({ storage });


// ============================================================
// 1) UPLOAD EXCEL — CREATE or UPDATE CUSTOMERS
// ============================================================
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const workbook = xlsx.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet);

    const results = [];

    for (const row of rows) {
      const name = row.Name || row.name;
      if (!name) continue;

      const phone = row.phoneNum || row.Phone || row.phone || "";
      const totalAmount = Number(row.TotalAmount || row.Amount || 0) || 0;
      const paidAmount = Number(row.PaidAmount || row.paid || 0) || 0;

      let existing = phone
        ? await Payment.findOne({ phone })
        : await Payment.findOne({ name });

      if (existing) {
        if (paidAmount > 0) {
          existing.transactions.push({ amount: paidAmount });
        }

        if (totalAmount) existing.totalAmount = totalAmount;

        existing.recalculate();
        await existing.save();

        results.push({ action: "updated", id: existing._id, name: existing.name });
      } else {
        const p = new Payment({
          name,
          address: row.Address || "",
          phone,
          profession: row.Profession || "",
          totalAmount,
          transactions: paidAmount > 0 ? [{ amount: paidAmount }] : []
        });

        p.recalculate();
        await p.save();

        results.push({ action: "created", id: p._id, name: p.name });
      }
    }

    fs.unlinkSync(req.file.path);

    res.json({ success: true, results });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Upload failed", details: err.message });
  }
});


// ============================================================
// 2) REGISTER CUSTOMER FROM SPICON FRONTEND FORM (UPDATED)
// ============================================================
router.post(
  "/registerCustomer",
  upload.single("paymentScreenshot"),
  async (req, res) => {
    try {
      const { region, groupType } = req.body;
      
      // Ensure mandatory fields are present
      if (!region || !groupType) {
        return res.status(400).json({ error: "Region and Group Type are mandatory for registration." });
      }
      
      // --- 1. CREATE PAYMENT OBJECT ---
      const customer = new Payment({
        // REGION
        region: region,

        // BASIC DETAILS
        email: req.body.email,
        title: req.body.title,
        fullName: req.body.fullName,
        surname: req.body.surname,
        name: `${req.body.fullName} ${req.body.surname}`,
        gender: req.body.gender,
        age: req.body.age,
        mobile: req.body.mobile,
        maritalStatus: req.body.maritalStatus,

        // DT CAMP
        dtcAttended: req.body.dtcAttended,
        dtcWhen: req.body.dtcWhen,
        dtcWhere: req.body.dtcWhere,

        // DISTRICT + EGF
        district: req.body.district,
        iceuEgf: req.body.iceuEgf,

        // RECOMMENDATION
        recommendedByRole: req.body.recommendedByRole,
        recommenderContact: req.body.recommenderContact,

        // GROUP TYPE
        groupType: groupType,

        // FAMILY DETAILS
        spouseAttending: req.body.spouseAttending,
        spouseName: req.body.spouseName,

        childBelow10Count: req.body.childBelow10Count,
        childBelow10Names: req.body.childBelow10Names,

        child10to14Count: req.body.child10to14Count,
        child10to14Names: req.body.child10to14Names,

        totalFamilyMembers: req.body.totalFamilyMembers,
        delegatesOther: req.body.delegatesOther,

        // PAYMENT DETAILS
        amountPaid: Number(req.body.amountPaid) || 0,
        paymentMode2: req.body.paymentMode2,
        dateOfPayment: req.body.dateOfPayment,
        transactionId: req.body.transactionId,

        transactions: req.body.amountPaid
          ? [
              {
                amount: Number(req.body.amountPaid),
                note: `Txn: ${req.body.transactionId}`,
                date: new Date(req.body.dateOfPayment),
              },
            ]
          : [],

        // ARRIVAL DETAILS
        arrivalDay: req.body.arrivalDay,
        arrivalTime: req.body.arrivalTime,

        // FILE
        paymentScreenshot: req.file ? req.file.filename : "",

        // AUTO – you can calculate later
        totalAmount: Number(req.body.totalAmount) || 0,
      });

      customer.recalculate();
      await customer.save();

      // --- 2. SEND CONFIRMATION EMAIL ---
      // Send email to the registered user
      if (req.body.email) {
        await sendRegistrationEmail(
          req.body.email,
          req.body.fullName || customer.name,
          region
        );
      }

      // --- 3. RETURN SUCCESS RESPONSE (without uniqueId) ---
      res.json({ 
        success: true, 
        message: "Registration successful. Confirmation email has been sent."
      });
    } catch (err) {
      console.error("REGISTER ERROR:", err);
      res.status(500).json({ error: err.message });
    }
  }
);



// ============================================================
// 3) LIST ALL CUSTOMERS (FOR MOBILE APP)
// ============================================================
router.get("/list", async (req, res) => {
  try {
    const list = await Payment.find().sort({ name: 1 });
    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// REGISTRAR ENDPOINTS - Registration Approval/Rejection
// ============================================================

// Get all registrations (for registrar dashboard)
router.get("/registrations", async (req, res) => {
  try {
    const { status, region } = req.query; // Optional filters: status (pending/approved/rejected), region
    
    const query = {};
    if (status) {
      query.registrationStatus = status;
    }
    if (region) {
      query.region = region;
    }
    
    const registrations = await Payment.find(query)
      .sort({ createdAt: -1 }) // Newest first
      .select("-transactions"); // Exclude transactions array for cleaner response
    
    res.json({ 
      success: true, 
      data: registrations,
      count: registrations.length
    });
  } catch (err) {
    console.error("Error fetching registrations:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET all failed emails from database (MUST be before /registrations/:id route)
router.get("/registrations/failed-emails", async (req, res) => {
  try {
    const { region } = req.query;
    
    const query = {};
    if (region) {
      query.region = region;
    }
    
    const failedEmails = await FailedEmail.find(query)
      .sort({ createdAt: -1 }) // Newest first
      .lean();
    
    res.json({
      success: true,
      data: failedEmails,
      count: failedEmails.length
    });
  } catch (err) {
    console.error("Error fetching failed emails:", err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE a failed email by ID (MUST be before /registrations/:id route)
router.delete("/registrations/failed-emails/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const deletedEmail = await FailedEmail.findByIdAndDelete(id);
    
    if (!deletedEmail) {
      return res.status(404).json({ error: "Failed email record not found" });
    }
    
    res.json({
      success: true,
      message: "Failed email record deleted successfully"
    });
  } catch (err) {
    console.error("Error deleting failed email:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET complete user details for a failed email by email address (MUST be before /registrations/:id route)
router.get("/registrations/failed-emails/:email/details", async (req, res) => {
  try {
    const { email } = req.params;
    
    // Decode email if it's URL encoded
    const decodedEmail = decodeURIComponent(email);
    
    // Find the registration by email
    const registration = await Payment.findOne({ 
      email: decodedEmail 
    }).lean();
    
    if (!registration) {
      return res.status(404).json({ 
        error: "Registration not found for this email address" 
      });
    }
    
    res.json({
      success: true,
      data: registration
    });
  } catch (err) {
    console.error("Error fetching user details:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get single registration details
router.get("/registrations/:id", async (req, res) => {
  try {
    const registration = await Payment.findById(req.params.id);
    
    if (!registration) {
      return res.status(404).json({ error: "Registration not found" });
    }
    
    res.json({ success: true, data: registration });
  } catch (err) {
    console.error("Error fetching registration:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// VIEW PAYMENT SCREENSHOT (CASE & EXTENSION SAFE)
// ============================================================
router.get("/registrations/:id/screenshot", async (req, res) => {
  try {
    const registration = await Payment.findById(req.params.id);

    if (!registration || !registration.paymentScreenshot) {
      return res.status(404).json({ message: "Screenshot not found" });
    }

    const uploadsDir = path.resolve(__dirname, "../uploads");

    // Normalize filename from DB
    const dbFile = registration.paymentScreenshot.toLowerCase();

    // Find matching file ignoring case
    const files = fs.readdirSync(uploadsDir);
    const matchedFile = files.find(
      (f) => f.toLowerCase() === dbFile
    );

    if (!matchedFile) {
      return res.status(404).json({ message: "File missing on server" });
    }

    // Auto-set correct content type
    const ext = path.extname(matchedFile).toLowerCase();
    const mimeTypes = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
    };

    res.setHeader(
      "Content-Type",
      mimeTypes[ext] || "application/octet-stream"
    );

    res.sendFile(path.join(uploadsDir, matchedFile));
  } catch (err) {
    console.error("Screenshot view error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Approve registration - generates unique ID and sends confirmation email
router.post("/registrations/:id/approve", async (req, res) => {
  try {
    const { id } = req.params;
    const { approvedBy } = req.body; // Registrar email or ID
    
    const registration = await Payment.findById(id);
    
    if (!registration) {
      return res.status(404).json({ error: "Registration not found" });
    }
    
    if (registration.registrationStatus === "approved") {
      return res.status(400).json({ error: "Registration is already approved" });
    }
    
    // Generate unique registration ID based on groupType
    const uniqueId = await generateRegistrationId(registration.region, registration.groupType);
    
    // Update registration status
    registration.registrationStatus = "approved";
    registration.uniqueId = uniqueId;
    registration.approvedAt = new Date();
    registration.approvedBy = approvedBy || "Registrar";
    
    await registration.save();
    
    // Send approval email
    try {
      await sendApprovalEmail(
        registration.email,
        registration.fullName || registration.name,
        registration.region,
        uniqueId
      );
    } catch (emailError) {
      console.error("Failed to send approval email:", emailError);
      // Still return success but log the error
      // You might want to handle this differently based on your requirements
    }
    
    res.json({ 
      success: true, 
      message: "Registration approved successfully",
      data: {
        id: registration._id,
        uniqueId: uniqueId,
        registrationStatus: registration.registrationStatus
      }
    });
  } catch (err) {
    console.error("Error approving registration:", err);
    res.status(500).json({ error: err.message });
  }
});

// Reject registration
router.post("/registrations/:id/reject", async (req, res) => {
  try {
    const { id } = req.params;
        const { rejectedBy, reason } = req.body; // Optional rejection reason
    
    const registration = await Payment.findById(id);
    
    if (!registration) {
      return res.status(404).json({ error: "Registration not found" });
    }
    
    if (registration.registrationStatus === "rejected") {
      return res.status(400).json({ error: "Registration is already rejected" });
    }
    
    // Update registration status
    registration.registrationStatus = "rejected";
    registration.rejectedAt = new Date();
    registration.rejectedBy = rejectedBy || "Registrar";
    
    // Optionally store rejection reason
    if (reason) {
      registration.rejectionReason = reason;
    }
    
    await registration.save();

        // Send rejection email
        try {
            await sendRejectionEmail(
                registration.email,
                registration.fullName || registration.name,
                registration.region,
                reason
            );
        } catch (emailError) {
            console.error("Failed to send rejection email:", emailError);
        }
    
    res.json({ 
      success: true, 
      message: "Registration rejected successfully",
      data: {
        id: registration._id,
        registrationStatus: registration.registrationStatus
      }
    });
  } catch (err) {
    console.error("Error rejecting registration:", err);
    res.status(500).json({ error: err.message });
  }
});

// Send bulk WhatsApp group invitation emails to all approved registrations
router.post("/registrations/send-bulk-emails", async (req, res) => {
  try {
    const { region } = req.query; // Optional: "West Rayalaseema" or "East Rayalaseema"
    
    // Build query for approved registrations
    const query = { registrationStatus: "approved" };
    
    // Filter by region if specified
    if (region) {
      if (region !== "West Rayalaseema" && region !== "East Rayalaseema") {
        return res.status(400).json({ 
          error: "Invalid region. Must be 'West Rayalaseema' or 'East Rayalaseema'" 
        });
      }
      query.region = region;
    }
    
    // Find all approved registrations matching the query
    const approvedRegistrations = await Payment.find(query);
    
    if (approvedRegistrations.length === 0) {
      return res.json({
        success: true,
        message: "No approved registrations found",
        data: {
          totalSent: 0,
          totalFailed: 0,
          westRayalaseema: { sent: 0, failed: 0 },
          eastRayalaseema: { sent: 0, failed: 0 },
          failedEmails: []
        }
      });
    }
    
    // Group by region and send emails
    const results = {
      totalSent: 0,
      totalFailed: 0,
      westRayalaseema: { sent: 0, failed: 0 },
      eastRayalaseema: { sent: 0, failed: 0 },
      failedEmails: []
    };
    
    // Send emails sequentially with delay to avoid Gmail rate limiting
    // Delay between emails: 12-15 seconds (randomized to avoid pattern detection)
    const minDelay = 12000; // 12 seconds
    const maxDelay = 15000; // 15 seconds
    
    for (let i = 0; i < approvedRegistrations.length; i++) {
      const registration = approvedRegistrations[i];
      
      // Skip if no email
      if (!registration.email) {
        results.failedEmails.push({
          email: "No email provided",
          mobile: registration.mobile || "N/A",
          name: registration.fullName || registration.name || "Unknown",
          fullName: registration.fullName || "N/A",
          surname: registration.surname || "N/A",
          region: registration.region,
          district: registration.district || "N/A",
          iceuEgf: registration.iceuEgf || "N/A",
          groupType: registration.groupType || "N/A",
          uniqueId: registration.uniqueId || "N/A",
          error: "Email address missing"
        });
        if (registration.region === "West Rayalaseema") {
          results.westRayalaseema.failed++;
        } else if (registration.region === "East Rayalaseema") {
          results.eastRayalaseema.failed++;
        }
        results.totalFailed++;
        continue; // Skip to next registration
      }
      
      // Send email
      const emailResult = await sendBulkApprovalEmail(
        registration.email,
        registration.fullName || registration.name,
        registration.region
      );
      
      if (emailResult.success) {
        results.totalSent++;
        if (registration.region === "West Rayalaseema") {
          results.westRayalaseema.sent++;
        } else if (registration.region === "East Rayalaseema") {
          results.eastRayalaseema.sent++;
        }
        console.log(`✓ Email ${i + 1}/${approvedRegistrations.length} sent to ${registration.email}`);
      } else {
        results.totalFailed++;
        // Include all registration details for failed emails
        const failedEmailData = {
          email: registration.email,
          mobile: registration.mobile || "N/A",
          name: registration.fullName || registration.name || "Unknown",
          fullName: registration.fullName || "N/A",
          surname: registration.surname || "N/A",
          region: registration.region,
          district: registration.district || "N/A",
          iceuEgf: registration.iceuEgf || "N/A",
          groupType: registration.groupType || "N/A",
          uniqueId: registration.uniqueId || "N/A",
          error: emailResult.error,
          registrationId: registration._id
        };
        results.failedEmails.push(failedEmailData);
        // Save to database
        try {
          await FailedEmail.create(failedEmailData);
        } catch (dbError) {
          console.error("Error saving failed email to database:", dbError);
        }
        if (registration.region === "West Rayalaseema") {
          results.westRayalaseema.failed++;
        } else if (registration.region === "East Rayalaseema") {
          results.eastRayalaseema.failed++;
        }
        console.log(`✗ Email ${i + 1}/${approvedRegistrations.length} failed for ${registration.email}: ${emailResult.error}`);
      }
      
      // Add delay before next email (except for the last one)
      if (i < approvedRegistrations.length - 1) {
        const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
        console.log(`⏳ Waiting ${delay / 1000} seconds before next email...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    res.json({
      success: true,
      message: "Bulk emails sent successfully",
      data: results
    });
    
  } catch (err) {
    console.error("Error sending bulk emails:", err);
    res.status(500).json({ error: err.message });
  }
});

// Resend emails to specific failed email addresses
router.post("/registrations/resend-failed-emails", async (req, res) => {
  try {
    const { failedEmails } = req.body; // Array of email addresses or full failed email objects
    
    if (!failedEmails || !Array.isArray(failedEmails) || failedEmails.length === 0) {
      return res.status(400).json({ 
        error: "failedEmails array is required and must not be empty" 
      });
    }
    
    // Extract email addresses from the array (handle both string emails and full objects)
    const emailAddresses = failedEmails.map(item => 
      typeof item === 'string' ? item : item.email
    ).filter(email => email && email !== "No email provided");
    
    if (emailAddresses.length === 0) {
      return res.status(400).json({ 
        error: "No valid email addresses found in failedEmails array" 
      });
    }
    
    // Find registrations matching these email addresses
    const registrations = await Payment.find({ 
      email: { $in: emailAddresses },
      registrationStatus: "approved"
    });
    
    if (registrations.length === 0) {
      return res.json({
        success: true,
        message: "No approved registrations found for the provided email addresses",
        data: {
          totalSent: 0,
          totalFailed: emailAddresses.length,
          westRayalaseema: { sent: 0, failed: 0 },
          eastRayalaseema: { sent: 0, failed: 0 },
          failedEmails: emailAddresses.map(email => ({
            email,
            error: "Registration not found or not approved"
          }))
        }
      });
    }
    
    // Group by region and send emails
    const results = {
      totalSent: 0,
      totalFailed: 0,
      westRayalaseema: { sent: 0, failed: 0 },
      eastRayalaseema: { sent: 0, failed: 0 },
      failedEmails: []
    };
    
    // Send emails sequentially with delay to avoid Gmail rate limiting
    // Delay between emails: 12-15 seconds (randomized to avoid pattern detection)
    const minDelay = 12000; // 12 seconds
    const maxDelay = 15000; // 15 seconds
    
    for (let i = 0; i < registrations.length; i++) {
      const registration = registrations[i];
      
      // Skip if no email
      if (!registration.email) {
        const failedEmailData = {
          email: "No email provided",
          mobile: registration.mobile || "N/A",
          name: registration.fullName || registration.name || "Unknown",
          fullName: registration.fullName || "N/A",
          surname: registration.surname || "N/A",
          region: registration.region,
          district: registration.district || "N/A",
          iceuEgf: registration.iceuEgf || "N/A",
          groupType: registration.groupType || "N/A",
          uniqueId: registration.uniqueId || "N/A",
          error: "Email address missing",
          registrationId: registration._id
        };
        results.failedEmails.push(failedEmailData);
        // Save to database
        try {
          await FailedEmail.create(failedEmailData);
        } catch (dbError) {
          console.error("Error saving failed email to database:", dbError);
        }
        if (registration.region === "West Rayalaseema") {
          results.westRayalaseema.failed++;
        } else if (registration.region === "East Rayalaseema") {
          results.eastRayalaseema.failed++;
        }
        results.totalFailed++;
        continue; // Skip to next registration
      }
      
      // Send email
      const emailResult = await sendBulkApprovalEmail(
        registration.email,
        registration.fullName || registration.name,
        registration.region
      );
      
      if (emailResult.success) {
        results.totalSent++;
        if (registration.region === "West Rayalaseema") {
          results.westRayalaseema.sent++;
        } else if (registration.region === "East Rayalaseema") {
          results.eastRayalaseema.sent++;
        }
        // Delete from failed emails database if it exists
        try {
          await FailedEmail.deleteMany({ email: registration.email });
        } catch (dbError) {
          console.error("Error deleting failed email from database:", dbError);
        }
        console.log(`✓ Resend ${i + 1}/${registrations.length} sent to ${registration.email}`);
      } else {
        results.totalFailed++;
        const failedEmailData = {
          email: registration.email,
          mobile: registration.mobile || "N/A",
          name: registration.fullName || registration.name || "Unknown",
          fullName: registration.fullName || "N/A",
          surname: registration.surname || "N/A",
          region: registration.region,
          district: registration.district || "N/A",
          iceuEgf: registration.iceuEgf || "N/A",
          groupType: registration.groupType || "N/A",
          uniqueId: registration.uniqueId || "N/A",
          error: emailResult.error,
          registrationId: registration._id
        };
        results.failedEmails.push(failedEmailData);
        // Save to database
        try {
          await FailedEmail.create(failedEmailData);
        } catch (dbError) {
          console.error("Error saving failed email to database:", dbError);
        }
        if (registration.region === "West Rayalaseema") {
          results.westRayalaseema.failed++;
        } else if (registration.region === "East Rayalaseema") {
          results.eastRayalaseema.failed++;
        }
        console.log(`✗ Resend ${i + 1}/${registrations.length} failed for ${registration.email}: ${emailResult.error}`);
      }
      
      // Add delay before next email (except for the last one)
      if (i < registrations.length - 1) {
        const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
        console.log(`⏳ Waiting ${delay / 1000} seconds before next email...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    res.json({
      success: true,
      message: "Resend emails completed",
      data: results
    });
    
  } catch (err) {
    console.error("Error resending failed emails:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET SINGLE CUSTOMER DETAILS
router.get("/customer/:id", async (req, res) => {
  try {
    const customer = await Payment.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    res.json({ success: true, data: customer });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// 3) Get summary
router.get("/summary", async (req, res) => {
  try {
    const { region } = req.query;
    const query = region ? { region } : {};
    const payments = await Payment.find(query);
    const totalAmount = payments.reduce((s, p) => s + (p.totalAmount || 0), 0);
    const totalPaid = payments.reduce((s, p) => s + (p.amountPaid || 0), 0);
    const balance = totalAmount - totalPaid;
    res.json({ totalAmount, totalPaid, balance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get registrar payment summary (detailed)
router.get("/registrar/payment-summary", async (req, res) => {
  try {
    const { region } = req.query;
    if (!region) {
      return res.status(400).json({ error: "Region is required" });
    }

    // Get all payments for the region
    const payments = await Payment.find({ region, registrationStatus: "approved" });
    
    // Calculate payment totals
    const totalAmount = payments.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
    const totalPaid = payments.reduce((sum, p) => sum + (p.amountPaid || 0), 0);
    const totalBalance = payments.reduce((sum, p) => sum + (p.balance || 0), 0);

    // Get worker requests total for the region
    // Note: WorkerRequest doesn't have region field, so we'll get all
    const workerRequests = await WorkerRequest.find();
    const workerRequestedTotal = workerRequests.reduce((sum, w) => sum + (w.amount || 0), 0);
    const workerPaidTotal = workerRequests
      .filter(w => w.status === "paid")
      .reduce((sum, w) => sum + (w.amount || 0), 0);

    // Get payment requests (from coordinators/lac_convener) for the region
    const paymentRequests = await PaymentRequest.find({ region });
    const paymentRequestedTotal = paymentRequests.reduce((sum, pr) => sum + (pr.requestedAmount || 0), 0);
    // Sum all paid amounts (paidAmount field exists in PaymentRequest model)
    const paymentPaidTotal = paymentRequests.reduce((sum, pr) => sum + (pr.paidAmount || 0), 0);

    // Payment details for table
    const paymentDetails = payments.map(p => ({
      _id: p._id,
      name: p.name || p.fullName || "N/A",
      uniqueId: p.uniqueId || "N/A",
      groupType: p.groupType || "N/A",
      totalAmount: p.totalAmount || 0,
      amountPaid: p.amountPaid || 0,
      balance: p.balance || (p.totalAmount || 0) - (p.amountPaid || 0),
    }));

    res.json({
      success: true,
      region,
      paymentDetails,
      summary: {
        totalAmount,
        totalPaid,
        totalBalance,
        workerRequestedTotal,
        workerPaidTotal,
        paymentRequestedTotal,
        paymentPaidTotal,
      }
    });
  } catch (err) {
    console.error("Error in registrar payment summary:", err);
    res.status(500).json({ error: err.message });
  }
});

// 4) Add transaction (installment) to a payment record
router.post("/:id/transaction", async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, note } = req.body;
    if (!amount || isNaN(Number(amount))) return res.status(400).json({ error: "Invalid amount" });

    const payment = await Payment.findById(id);
    if (!payment) return res.status(404).json({ error: "Not found" });

    payment.transactions.push({ amount: Number(amount), note: note || "" });
    payment.recalculate();
    await payment.save();

    res.json(payment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5) Update customer data (edit total or name etc)
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const update = req.body || {};
    const p = await Payment.findById(id);
    if (!p) return res.status(404).json({ error: "Not found" });

    // allow editing name, address, profession, totalAmount
    if (update.name) p.name = update.name;
    if (update.address) p.address = update.address;
    if (update.profession) p.profession = update.profession;
    if (typeof update.totalAmount !== "undefined") p.totalAmount = Number(update.totalAmount);

    // Support payment updates (for pending payment module)
    if (update.transactionId && typeof update.amountPaid !== "undefined") {
      // Calculate the new payment amount (difference between new total and existing)
      const existingAmountPaid = p.amountPaid || 0;
      const newTotalAmountPaid = Number(update.amountPaid);
      const newPaymentAmount = newTotalAmountPaid - existingAmountPaid;
      
      // If there's a new payment, add it to transactions array
      if (newPaymentAmount > 0) {
        if (!p.transactions) p.transactions = [];
        p.transactions.push({
          amount: newPaymentAmount,
          note: `Txn: ${update.transactionId}`,
          date: new Date(update.dateOfPayment || Date.now()),
        });
      }
      
      // Update transaction ID and date (use latest)
      p.transactionId = update.transactionId;
      if (update.dateOfPayment) {
        p.dateOfPayment = update.dateOfPayment;
      }
    }
    // Preserve registration status if provided (to prevent re-approval)
    if (update.registrationStatus) {
      p.registrationStatus = update.registrationStatus;
    }
    // If transactions array is provided directly, update it (for payment history)
    if (update.transactions && Array.isArray(update.transactions)) {
      p.transactions = update.transactions;
    }

    // Recalculate will update amountPaid from transactions array
    p.recalculate();
    await p.save();
    res.json(p);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6) Delete record (optional)
router.delete("/:id", async (req, res) => {
  try {
    await Payment.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cashier marks payment + uploads screenshot
router.post("/pay/:id", upload.any(), async (req, res) => {
  console.log("✔ FILES RECEIVED:", req.files);
    console.log("✔ BODY:", req.body);
  try {
    const updated = await WorkerRequest.findByIdAndUpdate(
      req.params.id,
      {
        status: "paid",
        cashierPaidAt: new Date(),
        $push: { cashierImages: { $each: req.files.map(f => f.filename) } }
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: "Request not found" });
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Cashier payment failed" });
  }
});

// ============================================================
// PAYMENT REQUEST ENDPOINTS - Coordinator/LAC Convener Payment Requests
// ============================================================

// 1. Coordinator/LAC Convener creates payment request
router.post(
  "/payment-request",
  upload.array("requestImages", 5),
  async (req, res) => {
    try {
      const { requestedBy, title, description, requestedAmount, region, requesterRole } = req.body;

      // Validate required fields
      if (!requestedBy || !title || !description || !requestedAmount || !region || !requesterRole) {
        return res.status(400).json({ error: "All fields are required" });
      }

      // Validate requester role
      if (!['coordinator', 'lac_convener'].includes(requesterRole)) {
        return res.status(400).json({ error: "Invalid requester role" });
      }

      // Get requester details
      const requester = await User.findById(requestedBy);
      if (!requester) {
        return res.status(404).json({ error: "Requester not found" });
      }

      const paymentRequest = new PaymentRequest({
        requestedBy: requestedBy,
        requestedByName: requester.name,
        requesterRole: requesterRole,
        region: region,
        title: title,
        description: description,
        requestedAmount: Number(requestedAmount),
        requestImages: req.files ? req.files.map(f => f.filename) : [],
        status: "pending"
      });

      await paymentRequest.save();

      res.json({
        success: true,
        message: "Payment request submitted successfully",
        data: paymentRequest
      });
    } catch (err) {
      console.error("Error creating payment request:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

// 2. Get all payment requests (with filters)
router.get("/payment-requests", async (req, res) => {
  try {
    const { status, region, requesterRole, requestedBy } = req.query;

    const query = {};
    if (status) query.status = status;
    if (region) query.region = region;
    if (requesterRole) query.requesterRole = requesterRole;
    if (requestedBy) query.requestedBy = requestedBy;

    const paymentRequests = await PaymentRequest.find(query)
      .sort({ createdAt: -1 })
      .populate('requestedBy', 'name email')
      .populate('approvedBy', 'name email')
      .populate('paidBy', 'name email');

    res.json({
      success: true,
      data: paymentRequests,
      count: paymentRequests.length
    });
  } catch (err) {
    console.error("Error fetching payment requests:", err);
    res.status(500).json({ error: err.message });
  }
});

// 3. Get single payment request
router.get("/payment-requests/:id", async (req, res) => {
  try {
    const paymentRequest = await PaymentRequest.findById(req.params.id)
      .populate('requestedBy', 'name email role')
      .populate('approvedBy', 'name email')
      .populate('paidBy', 'name email');

    if (!paymentRequest) {
      return res.status(404).json({ error: "Payment request not found" });
    }

    res.json({ success: true, data: paymentRequest });
  } catch (err) {
    console.error("Error fetching payment request:", err);
    res.status(500).json({ error: err.message });
  }
});

// 4. Registrar approves payment request
router.post("/payment-requests/:id/approve", async (req, res) => {
  try {
    const { id } = req.params;
    const { approvedBy } = req.body;

    if (!approvedBy) {
      return res.status(400).json({ error: "Approver ID is required" });
    }

    const paymentRequest = await PaymentRequest.findById(id);
    if (!paymentRequest) {
      return res.status(404).json({ error: "Payment request not found" });
    }

    if (paymentRequest.status !== "pending") {
      return res.status(400).json({ 
        error: `Payment request is already ${paymentRequest.status}` 
      });
    }

    // Get approver details
    const approver = await User.findById(approvedBy);
    if (!approver) {
      return res.status(404).json({ error: "Approver not found" });
    }

    if (approver.role !== "registrar") {
      return res.status(403).json({ error: "Only registrar can approve payment requests" });
    }

    paymentRequest.status = "approved";
    paymentRequest.approvedBy = approvedBy;
    paymentRequest.approvedByName = approver.name;
    paymentRequest.approvedAt = new Date();

    await paymentRequest.save();

    res.json({
      success: true,
      message: "Payment request approved successfully",
      data: paymentRequest
    });
  } catch (err) {
    console.error("Error approving payment request:", err);
    res.status(500).json({ error: err.message });
  }
});

// 5. Registrar rejects payment request
router.post("/payment-requests/:id/reject", async (req, res) => {
  try {
    const { id } = req.params;
    const { approvedBy, rejectionReason } = req.body;

    if (!approvedBy) {
      return res.status(400).json({ error: "Approver ID is required" });
    }

    const paymentRequest = await PaymentRequest.findById(id);
    if (!paymentRequest) {
      return res.status(404).json({ error: "Payment request not found" });
    }

    if (paymentRequest.status !== "pending") {
      return res.status(400).json({ 
        error: `Payment request is already ${paymentRequest.status}` 
      });
    }

    // Get approver details
    const approver = await User.findById(approvedBy);
    if (!approver) {
      return res.status(404).json({ error: "Approver not found" });
    }

    if (approver.role !== "registrar") {
      return res.status(403).json({ error: "Only registrar can reject payment requests" });
    }

    paymentRequest.status = "rejected";
    paymentRequest.approvedBy = approvedBy;
    paymentRequest.approvedByName = approver.name;
    paymentRequest.rejectionReason = rejectionReason || "";
    paymentRequest.rejectedAt = new Date();

    await paymentRequest.save();

    res.json({
      success: true,
      message: "Payment request rejected",
      data: paymentRequest
    });
  } catch (err) {
    console.error("Error rejecting payment request:", err);
    res.status(500).json({ error: err.message });
  }
});

// 6. Cashier uploads payment proof (for approved requests)
router.post(
  "/payment-requests/:id/pay",
  upload.array("paymentProofImages", 5),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { paidBy, paidAmount, paymentNote } = req.body;

      if (!paidBy || !paidAmount) {
        return res.status(400).json({ 
          error: "Paid by and paid amount are required" 
        });
      }

      const paymentRequest = await PaymentRequest.findById(id);
      if (!paymentRequest) {
        return res.status(404).json({ error: "Payment request not found" });
      }

      if (paymentRequest.status !== "approved") {
        return res.status(400).json({ 
          error: `Payment request must be approved before payment. Current status: ${paymentRequest.status}` 
        });
      }

      // Get cashier details
      const cashier = await User.findById(paidBy);
      if (!cashier) {
        return res.status(404).json({ error: "Cashier not found" });
      }

      paymentRequest.status = "paid";
      paymentRequest.paidAmount = Number(paidAmount);
      paymentRequest.paymentProofImages = req.files ? req.files.map(f => f.filename) : [];
      paymentRequest.paidBy = paidBy;
      paymentRequest.paidByName = cashier.name;
      paymentRequest.paidAt = new Date();
      paymentRequest.paymentNote = paymentNote || "";

      await paymentRequest.save();

      res.json({
        success: true,
        message: "Payment proof uploaded successfully",
        data: paymentRequest
      });
    } catch (err) {
      console.error("Error uploading payment proof:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

// 7. Get payment requests for specific role (filtered view)
router.get("/payment-requests/role/:role", async (req, res) => {
  try {
    const { role } = req.params;
    const { userId, region } = req.query;

    let query = {};

    if (role === "registrar") {
      // Registrar sees all pending, approved, and rejected requests
      query.status = { $in: ["pending", "approved", "rejected", "paid"] };
    } else if (role === "coordinator" || role === "lac_convener") {
      // Coordinator/LAC Convener sees their own requests
      if (userId) {
        query.requestedBy = userId;
      }
    } else if (role === "cashier" || role === "treasurer") {
      // Cashier/Treasurer sees approved requests ready for payment
      query.status = "approved";
    }

    if (region) {
      query.region = region;
    }

    const paymentRequests = await PaymentRequest.find(query)
      .sort({ createdAt: -1 })
      .populate('requestedBy', 'name email role')
      .populate('approvedBy', 'name email')
      .populate('paidBy', 'name email');

    res.json({
      success: true,
      data: paymentRequests,
      count: paymentRequests.length
    });
  } catch (err) {
    console.error("Error fetching payment requests by role:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// PAYMENT VALIDATION ENDPOINT - Validate payments from PhonePe PDF
// ============================================================
router.post("/validate-payments", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No PDF file uploaded" });
    }

    const { region } = req.body;
    if (!region) {
      return res.status(400).json({ error: "Region is required" });
    }

    // Read and parse PDF
    const pdfBuffer = fs.readFileSync(req.file.path);
    const pdfData = await pdfParse(pdfBuffer);
    const pdfText = pdfData.text;

    console.log("PDF parsed, extracting transactions...");
    console.log("PDF text length:", pdfText.length);
    console.log("First 500 chars:", pdfText.substring(0, 500));

    // Extract transaction IDs and amounts from PhonePe PDF
    // PhonePe format based on image:
    // - Transaction ID: T2512210706583647360982 (starts with T, followed by digits, usually 20-22 chars)
    // - Amount: ₹250, ₹100, etc. (₹ symbol followed by number, no decimals typically)
    // - Format: "Transaction ID T2512210706583647360982" or "T2512210706583647360982"
    
    const allExtractedTransactions = [];
    
    // Pattern for PhonePe Transaction IDs: T followed by 15-25 digits
    const phonePeTransactionIdPattern = /T\d{15,25}/g;
    
    // Pattern for amounts with ₹ symbol: ₹ followed by number (optional comma separators)
    const amountPattern = /₹\s*(\d{1,3}(?:,\d{2,3})*)/g;
    
    // Split text into lines
    const lines = pdfText.split('\n');
    
    // Strategy: Look for lines containing Transaction IDs (T + digits)
    // Then find the associated amount, which is usually in the same row/line or nearby
    
    // First, find all Transaction IDs in the PDF
    const allTransactionIds = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let match;
      phonePeTransactionIdPattern.lastIndex = 0;
      while ((match = phonePeTransactionIdPattern.exec(line)) !== null) {
        allTransactionIds.push({
          id: match[0],
          lineIndex: i,
          position: match.index
        });
      }
    }
    
    console.log(`Found ${allTransactionIds.length} Transaction IDs in PDF`);
    
    // For each Transaction ID, find the associated amount
    // Amount is usually in the same line or in the "Amount" column on the right
    for (const txIdInfo of allTransactionIds) {
      const { id, lineIndex } = txIdInfo;
      
      // Search in the same line and nearby lines for the amount
      // PhonePe table structure: Transaction ID and Amount are usually on the same row
      const searchRange = [
        lines[Math.max(0, lineIndex - 1)] || '',
        lines[lineIndex] || '',
        lines[Math.min(lines.length - 1, lineIndex + 1)] || ''
      ].join(' ');
      
      // Find amounts in the search range
      const amounts = [];
      let amountMatch;
      amountPattern.lastIndex = 0;
      while ((amountMatch = amountPattern.exec(searchRange)) !== null) {
        const amountStr = amountMatch[1].replace(/,/g, '');
        const amount = parseFloat(amountStr);
        // PhonePe amounts are typically round numbers (no decimals) and reasonable range
        if (!isNaN(amount) && amount > 0 && amount <= 100000 && amount === Math.floor(amount)) {
          amounts.push(amount);
        }
      }
      
      // If we found amounts, use the first one (usually there's only one per transaction)
      if (amounts.length > 0) {
        allExtractedTransactions.push({
          transactionId: id,
          amount: amounts[0]
        });
      } else {
        // If no amount found nearby, try a different approach:
        // Look for amount in the same line after the Transaction ID
        const currentLine = lines[lineIndex];
        const afterTxId = currentLine.substring(currentLine.indexOf(id) + id.length);
        amountPattern.lastIndex = 0;
        const amountMatchAfter = amountPattern.exec(afterTxId);
        if (amountMatchAfter) {
          const amountStr = amountMatchAfter[1].replace(/,/g, '');
          const amount = parseFloat(amountStr);
          if (!isNaN(amount) && amount > 0 && amount <= 100000) {
            allExtractedTransactions.push({
              transactionId: id,
              amount: amount
            });
          }
        }
      }
    }
    
    // Remove duplicates (same transaction ID)
    const uniqueTransactions = [];
    const seenIds = new Set();
    for (const tx of allExtractedTransactions) {
      if (!seenIds.has(tx.transactionId)) {
        seenIds.add(tx.transactionId);
        uniqueTransactions.push(tx);
      }
    }
    
    console.log(`Extracted ${uniqueTransactions.length} unique transactions:`, uniqueTransactions.slice(0, 10));
    
    const extractedTransactions = uniqueTransactions;

    // Get all registrations for the specified region
    const registrations = await Payment.find({ region }).lean();

    console.log(`Found ${registrations.length} registrations for region: ${region}`);

    // Validate transactions
    const validated = [];
    const nonValidated = [];
    
    // Create a map of transaction IDs from PDF for quick lookup
    const pdfTransactionMap = new Map();
    extractedTransactions.forEach(tx => {
      const normalizedTxId = tx.transactionId.trim().toUpperCase();
      if (!pdfTransactionMap.has(normalizedTxId)) {
        pdfTransactionMap.set(normalizedTxId, []);
      }
      pdfTransactionMap.get(normalizedTxId).push(tx.amount);
    });

    // Check each registration against PDF transactions
    registrations.forEach(reg => {
      if (!reg.transactionId || !reg.amountPaid) {
        nonValidated.push({
          ...reg,
          validationReason: "Transaction ID or Amount not found in registration"
        });
        return;
      }

      // Normalize transaction ID - remove whitespace, convert to uppercase
      const regTxId = (reg.transactionId || '').trim().toUpperCase();
      const regAmount = Number(reg.amountPaid);

      console.log(`Checking registration: ${reg.uniqueId || reg.name}, TX ID: ${regTxId}, Amount: ${regAmount}`);
      console.log(`Available PDF TX IDs (sample):`, Array.from(pdfTransactionMap.keys()).slice(0, 5));

      // Check if transaction ID exists in PDF
      if (!pdfTransactionMap.has(regTxId)) {
        // Try to find partial matches or similar IDs for debugging
        const similarIds = Array.from(pdfTransactionMap.keys()).filter(pdfId => 
          pdfId.includes(regTxId.substring(0, 10)) || regTxId.includes(pdfId.substring(0, 10))
        );
        
        nonValidated.push({
          ...reg,
          validationReason: `Transaction ID not found in PDF. Looking for: ${regTxId}${similarIds.length > 0 ? `. Similar IDs found: ${similarIds.slice(0, 3).join(', ')}` : ''}`
        });
        return;
      }

      // Check if amount matches
      const pdfAmounts = pdfTransactionMap.get(regTxId);
      const amountMatches = pdfAmounts.some(pdfAmount => 
        Math.abs(pdfAmount - regAmount) < 0.01 // Allow small floating point differences
      );

      if (!amountMatches) {
        nonValidated.push({
          ...reg,
          validationReason: `Amount mismatch. Expected: ₹${regAmount}, Found in PDF: ₹${pdfAmounts.join(', ₹')}`
        });
        return;
      }

      // Both transaction ID and amount match
      console.log(`✓ Validated: ${reg.uniqueId || reg.name} - TX ID: ${regTxId}, Amount: ₹${regAmount}`);
      validated.push(reg);
    });

    // Clean up uploaded PDF file
    try {
      fs.unlinkSync(req.file.path);
    } catch (unlinkErr) {
      console.error("Error deleting PDF file:", unlinkErr);
    }

    res.json({
      success: true,
      data: {
        validated,
        nonValidated,
        extractedCount: extractedTransactions.length,
        validatedCount: validated.length,
        nonValidatedCount: nonValidated.length
      }
    });

  } catch (err) {
    console.error("Error validating payments:", err);
    
    // Clean up uploaded PDF file on error
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkErr) {
        console.error("Error deleting PDF file:", unlinkErr);
      }
    }
    
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
