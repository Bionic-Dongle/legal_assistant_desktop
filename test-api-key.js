/**
 * API Key Diagnostic Tool
 * Run this with: node test-api-key.js
 */

const Database = require('better-sqlite3');
const path = require('path');

// Open the database
const dbPath = path.join(__dirname, 'data', 'legal_assistant.db');
console.log('📂 Database path:', dbPath);

try {
  const db = new Database(dbPath);

  // Get all settings
  console.log('\n📋 All settings in database:');
  const allSettings = db.prepare('SELECT key, value FROM settings').all();

  allSettings.forEach(setting => {
    if (setting.key.toLowerCase().includes('openai')) {
      console.log(`\n🔑 ${setting.key}:`);
      console.log(`   Length: ${setting.value.length} characters`);
      console.log(`   Starts with: ${setting.value.substring(0, 20)}...`);
      console.log(`   Ends with: ...${setting.value.substring(setting.value.length - 10)}`);
      console.log(`   Has whitespace at start: ${setting.value[0] !== setting.value.trim()[0]}`);
      console.log(`   Has whitespace at end: ${setting.value[setting.value.length - 1] !== setting.value.trim()[setting.value.length - 1]}`);
      console.log(`   Trimmed length: ${setting.value.trim().length}`);

      // Check for invisible characters
      const invisibleChars = [];
      for (let i = 0; i < setting.value.length; i++) {
        const code = setting.value.charCodeAt(i);
        if (code < 32 || code === 127 || code === 160) {
          invisibleChars.push({ pos: i, code, char: String.fromCharCode(code) });
        }
      }
      if (invisibleChars.length > 0) {
        console.log(`   ⚠️ Found invisible characters:`, invisibleChars);
      }
    } else {
      console.log(`   ${setting.key}: ${setting.value.substring(0, 30)}${setting.value.length > 30 ? '...' : ''}`);
    }
  });

  // Test the exact retrieval logic used by the app
  console.log('\n🔍 Testing app retrieval logic:');
  const found = allSettings.find(s => s.key.toLowerCase().includes("openai"));
  const apiKey = found?.value?.trim();

  console.log('   Found key:', found?.key);
  console.log('   Key length after trim:', apiKey?.length);
  console.log('   First 20 chars:', apiKey?.substring(0, 20));

  // Now test if this key works with OpenAI
  console.log('\n🚀 Testing API key with OpenAI...');
  testOpenAI(apiKey);

  db.close();
} catch (error) {
  console.error('❌ Error:', error.message);
}

async function testOpenAI(apiKey) {
  if (!apiKey) {
    console.log('   ❌ No API key found');
    return;
  }

  try {
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey });

    console.log('   Making test request to OpenAI...');
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Say "test successful"' }],
      max_tokens: 10
    });

    console.log('   ✅ Success! Response:', completion.choices[0].message.content);
  } catch (error) {
    console.log('   ❌ Failed:', error.status, error.message);
  }
}
