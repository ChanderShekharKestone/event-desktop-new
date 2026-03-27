const router = require("express").Router();
const { db } = require("../db");
const settings = require("../settings");

const FIRST_NAMES = [
  "Aarav",
  "Aditya",
  "Akash",
  "Amit",
  "Ananya",
  "Anjali",
  "Ankit",
  "Arjun",
  "Aryan",
  "Ayaan",
  "Bhavya",
  "Chirag",
  "Deepak",
  "Deepika",
  "Dhruv",
  "Divya",
  "Gaurav",
  "Harsh",
  "Ishaan",
  "Isha",
  "Jay",
  "Kavya",
  "Kiran",
  "Kunal",
  "Lakshmi",
  "Manish",
  "Meera",
  "Mihir",
  "Mohit",
  "Naina",
  "Neha",
  "Nikhil",
  "Nitin",
  "Pankaj",
  "Pooja",
  "Priya",
  "Rahul",
  "Raj",
  "Riya",
  "Rohit",
  "Sachin",
  "Sahil",
  "Sanjay",
  "Sara",
  "Shivam",
  "Shreya",
  "Sneha",
  "Suresh",
  "Tanvi",
  "Varun",
  "Vikram",
  "Virat",
  "Yash",
  "Zara",
  "Abhinav",
  "Aishwarya",
  "Alok",
  "Amrita",
  "Anand",
  "Ankita",
  "Arun",
  "Ashish",
  "Bharat",
  "Chetan",
  "Devika",
  "Dinesh",
  "Ekta",
  "Farhan",
  "Geeta",
  "Girish",
  "Harsha",
  "Hemant",
  "Imran",
  "Jyoti",
  "Kamal",
  "Kartik",
  "Kewal",
  "Lalit",
  "Leena",
  "Madhav",
  "Mahesh",
  "Manju",
  "Manoj",
  "Mayank",
  "Mukesh",
  "Nandini",
  "Naveen",
  "Neeraj",
  "Pallavi",
  "Parag",
];

const LAST_NAMES = [
  "Sharma",
  "Verma",
  "Singh",
  "Kumar",
  "Patel",
  "Gupta",
  "Shah",
  "Joshi",
  "Mehta",
  "Nair",
  "Rao",
  "Reddy",
  "Iyer",
  "Pillai",
  "Menon",
  "Chauhan",
  "Tiwari",
  "Pandey",
  "Mishra",
  "Dubey",
  "Sinha",
  "Yadav",
  "Agarwal",
  "Bansal",
  "Kapoor",
  "Malhotra",
  "Khanna",
  "Bhatia",
  "Chopra",
  "Bajaj",
  "Saxena",
  "Tripathi",
  "Shukla",
  "Srivastava",
  "Bose",
  "Das",
  "Ghosh",
  "Roy",
  "Chatterjee",
  "Mukherjee",
  "Desai",
  "Thakur",
  "More",
  "Patil",
  "Kulkarni",
  "Jadhav",
  "Shinde",
  "Kadam",
  "Gaikwad",
  "Pawar",
];

const ORGANIZATIONS = [
  "Infosys",
  "TCS",
  "Wipro",
  "HCL Technologies",
  "Tech Mahindra",
  "Cognizant",
  "Accenture",
  "Capgemini",
  "IBM India",
  "Oracle India",
  "Microsoft India",
  "Google India",
  "Amazon India",
  "Flipkart",
  "Swiggy",
  "Zomato",
  "Razorpay",
  "Zerodha",
  "PhonePe",
  "Paytm",
  "HDFC Bank",
  "ICICI Bank",
  "Axis Bank",
  "Reliance Industries",
  "Tata Group",
  "Mahindra",
  "Bajaj Auto",
  "Maruti Suzuki",
  "Hero MotoCorp",
  "Freshworks",
  "Zoho",
  "MakeMyTrip",
  "OYO Rooms",
  "Ola Cabs",
  "Urban Company",
  "Nykaa",
  "Meesho",
];

const DESIGNATIONS = [
  "Software Engineer",
  "Senior Developer",
  "Product Manager",
  "Engineering Manager",
  "Tech Lead",
  "Data Scientist",
  "UX Designer",
  "DevOps Engineer",
  "QA Engineer",
  "Business Analyst",
  "Marketing Manager",
  "Sales Executive",
  "HR Manager",
  "Finance Analyst",
  "Operations Head",
  "CTO",
  "CEO",
  "VP Engineering",
  "Director of Product",
  "Principal Architect",
  "Full Stack Developer",
  "Mobile Developer",
  "Cloud Architect",
  "ML Engineer",
  "SRE",
];

const CAMPAIGN_SOURCES = [
  "organic",
  "email",
  "linkedin",
  "twitter",
  "referral",
  "website",
  "partner",
  "ads",
  "event",
  "direct",
];
const PAYMENT_STATUSES = ["Confirmed", "Pending", "Free"];

