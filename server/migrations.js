const { db } = require("./db");

function runMigrations() {
  db.prepare(
    `CREATE TABLE IF NOT EXISTS registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cloudId TEXT UNIQUE,
      customerId TEXT,
      firstName TEXT NOT NULL DEFAULT '',
      lastName TEXT DEFAULT '',
      email TEXT NOT NULL UNIQUE,
      mobile TEXT DEFAULT '',
      organization TEXT DEFAULT '',
      designation TEXT DEFAULT '',
      avatarUrl TEXT DEFAULT 'https://cdn.vosmos.live/VEP/assests/dummy.png',
      roleId TEXT,
      eventId TEXT,
      campaignSource TEXT,
      amount REAL DEFAULT 0,
      paymentStatus TEXT DEFAULT 'Pending',
      type TEXT DEFAULT 'attendee',
      appType TEXT,
      isCheckedIn INTEGER DEFAULT 0,
      checkedInTime TEXT,
      isActive INTEGER DEFAULT 1,
      isLoginAllowed INTEGER DEFAULT 0,
      moderator INTEGER DEFAULT 0,
      attend INTEGER DEFAULT 0,
      primeMember INTEGER DEFAULT 0,
      termsAndCondn INTEGER DEFAULT 0,
      isPrintClicked INTEGER DEFAULT 0,
      areaOfInterest TEXT DEFAULT '[]',
      customfields TEXT,
      timestamp TEXT NOT NULL
    )`,
  ).run();

  // Rename old snake_case columns to camelCase (for existing databases)
  const existingColumns = db
    .prepare("PRAGMA table_info(registrations)")
    .all()
    .map((c) => c.name);

  const renames = [
    ["cloud_id", "cloudId"],
    ["customer_id", "customerId"],
    ["first_name", "firstName"],
    ["last_name", "lastName"],
    ["avatar_url", "avatarUrl"],
    ["role_id", "roleId"],
    ["event_id", "eventId"],
    ["campaign_source", "campaignSource"],
    ["payment_status", "paymentStatus"],
    ["app_type", "appType"],
    ["is_checked_in", "isCheckedIn"],
    ["isCheckedIned_in", "isCheckedIn"], // fix previous typo if present
    ["checked_in_time", "checkedInTime"],
    ["is_active", "isActive"],
    ["is_login_allowed", "isLoginAllowed"],
    ["prime_member", "primeMember"],
    ["terms_and_condn", "termsAndCondn"],
    ["is_print_clicked", "isPrintClicked"],
    ["area_of_interest", "areaOfInterest"],
  ];

  for (const [oldName, newName] of renames) {
    if (existingColumns.includes(oldName) && !existingColumns.includes(newName)) {
      db.prepare(
        `ALTER TABLE registrations RENAME COLUMN ${oldName} TO ${newName}`,
      ).run();
    }
  }

  // Re-fetch after renames
  const updatedColumns = db
    .prepare("PRAGMA table_info(registrations)")
    .all()
    .map((c) => c.name);

  // Add any missing columns to existing databases
  const columnsToAdd = [
    ["customerId", "TEXT"],
    ["firstName", "TEXT DEFAULT ''"],
    ["lastName", "TEXT DEFAULT ''"],
    ["mobile", "TEXT DEFAULT ''"],
    ["organization", "TEXT DEFAULT ''"],
    ["designation", "TEXT DEFAULT ''"],
    ["avatarUrl", `TEXT DEFAULT 'https://cdn.vosmos.live/VEP/assests/dummy.png'`],
    ["roleId", "TEXT"],
    ["eventId", "TEXT"],
    ["campaignSource", "TEXT"],
    ["amount", "REAL DEFAULT 0"],
    ["paymentStatus", "TEXT DEFAULT 'Pending'"],
    ["type", "TEXT DEFAULT 'attendee'"],
    ["appType", "TEXT"],
    ["isCheckedIn", "INTEGER DEFAULT 0"],
    ["checkedInTime", "TEXT"],
    ["isActive", "INTEGER DEFAULT 1"],
    ["isLoginAllowed", "INTEGER DEFAULT 0"],
    ["moderator", "INTEGER DEFAULT 0"],
    ["attend", "INTEGER DEFAULT 0"],
    ["primeMember", "INTEGER DEFAULT 0"],
    ["termsAndCondn", "INTEGER DEFAULT 0"],
    ["isPrintClicked", "INTEGER DEFAULT 0"],
    ["areaOfInterest", "TEXT DEFAULT '[]'"],
    ["customfields", "TEXT"],
  ];

  for (const [col, def] of columnsToAdd) {
    if (!updatedColumns.includes(col)) {
      db.prepare(`ALTER TABLE registrations ADD COLUMN ${col} ${def}`).run();
    }
  }

  db.prepare(
    `CREATE TABLE IF NOT EXISTS sync_state (
      eventId TEXT PRIMARY KEY,
      last_sync TEXT
    )`,
  ).run();

  // Migrate old single-row sync_state to new eventId-keyed schema
  {
    const cols = db.prepare("PRAGMA table_info(sync_state)").all().map((c) => c.name);
    if (!cols.includes("eventId")) {
      db.prepare(`ALTER TABLE sync_state ADD COLUMN eventId TEXT`).run();
    }
    if (cols.includes("id")) {
      // Move existing row under empty-string key so old data isn't lost
      db.prepare(`UPDATE sync_state SET eventId = '' WHERE eventId IS NULL`).run();
    }
  }

  db.prepare(
    `CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT,
      payload TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT
    )`,
  ).run();

  db.prepare(
    `CREATE TABLE IF NOT EXISTS attendee_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cloud_id TEXT UNIQUE,
      event_id TEXT,
      name TEXT NOT NULL,
      display_name TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      can_be_deleted INTEGER DEFAULT 1,
      created_at TEXT,
      updated_at TEXT
    )`,
  ).run();

  db.prepare(
    `CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )`,
  ).run();

  db.prepare(
    `CREATE TABLE IF NOT EXISTS push_pending (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      registration_id INTEGER NOT NULL,
      eventId TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      UNIQUE(registration_id, eventId)
    )`,
  ).run();

  // Migrate old push_pending: add eventId column if missing
  {
    const cols = db.prepare("PRAGMA table_info(push_pending)").all().map((c) => c.name);
    if (!cols.includes("eventId")) {
      db.prepare(`ALTER TABLE push_pending ADD COLUMN eventId TEXT NOT NULL DEFAULT ''`).run();
    }
  }

  db.prepare(
    `CREATE TABLE IF NOT EXISTS badge_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cloud_id TEXT UNIQUE,
      event_id TEXT,
      name TEXT,
      type TEXT,
      width INTEGER DEFAULT 320,
      height INTEGER DEFAULT 450,
      bg_img TEXT DEFAULT '',
      font_family TEXT DEFAULT 'Arial',
      elements TEXT DEFAULT '[]',
      created_at TEXT,
      updated_at TEXT
    )`,
  ).run();

  db.prepare(
    `CREATE TABLE IF NOT EXISTS registration_forms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cloud_id TEXT UNIQUE,
      event_id TEXT,
      attendee_type_name TEXT NOT NULL,
      type TEXT DEFAULT 'type1',
      is_registration_page_required INTEGER DEFAULT 1,
      no_registration_email INTEGER DEFAULT 0,
      no_email_for_event INTEGER DEFAULT 0,
      page_section TEXT DEFAULT '[]',
      is_enable_before INTEGER DEFAULT 0,
      confirmation_pass_required INTEGER DEFAULT 0,
      custom_fields TEXT DEFAULT '[]',
      attendee_types TEXT DEFAULT '[]',
      created_at TEXT,
      updated_at TEXT
    )`,
  ).run();

  db.prepare(
    `CREATE TABLE IF NOT EXISTS sdk_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sdk_cloud_path TEXT NOT NULL,
      sdk_local_path TEXT DEFAULT '',
      type TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  ).run();
}

module.exports = runMigrations;
