import 'dotenv/config';

const BASE = process.env.PAPERLESS_URL ?? 'http://localhost:8000';
const TOKEN = process.env.PAPERLESS_TOKEN;

if (!TOKEN) {
  console.error('ERROR: Set PAPERLESS_TOKEN in .env');
  console.error('Get it from Paperless UI → Profile → Token');
  process.exit(1);
}

const headers = { Authorization: `Token ${TOKEN}`, 'Content-Type': 'application/json' };

const TAGS = [
  { name: 'agent:gestor', color: '#e74c3c' },
  { name: 'agent:doctor', color: '#3498db' },
  { name: 'agent:id-docs', color: '#2ecc71' },
  { name: 'type:receipt', color: '#f39c12' },
  { name: 'type:invoice', color: '#e67e22' },
  { name: 'type:medical_report', color: '#9b59b6' },
  { name: 'type:id_document', color: '#1abc9c' },
  { name: 'type:tax_form', color: '#34495e' },
  { name: 'tax:deducible', color: '#27ae60' },
  { name: 'tax:q1', color: '#7f8c8d' },
  { name: 'tax:q2', color: '#7f8c8d' },
  { name: 'tax:q3', color: '#7f8c8d' },
  { name: 'tax:q4', color: '#7f8c8d' },
  { name: 'year:2025', color: '#95a5a6' },
  { name: 'year:2026', color: '#95a5a6' },
];

const CUSTOM_FIELDS = [
  { name: 'amount', data_type: 'monetary' },
  { name: 'amount_iva', data_type: 'monetary' },
  { name: 'tax_category', data_type: 'string' },
  { name: 'nif', data_type: 'string' },
  { name: 'diagnosis', data_type: 'string' },
  { name: 'vendor', data_type: 'string' },
  { name: 'document_date', data_type: 'date' },
];

async function main() {
  console.log(`Configuring Paperless at ${BASE}\n`);

  console.log('--- Creating Tags ---');
  for (const tag of TAGS) {
    const res = await fetch(`${BASE}/api/tags/`, {
      method: 'POST',
      headers,
      body: JSON.stringify(tag),
    });
    const status = res.status === 201 ? 'created' : `skipped (${res.status})`;
    console.log(`  ${tag.name}: ${status}`);
  }

  console.log('\n--- Creating Custom Fields ---');
  for (const field of CUSTOM_FIELDS) {
    const res = await fetch(`${BASE}/api/custom_fields/`, {
      method: 'POST',
      headers,
      body: JSON.stringify(field),
    });
    const status = res.status === 201 ? 'created' : `skipped (${res.status})`;
    console.log(`  ${field.name} (${field.data_type}): ${status}`);
  }

  console.log('\nDone! Paperless is configured for PaperClaw.');
}

main().catch(console.error);
