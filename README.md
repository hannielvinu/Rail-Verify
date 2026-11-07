# RailVerify

A working railway catering prototype by **Hanniel Vinu A**, team **Crack The Puzzle**, UID **127373**.

## Run locally

Use Node.js 22.13 or newer (Node 24 LTS recommended).

```sh
npm ci
npm start
```

Open `http://127.0.0.1:4317`. The app serves its fonts locally. The English OCR model is installed with the dependencies, so server-side OCR needs no external inference API.

## A two-minute demo

1. Click **Try the ₹150 meal example**. Confirm the standard Mail/Express vegetarian meal and see the ₹80 tariff and ₹70 difference with the official source.
2. Upload `public/assets/sample-bill.png`. Actual Tesseract OCR reads this clearly labeled fictional bill. Confirm the suggested fields and check the purchase.
3. Choose bottled water, one litre, ₹20. Rail Neer has a ₹14 reference MRP under CC 18/2025, producing a ₹6 comparison.
4. Prepare a report, enter a five-digit train number, optionally add the actual vendor reference and a consented location, and approve storage. Download the evidence summary. The official portal link opens RailMadad for its separate filing process.
5. Open **Compliance desk**. The initial dataset is clearly labeled illustrative. Switch to **Local reports** and use the configured access key to see consented records created through the app.
6. After the first online visit and service-worker activation, switch the browser offline. Text tariff comparisons still work. A consented draft saves on the device and synchronizes with the server when connectivity returns, using an idempotent request ID.

## What works

- Responsive passenger and dashboard interfaces, using local Manrope and Space Grotesk fonts.
- Meal and water price comparisons with quantity support, explicit source links and manual-review outcomes for unsupported services or brands.
- Actual bill OCR for JPG, PNG and WebP up to 5 MB. Suggestions require passenger confirmation. Photos are not stored in the reports database.
- Regional interface labels and answer text in English, Hindi and Tamil. Spoken answers use installed browser/device voices. If no matching voice is installed, the app explains that and keeps the text available.
- Consented report creation, optional geolocation, SQLite persistence, evidence downloads and official RailMadad handoff.
- Dashboard access control, filters, train aggregates, and CSV export. Sample records remain separate from local reports.
- Offline text verification and a retry-safe local report queue after the first online load.
- Meta WhatsApp webhook verification, signature checks, message deduplication, text commands, bill-image OCR and a report-consent flow. Live messages require your Meta credentials and a reachable HTTPS endpoint.

## Configure WhatsApp

Copy `.env.example` to `.env`. Set `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, and `WHATSAPP_APP_SECRET` from your own Meta application. Keep `.env` private. Review `WHATSAPP_API_VERSION` against the version supported by your Meta app.

Expose `/webhooks/whatsapp` at a reachable HTTPS URL. Configure it in Meta with your verification token and subscribe to messages. The webhook validates the `X-Hub-Signature-256` HMAC against the raw request body.

Supported commands include `VEG 150 MAIL`, `EGG 100 MAIL`, `CHICKEN 150 MAIL`, `BREAKFAST 50 MAIL`, `WATER 20`, and `WATER500 10`. Meal commands require confirmation that the purchase is a standard separately sold Mail/Express item. To prepare a local report after a check, send `REPORT 12622`, then `CONFIRM`, or `CANCEL`.

Use Meta's approved test recipients while developing. Deploy on a persistent Node host for this SQLite version and configure HTTPS, durable disk and a strong admin token. The local default key is `railverify-local-demo`. The app binds to loopback by default and rejects explicit non-loopback binding without a configured admin token. Use `HOST`, `PORT`, and optionally `DATABASE_PATH` for deployment configuration.

## Verification boundaries

RailVerify checks confirmed purchase details against a limited published reference set. A tray image alone cannot prove payment, and a bottle photo cannot establish authenticity or water quality. The water comparison supports Rail Neer sizes; another brand triggers manual review because this prototype has no authoritative current route-specific approval registry.

A local report is **not an official grievance**. The app does not claim an official RailMadad API connection, anonymous official reporting, guaranteed passenger safety, refunds or enforcement. RailMadad may request OTP, PNR or other journey details. A train number alone cannot identify a vendor, so vendor attribution stays optional and requires an actual reference.

The dashboard aggregates only the selected records. Report counts are not estimates of prevalence. A proposed future paid service needs buyer validation and railway approval.

The public prototype does not retain uploaded bill images. Consented local reports can contain the free-text details and optional coordinates the passenger supplies. Use a retention policy, encrypted storage/backups and appropriate access controls before a real passenger pilot.

## Tests

```sh
npm test
```

Tests cover tariff boundaries, ambiguous purchases, OCR text interpretation, consent, persistence, duplicate and conflicting requests, dashboard authorization, webhook signatures and WhatsApp report confirmation. The pitch package records additional browser checks using the actual OCR model, offline mode, geolocation, downloads, dashboard filtering, and mobile layouts.

## Sources

- [Railway Board published menu and tariff reference](https://indianrailways.gov.in/railwayboard/uploads/directorate/coaching/TAG_2023-24/Menu_Meals.pdf)
- [Rail Neer / shortlisted packaged water MRP, CC 18/2025](https://rb.indianrailways.gov.in/uploads/directorate/traffic_comm/Comm_Cir_2025/MRP%20of%20Rail%20Neer%20Shortlisted%20packaged%20drinking%20water%20.pdf)
- [Official RailMadad complaint form](https://railmadad.indianrailways.gov.in/madad/final/ComplaintOnTrain.jsp)
- [Lok Sabha reply, 25 March 2026](https://sansad.in/getFile/loksabhaquestions/annex/187/AU5506_SeGOEw.pdf?source=pqals)
- [Tesseract.js](https://github.com/naptha/tesseract.js)
- [Meta WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api/)

Fonts are distributed under the SIL Open Font License. Their licenses are retained in `public/fonts/`. Tesseract.js and its English data package retain their upstream package licenses. The sample receipt is fictional and created for this project.
