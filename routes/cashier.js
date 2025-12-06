const express = require("express");
const multer = require("multer");
const xlsx = require("xlsx");
const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");

const Payment = require("../models/Payment");
const WorkerRequest = require("../models/workerRequest");

const router = express.Router();

// ==== Email Configuration ====
// Configure nodemailer transporters for each region
// You'll need to set these environment variables in your .env file:
// EMAIL_HOST, EMAIL_PORT (optional, defaults to Gmail)
// WEST_EMAIL_PASS - App password for spicon.apwr@gmail.com
// EAST_EMAIL_PASS - App password for Spicom.aper@gmail.com

// West Rayalaseema email transporter
const westTransporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: process.env.EMAIL_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: "spicon.apwr@gmail.com",
        pass: process.env.WEST_EMAIL_PASS, // App password for West email
    },
});

// East Rayalaseema email transporter
const eastTransporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: process.env.EMAIL_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: "spicon.aper@gmail.com",
        pass: process.env.EAST_EMAIL_PASS, // App password for East email
    },
});

// Function to get transporter and sender email based on region
function getEmailConfig(region) {
    if (region === "West Rayalaseema") {
        return {
            transporter: westTransporter,
            senderEmail: "spicon.apwr@gmail.com"
        };
    } else if (region === "East Rayalaseema") {
        return {
            transporter: eastTransporter,
            senderEmail: "spicon.aper@gmail.com"
        };
    }
    // Fallback to West if region doesn't match
    return {
        transporter: westTransporter,
        senderEmail: "spicon.apwr@gmail.com"
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
            subject: "Thank You for Registering for SPICON-2026",
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
        console.error("Error sending email:", error);
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
            subject: "SPICON-2026 Registration Confirmation & Invitation",
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
        console.error("Error sending approval email:", error);
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

// ==== Multer Storage ====
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, "../uploads");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
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

//--------------------------------------------------
// DELETE CUSTOMER / REGISTRATION
//--------------------------------------------------
router.delete("/registrations/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const record = await Payment.findById(id);
    if (!record) {
      return res.status(404).json({ success: false, error: "Customer not found" });
    }

    // If screenshot exists you can also delete from uploads folder (Optional)
    /*
    if (record.paymentScreenshot) {
      const fs = require("fs");
      const filePath = `uploads/${record.paymentScreenshot}`;
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    */

    await Payment.findByIdAndDelete(id);

    return res.json({ success: true, message: "Registration deleted successfully" });
  } catch (err) {
    console.error("DELETE ERROR:", err);
    res.status(500).json({ success: false, error: "Server error while deleting" });
  }
});




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
    const payments = await Payment.find();
    const totalAmount = payments.reduce((s, p) => s + (p.totalAmount || 0), 0);
    const totalPaid = payments.reduce((s, p) => s + (p.paidAmount || 0), 0);
    const balance = totalAmount - totalPaid;
    res.json({ totalAmount, totalPaid, balance });
  } catch (err) {
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





module.exports = router;