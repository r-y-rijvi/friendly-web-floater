export type Lang = "en" | "bn";

const strings = {
  appTitle: { en: "Tender Package Builder", bn: "টেন্ডার প্যাকেজ বিল্ডার" },
  appSubtitle: {
    en: "Turn your PDF files into one complete, checked and correctly ordered tender package.",
    bn: "আপনার পিডিএফ ফাইলগুলোকে একটিমাত্র সম্পূর্ণ, যাচাইকৃত ও সঠিক ক্রমে সাজানো টেন্ডার প্যাকেজে পরিণত করুন।",
  },
  step1: { en: "1. Load requirements", bn: "১. প্রয়োজনীয় তালিকা লোড করুন" },
  step1Hint: {
    en: "Open the requirements.json file from the tender pack.",
    bn: "টেন্ডার প্যাক থেকে requirements.json ফাইলটি খুলুন।",
  },
  step2: { en: "2. Upload PDF files", bn: "২. পিডিএফ ফাইল আপলোড করুন" },
  step2Hint: {
    en: "Upload up to 30 PDF files (max 50 MB total).",
    bn: "সর্বোচ্চ ৩০টি পিডিএফ ফাইল আপলোড করুন (মোট সর্বোচ্চ ৫০ এমবি)।",
  },
  step3: { en: "3. Match & check", bn: "৩. মিলিয়ে নিন ও যাচাই করুন" },
  step3Hint: {
    en: "Match each file to a required document and enter expiry dates where needed.",
    bn: "প্রতিটি ফাইল প্রয়োজনীয় ডকুমেন্টের সাথে মিলিয়ে নিন এবং প্রয়োজনে মেয়াদের তারিখ দিন।",
  },
  step4: { en: "4. Generate package", bn: "৪. প্যাকেজ তৈরি করুন" },
  chooseFile: { en: "Choose requirements.json", bn: "requirements.json বাছুন" },
  addPdfs: { en: "Add PDF files", bn: "পিডিএফ যোগ করুন" },
  tenderDetails: { en: "Tender details", bn: "টেন্ডারের বিবরণ" },
  tenderId: { en: "Tender ID", bn: "টেন্ডার আইডি" },
  title: { en: "Title", bn: "শিরোনাম" },
  procuringEntity: { en: "Procuring entity", bn: "ক্রয়কারী প্রতিষ্ঠান" },
  bidder: { en: "Bidder", bn: "দরদাতা" },
  deadline: { en: "Submission deadline", bn: "জমা দেওয়ার শেষ তারিখ" },
  uploadedFiles: { en: "Uploaded files", bn: "আপলোড করা ফাইল" },
  noFiles: { en: "No files uploaded yet.", bn: "এখনও কোনো ফাইল আপলোড হয়নি।" },
  pages: { en: "pages", bn: "পৃষ্ঠা" },
  remove: { en: "Remove", bn: "মুছুন" },
  duplicate: { en: "Duplicate", bn: "সদৃশ" },
  duplicateOf: { en: "Same content as", bn: "একই বিষয়বস্তু:" },
  badFile: { en: "Cannot read this PDF (damaged or protected).", bn: "এই পিডিএফ পড়া যাচ্ছে না (ক্ষতিগ্রস্ত বা পাসওয়ার্ড-সুরক্ষিত)।" },
  notPdf: { en: "is not a PDF and was rejected.", bn: "পিডিএফ নয়, তাই বাতিল করা হয়েছে।" },
  tooMany: { en: "Too many files (max 30).", bn: "অতিরিক্ত ফাইল (সর্বোচ্চ ৩০টি)।" },
  tooBig: { en: "Total size exceeds 50 MB.", bn: "মোট আকার ৫০ এমবি অতিক্রম করেছে।" },
  requirements: { en: "Required documents", bn: "প্রয়োজনীয় ডকুমেন্টসমূহ" },
  mandatory: { en: "Mandatory", bn: "বাধ্যতামূলক" },
  optional: { en: "Optional", bn: "ঐচ্ছিক" },
  matchFile: { en: "Match a file…", bn: "ফাইল বাছুন…" },
  none: { en: "— None —", bn: "— কিছু নয় —" },
  expiryDate: { en: "Expiry date", bn: "মেয়াদের তারিখ" },
  status_missing: { en: "Missing", bn: "অনুপস্থিত" },
  status_expiry_needed: { en: "Expiry date needed", bn: "মেয়াদের তারিখ প্রয়োজন" },
  status_expired: { en: "Expired", bn: "মেয়াদোত্তীর্ণ" },
  status_not_provided: { en: "Not provided", bn: "দেওয়া হয়নি" },
  status_ok: { en: "OK", bn: "ঠিক আছে" },
  generate: { en: "Generate package PDF", bn: "প্যাকেজ পিডিএফ তৈরি করুন" },
  generating: { en: "Generating…", bn: "তৈরি হচ্ছে…" },
  blockedBecause: {
    en: "Fix these before generating:",
    bn: "তৈরি করার আগে এগুলো ঠিক করুন:",
  },
  ready: {
    en: "All checks passed. You can generate the package.",
    bn: "সব যাচাই সম্পন্ন। এখন প্যাকেজ তৈরি করতে পারেন।",
  },
  includeIndex: { en: "Include index page", bn: "সূচিপত্র পৃষ্ঠা যোগ করুন" },
  loadFirst: {
    en: "Load requirements.json first.",
    bn: "প্রথমে requirements.json লোড করুন।",
  },
  invalidJson: {
    en: "That file is not a valid requirements.json.",
    bn: "ফাইলটি সঠিক requirements.json নয়।",
  },
  coverTitle: { en: "Cover preview", bn: "প্রচ্ছদ প্রিভিউ" },
} as const;

export type StringKey = keyof typeof strings;

export function t(lang: Lang, key: StringKey): string {
  return strings[key][lang];
}
