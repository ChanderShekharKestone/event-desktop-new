const { db } = require("./db");

function runMigrations() {
  db.prepare(
    `CREATE TABLE IF NOT EXISTS registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cloudId TEXT UNIQUE,
      customerId TEXT,
      firstName TEXT NOT NULL DEFAULT '',
      lastName TEXT DEFAULT '',
      email TEXT NOT NULL,
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
      timestamp TEXT NOT NULL,
      UNIQUE(email, eventId)
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

  // Migrate email UNIQUE (global) → UNIQUE(email, eventId)
  // Detect by checking if a standalone unique index on email exists
  {
    const indexes = db.prepare("PRAGMA index_list(registrations)").all();
    const hasGlobalEmailUnique = indexes.some((idx) => {
      if (!idx.unique) return false;
      const cols = db.prepare(`PRAGMA index_info(${idx.name})`).all().map((c) => c.name);
      return cols.length === 1 && cols[0] === "email";
    });

    if (hasGlobalEmailUnique) {
      db.transaction(() => {
        db.prepare(`CREATE TABLE registrations_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          cloudId TEXT UNIQUE,
          customerId TEXT,
          firstName TEXT NOT NULL DEFAULT '',
          lastName TEXT DEFAULT '',
          email TEXT NOT NULL,
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
          timestamp TEXT NOT NULL,
          UNIQUE(email, eventId)
        )`).run();
        db.prepare(`INSERT OR IGNORE INTO registrations_new SELECT * FROM registrations`).run();
        db.prepare(`DROP TABLE registrations`).run();
        db.prepare(`ALTER TABLE registrations_new RENAME TO registrations`).run();
      })();
    }
  }

  db.prepare(
    `CREATE TABLE IF NOT EXISTS sync_state (
      eventId TEXT PRIMARY KEY,
      last_sync TEXT
    )`,
  ).run();

  // Migrate old sync_state to eventId-keyed schema with PRIMARY KEY
  {
    const cols = db.prepare("PRAGMA table_info(sync_state)").all();
    const hasIdCol = cols.some((c) => c.name === "id");
    const eventIdCol = cols.find((c) => c.name === "eventId");
    const eventIdIsPK = eventIdCol?.pk > 0;

    if (hasIdCol || (eventIdCol && !eventIdIsPK)) {
      // Old schema — recreate with eventId as PRIMARY KEY, preserve last_sync
      const oldRow = db.prepare(`SELECT last_sync FROM sync_state LIMIT 1`).get();
      db.transaction(() => {
        db.prepare(`DROP TABLE sync_state`).run();
        db.prepare(`CREATE TABLE sync_state (eventId TEXT PRIMARY KEY, last_sync TEXT)`).run();
        if (oldRow?.last_sync) {
          db.prepare(`INSERT INTO sync_state (eventId, last_sync) VALUES ('', ?)`).run(oldRow.last_sync);
        }
      })();
    }
  }

  db.prepare(
    `CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT,
      payload TEXT,
      eventId TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      created_at TEXT
    )`,
  ).run();

  // Migrate sync_queue: add eventId column if missing
  {
    const cols = db.prepare("PRAGMA table_info(sync_queue)").all().map((c) => c.name);
    if (!cols.includes("eventId")) {
      db.prepare(`ALTER TABLE sync_queue ADD COLUMN eventId TEXT DEFAULT ''`).run();
    }
  }

  db.prepare(
    `CREATE TABLE IF NOT EXISTS attendee_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cloud_id TEXT,
      event_id TEXT,
      name TEXT NOT NULL,
      display_name TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      can_be_deleted INTEGER DEFAULT 1,
      created_at TEXT,
      updated_at TEXT,
      UNIQUE(cloud_id, event_id)
    )`,
  ).run();

  // Migrate attendee_types: if global cloud_id UNIQUE exists, recreate with composite key
  {
    const atIndexes = db.prepare("PRAGMA index_list(attendee_types)").all();
    const hasGlobalCloudIdUnique = atIndexes.some((idx) => {
      if (!idx.unique) return false;
      const cols = db.prepare(`PRAGMA index_info(${idx.name})`).all().map((c) => c.name);
      return cols.length === 1 && cols[0] === "cloud_id";
    });
    if (hasGlobalCloudIdUnique) {
      db.transaction(() => {
        db.prepare(`CREATE TABLE attendee_types_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          cloud_id TEXT,
          event_id TEXT,
          name TEXT NOT NULL,
          display_name TEXT NOT NULL,
          is_active INTEGER DEFAULT 1,
          can_be_deleted INTEGER DEFAULT 1,
          created_at TEXT,
          updated_at TEXT,
          UNIQUE(cloud_id, event_id)
        )`).run();
        db.prepare(`INSERT OR IGNORE INTO attendee_types_new SELECT * FROM attendee_types`).run();
        db.prepare(`DROP TABLE attendee_types`).run();
        db.prepare(`ALTER TABLE attendee_types_new RENAME TO attendee_types`).run();
      })();
    }
  }

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
      cloud_id TEXT,
      event_id TEXT,
      name TEXT,
      type TEXT,
      width INTEGER DEFAULT 320,
      height INTEGER DEFAULT 450,
      bg_img TEXT DEFAULT '',
      font_family TEXT DEFAULT 'Arial',
      elements TEXT DEFAULT '[]',
      created_at TEXT,
      updated_at TEXT,
      UNIQUE(cloud_id, event_id)
    )`,
  ).run();

  // Migrate badge_templates: if global cloud_id UNIQUE exists, recreate with composite key
  {
    const btIndexes = db.prepare("PRAGMA index_list(badge_templates)").all();
    const hasGlobalCloudIdUnique = btIndexes.some((idx) => {
      if (!idx.unique) return false;
      const cols = db.prepare(`PRAGMA index_info(${idx.name})`).all().map((c) => c.name);
      return cols.length === 1 && cols[0] === "cloud_id";
    });
    if (hasGlobalCloudIdUnique) {
      db.transaction(() => {
        db.prepare(`CREATE TABLE badge_templates_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          cloud_id TEXT,
          event_id TEXT,
          name TEXT,
          type TEXT,
          width INTEGER DEFAULT 320,
          height INTEGER DEFAULT 450,
          bg_img TEXT DEFAULT '',
          font_family TEXT DEFAULT 'Arial',
          elements TEXT DEFAULT '[]',
          created_at TEXT,
          updated_at TEXT,
          UNIQUE(cloud_id, event_id)
        )`).run();
        db.prepare(`INSERT OR IGNORE INTO badge_templates_new SELECT * FROM badge_templates`).run();
        db.prepare(`DROP TABLE badge_templates`).run();
        db.prepare(`ALTER TABLE badge_templates_new RENAME TO badge_templates`).run();
      })();
    }
  }

  db.prepare(
    `CREATE TABLE IF NOT EXISTS registration_forms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cloud_id TEXT,
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
      updated_at TEXT,
      UNIQUE(cloud_id, event_id)
    )`,
  ).run();

  // Migrate registration_forms: if global cloud_id UNIQUE exists, recreate with composite key
  {
    const rfIndexes = db.prepare("PRAGMA index_list(registration_forms)").all();
    const hasGlobalCloudIdUnique = rfIndexes.some((idx) => {
      if (!idx.unique) return false;
      const cols = db.prepare(`PRAGMA index_info(${idx.name})`).all().map((c) => c.name);
      return cols.length === 1 && cols[0] === "cloud_id";
    });
    if (hasGlobalCloudIdUnique) {
      db.transaction(() => {
        db.prepare(`CREATE TABLE registration_forms_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          cloud_id TEXT,
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
          updated_at TEXT,
          UNIQUE(cloud_id, event_id)
        )`).run();
        db.prepare(`INSERT OR IGNORE INTO registration_forms_new SELECT * FROM registration_forms`).run();
        db.prepare(`DROP TABLE registration_forms`).run();
        db.prepare(`ALTER TABLE registration_forms_new RENAME TO registration_forms`).run();
      })();
    }
  }

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
