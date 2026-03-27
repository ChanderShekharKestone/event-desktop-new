/**
 * Seed script — generates 1000 fake registrations distributed across attendee types.
 * Run: node server/seed.js
 */

const { db } = require("./db");
const { getDbPaths } = require("./dbPaths");
const runMigrations = require("./migrations");
const settings = require("./settings");

runMigrations();

const FIRST_NAMES = [
  "Aarav","Aditya","Akash","Amit","Ananya","Anjali","Ankit","Arjun","Aryan","Ayaan",
  "Bhavya","Chirag","Deepak","Deepika","Dhruv","Divya","Gaurav","Harsh","Ishaan","Isha",
  "Jay","Kavya","Kiran","Kunal","Lakshmi","Manish","Meera","Mihir","Mohit","Naina",
  "Neha","Nikhil","Nitin","Pankaj","Pooja","Priya","Rahul","Raj","Riya","Rohit",
  "Sachin","Sahil","Sanjay","Sara","Shivam","Shreya","Sneha","Suresh","Tanvi","Varun",
  "Vikram","Virat","Yash","Zara","Abhinav","Aishwarya","Alok","Amrita","Anand","Ankita",
  "Arun","Ashish","Bharat","Chetan","Devika","Dinesh","Ekta","Farhan","Geeta","Girish",
  "Harsha","Hemant","Imran","Jyoti","Kamal","Kartik","Kewal","Lalit","Leena","Madhav",
  "Mahesh","Manju","Manoj","Mayank","Mukesh","Nandini","Naveen","Neeraj","Pallavi","Parag",
  "Piyush","Prakash","Pranav","Preeti","Pritam","Radhika","Rajesh","Rakesh","Ramesh","Rashmi",
];

const LAST_NAMES = [
  "Sharma","Verma","Singh","Kumar","Patel","Gupta","Shah","Joshi","Mehta","Nair",
  "Rao","Reddy","Iyer","Pillai","Menon","Chauhan","Tiwari","Pandey","Mishra","Dubey",
  "Sinha","Yadav","Agarwal","Bansal","Kapoor","Malhotra","Khanna","Bhatia","Chopra","Bajaj",
  "Saxena","Tripathi","Shukla","Srivastava","Bose","Das","Ghosh","Roy","Chatterjee","Mukherjee",
  "Desai","Thakur","More","Patil","Kulkarni","Jadhav","Shinde","Kadam","Gaikwad","Pawar",
  "Nair","Pillai","Krishnan","Subramaniam","Rajan","Venkatesh","Naidu","Choudhary","Ansari","Khan",
];

const ORGANIZATIONS = [
  "Infosys","TCS","Wipro","HCL Technologies","Tech Mahindra","Cognizant","Accenture","Capgemini",
  "IBM India","Oracle India","Microsoft India","Google India","Amazon India","Flipkart","Swiggy",
  "Zomato","Byju's","Razorpay","Zerodha","PhonePe","Paytm","HDFC Bank","ICICI Bank","Axis Bank",
  "Reliance Industries","Tata Group","Mahindra","Bajaj Auto","Maruti Suzuki","Hero MotoCorp",
  "ONGC","BHEL","NTPC","Coal India","Air India","IndiGo Airlines","Nykaa","Meesho","Unacademy",
  "Freshworks","Zoho","MakeMyTrip","OYO Rooms","Ola Cabs","Urban Company","Lenskart","CureFit",
];

const DESIGNATIONS = [
  "Software Engineer","Senior Developer","Product Manager","Engineering Manager","Tech Lead",
  "Data Scientist","UX Designer","DevOps Engineer","QA Engineer","Business Analyst",
  "Marketing Manager","Sales Executive","HR Manager","Finance Analyst","Operations Head",
  "CTO","CEO","COO","VP Engineering","Director of Product","Principal Architect",
  "Full Stack Developer","Mobile Developer","Cloud Architect","Security Engineer",
  "Content Strategist","Growth Hacker","Research Scientist","ML Engineer","SRE",
];

const CAMPAIGN_SOURCES = ["organic","email","linkedin","twitter","referral","website","partner","ads","event","direct"];

function rand(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randBool(prob = 0.5) {
  return Math.random() < prob ? 1 : 0;
}

function uniqueEmail(firstName, lastName, idx) {
  const domain = rand(["gmail.com","yahoo.com","outlook.com","hotmail.com","company.io","work.co","mail.in","example.com"]);
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}${idx}@${domain}`;
}

// Get eventId
const eventId = settings.get("eventId");
if (!eventId) {
  console.error("No eventId found in settings. Please activate the app first.");
  process.exit(1);
}

// Get attendee types
const types = db.prepare("SELECT name FROM attendee_types WHERE is_active = 1 AND event_id = ?").all(eventId).map((r) => r.name);
if (!types.length) {
  console.error("No attendee types found. Pull attendee types from Settings first.");
  process.exit(1);
}

console.log(`EventId: ${eventId}`);
console.log(`Attendee types: ${types.join(", ")}`);
console.log("Generating 1000 registrations...");

const insert = db.prepare(`
  INSERT OR IGNORE INTO registrations
    (cloudId, customerId, firstName, lastName, email, mobile, organization, designation,
     avatarUrl, roleId, eventId, campaignSource, amount, paymentStatus, type,
     isCheckedIn, checkedInTime, isActive, isPrintClicked, timestamp)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
`);

const seedMany = db.transaction(() => {
  let inserted = 0;
  for (let i = 1; i <= 1000; i++) {
    const firstName = rand(FIRST_NAMES);
    const lastName  = rand(LAST_NAMES);
    const email     = uniqueEmail(firstName, lastName, i);
    const type      = types[i % types.length]; // distribute evenly
    const isCheckedIn = randBool(0.35);
    const isPrintClicked = isCheckedIn ? randBool(0.6) : 0;
    const daysAgo = Math.floor(Math.random() * 60);
    const timestamp = new Date(Date.now() - daysAgo * 86400000 - Math.random() * 86400000).toISOString();

    insert.run(
      `seed-${i}-${Date.now()}`,                         // cloudId
      `cust-${i}`,                                       // customerId
      firstName,
      lastName,
      email,
      `+91${Math.floor(7000000000 + Math.random() * 2999999999)}`, // mobile
      rand(ORGANIZATIONS),
      rand(DESIGNATIONS),
      "https://cdn.vosmos.live/VEP/assests/dummy.png",  // avatarUrl
      null,                                              // roleId
      eventId,
      rand(CAMPAIGN_SOURCES),
      Math.random() < 0.3 ? Math.floor(Math.random() * 5000) : 0, // amount
      rand(["Confirmed","Pending","Free"]),              // paymentStatus
      type,
      isCheckedIn ? 1 : 0,
      isCheckedIn ? timestamp : null,                   // checkedInTime
      isPrintClicked,
      timestamp,
    );
    inserted++;
  }
  console.log(`Done — ${inserted} rows inserted (duplicates silently skipped).`);
});

seedMany();
