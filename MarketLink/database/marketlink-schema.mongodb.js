const dbName = 'marketlink';
const target = db.getSiblingDB(dbName);

function createCollection(name, schema, indexes = []) {
  if (target.getCollectionNames().includes(name)) {
    target.runCommand({ collMod: name, validator: { $jsonSchema: schema }, validationLevel: 'moderate' });
  } else {
    target.createCollection(name, { validator: { $jsonSchema: schema }, validationLevel: 'moderate' });
  }
  for (const [keys, options] of indexes) target[name].createIndex(keys, options || {});
  print(`[ok] ${name}`);
}

const objectId = { bsonType: 'objectId' };
const date = { bsonType: 'date' };
const str = (max) => (max ? { bsonType: 'string', maxLength: max } : { bsonType: 'string' });
const num = (min, max) => ({ bsonType: ['double', 'int', 'long', 'decimal'], ...(min !== undefined && { minimum: min }), ...(max !== undefined && { maximum: max }) });
const bool = { bsonType: 'bool' };
const int = (min, max) => ({ bsonType: ['int', 'long', 'double'], minimum: min, maximum: max });
const days = { bsonType: 'array', items: int(0, 6) };
const time = { bsonType: 'string', pattern: '^([01][0-9]|2[0-3]):[0-5][0-9]$' };

// users: customers, farmers (login account) and administrators
createCollection(
  'users',
  {
    bsonType: 'object',
    required: ['name', 'email', 'password', 'role', 'status'],
    properties: {
      name: str(80),
      email: str(120),
      password: { bsonType: 'string', description: 'bcrypt hash' },
      role: { enum: ['customer', 'farmer', 'admin'] },
      phone: { bsonType: 'string', pattern: '^\\+?[0-9 ()-]{7,20}$' },
      address: str(250),
      city: str(60),
      status: { enum: ['active', 'pending', 'suspended', 'inactive'] },
      avatar: str(),
      favoriteFarmers: { bsonType: 'array', items: objectId },
      favoriteProducts: { bsonType: 'array', items: objectId },
      savedMarkets: { bsonType: 'array', items: objectId },
      household: objectId,
      lastLoginAt: date,
      termsAcceptedAt: date,
      termsVersion: str(20),
      createdAt: date,
      updatedAt: date,
    },
  },
  [[{ email: 1 }, { unique: true }], [{ role: 1, status: 1 }]]
);