function rand(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// POST /api/seed — insert N fake registrations
router.post("/", (req, res) => {
  try {
    const eventId = settings.get("eventId");
    if (!eventId) {
      return res.status(401).json({ status: 401, message: "Not activated" });
    }

    const count = Math.min(parseInt(req.body?.count) || 1000, 5000);

    const types = db
      .prepare(
        "SELECT name FROM attendee_types WHERE is_active = 1 AND event_id = ?",
      )
      .all(eventId)
      .map((r) => r.name);

    if (!types.length) {
      return res
        .status(400)
        .json({
          status: 400,
          message: "No attendee types found. Pull attendee types first.",
        });
    }

    const insert = db.prepare(`
      INSERT OR IGNORE INTO registrations
        (cloudId, customerId, firstName, lastName, email, mobile, organization, designation,
         avatarUrl, roleId, eventId, campaignSource, amount, paymentStatus, type,
         isCheckedIn, checkedInTime, isActive, isPrintClicked, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `);

    let inserted = 0;
    db.transaction(() => {
      for (let i = 1; i <= count; i++) {
        const firstName = rand(FIRST_NAMES);
        const lastName = rand(LAST_NAMES);
        const domain = rand([
          "gmail.com",
          "yahoo.com",
          "outlook.com",
          "hotmail.com",
          "mail.in",
          "example.com",
        ]);
        const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@${domain}`;
        const type = types[i % types.length];
        const isCheckedIn = Math.random() < 0.35 ? 1 : 0;
        const isPrintClicked = isCheckedIn && Math.random() < 0.6 ? 1 : 0;
        const daysAgo = Math.floor(Math.random() * 60);
        const timestamp = new Date(
          Date.now() - daysAgo * 86400000 - Math.random() * 86400000,
        ).toISOString();

        insert.run(
          `seed-${Date.now()}-${i}`,
          `cust-${i}`,
          firstName,
          lastName,
          email,
          `+91${Math.floor(7000000000 + Math.random() * 2999999999)}`,
          rand(ORGANIZATIONS),
          rand(DESIGNATIONS),
          "https://cdn.vosmos.live/VEP/assests/dummy.png",
          null,
          eventId,
          rand(CAMPAIGN_SOURCES),
          Math.random() < 0.3 ? Math.floor(Math.random() * 5000) : 0,
          rand(PAYMENT_STATUSES),
          type,
          isCheckedIn,
          isCheckedIn ? timestamp : null,
          isPrintClicked,
          timestamp,
        );
        inserted++;
      }
    })();

    res.json({
      status: 200,
      message: `Seeded ${inserted} registrations`,
      data: { inserted, types },
    });
  } catch (err) {
    res.status(500).json({ status: 500, message: err.message, data: null });
  }
});

// DELETE /api/seed — remove all seeded registrations
router.delete("/", (req, res) => {
  try {
    const eventId = settings.get("eventId");
    const result = db
      .prepare(
        `DELETE FROM registrations WHERE cloudId LIKE 'seed-%' AND eventId = ?`,
      )
      .run(eventId);
    res.json({
      status: 200,
      message: `Removed ${result.changes} seeded registrations`,
      data: { removed: result.changes },
    });
  } catch (err) {
    res.status(500).json({ status: 500, message: err.message, data: null });
  }
});

// DELETE /api/seed/event — wipe ALL data for current event
router.delete("/event", (req, res) => {
  try {
    const eventId = settings.get("eventId");
    if (!eventId) {
      return res.status(401).json({ status: 401, message: "Not activated" });
    }

    const summary = db.transaction(() => {
      const r1 = db
        .prepare(`DELETE FROM registrations WHERE eventId = ?`)
        .run(eventId);
      const r2 = db
        .prepare(`DELETE FROM attendee_types WHERE event_id = ?`)
        .run(eventId);
      const r3 = db
        .prepare(`DELETE FROM badge_templates WHERE event_id = ?`)
        .run(eventId);
      const r4 = db
        .prepare(`DELETE FROM registration_forms WHERE event_id = ?`)
        .run(eventId);
      const r5 = db
        .prepare(`DELETE FROM sync_state WHERE eventId = ?`)
        .run(eventId);
      const r6 = db
        .prepare(`DELETE FROM sync_queue WHERE eventId = ?`)
        .run(eventId);
      const r7 = db
        .prepare(`DELETE FROM push_pending WHERE eventId = ?`)
        .run(eventId);
      return {
        registrations: r1.changes,
        attendeeTypes: r2.changes,
        badgeTemplates: r3.changes,
        registrationForms: r4.changes,
        syncState: r5.changes,
        syncQueue: r6.changes,
        pushPending: r7.changes,
      };
    })();

    res.json({
      status: 200,
      message: `All event data cleared for eventId: ${eventId}`,
      data: summary,
    });
  } catch (err) {
    res.status(500).json({ status: 500, message: err.message, data: null });
  }
});

module.exports = router;