// farmers: stall profile linked 1:1 to a user with role "farmer"
createCollection(
  'farmers',
  {
    bsonType: 'object',
    required: ['user', 'stallName', 'slug', 'contactPerson', 'phone', 'email', 'address'],
    properties: {
      user: objectId,
      stallName: str(100),
      slug: str(),
      contactPerson: str(),
      phone: str(),
      email: str(),
      address: str(),
      city: str(),
      bio: str(1200),
      tags: { bsonType: 'array', items: str(), description: 'farming practices' },
      categories: { bsonType: 'array', items: objectId, description: 'what the farmer grows / sells' },
      logo: str(),
      coverImage: str(),
      coverCredit: { bsonType: 'object', properties: { author: str(), source: str(), license: str() }, description: 'photographer of the cover photo' },
      latitude: num(-90, 90),
      longitude: num(-180, 180),
      markets: { bsonType: 'array', items: objectId },
      operatingDays: days,
      pickupWindows: {
        bsonType: 'array',
        items: {
          bsonType: 'object',
          required: ['market', 'day', 'start', 'end'],
          properties: { market: objectId, day: int(0, 6), start: time, end: time },
        },
      },
      slotMinutes: num(10, 240),
      slotCapacity: num(1, 100),
      orderCutoffHours: num(0, 168),
      blockedDates: { bsonType: 'array', items: { bsonType: 'string', pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' }, description: 'dates the farmer is not at the market' },
      checkIn: {
        bsonType: 'object',
        description: '"I\'m at the market": the day the farmer checked in and when',
        properties: { date: { bsonType: 'string', pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' }, at: date },
      },
      autoApplyTemplate: bool,
      templateLastAppliedWeek: str(),
      isActive: bool,
      ratingAvg: num(0, 5),
      ratingCount: num(0),
      createdAt: date,
      updatedAt: date,
    },
  },
  [[{ user: 1 }, { unique: true }], [{ slug: 1 }, { unique: true }], [{ isActive: 1 }], [{ markets: 1 }], [{ operatingDays: 1 }]]
);

// cities: the city dropdowns (markets, farmers, filters) come from this table
createCollection(
  'cities',
  {
    bsonType: 'object',
    required: ['name', 'slug'],
    properties: {
      name: str(60),
      slug: str(),
      province: str(60),
      latitude: num(-90, 90),
      longitude: num(-180, 180),
      isActive: bool,
      sortOrder: num(),
      createdAt: date,
      updatedAt: date,
    },
  },
  [[{ name: 1 }, { unique: true }], [{ slug: 1 }, { unique: true }]]
);

// markets: farmers markets / pickup points shown on the map
createCollection(
  'markets',
  {
    bsonType: 'object',
    required: ['name', 'slug', 'address', 'latitude', 'longitude'],
    properties: {
      name: str(100),
      slug: str(),
      description: str(1000),
      address: str(),
      city: str(),
      categories: { bsonType: 'array', items: objectId, description: 'what is sold at the market' },
      latitude: num(-90, 90),
      longitude: num(-180, 180),
      mapProvider: { enum: ['openstreetmap', 'google'] },
      mapLink: str(),
      operatingDays: days,
      openTime: time,
      closeTime: time,
      image: str(),
      imageCredit: { bsonType: 'object', properties: { author: str(), source: str(), license: str() }, description: 'photographer of the market photo' },
      isActive: bool,
      createdAt: date,
      updatedAt: date,
    },
  },
  [[{ slug: 1 }, { unique: true }], [{ isActive: 1, city: 1 }], [{ categories: 1 }]]
);

// categories: master data managed by the admin
createCollection(
  'categories',
  {
    bsonType: 'object',
    required: ['name', 'slug'],
    properties: { name: str(60), nameUr: str(60), slug: str(), description: str(300), icon: str(), color: str(), sortOrder: num(), isActive: bool, createdAt: date, updatedAt: date },
  },
  [[{ name: 1 }, { unique: true }], [{ slug: 1 }, { unique: true }]]
);

// assistantchats: the AI assistant's saved conversation and memory for a signed-in user
createCollection(
  'assistantchats',
  {
    bsonType: 'object',
    required: ['user'],
    properties: {
      user: objectId,
      messages: {
        bsonType: 'array',
        items: { bsonType: 'object', required: ['from', 'text'], properties: { from: { enum: ['me', 'bot'] }, text: str(4000), cards: { bsonType: 'array' }, at: date } },
      },
      memory: { bsonType: 'object' },
    },
  },
  [[{ user: 1 }, { unique: true }]]
);

// products: weekly stock of a farmer
createCollection(
  'products',
  {
    bsonType: 'object',
    required: ['farmer', 'name', 'category', 'price'],
    properties: {
      farmer: objectId,
      name: str(100),
      slug: str(),
      category: objectId,
      price: num(0),
      compareAtPrice: { ...num(0), description: 'usual price while the product is on offer' },
      offerEndsAt: { ...date, description: 'last moment of the offer; the usual price comes back after it' },
      unit: { enum: ['kg', 'g', 'lb', 'dozen', 'piece', 'bunch', 'litre', 'pack', 'jar', 'loaf', 'box'] },
      quantityAvailable: num(0),
      // how customers buy it: by weight (grams of a kg / ml of a litre), the smallest amount (= the step), the most per order
      sellByWeight: bool,
      minQuantity: num(0.01),
      maxPerOrder: num(0),
      templateQuantity: num(0),
      lowStockThreshold: num(0, 100000),
      lowStockAlertedAt: date,
      soldOutAlertedAt: date,
      description: str(1500),
      nameUr: str(100),
      aiSchema: { bsonType: 'object', properties: { summary: str(300), season: str(80), storage: str(200), uses: str(200), source: { enum: ['claude', 'builtin', 'farmer'] }, generatedAt: date }, description: 'product schema details written by AI' },
      metaTitle: str(70), // SEO title (optional)
      metaDescription: str(170), // SEO description (optional)
      keywords: { bsonType: 'array', items: str(40) }, // SEO keywords, also used by the search
      image: str(),
      imageCredit: { bsonType: 'object', properties: { author: str(), source: str(), license: str() } },
      gallery: {
        bsonType: 'array',
        maxItems: 4,
        items: { bsonType: 'object', required: ['url'], properties: { url: str(), credit: { bsonType: 'object', properties: { author: str(), source: str(), license: str() } } } },
      },
      status: { enum: ['available', 'sold_out', 'unavailable'] },
      isRemoved: bool,
      removedReason: str(),
      deletedByFarmer: bool,
      markets: { bsonType: 'array', items: objectId },
      days,
      farmerActive: bool,
      ratingAvg: num(0, 5),
      ratingCount: num(0),
      totalSold: num(0),
      createdAt: date,
      updatedAt: date,
    },
  },
  [[{ farmer: 1, isRemoved: 1 }], [{ slug: 1 }], [{ category: 1, price: 1 }], [{ markets: 1 }], [{ days: 1 }]]
);

// orders: one pre-order = one farmer + one pickup slot (items are embedded)
createCollection(
  'orders',
  {
    bsonType: 'object',
    required: ['orderNumber', 'customer', 'farmer', 'market', 'items', 'totalAmount', 'pickupDate', 'pickupSlot', 'pickupAt', 'cutoffAt', 'status'],
    properties: {
      orderNumber: str(),
      customer: objectId,
      farmer: objectId,
      market: objectId,
      items: {
        bsonType: 'array',
        minItems: 1,
        items: {
          bsonType: 'object',
          required: ['product', 'name', 'price', 'quantity', 'subtotal'],
          properties: { product: objectId, name: str(), nameUr: str(), image: str(), unit: str(), price: num(0), quantity: num(0.01), step: num(0.01), maxPerOrder: num(0), subtotal: num(0) },
        },
      },
      totalAmount: num(0),
      pickupDate: { bsonType: 'string', pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' },
      pickupSlot: { bsonType: 'object', required: ['start', 'end'], properties: { start: time, end: time } },
      pickupAt: date,
      cutoffAt: date,
      status: { enum: ['placed', 'accepted', 'ready', 'completed', 'declined', 'cancelled'] },
      statusHistory: {
        bsonType: 'array',
        items: { bsonType: 'object', properties: { status: str(), at: date, by: str(), note: str() } },
      },
      customerNote: str(500),
      placedBy: { enum: ['customer', 'admin'] },
      farmerNote: str(500),
      paymentMethod: { enum: ['pay_at_pickup'] },
      completedAt: date,
      // the customer's answer to "Did you receive your order?" after the farmer marks it complete
      receipt: { bsonType: 'object', properties: { status: { enum: ['received', 'not_received'] }, note: str(500), at: date } },
      // pickup problem after "not received": a new pickup, the farmer's answer, the admin's decision
      issue: {
        bsonType: 'object',
        properties: {
          status: { enum: ['open', 'new_pickup', 'disputed', 'resolved'] },
          reason: str(40),
          note: str(500),
          openedAt: date,
          timesReported: num(0),
          resolution: { enum: ['received', 'collected_after_new_pickup', 'cancelled', 'farmer_right'] },
          resolvedAt: date,
          resolvedBy: str(20),
          history: { bsonType: 'array', items: { bsonType: 'object', properties: { at: date, by: str(20), action: str(40), note: str(600) } } },
        },
      },
      createdAt: date,
      updatedAt: date,
    },
  },
  [[{ orderNumber: 1 }, { unique: true }], [{ customer: 1, createdAt: -1 }], [{ farmer: 1, status: 1, pickupDate: 1 }], [{ market: 1 }], [{ 'issue.status': 1 }]]
);

// reviews: ratings for a product or a farmer; verified = tied to the customer's completed order
createCollection(
  'reviews',
  {
    bsonType: 'object',
    required: ['type', 'farmer', 'customer', 'rating'],
    properties: {
      type: { enum: ['product', 'farmer'] },
      product: objectId,
      farmer: objectId,
      customer: objectId,
      order: objectId,
      verified: bool,
      rating: int(1, 5),
      comment: str(1000),
      response: { bsonType: 'object', properties: { text: str(1000), at: date } },
      isRemoved: bool,
      removedReason: str(),
      createdAt: date,
      updatedAt: date,
    },
  },
  [[{ product: 1, isRemoved: 1 }], [{ farmer: 1, isRemoved: 1 }], [{ customer: 1, order: 1 }]]
);

// notifications: in-app alerts (order updates, restock and low-stock alerts, reviews, moderation, announcements)
createCollection(
  'notifications',
  {
    bsonType: 'object',
    required: ['user', 'title', 'message'],
    properties: {
      user: objectId,
      type: { enum: ['order', 'restock', 'stock', 'announcement', 'review', 'account', 'moderation', 'system'] },
      title: str(),
      message: str(),
      link: str(),
      read: bool,
      createdAt: date,
      updatedAt: date,
    },
  },
  [[{ user: 1, read: 1, createdAt: -1 }]]
);

// announcements: platform-wide notices published by the admin
createCollection(
  'announcements',
  {
    bsonType: 'object',
    required: ['title', 'message'],
    properties: {
      title: str(120),
      message: str(1000),
      titleUr: str(160), // the notice in Urdu (optional)
      messageUr: str(1200),
      audience: { enum: ['all', 'customer', 'farmer'] },
      months: { bsonType: 'array', items: int(1, 12) }, // empty = all year; otherwise shown only in these months
      link: str(200),
      isActive: bool,
      createdBy: objectId,
      createdAt: date,
      updatedAt: date,
    },
  }
);

// reports: saved snapshots of generated admin reports
createCollection(
  'reports',
  {
    bsonType: 'object',
    required: ['generatedBy', 'reportType'],
    properties: {
      generatedBy: objectId,
      reportType: {
        enum: ['platform_overview', 'orders_summary', 'revenue_by_market', 'top_farmers', 'sales_by_category', 'customer_activity', 'inventory_status', 'city_overview', 'reviews_moderation'],
      },
      title: str(),
      from: date,
      to: date,
      data: { bsonType: 'object' },
      generatedAt: date,
    },
  }
);

// subscribers: newsletter sign-ups (weekly harvest e-mail); the token is used for the unsubscribe link
createCollection(
  'subscribers',
  {
    bsonType: 'object',
    required: ['email'],
    properties: {
      email: str(120),
      name: str(80),
      source: { enum: ['home', 'footer', 'checkout', 'admin'] },
      status: { enum: ['subscribed', 'unsubscribed'] },
      token: str(),
      unsubscribedAt: date,
      createdAt: date,
      updatedAt: date,
    },
  },
  [[{ email: 1 }, { unique: true }], [{ token: 1 }]]
);

// faqs: frequently asked questions (FAQ page, home page block and FAQPage structured data)
createCollection(
  'faqs',
  {
    bsonType: 'object',
    required: ['question', 'answer'],
    properties: {
      question: str(200),
      answer: str(1500),
      questionUr: str(300), // the question and answer in Urdu (optional)
      answerUr: str(2500),
      group: { enum: ['shopping', 'pickup', 'farmers', 'account'] },
      order: num(),
      showOnHome: bool,
      isActive: bool,
      createdAt: date,
      updatedAt: date,
    },
  },
  [[{ isActive: 1, group: 1, order: 1 }]]
);

// contactmessages: messages sent from the Contact Us page
createCollection(
  'contactmessages',
  {
    bsonType: 'object',
    required: ['name', 'email', 'message'],
    properties: {
      name: str(80),
      email: str(120),
      subject: str(150),
      // optional drop-down on the contact page
      topic: { enum: ['market_request', 'market_complaint', 'farmer_complaint', 'order_help', 'selling', 'feedback', 'other'] },
      message: str(2000),
      status: { enum: ['new', 'read'] },
      createdAt: date,
      updatedAt: date,
    },
  }
);

// stockmovements: inventory log, every change to a product's stock (pre-orders, cancellations,
// the weekly template and the farmer's own adjustments)
createCollection(
  'stockmovements',
  {
    bsonType: 'object',
    required: ['farmer', 'product', 'productName', 'change', 'quantityAfter', 'type'],
    properties: {
      farmer: objectId,
      product: objectId,
      productName: str(),
      unit: str(),
      change: num(),
      quantityAfter: num(0),
      type: { enum: ['initial', 'restock', 'adjustment', 'waste', 'stall_sale', 'correction', 'template', 'order_reserved', 'order_released', 'order_changed'] },
      reason: str(200),
      order: objectId,
      orderNumber: str(),
      by: { enum: ['farmer', 'customer', 'admin', 'system'] },
      createdAt: date,
      updatedAt: date,
    },
  },
  [[{ farmer: 1, createdAt: -1 }], [{ product: 1, createdAt: -1 }]]
);

// contentflags: content moderation queue (reports by users and reviews held by the word filter)
createCollection(
  'contentflags',
  {
    bsonType: 'object',
    required: ['targetType', 'reason'],
    properties: {
      targetType: { enum: ['review', 'product', 'farmer'] },
      review: objectId,
      product: objectId,
      farmer: objectId,
      reason: { enum: ['spam', 'offensive', 'misleading', 'wrong_info', 'other', 'auto_language'] },
      note: str(500),
      reporter: objectId,
      status: { enum: ['open', 'resolved', 'dismissed'] },
      action: { enum: ['none', 'removed', 'restored', 'suspended'] },
      resolutionNote: str(300),
      resolvedBy: objectId,
      resolvedAt: date,
      createdAt: date,
      updatedAt: date,
    },
  },
  [[{ status: 1, createdAt: -1 }], [{ targetType: 1, review: 1, product: 1, farmer: 1 }]]
);

// restockrequests: "Remind me when it is available" on a sold-out product (customer or guest e-mail)
createCollection(
  'restockrequests',
  {
    bsonType: 'object',
    required: ['product', 'email'],
    properties: { product: objectId, user: objectId, email: str(120), createdAt: date, updatedAt: date },
  },
  [[{ product: 1, email: 1 }, { unique: true }]]
);

// marketdaylogs: one line per farmer and market day: came (checked in) or could not come, with the reason
createCollection(
  'marketdaylogs',
  {
    bsonType: 'object',
    required: ['farmer', 'date', 'status'],
    properties: {
      farmer: objectId,
      date: str(10),
      status: { enum: ['here', 'away'] },
      reason: { enum: ['sick', 'transport', 'weather', 'harvest', 'family', 'other', 'closed_date'] },
      note: str(300),
      at: date,
      ordersAffected: num(0),
    },
  },
  [[{ farmer: 1, date: 1 }, { unique: true }], [{ date: 1, status: 1 }]]
);

// sitebanners: banners the admin edits (the "Up to 30% off" offer banner on the home page, key "home-offer")
createCollection(
  'sitebanners',
  {
    bsonType: 'object',
    required: ['key'],
    properties: {
      key: str(40),
      isActive: bool,
      percent: num(0, 90),
      autoPercent: bool,
      tag: str(40),
      tagUr: str(60),
      title: str(90),
      titleUr: str(120),
      text: str(220),
      textUr: str(300),
      buttonLabel: str(30),
      buttonLabelUr: str(40),
      link: str(200),
      image: str(),
      updatedBy: objectId,
      createdAt: date,
      updatedAt: date,
    },
  },
  [[{ key: 1 }, { unique: true }]]
);

print(`\nDatabase "${dbName}" is ready. Now run "npm run seed" inside /server to insert demo data.`);
